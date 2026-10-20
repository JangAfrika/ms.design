/* The Finance Manager's monthly financial report. Without ?period: every month with its report status, due date and
   whether it was on time (the KPI). With ?period=YYYY-MM: the report itself — figures frozen from the books, the
   narrative (highlights, problems, recommendations), submit (month must be closed), GM / CEO approve or return, print. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const fin = MS.fin;
  const period = MS.param('period');
  let data = null;

  const REPORT = { NOT_STARTED: ['off', 'Not started'], DRAFT: ['pending', 'Draft'], SUBMITTED: ['waiting', 'Waiting for review'], RETURNED: ['failed', 'Returned for changes'], APPROVED: ['ok', 'Approved'] };
  const BOOKS = { OPEN: ['pending', 'Books open'], CLOSING: ['waiting', 'Closing'], CLOSED: ['ok', 'Books closed'] };
  const pill = (map, s) => { const t = map[s] || ['off', MS.label(s)]; return `<span class="pill ${t[0]}">${esc(t[1])}</span>`; };
  const amt = (n) => (n === null || n === undefined ? '–' : fin.amt(n));
  const neg = (n) => (Number(n) < 0 ? ' neg' : '');
  const pct = (n) => (n === null || n === undefined ? '–' : (Number(n) > 0 ? '+' : '') + Number(n).toFixed(1) + '%');
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = (p) => MONTHS[Number(String(p).slice(5, 7)) - 1] + ' ' + String(p).slice(0, 4);

  /* ================= the list ================= */
  async function loadList() {
    $('dTitle').textContent = 'Monthly financial reports';
    MS.setMsg('dStatus', 'Loading…');
    try {
      const r = await MS.call('FIN_REPORT_LIST', {});
      MS.setMsg('dStatus', '');
      const ot = r.on_time;
      const waiting = r.rows.filter((x) => x.status === 'SUBMITTED').length;
      const overdue = r.rows.filter((x) => x.overdue).length;
      $('dBody').innerHTML = `
        <div class="cards fin-cards">
          <div class="card${ot.submitted && ot.on_time < ot.submitted ? ' red' : ot.submitted ? ' green' : ''}"><div class="k">On time</div><div class="v">${ot.submitted ? esc(ot.on_time + ' of ' + ot.submitted) : '–'}</div><div class="s">reports submitted by the due date (last 12)</div></div>
          <div class="card${overdue ? ' red' : ''}"><div class="k">Overdue</div><div class="v">${overdue}</div><div class="s">past the due date, not submitted</div></div>
          <div class="card"><div class="k">Waiting for review</div><div class="v">${waiting}</div><div class="s">with the GM or CEO</div></div>
        </div>
        <div class="tablewrap"><table class="inv">
          <thead><tr><th>Month</th><th>Books</th><th>Report</th><th>Due</th><th>Submitted</th><th class="num">Revenue</th><th class="num">Net profit</th></tr></thead>
          <tbody id="repBody">${r.rows.length ? r.rows.map((x) => `
            <tr class="clk" data-href="finance/monthly-report.html?period=${encodeURIComponent(x.period)}">
              <td><b>${MS.lnk('finance/monthly-report.html?period=' + encodeURIComponent(x.period), x.month_name)}</b>${!x.ended ? '<span class="sub">Month in progress</span>' : ''}</td>
              <td>${pill(BOOKS, x.period_status)}</td>
              <td>${pill(REPORT, x.status)}${x.prepared_by_name ? `<span class="sub">${esc(x.prepared_by_name)}</span>` : ''}</td>
              <td class="${x.overdue ? 'late' : ''}">${esc(MS.shortDate(x.due_date))}${x.overdue ? `<span class="sub late">${esc(x.days_late)} days overdue</span>` : ''}</td>
              <td>${x.first_submitted_at ? esc(MS.shortDate(x.first_submitted_at)) + (x.late ? ` <span class="pill failed">Late</span>` : ' <span class="pill ok">On time</span>') : ''}</td>
              <td class="num">${x.revenue === null ? '' : MS.money(x.revenue)}</td>
              <td class="num${neg(x.net_profit)}">${x.net_profit === null ? '' : fin.amt(x.net_profit)}</td>
            </tr>`).join('') : '<tr><td colspan="7" class="empty">No months in the books yet.</td></tr>'}</tbody>
        </table></div>
        <p class="fin-note">Each report is due on day ${esc(dueDay(r.rows))} of the following month. It can be submitted once the month is closed under <a class="lnk" href="finance/close.html">Month-end close</a>, so its figures are final.</p>`;
      MS.clickable($('repBody'));
    } catch (err) { MS.setMsg('dStatus', err.message, 'error'); }
  }
  const dueDay = (rows) => (rows[0] ? Number(String(rows[0].due_date).slice(8, 10)) : 10);

  /* ================= one report ================= */
  async function loadOne() {
    MS.setMsg('dStatus', 'Loading…');
    try { render(await MS.call('FIN_REPORT_GET', { period })); MS.setMsg('dStatus', ''); }
    catch (err) { MS.setMsg('dStatus', err.message, 'error'); $('dBody').innerHTML = '<p><a class="lnk" href="finance/monthly-report.html">Back to the reports</a></p>'; }
  }

  function table(head, rows, foot, cls) {
    return `<div class="tablewrap"><table class="inv rep-t${cls ? ' ' + cls : ''}"><thead><tr>${head.map((h) => `<th${/num/.test(h[1] || '') ? ' class="num"' : ''}>${esc(h[0])}</th>`).join('')}</tr></thead>
      <tbody>${rows.length ? rows.join('') : `<tr><td colspan="${head.length}" class="fin-note">None.</td></tr>`}</tbody>${foot ? `<tfoot>${foot}</tfoot>` : ''}</table></div>`;
  }
  const sec = (title, body, cls) => `<section class="rep-sec${cls ? ' ' + cls : ''}"><h3>${esc(title)}</h3>${body}</section>`;

  function figures(s) {
    const h = s.headline;
    const k = (label, v, sub) => `<div class="rep-k"><div class="k">${esc(label)}</div><div class="v${neg(v)}">${amt(v)}</div>${sub ? `<div class="s">${esc(sub)}</div>` : ''}</div>`;
    const kpis = [
      k('Revenue', h.revenue), k('Cost of sales', h.cost_of_sales), k('Gross profit', h.gross_profit, s.profit_loss.gross_margin_pct === null ? '' : s.profit_loss.gross_margin_pct + '% margin'),
      k('Operating expenses', h.operating_expenses), k('Payroll', h.payroll, 'salaries and employer social security'), k('Utilities', h.utilities, 'electricity and telephone'),
      k('Fuel', h.fuel, 'vehicles and generator'), k('Overtime', h.overtime), k('Other expenses', h.other_expenses), k(h.net_profit < 0 ? 'Net loss' : 'Net profit', h.net_profit),
      k('Receivables', h.receivables, 'customers owe at month end'), k('Payables', h.payables, 'suppliers, taxes and staff'), k('Cash position', h.cash), k('Bank position', h.bank, 'banks and mobile money'),
      k('Inventory value', h.inventory)
    ];
    const pl = s.profit_loss;
    const accRows = (list) => list.map((a) => `<tr class="acc"><td>${esc(a.code + ' ' + a.name)}</td><td class="num${neg(a.amount)}">${amt(a.amount)}</td></tr>`).join('');
    const tot = (label, v, big) => `<tr class="tot${big ? ' big' : ''}"><td>${esc(label)}</td><td class="num${neg(v)}">${amt(v)}</td></tr>`;
    const plHtml = `<div class="tablewrap"><table class="inv rep-t rep-pl"><tbody>
      <tr class="hd"><td colspan="2">Revenue by service line</td></tr>${accRows(pl.revenue.accounts) || '<tr class="acc"><td colspan="2" class="fin-note">No sales this month.</td></tr>'}${tot('Total revenue', pl.revenue.total)}
      <tr class="hd"><td colspan="2">Cost of sales</td></tr>${accRows(pl.cost_of_sales.accounts)}${tot('Total cost of sales', pl.cost_of_sales.total)}
      ${tot('Gross profit' + (pl.gross_margin_pct === null ? '' : ' (' + pl.gross_margin_pct + '%)'), pl.gross_profit, true)}
      <tr class="hd"><td colspan="2">Expenses</td></tr>${accRows(pl.expenses.accounts)}${tot('Total expenses', pl.expenses.total)}
      ${tot(pl.net_profit < 0 ? 'Net loss' : 'Net profit', pl.net_profit, true)}
    </tbody></table></div>`;
    const cmp = ['revenue', 'cost_of_sales', 'gross_profit', 'expenses', 'net_profit'].map((key) => {
      const label = { revenue: 'Revenue', cost_of_sales: 'Cost of sales', gross_profit: 'Gross profit', expenses: 'Expenses', net_profit: 'Net profit' }[key];
      const thisM = key === 'expenses' ? h.operating_expenses : h[key];
      return `<tr><td>${label}</td><td class="num${neg(thisM)}">${amt(thisM)}</td><td class="num${neg(s.previous[key])}">${amt(s.previous[key])}</td><td class="num${neg(s.change[key].amount)}">${amt(s.change[key].amount)}<span class="sub">${pct(s.change[key].pct)}</span></td></tr>`;
    });
    const r = s.receivables, ag = r.ageing;
    const cash = s.cash_bank;
    const pay = s.payroll;
    const bud = s.budget;
    const jobs = s.jobs;
    return `
      <div class="rep-kpis">${kpis.join('')}</div>
      <div class="rep-two">
        ${sec('Profit & loss for the month', plHtml)}
        <div>
          ${sec('Compared with ' + monthName(s.previous.period), table([['', ''], ['This month', 'num'], ['Last month', 'num'], ['Change', 'num']], cmp))}
          ${sec('Cash and bank at month end', table([['Account', ''], ['Balance', 'num']], cash.accounts.map((a) => `<tr><td>${esc(a.code + ' ' + a.name)}${a.linked.length ? `<span class="sub">${esc(a.linked.join(', '))}</span>` : ''}</td><td class="num${neg(a.balance)}">${amt(a.balance)}</td></tr>`),
            `<tr><td>Cash ${amt(cash.cash_total)} · Bank ${amt(cash.bank_total)}</td><td class="num">${amt(cash.total)}</td></tr>`))}
          ${sec('Collections in the month', `<p class="rep-line">${amt(s.collections.total)} received from customers in ${esc(s.collections.count)} payment${s.collections.count === 1 ? '' : 's'}${Object.keys(s.collections.by_method).length ? ' (' + Object.keys(s.collections.by_method).map((m) => esc(MS.label(m).toLowerCase()) + ' ' + MS.money(s.collections.by_method[m])).join(', ') + ')' : ''}.</p>`)}
        </div>
      </div>
      ${sec('Receivables at month end', `
        ${table([['Current', 'num'], ['1–30 days', 'num'], ['31–60', 'num'], ['61–90', 'num'], ['Over 90', 'num'], ['Total', 'num']],
          [`<tr>${['CURRENT', '1-30', '31-60', '61-90', '90+', 'total'].map((b) => `<td class="num${b === 'total' ? ' b' : ''}${b === '90+' && ag[b] ? ' neg' : ''}">${amt(ag[b])}</td>`).join('')}</tr>`], '', 'rep-ageing')}
        <p class="rep-line">In the books (1100 Receivable): <b>${amt(r.ledger_total)}</b> · Customer deposits held (2150): <b>${amt(s.customer_deposits)}</b> · ${esc(r.open_invoices)} open invoice${r.open_invoices === 1 ? '' : 's'}, ${amt(r.overdue_total)} overdue.</p>
        ${r.top_overdue.length ? `<h4>Largest overdue invoices</h4>` + table([['Invoice', ''], ['Customer', ''], ['Due', ''], ['Days late', 'num'], ['Owed', 'num']],
          r.top_overdue.map((i) => `<tr><td>${MS.lnk('finance/invoice.html?id=' + encodeURIComponent(i.invoice_id), i.invoice_number)}</td><td>${esc(i.customer_name)}</td><td>${esc(MS.shortDate(i.due_date))}</td><td class="num">${esc(i.days_overdue)}</td><td class="num">${amt(i.balance)}</td></tr>`)) : ''}`)}
      <div class="rep-two">
        ${sec('Payables and amounts owed', table([['Account', ''], ['Balance', 'num']], s.payables.accounts.map((a) => `<tr><td>${esc(a.code + ' ' + a.name)}</td><td class="num${neg(a.balance)}">${amt(a.balance)}</td></tr>`),
          s.payables.accounts.length ? `<tr><td>Total</td><td class="num">${amt(s.payables.total)}</td></tr>` : ''))}
        ${sec('Payroll', pay.run ? MS.kv([['Payroll run', MS.label(pay.run.status)], ['Staff paid', String(pay.run.employee_count)], ['Gross pay', MS.money(pay.run.total_gross)], ['Deductions', MS.money(pay.run.total_deductions)], ['Net pay', MS.money(pay.run.total_net)], ['Employer contributions', MS.money(pay.run.total_employer_contributions)], ['Staff cost in the books', MS.money(pay.ledger_cost)]])
          : `<p class="rep-line">No payroll run in the system for this month. Staff cost in the books (salaries, overtime, employer social security): <b>${amt(pay.ledger_cost)}</b>.</p>`)}
      </div>
      ${sec('Job profitability (' + jobs.count + ' job' + (jobs.count === 1 ? '' : 's') + ' with sales or costs this month)', table([['Job', ''], ['Customer', ''], ['Revenue', 'num'], ['Costs', 'num'], ['Profit', 'num'], ['Margin', 'num']],
        jobs.rows.map((j) => `<tr><td>${MS.can('JOB_VIEW') ? MS.lnk('jobs/job.html?id=' + encodeURIComponent(j.job_id), j.job_number) : esc(j.job_number)}<span class="sub">${esc(j.job_name)}</span></td><td>${esc(j.customer_name)}</td><td class="num">${amt(j.revenue)}</td><td class="num">${amt(j.costs)}</td><td class="num${neg(j.profit)}">${amt(j.profit)}</td><td class="num">${j.margin_pct === null ? '–' : esc(j.margin_pct) + '%'}</td></tr>`),
        jobs.rows.length ? `<tr><td colspan="2">All jobs${jobs.count > jobs.rows.length ? ' (top ' + jobs.rows.length + ' shown)' : ''}</td><td class="num">${amt(jobs.totals.revenue)}</td><td class="num">${amt(jobs.totals.costs)}</td><td class="num${neg(jobs.totals.profit)}">${amt(jobs.totals.profit)}</td><td></td></tr>` : ''))}
      ${sec('Budget against actual', bud.available ? table([['Account', ''], ['Budget', 'num'], ['Actual', 'num'], ['Difference', 'num'], ['', '']],
        bud.rows.map((b) => `<tr><td>${esc(b.code + ' ' + b.name)}</td><td class="num">${amt(b.budget)}</td><td class="num">${amt(b.actual)}</td><td class="num${neg(b.variance)}">${amt(b.variance)}${b.variance_pct === null ? '' : ' (' + pct(b.variance_pct) + ')'}</td><td><span class="rag ${esc(b.rag.toLowerCase())}">${esc(b.rag === 'GREEN' ? 'On track' : b.rag === 'AMBER' ? 'Watch' : 'Off track')}</span></td></tr>`),
        `<tr><td>Revenue ${amt(bud.revenue.actual)} of ${amt(bud.revenue.budget)} · Costs ${amt(bud.costs.actual)} of ${amt(bud.costs.budget)}</td><td colspan="4"></td></tr>`)
        : '<p class="rep-line">There is no approved budget for this month.</p>')}
      ${sec('GRA obligations due or overdue', table([['Obligation', ''], ['For', ''], ['Due', ''], ['Amount', 'num'], ['Status', '']],
        s.gra.rows.map((g) => `<tr><td>${esc(MS.label(g.type))}</td><td>${esc(g.period)}</td><td class="${g.overdue ? 'late' : ''}">${esc(MS.shortDate(g.due_date))}</td><td class="num">${g.amount_due ? amt(g.amount_due) : ''}</td><td>${g.overdue ? '<span class="pill failed">Overdue</span>' : MS.pill(g.status)}</td></tr>`)))}
      <p class="fin-note">Trial balance up to ${esc(MS.shortDate(s.meta.to))}: ${s.trial_balance.balanced ? 'debits equal credits' : 'OUT OF BALANCE'} (${amt(s.trial_balance.debit)}). Figures taken from the books on ${esc(MS.when(s.meta.generated_at))}${s.meta.generated_by_name ? ' by ' + esc(s.meta.generated_by_name) : ''}${s.meta.period_status !== 'CLOSED' ? ', while the month was still open (they may still change)' : ', after the month was closed'}.</p>`;
  }

  function narrative(rep) {
    const n = rep ? rep.narrative : { highlights: '', problems: '', recommendations: '' };
    const parts = [['highlights', 'Highlights of the month', 'What went well: big jobs, new customers, better margins…'], ['problems', 'Problems and risks', 'Late payers, cost increases, machine breakdowns, cash pressure…'], ['recommendations', 'Recommendations', 'What management should decide or do next…']];
    if (rep && rep.can_edit) {
      return sec('Finance Manager\'s comments', `<div class="rep-narr-edit no-print">${parts.map(([k, t, ph]) => `<label${k === 'highlights' ? ' class="req"' : ''}>${esc(t)} <textarea id="n_${k}" rows="4" maxlength="6000" placeholder="${esc(ph)}">${esc(n[k])}</textarea></label>`).join('')}
        <div class="lines-foot" style="justify-content:flex-end"><span class="fin-note" id="narrMsg"></span><button type="button" id="narrSave">Save comments</button></div></div>
        <div class="rep-narr print-only">${parts.map(([k, t]) => n[k] ? `<h4>${esc(t)}</h4><p>${esc(n[k])}</p>` : '').join('')}</div>`, 'rep-narrative');
    }
    const any = parts.some(([k]) => n[k]);
    return sec('Finance Manager\'s comments', any ? `<div class="rep-narr">${parts.map(([k, t]) => n[k] ? `<h4>${esc(t)}</h4><p>${esc(n[k])}</p>` : '').join('')}</div>` : '<p class="rep-line">No comments yet.</p>', 'rep-narrative');
  }

  const readNarr = () => ({ highlights: $('n_highlights').value, problems: $('n_problems').value, recommendations: $('n_recommendations').value });

  function render(d) {
    data = d;
    const rep = d.report;
    const p = rep ? rep.period : d.period;
    const name = rep ? rep.month_name : d.month_name;
    const status = rep ? rep.status : 'NOT_STARTED';
    const bookStatus = rep ? rep.period_status : d.period_status;
    const s = rep ? rep.data_snapshot : d.preview;
    document.title = 'Financial report ' + name + ' · MS BMS';
    $('dCrumbs').hidden = false;
    $('dCrumbs').innerHTML = `<a href="finance/monthly-report.html">Monthly financial reports</a> › ${esc(name)}`;
    $('dTitle').innerHTML = 'Financial report ' + esc(name) + ' ' + pill(REPORT, status);
    $('dActions').innerHTML = [
      !rep && d.can_create && '<button type="button" class="primary" data-act="start">Start the report</button>',
      rep && rep.can_edit && '<button type="button" data-act="refresh">Take figures again</button>',
      rep && rep.can_edit && `<button type="button" class="primary" data-act="submit"${rep.can_submit ? '' : ' disabled title="Close the month first"'}>Submit for review</button>`,
      rep && rep.can_review && '<button type="button" class="primary" data-act="approve">Approve</button>',
      rep && rep.can_review && '<button type="button" class="danger" data-act="return">Return for changes</button>',
      `<a class="btn" href="finance/close.html?period=${encodeURIComponent(p)}">Month-end close</a>`,
      '<button type="button" data-act="print">Print / PDF</button>'
    ].filter(Boolean).join('');
    const due = rep ? rep.due_date : d.due_date;
    const notices = [];
    if (!rep) notices.push('This is a preview worked out from the books now. ' + (d.can_create ? 'Start the report to save it and write your comments.' : 'The Finance Manager has not started this report yet.'));
    if (rep && rep.status === 'RETURNED' && rep.review_comment) notices.push(`<b>Returned by ${esc(rep.reviewed_by_name)}:</b> ${esc(rep.review_comment)}`);
    if (rep && rep.can_edit && bookStatus !== 'CLOSED') notices.push(`The books for ${esc(name)} are not closed yet, so the figures can still change. The report can be submitted once the month is closed under <a href="finance/close.html?period=${encodeURIComponent(p)}">Month-end close</a>; the figures are then taken again from the closed books.`);
    if (rep && rep.reopened_after) notices.push('The month was reopened after these figures were taken. They may no longer match the books.');
    if (rep && rep.overdue) notices.push(`This report was due on ${esc(MS.shortDate(due))} (${esc(rep.days_late)} days ago).`);
    if (!rep && d.due_date && MS.todayISO() > d.due_date) notices.push(`This report was due on ${esc(MS.shortDate(d.due_date))}.`);
    const timing = rep && rep.first_submitted_at ? (rep.late ? `<span class="pill failed">Late</span> ${esc(rep.days_late)} day${rep.days_late === 1 ? '' : 's'} after the due date` : '<span class="pill ok">On time</span>') : '';
    $('dBody').innerHTML = `
      ${notices.map((n) => `<div class="notice-bar no-print">${n}</div>`).join('')}
      <div class="fdoc rep-doc">
        ${fin.head(rep ? rep.company : d.company, 'MONTHLY FINANCIAL REPORT', name, '')}
        <div class="fdoc-parties">
          <div class="box"><dl class="fdoc-facts">
            <dt>Period</dt><dd>${esc(MS.shortDate(s.meta.from))} – ${esc(MS.shortDate(s.meta.to))}</dd>
            <dt>Books</dt><dd>${pill(BOOKS, bookStatus)}</dd>
            <dt>Due</dt><dd>${esc(MS.shortDate(due))}</dd>
          </dl></div>
          <div class="box"><dl class="fdoc-facts">
            ${rep ? `<dt>Prepared by</dt><dd>${esc(rep.prepared_by_name)}</dd>` : ''}
            ${rep && rep.first_submitted_at ? `<dt>Submitted</dt><dd>${esc(MS.when(rep.submitted_at))} ${timing}</dd>` : ''}
            ${rep && rep.reviewed_by_name ? `<dt>${rep.status === 'APPROVED' ? 'Approved by' : 'Reviewed by'}</dt><dd>${esc(rep.reviewed_by_name)} · ${esc(MS.when(rep.reviewed_at))}${rep.status === 'APPROVED' && rep.review_comment ? ' — ' + esc(rep.review_comment) : ''}</dd>` : ''}
          </dl></div>
        </div>
        ${narrative(rep)}
        ${figures(s)}
        <div class="fdoc-foot"><span>Figures from the MS BMS books (double entry, GMD).</span><div class="rep-signs"><div class="fdoc-sign">Finance Manager</div><div class="fdoc-sign">General Manager / CEO</div></div></div>
      </div>
      ${rep && rep.history.length ? `<div class="dpanel no-print" style="margin-top:12px"><h3>History</h3><div class="tablewrap"><table class="inv"><tbody>${rep.history.slice().reverse().map((h) => `<tr><td>${esc(MS.when(h.at))}</td><td>${esc(h.by_name)}</td><td>${esc({ CREATE: 'Started', SUBMIT: 'Submitted', APPROVE: 'Approved', RETURN: 'Returned', REFRESH: 'Figures taken again' }[h.action] || h.action)}</td><td class="wrap">${esc(h.reason)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}`;
    MS.clickable($('dBody'));
    if (rep && rep.can_edit) $('narrSave').onclick = saveNarr;
  }

  async function saveNarr() {
    MS.busy($('narrSave'), true, 'Saving…');
    try { const r = await MS.call('FIN_REPORT_SAVE', { period, narrative: readNarr() }); render({ report: r }); MS.setMsg('dStatus', 'Comments saved.', 'ok'); }
    catch (err) { MS.setMsg('narrMsg', err.message, 'error'); MS.busy($('narrSave'), false); }
  }

  function ask(o) {
    $('noteForm').reset();
    $('noteTitle').textContent = o.title;
    $('noteInfo').textContent = o.info;
    $('noteLabel').classList.toggle('req', !!o.required);
    $('noteLabel').firstChild.textContent = o.label + ' ';
    $('noteError').textContent = '';
    $('noteSave').textContent = o.button; $('noteSave').dataset.label = o.button;
    $('noteSave').className = o.danger ? 'danger-solid' : 'primary';
    const dlg = MS.openDialog('noteDialog');
    $('noteCancel').onclick = () => dlg.close();
    $('noteForm').onsubmit = async (e) => {
      e.preventDefault();
      const t = $('noteText').value.trim();
      if (o.required && !t) { $('noteError').textContent = 'Please write what needs to change.'; return; }
      MS.busy($('noteSave'), true, 'Saving…');
      try { await o.run(t); dlg.close(); } catch (err) { $('noteError').textContent = err.message; } finally { MS.busy($('noteSave'), false); }
    };
  }

  async function onAction(e) {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const a = b.dataset.act;
    const rep = data && data.report;
    if (a === 'print') return window.print();
    if (a === 'start') {
      MS.busy(b, true, 'Starting…');
      try { render({ report: await MS.call('FIN_REPORT_SAVE', { period }) }); MS.setMsg('dStatus', 'Report started. Write your comments, then submit once the month is closed.', 'ok'); }
      catch (err) { MS.busy(b, false); MS.alert(err.message); }
    } else if (a === 'refresh') {
      MS.busy(b, true, 'Working…');
      try { render({ report: await MS.call('FIN_REPORT_SAVE', { period, narrative: readNarr(), refresh: true }) }); MS.setMsg('dStatus', 'Figures taken again from the books.', 'ok'); }
      catch (err) { MS.busy(b, false); MS.alert(err.message); }
    } else if (a === 'submit') {
      const n = readNarr();
      if (!n.highlights.trim()) { MS.alert('Write the highlights of the month before submitting.', 'Highlights missing'); return; }
      const late = MS.todayISO() > rep.due_date && !rep.first_submitted_at;
      if (!await MS.confirm({ title: 'Submit the report', message: 'Send the ' + rep.month_name + ' report to the General Manager and CEO for review? The figures are taken again from the closed books and then frozen.' + (late ? ' It is past the due date (' + MS.shortDate(rep.due_date) + '), so it will count as late.' : ''), confirmText: 'Submit' })) return;
      MS.busy(b, true, 'Submitting…');
      try { render({ report: await MS.call('FIN_REPORT_SUBMIT', { period, narrative: n }) }); MS.setMsg('dStatus', 'Submitted. The General Manager and CEO have been told.', 'ok'); }
      catch (err) { MS.busy(b, false); MS.alert(err.message); }
    } else if (a === 'approve') {
      ask({ title: 'Approve the report', info: 'The Finance Manager is told. You may add a comment.', label: 'Comment (optional)', button: 'Approve',
        run: async (t) => { render({ report: await MS.call('FIN_REPORT_APPROVE', { period, comment: t }) }); MS.setMsg('dStatus', 'Report approved.', 'ok'); } });
    } else if (a === 'return') {
      ask({ title: 'Return for changes', info: 'Say what the Finance Manager should fix or explain. They can change it and submit again.', label: 'What needs to change', button: 'Return', required: true, danger: true,
        run: async (t) => { render({ report: await MS.call('FIN_REPORT_RETURN', { period, comment: t }) }); MS.setMsg('dStatus', 'Returned to the Finance Manager.', 'ok'); } });
    }
  }

  MS.boot({ page: 'monthly-report', any: ['FIN_REPORT_SUBMIT', 'FIN_REPORT_REVIEW'], ref: true }).then(() => {
    $('dActions').addEventListener('click', onAction);
    if (period) loadOne(); else loadList();
  });
})();
