(function () {
  const MS = (window.MS = window.MS || {});

  MS.$ = (id) => document.getElementById(id);
  MS.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  MS.pad = (n) => String(n).padStart(2, '0');
  MS.isoOf = (d) => d.getFullYear() + '-' + MS.pad(d.getMonth() + 1) + '-' + MS.pad(d.getDate());
  MS.todayISO = () => MS.isoOf(new Date());
  MS.sum = (arr, k) => arr.reduce((s, i) => s + (Number(i[k]) || 0), 0);
  MS.param = (name) => new URLSearchParams(location.search).get(name) || '';

  MS.root = () => new URL('.', document.baseURI).href;
  MS.here = () => location.href.slice(MS.root().length).split('#')[0];
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented) return;
    e.preventDefault();
    const id = a.getAttribute('href').slice(1);
    const el = id && document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  MS.label = (code) => {
    const s = String(code == null ? '' : code).replace(/_id$/, '').replace(/_/g, ' ').toLowerCase().trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const asDate = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? (() => { const [y, m, d] = String(v).split('-').map(Number); return new Date(y, m - 1, d); })() : new Date(v));
  MS.docDate = (v) => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(String(v || '')); return m ? m[3] + '-' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m[2] - 1] + '-' + m[1] : ''; };
  MS.shortDate = (v) => (v ? asDate(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  MS.prettyDate = (v) => (v ? asDate(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
  MS.dateTime = (v) => (v ? new Date(v).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
  MS.when = (v) => (!v ? '' : /T\d\d:/.test(String(v)) ? MS.dateTime(v) : MS.shortDate(v));
  MS.ago = (v) => {
    if (!v) return '';
    const s = Math.round((Date.now() - new Date(v).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.round(s / 60) + ' min ago';
    if (s < 86400) return Math.round(s / 3600) + ' h ago';
    return MS.shortDate(v);
  };
  MS.recordHref = (table, id) => {
    const q = encodeURIComponent(id || '');
    if (table === 'jobs' && id) return 'jobs/job.html?id=' + q;
    if (table === 'job_to_create' && id) return 'jobs/job-new.html?quotation_id=' + q;
    if (table === 'quotations' && id) return 'customers/quotation.html?id=' + q;
    if (table === 'messages') return 'management/messages.html';
    if (table === 'role_requests') return 'admin/users.html?tab=requests';
    if (table === 'users') return 'admin/users.html';
    return 'notifications.html';
  };
  MS.toLocalInput = (iso) => { if (!iso) return ''; const d = new Date(iso); return MS.isoOf(d) + 'T' + MS.pad(d.getHours()) + ':' + MS.pad(d.getMinutes()); };
  MS.fromLocalInput = (v) => (v ? new Date(v).toISOString() : '');

  const cur = () => (window.APP_CONFIG && window.APP_CONFIG.CURRENCY) || 'GMD';
  MS.money = (n) => (n === '' || n == null ? '' : cur() + ' ' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  MS.num = (n) => (n === '' || n == null ? '' : (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 4 }));

  MS.tone = (s) => {
    s = String(s || '');
    if (/UNAUTHORI[SZ]ED|ABSENT|MISSED/.test(s)) return 'failed';
    if (/^(LATE|REQUESTED|RECEIVED|SICK|UNPAID)$/.test(s)) return 'pending';
    if (/^(PRESENT|AUTHORI[SZ]ED|ADDRESSED)$/.test(s)) return 'ok';
    if (/^(ON_LEAVE|RECORDED|IN_REVIEW)$/.test(s)) return 'waiting';
    if (/PASS_WITH|REPORTED|^OPEN$/.test(s)) return 'pending';
    if (/MAINTENANCE|REPAIR|ACKNOWLEDGED|SCHEDULED/.test(s)) return 'waiting';
    if (/CLOSED|COMPLETE|PAID|APPROVED|ACTIVE|DELIVERED|RESOLVED|VERIFIED|ACCEPTED|PASS|DONE|POSTED|ACTIONED|WON|RELEASED/.test(s)) return 'ok';
    if (/CANCEL|REJECT|FAIL|VOID|BLOCK|SUSPEND|DEACTIV|LOST|OVERDUE|BROKEN|REWORK|DISPUTED|EMERGENCY|LOCKED/.test(s)) return 'failed';
    if (/HOLD|PENDING|AWAIT|REVIEW|REVISION|SHORTAGE|DRAFT|EXPIRED|HIGH|NEW|PLANNED/.test(s)) return 'pending';
    if (/PROGRESS|PRODUCTION|SECTIONS|SENT|SUBMITTED|QUALITY|FINISHING|READY|OUT_FOR|ASSIGNED|CUSTOMER_APPROVAL/.test(s)) return 'waiting';
    return 'off';
  };
  const TONE_ICON = { ok: 'check', failed: 'alert', pending: 'clock', waiting: 'refresh', off: 'dot' };
  MS.pill = (s, text) => {
    if (s === '' || s == null) return '';
    const tone = MS.tone(s);
    return `<span class="pill ${tone}">${MS.icon ? MS.icon(TONE_ICON[tone] || 'dot') : ''}${MS.esc(text || MS.statusLabel(s))}</span>`;
  };
  MS.empty = (icon, title, text, action) => `<div class="empty-state big">${MS.icon ? MS.icon(icon || 'inbox') : ''}<b>${MS.esc(title)}</b>${text ? `<p>${MS.esc(text)}</p>` : ''}${action || ''}</div>`;
  MS.statusLabel = (code, entity) => {
    if (code === 'ACCEPTED' && (!entity || entity === 'quotations')) return 'Approved';
    const ref = MS.refCache && MS.refCache.statuses;
    const hit = ref && ref.find((x) => x.status_code === code && (!entity || x.entity === entity));
    return hit ? hit.label : MS.label(code);
  };

  MS.setMsg = (el, msg, type) => {
    if (typeof el === 'string') el = MS.$(el);
    if (!el) return;
    if (msg === 'Loading…' && MS.live && MS.live.silent) return;
    el.textContent = msg || '';
    el.classList.remove('error', 'ok');
    if (type) el.classList.add(type);
  };

  MS.busy = function (btn, on, label) {
    if (!btn) return on;
    if (on && typeof on.then === 'function') {
      MS.busy(btn, true, label);
      const done = () => MS.busy(btn, false);
      on.then(done, done);
      return on;
    }
    const isBtn = btn.tagName === 'BUTTON';
    if (on) {
      if (btn.classList.contains('is-busy')) return on;
      if (btn.dataset.label === undefined) btn.dataset.busyHtml = btn.innerHTML;
      if (isBtn) btn.disabled = true; else btn.setAttribute('aria-disabled', 'true');
      btn.classList.add('is-busy');
      btn.setAttribute('aria-busy', 'true');
      btn.textContent = label || 'Working…';
    } else {
      if (!btn.classList.contains('is-busy')) return on;
      if (isBtn) btn.disabled = false; else btn.removeAttribute('aria-disabled');
      btn.classList.remove('is-busy');
      btn.setAttribute('aria-busy', 'false');
      if (btn.dataset.label !== undefined) btn.textContent = btn.dataset.label;
      else if (btn.dataset.busyHtml !== undefined) btn.innerHTML = btn.dataset.busyHtml;
      delete btn.dataset.busyHtml;
    }
    return on;
  };

  MS.skeleton = (lines) => '<div class="skel-box" aria-hidden="true">' + Array.from({ length: lines || 4 }, (_, i) => `<span class="skel" style="width:${[92, 70, 84, 56, 76][i % 5]}%"></span>`).join('') + '</div><p class="sr-only" role="status">Loading…</p>';

  const bar = { n: 0, el: null, t: null };
  MS.progress = function (on) {
    bar.n = Math.max(0, bar.n + (on ? 1 : -1));
    if (bar.n > 0 && !bar.t && !(bar.el && bar.el.classList.contains('on'))) {
      bar.t = setTimeout(() => {
        bar.t = null;
        if (!bar.el) { bar.el = document.createElement('div'); bar.el.className = 'nav-progress'; bar.el.setAttribute('aria-hidden', 'true'); document.body.appendChild(bar.el); }
        bar.el.classList.add('on');
      }, 120);
    }
    if (bar.n === 0) {
      if (bar.t) { clearTimeout(bar.t); bar.t = null; }
      if (bar.el) bar.el.classList.remove('on');
    }
  };

  const NO_BUSY = 'a[href^="#"], .xbtn, [role=tab], [data-nobusy], summary, .tab';
  let claim = null;
  document.addEventListener('click', (e) => {
    const el = e.target.closest && e.target.closest('button, a.btn, [role=button]');
    if (el && el.classList.contains('is-busy')) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    claim = el && !el.disabled && !el.matches(NO_BUSY) ? { el, at: Date.now() } : null;
  }, true);
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    setTimeout(() => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button || a.target === '_blank' || a.hasAttribute('download')) return;
      const href = a.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#' || /^(mailto:|tel:|javascript:|blob:)/i.test(href)) return;
      let u;
      try { u = new URL(a.href); } catch (x) { return; }
      if (u.origin !== location.origin || (u.pathname === location.pathname && u.search === location.search)) return;
      MS.progress(true);
      if (a.matches('a.btn')) MS.busy(a, true, 'Opening…');
      setTimeout(() => { MS.progress(false); if (a.classList.contains('is-busy')) MS.busy(a, false); }, 8000);
    }, 0);
  });
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    while (bar.n > 0) MS.progress(false);
    document.querySelectorAll('.is-busy').forEach((b) => MS.busy(b, false));
  });

  MS.claimClick = function (label) {
    const c = claim;
    if (!c || Date.now() - c.at > 2500 || !c.el.isConnected || c.el.classList.contains('is-busy')) return null;
    claim = null;
    const el = c.el;
    MS.busy(el, true, label);
    return () => { if (el.isConnected) MS.busy(el, false); };
  };

  MS.kv = (rows) => `<dl class="kv">${rows.filter((r) => r[1] !== '' && r[1] != null).map((r) => `<dt>${MS.esc(r[0])}</dt><dd>${r[2] ? r[1] : MS.esc(r[1])}</dd>`).join('')}</dl>`;

  MS.options = (items, selected, blank) => (blank !== undefined ? `<option value="">${MS.esc(blank)}</option>` : '') + items.map((o) => {
    const v = typeof o === 'string' ? o : o.value;
    const l = typeof o === 'string' ? MS.label(o) : o.label;
    return `<option value="${MS.esc(v)}"${String(v) === String(selected == null ? '' : selected) ? ' selected' : ''}>${MS.esc(l)}</option>`;
  }).join('');

  MS.formData = (form) => {
    const out = {};
    form.querySelectorAll('[name]').forEach((el) => {
      if (el.type === 'checkbox') out[el.name] = el.checked;
      else if (el.type === 'datetime-local') out[el.name] = MS.fromLocalInput(el.value);
      else if (el.type === 'number') out[el.name] = el.value === '' ? '' : Number(el.value);
      else out[el.name] = el.value.trim();
    });
    return out;
  };

  MS.blobToDataUrl = (blob) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
  MS.blobToBase64 = async (blob) => (await MS.blobToDataUrl(blob)).split(',')[1];

  MS.lnk = (href, text, cls) => `<a class="lnk${cls ? ' ' + cls : ''}" href="${MS.esc(href)}">${MS.esc(text)}</a>`;

  MS.clickable = (box) => {
    if (!box) return;
    box.addEventListener('click', (e) => {
      if (e.target.closest('a, button, input, select, textarea, label, .menu, .more, dialog')) return;
      const el = e.target.closest('[data-href]');
      if (el && el.dataset.href) { MS.progress(true); location.href = el.dataset.href; }
    });
  };

  MS.initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  MS.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms || 250); }; };

  MS.openDialog = (id) => { const d = MS.$(id); d.showModal(); const f = d.querySelector('input:not([type=hidden]),select,textarea'); if (f) f.focus(); return d; };
})();
