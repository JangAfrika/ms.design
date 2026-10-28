(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const state = { page: 1, q: '' };
  let rows = [];

  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    try {
      const r = await MS.call('ERROR_LOG_LIST', { page: state.page, page_size: 50, search: state.q });
      rows = r.rows;
      MS.setMsg('listMsg', MS.count(r.total, 'error', 'errors'));
      $('listBody').innerHTML = rows.length ? rows.map((e, i) => `<tr class="clk" data-i="${i}"><td>${esc(MS.dateTime(e.created_at))}</td><td class="mono">${esc(e.request_id)}</td><td>${esc(e.action)}</td>
        <td>${esc(e.username || '')}</td><td class="wrap">${esc(String(e.error_message || '').slice(0, 140))}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">No errors recorded.</td></tr>';
      MS.pager('pager', r, state, load);
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  let t = null;
  $('search').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { state.q = $('search').value.trim(); state.page = 1; load(); }, 300); });
  $('reloadBtn').addEventListener('click', load);
  $('listBody').addEventListener('click', (ev) => {
    const tr = ev.target.closest('tr[data-i]');
    if (!tr) return;
    const e = rows[Number(tr.dataset.i)];
    $('errBody').innerHTML = MS.kv([['When', MS.dateTime(e.created_at)], ['Reference', e.request_id], ['Action', e.action], ['User', e.username], ['Detail', e.detail]]) +
      `<h3 style="margin:10px 0 4px;font-size:12px">Error</h3><pre class="json">${esc(e.error_message || '')}</pre><h3 style="margin:10px 0 4px;font-size:12px">Stack</h3><pre class="json">${esc(e.error_stack || '')}</pre>`;
    MS.openDialog('errDialog');
  });
  load();
})();
