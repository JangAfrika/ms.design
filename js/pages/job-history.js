(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const SIZE = 50;
  const state = { page: 1, q: '', customer: '', from: '', to: '' };

  function query() {
    const p = { page: state.page, page_size: SIZE, search: state.q };
    if (state.customer) p.customer_id = state.customer;
    if (state.from) p.from = state.from;
    if (state.to) p.to = state.to;
    return p;
  }

  MS.reload = () => load();
  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    $('listBody').innerHTML = `<tr><td colspan="8">${MS.skeleton(3)}</td></tr>`;
    try {
      const r = await MS.call('JOB_HISTORY_LIST', query());
      if (!$('customerFilter').dataset.set) {
        $('customerFilter').innerHTML = MS.options((r.customers || []).map((c) => ({ value: c.customer_id, label: c.customer_name })), state.customer, 'Any customer');
        $('customerFilter').dataset.set = '1';
      }
      MS.setMsg('listMsg', r.total + ' delivered job' + (r.total === 1 ? '' : 's'));
      $('listBody').innerHTML = r.rows.length ? r.rows.map((j) => `
        <tr class="clk" data-href="jobs/job-history-job.html?id=${encodeURIComponent(j.job_id)}">
          <td><b>${MS.lnk('jobs/job-history-job.html?id=' + encodeURIComponent(j.job_id), j.job_number)}</b></td>
          <td class="wrap">${esc(j.job_name)}</td>
          <td>${esc(j.customer_name)}</td>
          <td>${esc(MS.when(j.delivered_at))}</td>
          <td>${esc(j.delivered_by_name)}</td>
          <td class="num">${esc(MS.money(j.total))}</td>
          <td class="num">${esc(MS.money(j.paid))}</td>
          <td>${MS.payChip({ pay: { status: j.pay_status, label: j.pay_label, balance: j.balance } })}</td>
        </tr>`).join('') : `<tr><td colspan="8" class="empty">${state.q || state.customer || state.from || state.to ? 'No delivered job matches.' : 'No job has been delivered yet.'}</td></tr>`;
      const pages = Math.max(1, Math.ceil(r.total / (r.page_size || SIZE)));
      $('pager').innerHTML = pages > 1 ? `<button type="button" id="pPrev"${state.page <= 1 ? ' disabled' : ''}>Previous</button><span>Page ${state.page} of ${pages}</span><button type="button" id="pNext"${state.page >= pages ? ' disabled' : ''}>Next</button>` : '';
      if (pages > 1) { $('pPrev').onclick = () => { state.page--; load(); }; $('pNext').onclick = () => { state.page++; load(); }; }
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); $('listBody').innerHTML = ''; }
  }

  MS.boot({ page: 'job-history', any: ['JOB_HISTORY_VIEW'] }).then(() => {
    const go = () => { state.page = 1; load(); };
    $('search').addEventListener('input', MS.debounce(() => { state.q = $('search').value.trim(); go(); }, 300));
    $('customerFilter').addEventListener('change', () => { state.customer = $('customerFilter').value; go(); });
    $('dateFrom').addEventListener('change', () => { state.from = $('dateFrom').value; go(); });
    $('dateTo').addEventListener('change', () => { state.to = $('dateTo').value; go(); });
    $('reloadBtn').addEventListener('click', load);
    MS.clickable($('listBody'));
    load();
  });
})();
