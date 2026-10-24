/* Small helpers shared by every page: formatting, dates, money, status pills, files. */
(function () {
  const MS = (window.MS = window.MS || {});

  MS.$ = (id) => document.getElementById(id);
  MS.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  MS.pad = (n) => String(n).padStart(2, '0');
  MS.isoOf = (d) => d.getFullYear() + '-' + MS.pad(d.getMonth() + 1) + '-' + MS.pad(d.getDate());
  MS.todayISO = () => MS.isoOf(new Date());
  MS.sum = (arr, k) => arr.reduce((s, i) => s + (Number(i[k]) || 0), 0);
  MS.param = (name) => new URLSearchParams(location.search).get(name) || '';

  // Every page sits next to index.html, so links are plain file names (jobs/job.html?id=).
  MS.root = () => new URL('.', document.baseURI).href;
  MS.here = () => location.href.slice(MS.root().length).split('#')[0];
  // "#section" links jump within the page (the base would otherwise send them to the site root)
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented) return;
    e.preventDefault();
    const id = a.getAttribute('href').slice(1);
    const el = id && document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // "JOB_STATUS_UPDATE" -> "Job status update", "customer_deadline" -> "Customer deadline"
  MS.label = (code) => {
    const s = String(code == null ? '' : code).replace(/_id$/, '').replace(/_/g, ' ').toLowerCase().trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const asDate = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? (() => { const [y, m, d] = String(v).split('-').map(Number); return new Date(y, m - 1, d); })() : new Date(v));
  MS.docDate = (v) => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(String(v || '')); return m ? m[3] + '-' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m[2] - 1] + '-' + m[1] : ''; };   // 20-Oct-2026, as printed on the PDFs
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
  // value for <input type="datetime-local"> and back to ISO
  MS.toLocalInput = (iso) => { if (!iso) return ''; const d = new Date(iso); return MS.isoOf(d) + 'T' + MS.pad(d.getHours()) + ':' + MS.pad(d.getMinutes()); };
  MS.fromLocalInput = (v) => (v ? new Date(v).toISOString() : '');

  const cur = () => (window.APP_CONFIG && window.APP_CONFIG.CURRENCY) || 'GMD';
  MS.money = (n) => (n === '' || n == null ? '' : cur() + ' ' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  MS.num = (n) => (n === '' || n == null ? '' : (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 4 }));

  /* status pills, coloured like the badges in the spreadsheet */
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
  MS.pill = (s, text) => (s === '' || s == null ? '' : `<span class="pill ${MS.tone(s)}">${MS.esc(text || MS.statusLabel(s))}</span>`);
  MS.statusLabel = (code, entity) => {
    if (code === 'ACCEPTED' && (!entity || entity === 'quotations')) return 'Approved';   // proforma invoices: the customer "approves"
    const ref = MS.refCache && MS.refCache.statuses;
    const hit = ref && ref.find((x) => x.status_code === code && (!entity || x.entity === entity));
    return hit ? hit.label : MS.label(code);
  };

  MS.setMsg = (el, msg, type) => {
    if (typeof el === 'string') el = MS.$(el);
    if (!el) return;
    el.textContent = msg || '';
    el.classList.remove('error', 'ok');
    if (type) el.classList.add(type);
  };

  MS.busy = function (btn, on, label) {
    if (!btn) return;
    if (!btn.dataset.label) btn.dataset.label = btn.textContent;
    btn.disabled = on;
    btn.textContent = on ? (label || 'Please wait…') : btn.dataset.label;
  };

  /* a definition list from [[label, value(html allowed when raw)], ...]; empty values are left out */
  MS.kv = (rows) => `<dl class="kv">${rows.filter((r) => r[1] !== '' && r[1] != null).map((r) => `<dt>${MS.esc(r[0])}</dt><dd>${r[2] ? r[1] : MS.esc(r[1])}</dd>`).join('')}</dl>`;

  /* <option> lists: items [{value,label}] or strings */
  MS.options = (items, selected, blank) => (blank !== undefined ? `<option value="">${MS.esc(blank)}</option>` : '') + items.map((o) => {
    const v = typeof o === 'string' ? o : o.value;
    const l = typeof o === 'string' ? MS.label(o) : o.label;
    return `<option value="${MS.esc(v)}"${String(v) === String(selected == null ? '' : selected) ? ' selected' : ''}>${MS.esc(l)}</option>`;
  }).join('');

  /* reads every [name] field inside a form into an object (checkboxes give true/false, numbers stay strings) */
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

  /* files */
  MS.blobToDataUrl = (blob) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
  MS.blobToBase64 = async (blob) => (await MS.blobToDataUrl(blob)).split(',')[1];

  MS.lnk = (href, text, cls) => `<a class="lnk${cls ? ' ' + cls : ''}" href="${MS.esc(href)}">${MS.esc(text)}</a>`;

  // a whole row or card opens its details: give it data-href, then MS.clickable(container)
  MS.clickable = (box) => {
    if (!box) return;
    box.addEventListener('click', (e) => {
      if (e.target.closest('a, button, input, select, textarea, label, .menu, .more, dialog')) return;
      const el = e.target.closest('[data-href]');
      if (el && el.dataset.href) location.href = el.dataset.href;
    });
  };

  MS.initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  MS.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms || 250); }; };

  /* opens a dialog that holds a form; resolves when it is closed */
  MS.openDialog = (id) => { const d = MS.$(id); d.showModal(); const f = d.querySelector('input:not([type=hidden]),select,textarea'); if (f) f.focus(); return d; };
})();
