/* My payslips: the signed-in employee's own paid payslips, and one printable payslip (?id=).
   Finance opens any payslip here from the payroll page; nobody else can see someone else's. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const id = MS.param('id');
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = (p) => { const m = /^(\d{4})-(\d{2})/.exec(String(p || '')); return m ? MONTHS[Number(m[2]) - 1] + ' ' + m[1] : String(p || ''); };
  const state = { page: 1 };

  async function loadList() {
    MS.setMsg('dStatus', 'Loading…');
    try {
      const r = await MS.call('PAYSLIP_LIST', { mine: true, page: state.page, page_size: 24 });
      MS.setMsg('dStatus', '');
      $('listBody').innerHTML = r.rows.length ? r.rows.map((p) => {
        const href = 'payslips.html?id=' + encodeURIComponent(p.payslip_id);
        return `<tr class="clk" data-href="${esc(href)}"><td><b>${MS.lnk(href, monthName(p.month))}</b></td><td>${esc(MS.shortDate(p.pay_date))}</td>
          <td class="num">${MS.money(p.gross_pay)}</td><td class="num">${MS.money(p.deductions_total)}</td><td class="num"><b>${MS.money(p.net_pay)}</b></td></tr>`;
      }).join('') : '<tr><td colspan="5" class="empty">No payslips yet. They appear here after each month\'s salaries are paid.</td></tr>';
      const pages = Math.max(1, Math.ceil(r.total / r.page_size));
      $('pager').innerHTML = pages > 1 ? `<button type="button" id="pPrev"${state.page <= 1 ? ' disabled' : ''}>Previous</button><span>Page ${state.page} of ${pages}</span><button type="button" id="pNext"${state.page >= pages ? ' disabled' : ''}>Next</button>` : '';
      if (pages > 1) { $('pPrev').onclick = () => { state.page--; loadList(); }; $('pNext').onclick = () => { state.page++; loadList(); }; }
    } catch (err) { MS.setMsg('dStatus', err.message, 'error'); }
  }

  function table(title, rows, total, totalLabel) {
    return `<div><h4>${esc(title)}</h4><div class="tablewrap"><table class="inv"><tbody>
      ${rows.length ? rows.map((l) => `<tr><td class="wrap">${esc(l.description)}</td><td class="num">${MS.money(l.amount)}</td></tr>`).join('') : '<tr><td class="empty" colspan="2">None</td></tr>'}
      <tr class="tot"><td>${esc(totalLabel)}</td><td class="num">${MS.money(total)}</td></tr>
    </tbody></table></div></div>`;
  }

  function render(p) {
    const title = 'Payslip ' + monthName(p.month);
    document.title = title + ' · MS BMS';
    $('dTitle').innerHTML = esc(title) + (p.status !== 'FINAL' ? ' ' + MS.pill(p.status, p.status === 'DRAFT' ? 'Not final yet' : 'Void') : '');
    $('dCrumbs').innerHTML = p.is_own ? `<a href="payslips.html">My payslips</a> › ${esc(monthName(p.month))}`
      : `<a href="people/payroll.html?id=${encodeURIComponent(p.payroll_run_id)}">Payroll ${esc(monthName(p.month))}</a> › ${esc(p.employee_name)}`;
    $('dActions').innerHTML = '<button type="button" id="printBtn">Print / PDF</button>';
    $('printBtn').onclick = () => window.print();
    const L = p.lines || [];
    const earn = L.filter((l) => l.line_type === 'EARNING');
    const ded = L.filter((l) => l.line_type === 'DEDUCTION');
    const er = L.filter((l) => l.line_type === 'EMPLOYER_CONTRIBUTION');
    const stamp = p.status === 'VOID' ? '<div><span class="stamp void">VOID</span></div>' : p.status === 'DRAFT' ? '<div><span class="stamp void">DRAFT</span></div>' : '';
    $('docView').innerHTML = `
      ${p.status === 'DRAFT' ? '<div class="notice-bar no-print">This payslip is not final: the payroll has not been paid yet, and the figures may still change.</div>' : ''}
      <div class="fdoc payslip">
        ${MS.fin.head(p.company, 'PAYSLIP', monthName(p.month).toUpperCase(), stamp)}
        <div class="fdoc-parties">
          <div class="box"><div class="k">Employee</div><b>${esc(p.employee_name)}</b>
            <div>${esc(p.position_title || '')}</div><div>${esc(p.department_name || '')}</div><div class="sub">${esc(p.employee_number)}</div></div>
          <div class="box"><dl class="fdoc-facts">
            <dt>Pay period</dt><dd>${esc(monthName(p.month))}</dd>
            <dt>Pay date</dt><dd>${esc(MS.shortDate(p.pay_date))}</dd>
            <dt>Taxable pay</dt><dd>${MS.money(p.taxable_pay)}</dd>
          </dl></div>
        </div>
        <div class="ps-cols">
          ${table('Earnings', earn, p.gross_pay, 'Gross pay')}
          ${table('Deductions', ded, p.deductions_total, 'Total deductions')}
        </div>
        <div class="ps-net"><span class="k">NET PAY</span><span class="v">${MS.money(p.net_pay)}</span></div>
        ${er.length ? `<p class="fin-note" style="margin:0 0 12px">Paid by the company on top of your pay (not deducted): ${er.map((l) => esc(l.description) + ' ' + MS.money(l.amount)).join(', ')}.</p>` : ''}
        <h4>Year to date (from ${esc(monthName(p.ytd.from))})</h4>
        <div class="ps-ytd">
          <div>Gross pay<b>${MS.money(p.ytd.gross)}</b></div>
          <div>PAYE<b>${MS.money(p.ytd.paye)}</b></div>
          <div>Net pay<b>${MS.money(p.ytd.net)}</b></div>
        </div>
        <div class="fdoc-foot"><span>Confidential. Questions about your pay? Ask the Finance Manager.</span><div class="fdoc-sign">Finance Manager</div></div>
      </div>`;
  }

  async function loadOne() {
    $('listView').hidden = true;
    $('docView').hidden = false;
    $('dCrumbs').hidden = false;
    MS.setMsg('dStatus', 'Loading…');
    try { render(await MS.call('PAYSLIP_GET', { payslip_id: id })); MS.setMsg('dStatus', ''); }
    catch (err) { MS.setMsg('dStatus', err.message, 'error'); $('docView').innerHTML = '<p><a class="lnk" href="payslips.html">Back to my payslips</a></p>'; }
  }

  MS.boot({ page: 'payslips', any: ['PAYSLIP_VIEW_OWN', 'FINANCE_PAYROLL_VIEW', 'PAYROLL_PREPARE'] }).then(() => {
    MS.clickable($('listBody'));
    if (id) loadOne(); else loadList();
  });
})();
