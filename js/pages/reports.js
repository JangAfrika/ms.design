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

  async function runCF() {
    MS.setMsg('rMsg', 'Working it out…');
    try {
      const r = await MS.call('CASH_FLOW_GET', { from: $('cfFrom').value, to: $('cfTo').value });
      MS.setMsg('rMsg', 'From ' + MS.shortDate(r.from) + ' to ' + MS.shortDate(r.to) + ' · from the books: tills, banks and mobile money');
      const ms = r.months, n = ms.length;
      const cols = (vals, total, bold) => (n > 1 ? vals.map((v) => `<td class="num${cls(v)}">${amt(v)}</td>`).join('') : '') + `<td class="num${cls(total)}">${bold ? '<b>' + amt(total) + '</b>' : amt(total)}</td>`;
      const op = r.operating;
      $('rCards').innerHTML = `
        <div class="card"><div class="k">Cash at the start</div><div class="v${cls(r.opening.total)}">${fin.amt(r.opening.total)}</div><div class="s">${esc(MS.shortDate(r.from))}</div></div>
        <div class="card"><div class="k">Money in (day-to-day)</div><div class="v">${MS.money(op.inflow_total)}</div><div class="s">customers, refunds, other</div></div>
        <div class="card"><div class="k">Money out (day-to-day)</div><div class="v">${MS.money(op.outflow_total)}</div><div class="s">suppliers, pay, tax, costs</div></div>
        <div class="card${r.closing.total < 0 ? ' red' : ''}"><div class="k">Cash at the end</div><div class="v${cls(r.closing.total)}">${fin.amt(r.closing.total)}</div><div class="s">${r.net_change.total < 0 ? 'down' : 'up'} ${esc(MS.money(Math.abs(r.net_change.total)))} in the period</div></div>`;
      const head = `<thead><tr><th>Where the money went</th>${n > 1 ? ms.map((k) => `<th>${esc(mLabel(k))}</th>`).join('') : ''}<th>Total</th></tr></thead>`;
      const span = (n > 1 ? n : 0) + 2;
      const section = (s) => `<tr class="grp"><td colspan="${span}">${esc(s.label)}</td></tr>` +
        (s.lines.length ? s.lines.map((l) => `<tr class="acc"><td>${esc(l.label)}</td>${cols(l.net, l.net_total)}</tr>`).join('') : `<tr class="acc"><td colspan="${span}" class="fin-note">Nothing in this period.</td></tr>`) +
        `<tr class="tot"><td>Net ${esc(s.label.toLowerCase())}</td>${cols(s.net, s.net_total)}</tr>`;
      $('rBody').innerHTML = `<table class="pl">${head}<tbody>
        <tr class="grp"><td colspan="${span}">Day-to-day business</td></tr>
        <tr class="acc"><td>Money in</td>${cols(op.inflow, op.inflow_total)}</tr>
        <tr class="acc"><td>Money out</td>${cols(op.outflow.map((v) => -v), -op.outflow_total)}</tr>
        <tr class="tot big"><td>Net cash from day-to-day business</td>${cols(op.net, op.net_total, true)}</tr>
        <tr class="grp"><td colspan="${span}">Of which, by what it was for</td></tr>
        ${r.sections[0].lines.length ? r.sections[0].lines.map((l) => `<tr class="acc"><td>${esc(l.label)}</td>${cols(l.net, l.net_total)}</tr>`).join('') : `<tr class="acc"><td colspan="${span}" class="fin-note">Nothing in this period.</td></tr>`}
        ${section(r.sections[1])}${section(r.sections[2])}
        <tr class="tot big"><td>Net change in cash</td>${cols(r.net_change.months, r.net_change.total, true)}</tr>
        <tr class="acc"><td>Cash at the start</td>${cols(r.opening.months, r.opening.total)}</tr>
        <tr class="tot big"><td>Cash at the end</td>${cols(r.closing.months, r.closing.total, true)}</tr>
        <tr class="check${r.balance_check.ok ? '' : ' bad'}"><td colspan="${span}">${r.balance_check.ok ? '✓ Agrees with the balances of the till, bank and mobile money accounts: ' + esc(MS.money(r.balance_check.books)) + '.' : '✗ Does not agree with the account balances (' + esc(MS.money(r.balance_check.books)) + ') – tell the Finance Officer.'}</td></tr>
      </tbody></table>
      <p class="fin-note">Money moved between your own tills and banks is not counted. A customer deposit counts when it is received, not when the job is invoiced.</p>`;
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
        <tr class="check${r.balanced ? '' : ' bad'}"><td colspan="5">${r.balanced ? '✓ The books balance.' : '✗ The books do not balance – tell the Finance Officer.'}</td></tr>
      </tbody></table>`;
    } catch (err) { MS.setMsg('rMsg', err.message, 'error'); $('rBody').innerHTML = ''; $('rCards').innerHTML = ''; }
  }

  function show(t) {
    tab = t;
    $('tabs').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    $('plHead').hidden = t !== 'pl'; $('cfHead').hidden = t !== 'cf'; $('bsHead').hidden = t !== 'bs'; $('tbHead').hidden = t !== 'tb';
    const title = { pl: 'Profit & loss', cf: 'Cash flow', bs: 'Balance sheet', tb: 'Trial balance' }[t];
    $('rTitle').textContent = title;
    document.title = title + ' · MS BMS';
    ({ pl: runPL, cf: runCF, bs: runBS, tb: runTB })[t]();
  }

  MS.boot({ page: 'reports', any: ['FINANCE_VIEW'], ref: true }).then(() => {
    const today = MS.todayISO();
    $('plFrom').value = today.slice(0, 4) + '-01-01';
    $('plTo').value = today; $('bsAsOf').value = today; $('tbTo').value = today;
    $('cfFrom').value = today.slice(0, 4) + '-01-01'; $('cfTo').value = today;
    $('plDept').innerHTML = MS.options(((MS.refCache && MS.refCache.departments) || []).map((d) => ({ value: d.department_id, label: d.department_name })), '', 'Whole company');
    $('tabs').addEventListener('click', (e) => { const b = e.target.closest('button[data-tab]'); if (b) show(b.dataset.tab); });
    $('plRun').onclick = runPL; $('cfRun').onclick = runCF; $('bsRun').onclick = runBS; $('tbRun').onclick = runTB;
    $('printBtn').onclick = () => window.print();
    show(['cf', 'bs', 'tb'].indexOf(MS.param('tab')) >= 0 ? MS.param('tab') : 'pl');
  });
})();
