/* Activity (audit log): who did what and when, with filters. Opening a row shows the values before and after.
   admin/activity.html?record=<id> or ?user=<user id> narrows the log to one record or one account. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const state = { page: 1, q: '', action: '', module: '', result: '', user: MS.param('user'), record: MS.param('record'), from: '', to: '' };
  let rows = [];

  const parse = (v) => { if (!v) return null; if (typeof v === 'object') return v; try { return JSON.parse(v); } catch (e) { return String(v); } };
  const show = (v) => (v === undefined ? '' : v === null ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    const p = { page: state.page, page_size: 50, search: state.q, sort: 'timestamp', dir: 'desc', filters: { module: state.module, result: state.result } };
    if (state.action) p.action = state.action;
    if (state.user) p.user_id = state.user;
    if (state.record) p.record_id = state.record;
    if (state.from || state.to) { p.date_field = 'timestamp'; p.date_from = state.from; p.date_to = state.to; }
    try {
      const r = await MS.call('AUDIT_GET', p);
      rows = r.rows;
      MS.setMsg('listMsg', MS.count(r.total, 'entry', 'entries'));
      $('listBody').innerHTML = rows.length ? rows.map((a, i) => `<tr class="clk" data-i="${i}">
          <td>${esc(MS.dateTime(a.timestamp))}</td>
          <td>${esc(a.user_name || (a.user_id ? a.user_id : 'Unknown'))}</td>
          <td>${MS.pill(a.action, MS.label(a.action))}</td>
          <td>${esc(MS.areaLabel(a.module))}</td>
          <td>${esc(a.table_name ? MS.label(a.table_name) : '')}${a.record_id ? `<span class="sub mono">${esc(a.record_id)}</span>` : ''}</td>
          <td>${a.result ? MS.pill(a.result === 'SUCCESS' ? 'DONE' : a.result, MS.label(a.result)) : ''}</td>
          <td class="wrap reason">${esc(a.reason || '')}</td>
        </tr>`).join('') : '<tr><td colspan="7" class="empty">No entries match.</td></tr>';
      MS.pager('pager', r, state, load);
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  function openEntry(a) {
    const before = parse(a.old_value), after = parse(a.new_value);
    $('entryTitle').textContent = MS.label(a.action) + (a.table_name ? ' · ' + MS.label(a.table_name) : '');
    $('entryInfo').textContent = MS.dateTime(a.timestamp) + ' · ' + (a.user_name || 'Unknown user') + (a.result ? ' · ' + MS.label(a.result) : '');
    let body = MS.kv([['Record', a.record_id], ['Reason', a.reason], ['Area', MS.areaLabel(a.module)], ['Request', a.request_id]]);
    if (before && after && typeof before === 'object' && typeof after === 'object') {
      const keys = [...new Set(Object.keys(before).concat(Object.keys(after)))].filter((k) => show(before[k]) !== show(after[k]));
      body += keys.length ? `<table class="diff"><thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead><tbody>${keys.map((k) => `<tr><td>${esc(MS.label(k))}</td><td class="old">${esc(show(before[k]))}</td><td class="new">${esc(show(after[k]))}</td></tr>`).join('')}</tbody></table>` : '<p class="hint">No field values changed.</p>';
    } else {
      const block = (title, v) => `<h3 style="margin:10px 0 4px;font-size:12px">${esc(title)}</h3><pre class="json">${esc(v === null ? '—' : typeof v === 'object' ? JSON.stringify(v, null, 2) : v)}</pre>`;
      body += block('Before', before) + block('After', after);
    }
    $('entryBody').innerHTML = body;
    MS.openDialog('entryDialog');
  }

  function scopeBar() {
    const bits = [];
    if (state.record) bits.push('record <b class="mono">' + esc(state.record) + '</b>');
    if (state.user && $('userFilter').hidden) bits.push('one user account');
    $('scopeBar').hidden = !bits.length;
    $('scopeBar').innerHTML = bits.length ? 'Showing only ' + bits.join(' and ') + '. <a href="admin/activity.html">Show everything</a>' : '';
  }

  async function users() {
    if (!MS.can('USER_VIEW')) return;
    try {
      const r = await MS.call('USER_LIST', { page: 1, page_size: 100, sort: 'display_name', dir: 'asc' });
      $('userFilter').innerHTML = MS.options(r.rows.map((u) => ({ value: u.user_id, label: u.display_name + ' (' + u.username + ')' })), state.user, 'Every user');
      $('userFilter').hidden = false;
      scopeBar();
    } catch (e) { /* the filter just stays hidden */ }
  }

  MS.boot({ page: 'activity', any: ['AUDIT_VIEW'], ref: true }).then(() => {
    $('actionFilter').innerHTML = MS.options(MS.enumOf('audit_logs.action').map((a) => ({ value: a, label: MS.label(a) })), '', 'Every action');
    $('moduleFilter').innerHTML = MS.options(['JOBS', 'CUSTOMERS', 'SALES', 'FINANCE', 'HR', 'KPI', 'MANAGEMENT', 'COMMUNICATION', 'SYSTEM'].map((a) => ({ value: a, label: MS.label(a) })), '', 'Every area');
    $('resultFilter').innerHTML = MS.options(MS.enumOf('audit_logs.result').map((a) => ({ value: a, label: MS.label(a) })), '', 'Any result');
    const set = (k, el, ev) => $(el).addEventListener(ev || 'change', () => { state[k] = $(el).value.trim(); state.page = 1; load(); });
    $('search').addEventListener('input', MS.debounce(() => { state.q = $('search').value.trim(); state.page = 1; load(); }, 300));
    set('action', 'actionFilter'); set('module', 'moduleFilter'); set('result', 'resultFilter'); set('user', 'userFilter');
    set('from', 'dateFrom'); set('to', 'dateTo');
    $('clearBtn').addEventListener('click', () => {
      ['search', 'actionFilter', 'moduleFilter', 'resultFilter', 'userFilter', 'dateFrom', 'dateTo'].forEach((x) => { $(x).value = ''; });
      Object.assign(state, { page: 1, q: '', action: '', module: '', result: '', user: '', record: '', from: '', to: '' });
      history.replaceState(null, '', 'admin/activity.html');
      scopeBar(); load();
    });
    $('reloadBtn').addEventListener('click', load);
    $('listBody').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-i]'); if (tr) openEntry(rows[Number(tr.dataset.i)]); });
    scopeBar();
    users();
    load();
  });
})();
