/* System settings: every key with its value; the System Administrator changes them one at a time.
   Secret values come from the server already masked and are never filled into the form. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  let rows = [];
  const CAT = { AUTH: 'Sign-in & security', KPI: 'KPIs', NOTIFICATION: 'Notifications', BACKUP: 'Backups' };
  const catLabel = (c) => CAT[c] || MS.label(c);
  const filt = { q: '', cat: '' };
  // help for settings whose rows have no description yet
  const HELP = {
    APP_URL: 'The website address people open (your GitHub Pages link, e.g. https://name.github.io/ms-bms/). Used in login emails and "forgot password" links; reset links do not work until this is set.',
    EMAIL_ENABLED: 'Send notifications (delays, approvals) by email as well as in the app. Login and password-reset emails are always sent.',
    GOOGLE_CLIENT_ID: '"Continue with Google" on the sign-in page: the OAuth client ID from Google Cloud (ends in .apps.googleusercontent.com). Put the same ID in js/config.js. Not a secret; never enter a client secret. Empty switches Google sign-in off.'
  };

  function render() {
    rows.forEach((s) => { if (!s.description && HELP[s.setting_key]) s.description = HELP[s.setting_key]; });
    const q = filt.q.toLowerCase();
    const list = rows.filter((s) => (!filt.cat || s.category === filt.cat) &&
      (!q || s.setting_key.toLowerCase().indexOf(q) >= 0 || String(s.description || '').toLowerCase().indexOf(q) >= 0 || (s.is_secret !== true && String(s.setting_value).toLowerCase().indexOf(q) >= 0)));
    MS.setMsg('listMsg', MS.count(list.length, 'setting'));
    $('listBody').innerHTML = list.length ? list.map((s) => {
      const i = rows.indexOf(s);
      const val = s.is_secret === true ? '<span class="secret">••••••</span> <span class="pill off">Secret</span>'
        : s.value_type === 'BOOLEAN' ? MS.pill(String(s.setting_value) === 'true' ? 'ACTIVE' : 'OFF', String(s.setting_value) === 'true' ? 'On' : 'Off')
        : s.setting_value === '' ? '<span class="sub">not set</span>' : esc(s.setting_value);
      return `<tr>
        <td><code class="key">${esc(s.setting_key)}</code>${s.description ? `<span class="sub" style="white-space:normal">${esc(s.description)}</span>` : ''}</td>
        <td>${esc(catLabel(s.category))}</td>
        <td class="wrap">${val}</td>
        <td>${esc(MS.when(s.updated_at)) || '<span class="sub">never</span>'}</td>
        <td><div class="acts"><button type="button" data-edit="${i}">Change</button></div></td>
      </tr>`;
    }).join('') : `<tr><td colspan="5" class="empty">${rows.length ? 'No setting matches.' : 'No settings.'}</td></tr>`;
  }

  function edit(s) {
    const f = $('setForm');
    f.reset();
    $('setTitle').textContent = 'Change ' + s.setting_key;
    $('setInfo').textContent = (s.description ? s.description + ' ' : '') + (s.is_secret === true ? 'This value is secret: type the new value; the current one is not shown.' : 'Type: ' + MS.label(s.value_type) + '.');
    const v = s.is_secret === true ? '' : String(s.setting_value == null ? '' : s.setting_value);
    $('setField').innerHTML = s.value_type === 'BOOLEAN'
      ? `<label class="req">Value <select id="setValue">${MS.options([{ value: 'true', label: 'On (true)' }, { value: 'false', label: 'Off (false)' }], v.toLowerCase() || 'false')}</select></label>`
      : s.value_type === 'JSON'
        ? `<label class="req">Value <textarea id="setValue" rows="5" class="mono">${esc(v)}</textarea></label>`
        : `<label class="req">Value <input id="setValue" type="${s.is_secret === true ? 'password' : s.value_type === 'NUMBER' ? 'number' : 'text'}" step="any" autocomplete="off" value="${esc(v)}"${s.is_secret === true ? ' placeholder="New value"' : ''}></label>`;
    $('setError').textContent = '';
    const dlg = MS.openDialog('setDialog');
    $('setValue').focus();
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      const value = $('setValue').value.trim();
      if (s.is_secret === true && !value) { $('setError').textContent = 'Type the new value.'; return; }
      if (s.value_type === 'NUMBER' && (value === '' || !isFinite(Number(value)))) { $('setError').textContent = 'Enter a number.'; return; }
      if (s.value_type === 'JSON' && value) { try { JSON.parse(value); } catch (e) { $('setError').textContent = 'This is not valid JSON.'; return; } }
      MS.busy($('setSave'), true, 'Saving…');
      try {
        await MS.call('SETTING_UPDATE', { setting_key: s.setting_key, setting_value: value, reason: f.elements.reason.value.trim() || 'Changed in settings' });
        dlg.close();
        load();
      } catch (err) { $('setError').textContent = err.message; } finally { MS.busy($('setSave'), false); }
    };
    $('setCancel').onclick = () => dlg.close();
  }

  // ---------- approval limits (approval_limits, through CONFIG_LIST / CONFIG_SAVE, audited) ----------
  const DOC_ORDER = ['PURCHASE_REQUEST', 'EXPENSE', 'SUPPLIER_PAYMENT', 'STOCK_ADJUSTMENT', 'PAYROLL', 'OVERTIME', 'QUOTATION_DISCOUNT', 'CAPEX'];
  let limits = [];
  const roleName = (id) => { const r = ((MS.refCache && MS.refCache.roles) || []).find((x) => x.role_id === id); return r ? r.role_name : ''; };
  function renderLimits() {
    const rank = (d) => (DOC_ORDER.indexOf(d) + 1) || 99;
    limits.sort((a, b) => rank(a.document_type) - rank(b.document_type) || String(a.document_type).localeCompare(b.document_type) || Number(a.max_amount) - Number(b.max_amount));
    MS.setMsg('limMsg', '');
    $('limBody').innerHTML = limits.length ? limits.map((l, i) => `<tr>
      <td><b>${esc(MS.label(l.document_type))}</b></td>
      <td>${esc(roleName(l.role_id))}</td>
      <td class="num">${Number(l.max_amount) >= 999999999 ? 'No limit' : esc(MS.num(l.max_amount))}</td>
      <td>${esc(roleName(l.escalate_to_role_id)) || '<span class="sub">—</span>'}</td>
      <td>${MS.pill(l.status || 'ACTIVE', l.status === 'INACTIVE' ? 'Off' : 'Active')}</td>
      <td>${esc(MS.when(l.updated_at)) || '<span class="sub">never</span>'}</td>
      <td><div class="acts"><button type="button" data-lim="${i}">Change</button></div></td>
    </tr>`).join('') : '<tr><td colspan="7" class="empty">No approval limits.</td></tr>';
  }
  async function loadLimits() {
    MS.setMsg('limMsg', 'Loading…');
    try { limits = await MS.call('CONFIG_LIST', { table: 'approval_limits' }); renderLimits(); } catch (err) { MS.setMsg('limMsg', err.message, 'error'); }
  }
  function editLimit(l) {
    const f = $('limForm');
    f.reset();
    $('limTitle').textContent = MS.label(l.document_type) + ' · ' + roleName(l.role_id);
    $('limInfo').textContent = 'The most a ' + roleName(l.role_id) + ' may approve on one ' + MS.label(l.document_type).toLowerCase() + '. Above it, the document waits for the role you choose below.';
    $('limMax').value = l.max_amount;
    $('limEsc').innerHTML = MS.options(((MS.refCache && MS.refCache.roles) || []).filter((r) => r.role_id !== l.role_id).map((r) => ({ value: r.role_id, label: r.role_name })), l.escalate_to_role_id || '', '— nobody (this is the top) —');
    $('limStatus').value = l.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
    $('limError').textContent = '';
    const dlg = MS.openDialog('limDialog');
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      const max = $('limMax').value.trim();
      const reason = f.elements.reason.value.trim();
      if (max === '' || !(Number(max) >= 0)) { $('limError').textContent = 'Enter the amount (0 or more).'; return; }
      if (!reason) { $('limError').textContent = 'Give a reason; it goes into the audit log.'; return; }
      MS.busy($('limSave'), true, 'Saving…');
      try {
        await MS.call('CONFIG_SAVE', { table: 'approval_limits', reason, record: { approval_limit_id: l.approval_limit_id, max_amount: Number(max),
          escalate_to_role_id: $('limEsc').value, status: $('limStatus').value } });
        dlg.close();
        await loadLimits();
        MS.setMsg('limMsg', 'Saved. It applies to approvals from now on.', 'ok');
      } catch (err) { $('limError').textContent = err.message; } finally { MS.busy($('limSave'), false); }
    };
    $('limCancel').onclick = () => dlg.close();
  }

  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    try {
      rows = await MS.call('SETTINGS_LIST');
      const cats = [...new Set(rows.map((s) => s.category))].sort();
      $('catFilter').innerHTML = MS.options(cats.map((c) => ({ value: c, label: catLabel(c) })), filt.cat, 'Every group');
      render();
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  MS.boot({ page: 'settings', any: ['SYSTEM_CONFIG'], ref: true }).then(() => {
    $('search').addEventListener('input', MS.debounce(() => { filt.q = $('search').value.trim(); render(); }, 200));
    $('catFilter').addEventListener('change', () => { filt.cat = $('catFilter').value; render(); });
    $('reloadBtn').addEventListener('click', load);
    $('listBody').addEventListener('click', (e) => { const b = e.target.closest('[data-edit]'); if (b) edit(rows[Number(b.dataset.edit)]); });
    $('limBody').addEventListener('click', (e) => { const b = e.target.closest('[data-lim]'); if (b) editLimit(limits[Number(b.dataset.lim)]); });
    load();
    loadLimits();
  });
})();
