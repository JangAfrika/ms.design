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
      try { console.warn('[MS] request failed before any reply', { action: body.action, error: String(e), online: navigator.onLine, timedOut }); } catch (x) {  }
      const err = ApiError({ error_code: timedOut ? 'TIMEOUT' : 'NETWORK', message: timedOut ? 'The server took too long to answer, so the request was stopped.' + (opts.big ? ' The file may be too large for this connection. Try a smaller file or a better connection.' : ' Please try again.')
        : navigator.onLine === false ? 'You are offline. Connect to the internet and try again.'
          : 'The request did not reach the server, or the server refused it.' + big + ' Check your connection and try again. If it keeps happening, tell the system administrator.' });
      err.retry = !opts.noRetry;
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }
    let text = '';
    try { text = await res.text(); } catch (e) {  }
    try { return JSON.parse(text); } catch (e) {
      const snippet = String(text).replace(/\s+/g, ' ').slice(0, 300);
      try { console.warn('[MS] the server reply was not JSON', { action: body.action, status: res.status, snippet }); } catch (x) {  }
      const code = res.status === 413 ? 'TOO_LARGE' : 'BAD_REPLY';
      throw ApiError({ error_code: code, message: res.status === 413 ? 'The file is too large for the server.' + big
        : 'The server sent a reply the app cannot read (HTTP ' + res.status + ').' + big + ' Please try again; if it keeps happening, tell the system administrator and check that the Web App is deployed with access set to "Anyone" and the newest version.' });
    }
  }
  MS.send = send;

  const READ = /(_LIST|_GET|_SEARCH|_ME|_PING|_SEEN|_TABLES)$|^WORK_SCORE_REFRESH$|^PULSE$/;
  const NOT_A_PAGE_READ = /^(AUTH_|PULSE$|REF_GET$|WORK_|MESSAGE_PEOPLE_LIST$|HISTORY_PEOPLE_LIST$)/;

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
      const sig = (u) => JSON.stringify([u && u.permissions, u && u.roles, u && u.position, u && u.department, u && u.work]);
      const changed = sig(fresh) !== sig(MS.user);
      MS.store.update({ me_at: Date.now(), unread: me.unread_notifications || 0, unread_messages: me.unread_messages || 0, user: fresh });
      MS.user = fresh;
      if (changed) MS.store.dropCache();
      if (changed && reloadIfChanged) { if (MS.accessChanged) MS.accessChanged(); else location.reload(); }
      return me;
    }).catch(() => {}).finally(() => { checking = false; });
  };

  const pageReads = new Map(), prefetch = {};
  const readKey = (action, payload) => action + '|' + JSON.stringify(payload || {});
  const sigOf = (data) => { const t = JSON.stringify(data); let h = 5381; for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return h + ':' + t.length; };
  const noteRead = (action, payload, data) => {
    if (NOT_A_PAGE_READ.test(action) || document.querySelector('dialog[open]')) return;
    pageReads.delete(action);
    pageReads.set(action, { action, payload: payload || {}, sig: sigOf(data), at: Date.now() });
    if (pageReads.size > 8) pageReads.delete(pageReads.keys().next().value);
  };
  MS.recallKey = (action, payload) => (MS.user ? MS.user.user_id : '') + ':' + action + ':' + JSON.stringify(payload || {});
  MS.probeReads = async function () {
    const now = Date.now();
    const list = Array.from(pageReads.values()).filter((r) => now - r.at < 180000).slice(-5);
    if (!list.length) return true;
    let changed = false;
    await Promise.all(list.map(async (r) => {
      try {
        const d = await MS.call(r.action, r.payload, { live: true, noRetry: true, timeout: 20000 });
        if (sigOf(d) === r.sig) return;
        changed = true;
        prefetch[readKey(r.action, r.payload)] = { data: d, at: Date.now() };
        if (MS.store.readCache(MS.recallKey(r.action, r.payload)) !== null) MS.store.saveCache(MS.recallKey(r.action, r.payload), d);
      } catch (e) {  }
    }));
    return changed;
  };

  const inflight = new Map();
  MS.call = function (action, payload, opts) {
    const isRead = READ.test(action);
    if (isRead && !(opts && opts.live)) {
      const k = readKey(action, payload), pf = prefetch[k];
      delete prefetch[k];
      if (pf && Date.now() - pf.at < 8000) { noteRead(action, payload, pf.data); return Promise.resolve(pf.data); }
    }
    const quiet = !!(opts && (opts.live || opts.quiet)) || NOT_A_PAGE_READ.test(action);
    if (!isRead) {
      const dk = readKey(action, payload);
      if (inflight.has(dk)) return inflight.get(dk);
      const p = callOnce(action, payload, opts, isRead, quiet);
      inflight.set(dk, p);
      const free = () => inflight.delete(dk);
      p.then(free, free);
      return p;
    }
    return callOnce(action, payload, opts, isRead, quiet);
  };

  async function callOnce(action, payload, opts, isRead, quiet) {
    const release = quiet || !MS.claimClick ? null : MS.claimClick(isRead ? 'Opening…' : 'Working…');
    if (!quiet && MS.progress) MS.progress(true);
    try { return await callCore(action, payload, opts, isRead); } finally {
      if (!quiet && MS.progress) MS.progress(false);
      if (release) release();
    }
  }

  async function callCore(action, payload, opts, isRead) {
    const s = MS.store.read();
    const body = { action, token: s ? s.token : '', request_id: uuid(), payload: payload || {} };
    const fromDialog = !READ.test(action) && !!document.querySelector('dialog[open]:not(.imdlg)');
    let out;
    try { out = await send(body, opts); } catch (e) {
      if (!e.retry) throw e;
      await new Promise((ok) => setTimeout(ok, 1500));
      out = await send(body, opts);
    }
    if (out.success) {
      if (!READ.test(action)) { MS.store.dropCache(); Object.keys(prefetch).forEach((k) => { delete prefetch[k]; }); try { document.dispatchEvent(new CustomEvent('ms:wrote', { detail: { action } })); } catch (e) {  } }
      if (out.perm_v) watchRights(out.perm_v);
      if (isRead && !(opts && (opts.live || opts.quiet))) noteRead(action, payload, out.data);
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
  }

  const reloadOnce = {};
  MS.recall = async function (action, payload) {
    const key = MS.recallKey(action, payload);
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
    const wait = s && s.token && !msg && MS.push && MS.push.isOn() ? MS.push.forget() : null;
    if (s && s.token && !msg) MS.call('AUTH_LOGOUT').catch(() => {});
    MS.store.clear();
    MS.session = null;
    const go = () => location.replace('index.html' + (msg ? '?msg=' + encodeURIComponent(msg) : ''));
    if (wait) { Promise.race([wait, new Promise((ok) => setTimeout(ok, 2000))]).then(go, go); return; }
    go();
  };

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

  MS.fileForUpload = async function (file) {
    return { file_name: file.name, mime_type: file.type || 'application/octet-stream', base64: await MS.blobToBase64(file) };
  };
})();
