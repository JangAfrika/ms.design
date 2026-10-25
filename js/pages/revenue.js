/* Revenue: month by month and year by year, invoiced against received against the revenue budget, with charts and a print view.
   All numbers come from REVENUE_REPORT (the ledger for revenue, the invoices for "invoiced", payments and other income for "received"). */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const fin = MS.fin;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mShort = (k) => MONTHS[Number(k.slice(5, 7)) - 1];
  const mLong = (k) => MONTHS[Number(k.slice(5, 7)) - 1] + ' ' + k.slice(0, 4);
  const amt = (n) => (Number(n) ? fin.amt(n) : '–');
  const pct = (p) => (p === null || p === undefined ? '–' : p.toFixed(0) + '%');
  let year = 0;

  function cards(r) {
    const t = r.totals;
    const card = (k, v, s) => `<div class="card"><div class="k">${esc(k)}</div><div class="v">${v}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`;
    $('rCards').innerHTML = card('Revenue ' + esc(r.label), fin.amt(t.revenue), t.budget ? 'budget ' + esc(MS.money(t.budget)) + ' · ' + esc(pct(t.pct_of_budget)) + ' of it' : 'no revenue budget')
      + card('Invoiced (with VAT)', fin.amt(t.invoiced), 'invoices issued, credit notes off')
      + card('Received', fin.amt(t.received), 'customers ' + esc(MS.money(t.received_from_customers)) + (t.other_income ? ' · other income ' + esc(MS.money(t.other_income)) : ''))
      + card('Not yet received', fin.amt(Math.max(0, t.invoiced - t.received_from_customers)), 'invoiced minus customer payments');
  }

  function months(r) {
    const cur = r.months.map((m) => m.is_current);
    $('chRev').innerHTML = MS.charts.bars({ title: 'Revenue against budget, ' + r.label, labels: r.months.map((m) => mShort(m.period)), fmt: (v) => MS.money(v),
      series: [{ name: 'Budget', cls: 's1', values: r.months.map((m) => m.budget) }, { name: 'Revenue', cls: 's2', values: r.months.map((m) => m.revenue) }] });
    $('chCash').innerHTML = MS.charts.lines({ title: 'Invoiced and received, ' + r.label, labels: r.months.map((m) => mShort(m.period)), fmt: (v) => MS.money(v),
      series: [{ name: 'Invoiced', cls: 's1', values: r.months.map((m) => m.invoiced) }, { name: 'Received', cls: 's3', values: r.months.map((m) => m.received) }] });
    const t = r.totals;
    $('rMonths').innerHTML = `<table class="pl"><thead><tr><th>Month</th><th>Revenue</th><th>Budget</th><th>Difference</th><th>% of budget</th><th>Invoiced</th><th>Received</th></tr></thead><tbody>
      ${r.months.map((m, i) => `<tr class="acc${cur[i] ? ' cur' : ''}"><td>${esc(mLong(m.period))}${cur[i] ? ' <span class="qhint">this month</span>' : ''}</td><td class="num">${amt(m.revenue)}</td><td class="num">${amt(m.budget)}</td>
        <td class="num${m.variance < 0 ? ' neg' : ''}">${m.budget || m.revenue ? fin.amt(m.variance) : '–'}</td><td class="num">${esc(pct(m.pct_of_budget))}</td><td class="num">${amt(m.invoiced)}</td><td class="num">${amt(m.received)}</td></tr>`).join('')}
      <tr class="tot big"><td>Whole year</td><td class="num">${amt(t.revenue)}</td><td class="num">${amt(t.budget)}</td><td class="num${t.variance < 0 ? ' neg' : ''}">${fin.amt(t.variance)}</td><td class="num">${esc(pct(t.pct_of_budget))}</td><td class="num">${amt(t.invoiced)}</td><td class="num">${amt(t.received)}</td></tr>
      </tbody></table>`;
  }

  function years(r) {
    $('chYears').innerHTML = MS.charts.bars({ title: 'Revenue by year', labels: r.years.map((y) => y.label), fmt: (v) => MS.money(v),
      series: [{ name: 'Budget', cls: 's1', values: r.years.map((y) => y.budget) }, { name: 'Revenue', cls: 's2', values: r.years.map((y) => y.revenue) }] });
    $('rYears').innerHTML = `<table class="pl"><thead><tr><th>Year</th><th>Revenue</th><th>Budget</th><th>% of budget</th><th>Invoiced</th><th>Received</th></tr></thead><tbody>
      ${r.years.map((y) => `<tr class="acc${y.fiscal_year === r.fiscal_year ? ' cur' : ''}"><td><a class="lnk" href="finance/revenue.html?year=${y.fiscal_year}">${esc(y.label)}</a>${y.budget_status && y.budget_status !== 'APPROVED' ? ' <span class="qhint">budget ' + esc(MS.label(y.budget_status).toLowerCase()) + '</span>' : ''}</td>
        <td class="num">${amt(y.revenue)}</td><td class="num">${amt(y.budget)}</td><td class="num">${esc(pct(y.pct_of_budget))}</td><td class="num">${amt(y.invoiced)}</td><td class="num">${amt(y.received)}</td></tr>`).join('')}
      </tbody></table>`;
  }

  function streams(r) {
    if (!r.streams.length) { $('rStreams').innerHTML = '<p class="empty">No revenue has been posted in the books for this year.</p>'; return; }
    $('rStreams').innerHTML = `<table class="pl"><thead><tr><th>Account</th>${r.months.map((m) => `<th>${esc(mShort(m.period))}</th>`).join('')}<th>Year</th></tr></thead><tbody>
      ${r.streams.map((s) => `<tr class="acc"><td>${esc(s.account_code + ' ' + s.account_name)}</td>${s.months.map((v) => `<td class="num">${v ? esc(Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })) : '–'}</td>`).join('')}<td class="num yr">${amt(s.total)}</td></tr>`).join('')}</tbody></table>`;
  }

  async function load() {
    MS.setMsg('rMsg', 'Loading…');
    try {
      const r = await MS.call('REVENUE_REPORT', { fiscal_year: year });
      const ys = r.years.map((y) => y.fiscal_year);
      $('yearSel').innerHTML = ys.slice().reverse().map((y) => { const l = r.years.find((x) => x.fiscal_year === y).label; return `<option value="${y}"${y === r.fiscal_year ? ' selected' : ''}>${esc(l)}${y === r.current_fiscal_year ? ' (this year)' : ''}</option>`; }).join('');
      $('rTitle').textContent = 'Revenue ' + r.label + (r.budget ? ' · budget ' + r.budget.budget_name + ' v' + r.budget.version + ' (' + MS.label(r.budget.status).toLowerCase() + ')' : ' · no budget');
      cards(r); months(r); years(r); streams(r);
      $('rNote').textContent = r.note + (r.budget && r.budget.status !== 'APPROVED' ? ' The revenue budget shown is not approved yet.' : '');
      MS.setMsg('rMsg', '');
    } catch (err) { MS.setMsg('rMsg', err.message, 'error'); }
  }

  MS.boot({ page: 'revenue', any: ['FINANCE_VIEW', 'BUDGET_MANAGE', 'BUDGET_APPROVE'], ref: true }).then(() => {
    year = Number(MS.param('year')) || 0;
    $('yearSel').addEventListener('change', () => { year = Number($('yearSel').value); load(); });
    $('printBtn').addEventListener('click', () => window.print());
    load();
  });
})();
