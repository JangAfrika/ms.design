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
    EMAIL_ENABLED: 'Send notifications (delays, approvals) by email as well as in the app. Login and password-reset emails are always sent.'
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

  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    try {
      rows = await MS.call('SETTINGS_LIST');
      const cats = [...new Set(rows.map((s) => s.category))].sort();
      $('catFilter').innerHTML = MS.options(cats.map((c) => ({ value: c, label: catLabel(c) })), filt.cat, 'Every group');
      render();
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  MS.boot({ page: 'settings', any: ['SYSTEM_CONFIG'] }).then(() => {
    $('search').addEventListener('input', MS.debounce(() => { filt.q = $('search').value.trim(); render(); }, 200));
    $('catFilter').addEventListener('change', () => { filt.cat = $('catFilter').value; render(); });
    $('reloadBtn').addEventListener('click', load);
    $('listBody').addEventListener('click', (e) => { const b = e.target.closest('[data-edit]'); if (b) edit(rows[Number(b.dataset.edit)]); });
    load();
  });
})();
