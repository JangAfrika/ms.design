/* Finance reports from the books: Profit & loss (month by month for a date range), Balance sheet, Trial balance. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const fin = MS.fin;
  let tab = 'pl';
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mLabel = (k) => MONTHS[Number(k.slice(5, 7)) - 1] + ' ' + k.slice(2, 4);
  const amt = (n) => (Number(n) ? fin.amt(n) : '–');
  const cls = (n) => (Number(n) < 0 ? ' neg' : '');

  async function runPL() {
    MS.setMsg('rMsg', 'Working it out…');
    try {
      const r = await MS.call('PROFIT_LOSS', { from: $('plFrom').value, to: $('plTo').value, by: $('plBy').value, department_id: $('plDept').value });
      MS.setMsg('rMsg', 'From ' + MS.shortDate(r.from) + ' to ' + MS.shortDate(r.to) + ($('plDept').value ? ' · ' + $('plDept').selectedOptions[0].textContent : ''));
      const ms = r.months || [];
      const cols = (vals, total) => (ms.length ? vals.map((v) => `<td class="num${cls(v)}">${amt(v)}</td>`).join('') : '') + `<td class="num${cls(total)}"><b>${amt(total)}</b></td>`;
      const section = (title, s) => `<tr class="grp"><td colspan="${ms.length + 2}">${esc(title)}</td></tr>` +
        (s.accounts.length ? s.accounts.map((a) => `<tr class="acc"><td>${esc(a.account_code + ' ' + a.account_name)}</td>${cols(a.months || [], a.amount)}</tr>`).join('') : `<tr class="acc"><td colspan="${ms.length + 2}" class="fin-note">Nothing in this period.</td></tr>`) +
        `<tr class="tot"><td>Total ${esc(title.toLowerCase())}</td>${cols(s.months, s.total)}</tr>`;
      $('rCards').innerHTML = `
        <div class="card"><div class="k">Revenue</div><div class="v">${MS.money(r.revenue.total)}</div><div class="s">sales after discounts</div></div>
        <div class="card"><div class="k">Gross profit</div><div class="v${cls(r.gross_profit.total)}">${fin.amt(r.gross_profit.total)}</div><div class="s">${r.gross_margin_pct === null ? '' : esc(r.gross_margin_pct) + '% of revenue'}</div></div>
        <div class="card"><div class="k">Expenses</div><div class="v">${MS.money(r.expenses.total)}</div><div class="s">running costs</div></div>
        <div class="card${r.net_profit.total < 0 ? ' red' : ''}"><div class="k">${r.net_profit.total < 0 ? 'Net loss' : 'Net profit'}</div><div class="v${cls(r.net_profit.total)}">${fin.amt(r.net_profit.total)}</div><div class="s">for the period</div></div>`;
      $('rBody').innerHTML = `<table class="pl"><thead><tr><th>Account</th>${ms.map((k) => `<th>${esc(mLabel(k))}</th>`).join('')}<th>Total</th></tr></thead><tbody>
        ${section('Revenue', r.revenue)}${section('Cost of sales', r.cost_of_sales)}
        <tr class="tot big"><td>Gross profit</td>${cols(r.gross_profit.months, r.gross_profit.total)}</tr>
        ${section('Expenses', r.expenses)}
        <tr class="tot big"><td>Net profit / (loss)</td>${cols(r.net_profit.months, r.net_profit.total)}</tr>
      </tbody></table>`;
    } catch (err) { MS.setMsg('rMsg', err.message, 'error'); $('rBody').innerHTML = ''; $('rCards').innerHTML = ''; }
  }

  async function runBS() {
    MS.setMsg('rMsg', 'Working it out…');
    try {
      const r = await MS.call('BALANCE_SHEET', { as_of: $('bsAsOf').value });
      MS.setMsg('rMsg', 'As at ' + MS.shortDate(r.as_of) + ' · financial year from ' + MS.shortDate(r.fiscal_year_start));
      const sect = (title, s) => `<tr class="grp"><td colspan="2">${esc(title)}</td></tr>` +
        (s.accounts.length ? s.accounts.map((a) => `<tr class="acc"><td>${esc((a.account_code ? a.account_code + ' ' : '') + a.account_name)}</td><td class="num${cls(a.amount)}">${fin.amt(a.amount)}</td></tr>`).join('') : '<tr class="acc"><td colspan="2" class="fin-note">Nothing yet.</td></tr>') +
        `<tr class="tot"><td>Total ${esc(title.toLowerCase())}</td><td class="num${cls(s.total)}">${fin.amt(s.total)}</td></tr>`;
      $('rCards').innerHTML = `
        <div class="card"><div class="k">What the business owns</div><div class="v">${MS.money(r.total_assets)}</div><div class="s">total assets</div></div>
        <div class="card"><div class="k">What it owes</div><div class="v">${MS.money(r.liabilities.total)}</div><div class="s">total liabilities</div></div>
        <div class="card"><div class="k">Owner's equity</div><div class="v${cls(r.equity.total)}">${fin.amt(r.equity.total)}</div><div class="s">capital and results</div></div>
        <div class="card${r.balanced ? '' : ' red'}"><div class="k">Check</div><div class="v">${r.balanced ? 'Balances' : 'Does not balance'}</div><div class="s">assets = liabilities + equity</div></div>`;
      $('rBody').innerHTML = `<table class="pl"><tbody>${sect('Assets', r.assets)}${sect('Liabilities', r.liabilities)}${sect('Equity', r.equity)}
        <tr class="tot big"><td>Liabilities + equity</td><td class="num">${fin.amt(r.total_liabilities_equity)}</td></tr></tbody></table>`;
    } catch (err) { MS.setMsg('rMsg', err.message, 'error'); $('rBody').innerHTML = ''; $('rCards').innerHTML = ''; }
  }

  async function runTB() {
    MS.setMsg('rMsg', 'Working it out…');
    try {
      const r = await MS.call('TRIAL_BALANCE', { from: $('tbFrom').value, to: $('tbTo').value });
      MS.setMsg('rMsg', (r.from ? 'From ' + MS.shortDate(r.from) + ' ' : 'All entries ') + 'to ' + MS.shortDate(r.to || MS.todayISO()));
      $('rCards').innerHTML = `<div class="card${r.balanced ? '' : ' red'}"><div class="k">Check</div><div class="v">${r.balanced ? 'Debits = credits' : 'Out of balance'}</div><div class="s">${r.rows.length} accounts with entries</div></div>
        <div class="card"><div class="k">Total debits</div><div class="v">${MS.money(r.totals.debit)}</div></div>
        <div class="card"><div class="k">Total credits</div><div class="v">${MS.money(r.totals.credit)}</div></div>`;
      $('rBody').innerHTML = `<table class="pl"><thead><tr><th>Account</th><th>Debits</th><th>Credits</th><th>Balance Dr</th><th>Balance Cr</th></tr></thead><tbody>
        ${r.rows.length ? r.rows.map((a) => `<tr><td>${esc(a.account_code + ' ' + a.account_name)}</td><td class="num">${amt(a.debit)}</td><td class="num">${amt(a.credit)}</td><td class="num">${amt(a.balance_debit)}</td><td class="num">${amt(a.balance_credit)}</td></tr>`).join('') : '<tr><td colspan="5" class="fin-note">No entries.</td></tr>'}
        <tr class="tot big"><td>Totals</td><td class="num">${MS.money(r.totals.debit)}</td><td class="num">${MS.money(r.totals.credit)}</td><td class="num">${MS.money(r.totals.balance_debit)}</td><td class="num">${MS.money(r.totals.balance_credit)}</td></tr>
        <tr class="check${r.balanced ? '' : ' bad'}"><td colspan="5">${r.balanced ? '✓ The books balance.' : '✗ The books do not balance – tell the Finance Manager.'}</td></tr>
      </tbody></table>`;
    } catch (err) { MS.setMsg('rMsg', err.message, 'error'); $('rBody').innerHTML = ''; $('rCards').innerHTML = ''; }
  }

  function show(t) {
    tab = t;
    $('tabs').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    $('plHead').hidden = t !== 'pl'; $('bsHead').hidden = t !== 'bs'; $('tbHead').hidden = t !== 'tb';
    const title = { pl: 'Profit & loss', bs: 'Balance sheet', tb: 'Trial balance' }[t];
    $('rTitle').textContent = title;
    document.title = title + ' · MS BMS';
    ({ pl: runPL, bs: runBS, tb: runTB })[t]();
  }

  MS.boot({ page: 'reports', any: ['FINANCE_VIEW'], ref: true }).then(() => {
    const today = MS.todayISO();
    $('plFrom').value = today.slice(0, 4) + '-01-01';
    $('plTo').value = today; $('bsAsOf').value = today; $('tbTo').value = today;
    $('plDept').innerHTML = MS.options(((MS.refCache && MS.refCache.departments) || []).map((d) => ({ value: d.department_id, label: d.department_name })), '', 'Whole company');
    $('tabs').addEventListener('click', (e) => { const b = e.target.closest('button[data-tab]'); if (b) show(b.dataset.tab); });
    $('plRun').onclick = runPL; $('bsRun').onclick = runBS; $('tbRun').onclick = runTB;
    $('printBtn').onclick = () => window.print();
    show(['bs', 'tb'].indexOf(MS.param('tab')) >= 0 ? MS.param('tab') : 'pl');
  });
})();
