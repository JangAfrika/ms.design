/* Job profitability: every job with its selling price, cost, profit and margin; filter by status, customer, month opened and losses;
   cost by category for the whole filter. Opens the cost sheet on the job. Needs JOB_COST_VIEW. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const fin = MS.fin;
  const state = { page: 1, q: '', status: '', customer: '', from: '', to: '', loss: false };
  const money = (n) => (Number(n) < 0 ? '− ' + MS.money(-Number(n)) : MS.money(n));

  MS.reload = () => load();
  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    try {
      const r = await MS.recall('JOB_PROFITABILITY_LIST', { page: state.page, page_size: 50, search: state.q, losses_only: state.loss,
        filters: { status: state.status, customer_id: state.customer }, date_from: state.from, date_to: state.to, sort: 'job_number', dir: 'desc' });
      MS.setMsg('listMsg', r.total + ' job' + (r.total === 1 ? '' : 's'));
      const t = r.totals;
      $('jpCards').innerHTML = `
        <div class="card"><div class="k">Revenue</div><div class="v">${MS.money(t.revenue)}</div><div class="s">selling prices of these jobs</div></div>
        <div class="card"><div class="k">Cost</div><div class="v">${MS.money(t.cost)}</div><div class="s">charged to these jobs</div></div>
        <div class="card ${t.profit < 0 ? 'red' : 'green'}"><div class="k">Profit</div><div class="v">${money(t.profit)}</div><div class="s">${t.margin_pct === null ? '' : esc(t.margin_pct + ' % margin')}</div></div>
        <div class="card ${t.losses ? 'red' : ''}"><div class="k">Jobs at a loss</div><div class="v">${t.losses}</div><div class="s">cost above the selling price</div></div>`;
      const max = Math.max(1, ...r.by_category.map((c) => Math.abs(c.amount)));
      $('jpCats').hidden = !r.by_category.length;
      $('jpCatBody').innerHTML = r.by_category.map((c) => `<div class="bar-row"><span>${esc(MS.label(c.category))}</span><span class="bar"><i style="width:${(100 * Math.abs(c.amount) / max).toFixed(0)}%"></i></span><span class="n">${esc(MS.money(c.amount))}</span></div>`).join('');
      $('listBody').innerHTML = r.rows.length ? r.rows.map((j) => {
        const href = 'jobs/job.html?id=' + encodeURIComponent(j.job_id) + '#costs';
        return `<tr class="clk" data-href="${esc(href)}"><td><b>${MS.lnk(href, j.job_number)}</b><span class="sub">${esc(j.job_name)}</span></td>
          <td class="wrap">${esc(j.customer_name)}</td><td>${MS.pill(j.status, MS.statusLabel(j.status, 'jobs'))}</td>
          <td class="num">${MS.money(j.revenue)}</td><td class="num">${j.has_costs ? MS.money(j.cost) : '<span class="qhint">none yet</span>'}</td>
          <td class="num${j.is_loss ? ' neg' : ''}">${j.has_costs ? money(j.profit) : ''}</td>
          <td class="num${j.is_loss ? ' neg' : ''}">${j.margin_pct === null || !j.has_costs ? '' : esc(j.margin_pct + ' %')}</td></tr>`;
      }).join('') : '<tr><td colspan="7" class="empty">No job matches.</td></tr>';
      MS.clickable($('listBody'));
      pager(r);
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  function pager(r) {
    const pages = Math.max(1, Math.ceil(r.total / r.page_size));
    $('pager').innerHTML = pages > 1 ? `<button type="button" id="pPrev"${state.page <= 1 ? ' disabled' : ''}>Previous</button><span>Page ${state.page} of ${pages}</span><button type="button" id="pNext"${state.page >= pages ? ' disabled' : ''}>Next</button>` : '';
    if (pages > 1) { $('pPrev').onclick = () => { state.page--; load(); }; $('pNext').onclick = () => { state.page++; load(); }; }
  }

  MS.boot({ page: 'job-profit', any: ['JOB_COST_VIEW'], ref: true }).then(() => {
    const ST = ['IN_SECTIONS', 'IN_PRODUCTION_DEPT', 'DONE', 'ON_HOLD', 'CANCELLED'];
    $('statusFilter').innerHTML = MS.options(ST.map((s) => ({ value: s, label: MS.statusLabel(s, 'jobs') })), '', 'Any status');
    $('search').addEventListener('input', MS.debounce(() => { state.q = $('search').value.trim(); state.page = 1; load(); }, 300));
    const on = (id, key, prop) => $(id).addEventListener('change', () => { state[key] = prop ? $(id)[prop] : $(id).value; state.page = 1; load(); });
    on('statusFilter', 'status'); on('custFilter', 'customer'); on('fromDate', 'from'); on('toDate', 'to'); on('lossOnly', 'loss', 'checked');
    $('reloadBtn').addEventListener('click', load);
    $('printBtn').addEventListener('click', () => window.print());
    fin.customers().then((cs) => { $('custFilter').innerHTML = MS.options(cs.map((c) => ({ value: c.customer_id, label: c.customer_name })), '', 'All customers'); }).catch(() => {});
    load();
  });
})();
