/* Talking to the Apps Script backend: {action, token, request_id, payload} as text/plain JSON
   (text/plain avoids the CORS preflight that Apps Script does not support).
   A network failure is retried once with the SAME request_id, so a save is never done twice. */
(function () {
  const MS = (window.MS = window.MS || {});
  const TIMEOUT_MS = 90000;

  const uuid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2));

  function ApiError(res) {
    const e = new Error(res.message || 'Something went wrong.');
    e.code = res.error_code || 'ERROR';
    e.details = res.details;
    return e;
  }

  /* Sends one request. Says WHY it failed, in plain words, and logs the technical detail to the console:
     offline / timeout / the browser refused the request (CORS, a blocked redirect or a body the browser would not send) /
     HTTP error / a reply that is not the app's JSON (Google's own error page). `opts.timeout` is in ms. */
  async function send(body, opts) {
    opts = opts || {};
    const cfg = window.APP_CONFIG || {};
    const url = cfg.SCRIPT_URL;
    if (!url || (url.indexOf('/exec') < 0 && !cfg.DEV)) throw ApiError({ error_code: 'NOT_CONFIGURED', message: 'Add your Apps Script Web App URL in js/config.js first.' });
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), opts.timeout || TIMEOUT_MS) : null;
    const big = opts.big ? ' A very large file can be the cause: try a smaller one (compress the PDF or reduce the picture size).' : '';
    let res;
    try {
      res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined });
    } catch (e) {
      const timedOut = e && e.name === 'AbortError';
      try { console.warn('[MS] request failed before any reply', { action: body.action, error: String(e), online: navigator.onLine, timedOut }); } catch (x) { /* no console */ }
      const err = ApiError({ error_code: timedOut ? 'TIMEOUT' : 'NETWORK', message: timedOut ? 'The server took too long to answer, so the request was stopped.' + (opts.big ? ' The file may be too large for this connection. Try a smaller file or a better connection.' : ' Please try again.')
        : navigator.onLine === false ? 'You are offline. Connect to the internet and try again.'
          : 'The request did not reach the server, or the server refused it.' + big + ' Check your connection and try again. If it keeps happening, tell the system administrator.' });
      err.retry = !opts.noRetry;
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }
    let text = '';
    try { text = await res.text(); } catch (e) { /* handled below */ }
    try { return JSON.parse(text); } catch (e) {
      const snippet = String(text).replace(/\s+/g, ' ').slice(0, 300);
      try { console.warn('[MS] the server reply was not JSON', { action: body.action, status: res.status, snippet }); } catch (x) { /* no console */ }
      const code = res.status === 413 ? 'TOO_LARGE' : 'BAD_REPLY';
      throw ApiError({ error_code: code, message: res.status === 413 ? 'The file is too large for the server.' + big
        : 'The server sent a reply the app cannot read (HTTP ' + res.status + ').' + big + ' Please try again; if it keeps happening, tell the system administrator and check that the Web App is deployed with access set to "Anyone" and the newest version.' });
    }
  }
  MS.send = send;

  // actions that only read; any other successful call may have changed data, so the saved copies are dropped
  const READ = /(_LIST|_GET|_SEARCH|_ME|_TABLES)$/;

  /* The server stamps every answer with a "rights version" that moves whenever roles, permissions or accounts change.
     When it moves, ask who I am again at once; if my permissions differ, reload so every button matches them. */
  let checking = false;
  function watchRights(v) {
    const s = MS.store.read();
    if (!s) return;
    if (!s.perm_v) { MS.store.update({ perm_v: v }); return; }
    if (s.perm_v === v || checking) return;
    MS.store.update({ perm_v: v });
    MS.refreshMe(true);
  }
  MS.refreshMe = function (reloadIfChanged) {
    if (checking) return Promise.resolve();
    checking = true;
    return MS.call('AUTH_ME').then((me) => {
      const fresh = Object.assign({}, MS.user, me);
      const changed = JSON.stringify(fresh.permissions) !== JSON.stringify(MS.user && MS.user.permissions);
      MS.store.update({ me_at: Date.now(), unread: me.unread_notifications || 0, unread_messages: me.unread_messages || 0, user: fresh });
      MS.user = fresh;
      if (changed) MS.store.dropCache(); // saved screens carry the old buttons
      if (changed && reloadIfChanged) location.reload();
      return me;
    }).catch(() => {}).finally(() => { checking = false; });
  };

  /** MS.call('JOB_LIST', {...}) resolves to the data, or throws an Error with .code */
  MS.call = async function (action, payload, opts) {
    const s = MS.store.read();
    const body = { action, token: s ? s.token : '', request_id: uuid(), payload: payload || {} };
    const fromDialog = !READ.test(action) && !!document.querySelector('dialog[open]:not(.imdlg)');   // a form was saved: say so with a toast
    let out;
    try { out = await send(body, opts); } catch (e) {
      if (!e.retry) throw e;
      await new Promise((ok) => setTimeout(ok, 1500));
      out = await send(body, opts);
    }
    if (out.success) {
      if (!READ.test(action)) MS.store.dropCache();
      if (out.perm_v) watchRights(out.perm_v);
      if (fromDialog && MS.toast && out.message && out.message !== 'OK') MS.toast(out.message);
      return out.data;
    }
    if (out.error_code === 'USE_POST') {
      throw ApiError({ error_code: 'USE_POST', message: 'The server received this request without its data. In Apps Script open Deploy > Manage deployments > Edit, set "Who has access" to "Anyone" and deploy a new version.' });
    }
    if (['AUTH_REQUIRED', 'SESSION_EXPIRED', 'ACCOUNT_INACTIVE'].indexOf(out.error_code) >= 0 && action !== 'AUTH_LOGIN' && action !== 'AUTH_GOOGLE' && action !== 'PASSKEY_LOGIN') {
      MS.signOut(out.message || 'Your session has ended. Please sign in again.');
    }
    if (out.error_code === 'PASSWORD_CHANGE_REQUIRED' && !document.getElementById('loginForm')) location.replace('index.html?change=1');
    throw ApiError(out);
  };

  /* Like MS.call for reads, but answers at once with the copy saved on the last visit (this tab only), then asks the
     server again in the background. If the answer changed, MS.reload() runs so the page draws the new data. */
  const reloadOnce = {};
  MS.recall = async function (action, payload) {
    const key = (MS.user ? MS.user.user_id : '') + ':' + action + ':' + JSON.stringify(payload || {});
    const hit = MS.store.readCache(key);
    if (hit !== null && reloadOnce[key]) { delete reloadOnce[key]; return hit; }
    if (hit !== null) {
      MS.call(action, payload).then((d) => {
        const changed = JSON.stringify(d) !== JSON.stringify(hit);
        MS.store.saveCache(key, d);
        if (changed && MS.reload) { reloadOnce[key] = 1; MS.reload(); }
      }).catch(() => {});
      return hit;
    }
    const data = await MS.call(action, payload);
    MS.store.saveCache(key, data);
    return data;
  };

  MS.can = (code) => !!(MS.user && MS.user.permissions && MS.user.permissions[code]);
  MS.canAny = (codes) => codes.some(MS.can);

  MS.signOut = function (msg) {
    const s = MS.store.read();
    if (s && s.token && !msg) MS.call('AUTH_LOGOUT').catch(() => {});
    MS.store.clear();
    MS.session = null;
    location.replace('index.html' + (msg ? '?msg=' + encodeURIComponent(msg) : ''));
  };

  /* reference lists (departments, positions, Job Locations, employees, statuses, dropdown values), kept for the visit */
  MS.ref = async function (force) {
    if (MS.refCache && !force) return MS.refCache;
    const cached = !force && MS.store.readRef();
    if (cached) { MS.refCache = cached; return cached; }
    MS.refCache = await MS.call('REF_GET');
    MS.store.saveRef(MS.refCache);
    return MS.refCache;
  };
  MS.enumOf = (key) => (MS.refCache && MS.refCache.enums && MS.refCache.enums[key]) || [];
  MS.employeeName = (id) => { const e = MS.refCache && MS.refCache.employees.find((x) => x.employee_id === id); return e ? e.name : ''; };
  MS.employeeOptions = (selected, blank) => MS.options((MS.refCache ? MS.refCache.employees : []).map((e) => ({ value: e.employee_id, label: e.name + ' (' + e.employee_number + ')' })), selected, blank === undefined ? '— none —' : blank);
  MS.employeesIn = (positionCodes, selected, blank) => {
    const ref = MS.refCache || { positions: [], employees: [] };
    const pos = {};
    ref.positions.forEach((p) => { pos[p.position_id] = p.position_code; });
    return MS.options(ref.employees.filter((e) => positionCodes.indexOf(pos[e.position_id]) >= 0).map((e) => ({ value: e.employee_id, label: e.name })), selected, blank === undefined ? '— choose —' : blank);
  };

  /* reads a file input into {file_name, mime_type, base64} for the upload actions */
  MS.fileForUpload = async function (file) {
    return { file_name: file.name, mime_type: file.type || 'application/octet-stream', base64: await MS.blobToBase64(file) };
  };
})();
