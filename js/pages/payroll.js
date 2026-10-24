/* Payroll: monthly runs (prepare → submit → approve → pay → email payslips, or void), pay components per employee,
   PAYE bands and social security rates. ?id= opens one run. Individual pay is shown to Finance only;
   an approver without payroll rights (the GM) sees totals and departments. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const fin = MS.fin;
  const id = MS.param('id');
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = (p) => { const m = /^(\d{4})-(\d{2})/.exec(String(p || '')); return m ? MONTHS[Number(m[2]) - 1] + ' ' + m[1] : String(p || ''); };
  const STATUS = { DRAFT: 'Draft', SUBMITTED: 'Waiting for approval', APPROVED: 'Approved (not paid)', PAID: 'Paid', VOID: 'Void' };
  const pill = (s) => MS.pill(s, STATUS[s] || MS.label(s));
  const EARN = ['ALLOWANCE', 'TRANSPORT', 'HOUSING', 'BONUS', 'OTHER'];
  const DEDUCT = ['ADVANCE', 'LOAN', 'OTHER'];
  const CODE_LABEL = { ALLOWANCE: 'Allowance', TRANSPORT: 'Transport', HOUSING: 'Housing', BONUS: 'Bonus', ADVANCE: 'Salary advance repayment', LOAN: 'Loan repayment', OTHER: 'Other' };
  let setup = null;
  let run = null;
  const state = { page: 1, tab: 'runs' };

  /* ---------- list view ---------- */
  async function loadSetup() {
    setup = await MS.call('PAYROLL_SETUP_GET', {});
    $('setupWarnings').innerHTML = setup.warnings.map((w) => `<div class="notice-bar${w.code === 'NO_PAYE_BANDS' ? ' danger' : ''}">${esc(w.text)}</div>`).join('');
    return setup;
  }

  async function loadRuns() {
    MS.setMsg('dStatus', 'Loading…');
    try {
      const r = await MS.call('PAYROLL_LIST', { page: state.page, page_size: 24 });
      MS.setMsg('dStatus', '');
      $('runsBody').innerHTML = r.rows.length ? r.rows.map((x) => {
        const href = 'people/payroll.html?id=' + encodeURIComponent(x.payroll_run_id);
        return `<tr class="clk${x.status === 'VOID' ? ' void' : ''}" data-href="${esc(href)}">
          <td><b>${MS.lnk(href, monthName(x.month))}</b></td><td>${esc(MS.shortDate(x.pay_date))}</td>
          <td class="num">${esc(x.employee_count)}</td><td class="num">${MS.money(x.total_gross)}</td><td class="num">${MS.money(x.total_net)}</td>
          <td class="num">${MS.money(x.total_cost)}</td><td>${pill(x.status)}</td><td>${esc(x.prepared_by_name)}</td></tr>`;
      }).join('') : `<tr><td colspan="8" class="empty">No payroll yet.${MS.can('PAYROLL_PREPARE') ? ' Click "Prepare payroll" to work out the first month.' : ''}</td></tr>`;
      const pages = Math.max(1, Math.ceil(r.total / r.page_size));
      $('pager').innerHTML = pages > 1 ? `<button type="button" id="pPrev"${state.page <= 1 ? ' disabled' : ''}>Previous</button><span>Page ${state.page} of ${pages}</span><button type="button" id="pNext"${state.page >= pages ? ' disabled' : ''}>Next</button>` : '';
      if (pages > 1) { $('pPrev').onclick = () => { state.page--; loadRuns(); }; $('pNext').onclick = () => { state.page++; loadRuns(); }; }
    } catch (err) { MS.setMsg('dStatus', err.message, 'error'); }
  }

  function showTab(t) {
    state.tab = t;
    $('tabs').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    $('runsTab').hidden = t !== 'runs';
    $('componentsTab').hidden = t !== 'components';
    $('bandsTab').hidden = t !== 'bands';
    try { history.replaceState(null, '', t === 'runs' ? 'people/payroll.html' : 'people/payroll.html?tab=' + t); } catch (e) { /* ignore */ }
    if (t === 'components') loadComponents();
    if (t === 'bands') renderBands();
  }

  /* ---------- pay components ---------- */
  async function loadComponents() {
    $('compBody').innerHTML = '<tr><td colspan="8" class="empty">Loading…</td></tr>';
    try {
      const r = await MS.call('PAY_COMPONENT_LIST', { employee_id: $('compEmployee').value, include_inactive: $('compInactive').checked });
      const can = MS.can('PAYROLL_PREPARE');
      $('compBody').innerHTML = r.rows.length ? r.rows.map((c) => `<tr class="${can ? 'clk' : ''}${c.status !== 'ACTIVE' ? ' off' : ''}" data-comp="${esc(c.pay_component_id)}">
          <td>${esc(c.employee_name)}</td><td>${c.component_type === 'EARNING' ? 'Earning' : 'Deduction'}</td>
          <td class="wrap">${esc(c.description)}<span class="sub">${esc(CODE_LABEL[c.code] || MS.label(c.code))}</span></td>
          <td class="num${c.component_type === 'DEDUCTION' ? ' neg' : ''}">${c.component_type === 'DEDUCTION' ? '− ' : ''}${MS.money(c.amount)}</td>
          <td>${c.component_type === 'EARNING' ? (c.is_taxable === false ? 'Not taxed' : 'Taxed') : ''}</td>
          <td>${esc(MS.shortDate(c.valid_from))}</td><td>${c.valid_to ? esc(MS.shortDate(c.valid_to)) : 'until stopped'}</td>
          <td>${c.status === 'ACTIVE' ? (c.current ? MS.pill('ACTIVE', 'Active') : MS.pill('PLANNED', c.valid_from > MS.todayISO() ? 'Starts later' : 'Ended')) : MS.pill('INACTIVE', 'Stopped')}</td></tr>`).join('')
        : '<tr><td colspan="8" class="empty">No pay components. Add allowances (transport, housing …) or repayments (advance, loan) here.</td></tr>';
      $('compBody').querySelectorAll('tr[data-comp]').forEach((tr) => {
        if (!can) return;
        tr.onclick = () => openComponent(r.rows.find((c) => c.pay_component_id === tr.dataset.comp));
      });
    } catch (err) { $('compBody').innerHTML = `<tr><td colspan="8" class="empty">${esc(err.message)}</td></tr>`; }
  }

  function codeOptions(type, sel) {
    $('cCode').innerHTML = MS.options((type === 'DEDUCTION' ? DEDUCT : EARN).map((c) => ({ value: c, label: CODE_LABEL[c] })), sel);
    $('cTaxWrap').hidden = type === 'DEDUCTION';
  }

  function openComponent(c) {
    const f = $('compForm');
    f.reset();
    c = c || {};
    $('compTitle').textContent = c.pay_component_id ? 'Change pay component' : 'Add pay component';
    $('compError').textContent = '';
    $('cEmployee').innerHTML = MS.options((setup.employees || []).map((e) => ({ value: e.employee_id, label: e.name + ' (' + e.employee_number + ')' + (e.department_name ? ' – ' + e.department_name : '') })), c.employee_id || $('compEmployee').value, '— choose employee —');
    $('cEmployee').disabled = !!c.pay_component_id;
    $('cType').value = c.component_type || 'EARNING';
    $('cType').disabled = !!c.pay_component_id;
    codeOptions($('cType').value, c.code);
    $('cType').onchange = () => codeOptions($('cType').value);
    f.elements.description.value = c.description || '';
    f.elements.amount.value = c.amount == null ? '' : c.amount;
    f.elements.valid_from.value = c.valid_from || MS.todayISO().slice(0, 8) + '01';
    f.elements.valid_to.value = c.valid_to || '';
    $('cTaxable').checked = c.is_taxable !== false;
    $('cStatusWrap').hidden = !c.pay_component_id;
    $('cStatus').value = c.status || 'ACTIVE';
    const dlg = MS.openDialog('compDialog');
    $('compCancel').onclick = () => dlg.close();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = MS.formData(f);
      if (!c.pay_component_id && !d.employee_id) { $('compError').textContent = 'Choose the employee.'; return; }
      if (!d.description) { $('compError').textContent = 'Describe it (this text is printed on the payslip).'; return; }
      if (!(Number(d.amount) > 0)) { $('compError').textContent = 'Enter the monthly amount.'; return; }
      if (!d.valid_from) { $('compError').textContent = 'Enter the date it starts.'; return; }
      const p = { description: d.description, amount: d.amount, valid_from: d.valid_from, valid_to: d.valid_to, is_taxable: d.component_type === 'DEDUCTION' ? false : d.is_taxable, code: d.code };
      if (c.pay_component_id) Object.assign(p, { pay_component_id: c.pay_component_id, status: d.status });
      else Object.assign(p, { employee_id: d.employee_id, component_type: d.component_type });
      MS.busy($('compSave'), true, 'Saving…');
      try { await MS.call('PAY_COMPONENT_SAVE', p); dlg.close(); loadComponents(); MS.setMsg('dStatus', 'Pay component saved. Draft payrolls pick it up when recalculated.', 'ok'); }
      catch (err) { $('compError').textContent = err.message; } finally { MS.busy($('compSave'), false); }
    };
  }

  /* ---------- PAYE bands & rates ---------- */
  function renderBands() {
    const can = MS.can('PAYROLL_PREPARE');
    $('rEmp').value = setup.rates.employee_pct;
    $('rEr').value = setup.rates.employer_pct;
    $('rEmp').disabled = $('rEr').disabled = !can;
    $('ratesBtns').hidden = !can;
    $('bandAdd').hidden = !can;
    const rows = setup.bands;
    $('bandsBody').innerHTML = rows.length ? rows.map((b) => `<tr class="${can ? 'clk' : ''}${b.status !== 'ACTIVE' ? ' off' : ''}" data-band="${esc(b.tax_band_id)}">
        <td>${esc(MS.shortDate(b.valid_from))}</td><td class="num">${MS.num(b.band_from)}</td><td class="num">${b.band_to === '' || b.band_to == null ? 'and above' : MS.num(b.band_to)}</td>
        <td class="num">${esc(b.rate_pct)}%</td><td>${b.status !== 'ACTIVE' ? MS.pill('INACTIVE', 'Switched off') : b.in_use ? '<span class="pill inuse">In use this month</span>' : MS.pill('PLANNED', b.valid_from > MS.todayISO() ? 'Applies later' : 'Older set')}</td>
        <td></td></tr>`).join('')
      : `<tr><td colspan="6" class="empty">PAYE bands not set — PAYE will be 0. ${can ? 'Add the GRA bands with "Add band".' : 'Finance enters them.'}</td></tr>`;
    if (can) $('bandsBody').querySelectorAll('tr[data-band]').forEach((tr) => { tr.onclick = () => openBand(rows.find((b) => b.tax_band_id === tr.dataset.band)); });
  }

  function openBand(b) {
    const f = $('bandForm');
    f.reset();
    b = b || {};
    $('bandTitle').textContent = b.tax_band_id ? 'Change PAYE band' : 'Add PAYE band';
    $('bandError').textContent = '';
    const last = setup.bands.filter((x) => x.status === 'ACTIVE').sort((x, y) => (x.valid_from === y.valid_from ? Number(y.band_from) - Number(x.band_from) : (x.valid_from < y.valid_from ? 1 : -1)))[0];
    f.elements.band_from.value = b.tax_band_id ? b.band_from : (last && last.band_to !== '' && last.band_to != null ? last.band_to : (last ? '' : 0));
    f.elements.band_to.value = b.band_to == null ? '' : b.band_to;
    f.elements.rate_pct.value = b.rate_pct == null ? '' : b.rate_pct;
    f.elements.valid_from.value = b.valid_from || (last ? last.valid_from : MS.todayISO().slice(0, 5) + '01-01');
    $('bStatusWrap').hidden = !b.tax_band_id;
    $('bStatus').value = b.status || 'ACTIVE';
    const dlg = MS.openDialog('bandDialog');
    $('bandCancel').onclick = () => dlg.close();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = MS.formData(f);
      if (d.band_from === '' || d.rate_pct === '' || !d.valid_from) { $('bandError').textContent = 'Enter "From", the rate and the date it applies from.'; return; }
      const p = { band_from: d.band_from, band_to: d.band_to, rate_pct: d.rate_pct, valid_from: d.valid_from };
      if (b.tax_band_id) Object.assign(p, { tax_band_id: b.tax_band_id, status: d.status });
      MS.busy($('bandSave'), true, 'Saving…');
      try { await MS.call('PAYE_BAND_SAVE', p); dlg.close(); await loadSetup(); renderBands(); MS.setMsg('dStatus', 'PAYE band saved.', 'ok'); }
      catch (err) { $('bandError').textContent = err.message; } finally { MS.busy($('bandSave'), false); }
    };
  }

  async function saveRates(e) {
    e.preventDefault();
    const d = MS.formData($('ratesForm'));
    $('ratesError').textContent = '';
    if (d.employee_pct === '' || d.employer_pct === '') { $('ratesError').textContent = 'Enter both rates (0 if none).'; return; }
    MS.busy($('ratesSave'), true, 'Saving…');
    try { await MS.call('PAYROLL_RATES_SAVE', d); await loadSetup(); renderBands(); MS.setMsg('dStatus', 'Social security rates saved.', 'ok'); }
    catch (err) { $('ratesError').textContent = err.message; } finally { MS.busy($('ratesSave'), false); }
  }

  /* ---------- prepare ---------- */
  function openNew() {
    const f = $('newForm');
    f.reset();
    $('newError').textContent = '';
    $('nPeriod').value = MS.todayISO().slice(0, 7);
    const dlg = MS.openDialog('newDialog');
    $('newCancel').onclick = () => dlg.close();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = MS.formData(f);
      if (!/^\d{4}-\d{2}$/.test(d.period)) { $('newError').textContent = 'Choose the month.'; return; }
      MS.busy($('newSave'), true, 'Working it out…');
      try {
        const r = await MS.call('PAYROLL_PREPARE', { period: d.period, pay_date: d.pay_date });
        location.href = 'people/payroll.html?id=' + encodeURIComponent(r.payroll_run_id);
      } catch (err) {
        $('newError').textContent = err.message;
        if (err.details && err.details.payroll_run_id) $('newError').innerHTML = esc(err.message) + ' ' + MS.lnk('people/payroll.html?id=' + encodeURIComponent(err.details.payroll_run_id), 'Open it');
        MS.busy($('newSave'), false);
      }
    };
  }

  /* ---------- one run ---------- */
  function card(k, v, s, cls) { return `<div class="card${cls ? ' ' + cls : ''}"><div class="k">${esc(k)}</div><div class="v">${v}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`; }

  function renderRun(r) {
    run = r;
    const st = r.status;
    document.title = 'Payroll ' + monthName(r.month) + ' · MS BMS';
    $('dTitle').innerHTML = 'Payroll ' + esc(monthName(r.month)) + ' ' + pill(st);
    $('dCrumbs').innerHTML = `<a href="people/payroll.html">Payroll</a> › ${esc(monthName(r.month))}`;
    const prep = MS.can('PAYROLL_PREPARE');
    const appr = MS.can('PAYROLL_APPROVE');
    $('dActions').innerHTML = [
      st === 'DRAFT' && prep && '<button type="button" data-act="recalc">Recalculate</button>',
      st === 'DRAFT' && prep && '<button type="button" class="primary" data-act="submit">Submit for approval</button>',
      st === 'SUBMITTED' && appr && r.can.approve && '<button type="button" class="primary" data-act="approve">Approve</button>',
      st === 'SUBMITTED' && appr && r.can.approve && '<button type="button" data-act="return">Send back</button>',
      st === 'APPROVED' && prep && '<button type="button" class="primary" data-act="pay">Pay salaries</button>',
      st === 'PAID' && prep && `<button type="button" class="primary" data-act="email">${r.emailed ? 'Email new payslips' : 'Email payslips'}</button>`,
      ['DRAFT', 'SUBMITTED', 'APPROVED'].includes(st) && (prep || appr) && '<button type="button" class="danger" data-act="void">Void</button>'
    ].filter(Boolean).join('');
    const notes = (r.warnings || []).map((w) => `<div class="notice-bar${w.code === 'NO_PAYE_BANDS' ? ' danger' : ''}">${esc(w.text)}</div>`);
    if (st === 'DRAFT') notes.unshift('<div class="notice-bar">This is a draft: nothing is in the books yet. Check the payslips, change pay components or bands if needed, then Recalculate and Submit for approval.</div>');
    if (st === 'SUBMITTED') notes.unshift(`<div class="notice-bar">Waiting for approval by the CEO, or the General Manager within the approval limit. ${r.can.approve ? '' : (r.prepared_by === MS.user.user_id ? 'You prepared it, so someone else approves it.' : '')}</div>`);
    if (st === 'APPROVED') notes.unshift('<div class="notice-bar">Approved and posted to the books (salaries payable). Pay the salaries, then mark it paid here.</div>');
    if (st === 'PAID') notes.unshift(`<div class="notice-bar ok">Paid${r.paid_from ? ' from ' + esc(r.paid_from) : ''} on ${esc(MS.when(r.paid_at))}. ${r.emailed} of ${esc(r.employee_count)} payslips emailed. Staff see their payslips under "My payslips".</div>`);
    const cost = Number(r.total_cost);
    const depRows = r.departments || [];
    const slips = r.payslips;
    $('runView').innerHTML = `
      ${notes.join('')}
      <div class="cards pr-cards">
        ${card('Employees', esc(r.employee_count), 'pay date ' + esc(MS.shortDate(r.pay_date)))}
        ${card('Gross pay', MS.money(r.total_gross), r.total_overtime ? 'incl. overtime <b>' + esc(MS.money(r.total_overtime)) + '</b>' : '')}
        ${card('Deductions', MS.money(r.total_deductions), 'PAYE <b>' + esc(MS.money(r.total_paye)) + '</b> · social sec. <b>' + esc(MS.money(r.total_social_security)) + '</b>')}
        ${card('Net pay to staff', MS.money(r.total_net), 'payroll cost <b>' + esc(MS.money(cost)) + '</b> (incl. employer SS ' + esc(MS.money(r.total_employer_contributions)) + ')')}
      </div>
      ${slips ? `<div class="dpanel wide"><h3>Payslips</h3><div class="tablewrap"><table class="inv"><thead><tr>
          <th>Employee</th><th class="num">Basic</th><th class="num">Allowances &amp; overtime</th><th class="num">Gross</th><th class="num">PAYE</th><th class="num">Social sec.</th><th class="num">Other deductions</th><th class="num">Net pay</th><th class="num">Employer SS</th></tr></thead><tbody>
          ${slips.map((s) => { const href = 'payslips.html?id=' + encodeURIComponent(s.payslip_id); return `<tr class="clk" data-href="${esc(href)}">
            <td>${MS.lnk(href, s.employee_name)}<span class="sub">${esc(s.position_title)} · ${esc(s.department_name)}${s.emailed_at ? ' · emailed' : ''}</span></td>
            <td class="num">${MS.money(s.basic_salary)}</td><td class="num">${MS.money(s.earnings_total)}</td><td class="num">${MS.money(s.gross_pay)}</td>
            <td class="num">${MS.money(s.paye)}</td><td class="num">${MS.money(s.social_security)}</td><td class="num">${MS.money(s.other_deductions)}</td>
            <td class="num"><b>${MS.money(s.net_pay)}</b></td><td class="num">${MS.money(s.employer_contributions)}</td></tr>`; }).join('')}
          <tr class="tot"><td colspan="3">Total</td><td class="num">${MS.money(r.total_gross)}</td><td class="num">${MS.money(r.total_paye)}</td><td class="num">${MS.money(r.total_social_security)}</td>
            <td class="num">${MS.money(fin.r2(r.total_deductions - r.total_paye - r.total_social_security))}</td><td class="num">${MS.money(r.total_net)}</td><td class="num">${MS.money(r.total_employer_contributions)}</td></tr>
        </tbody></table></div></div>` : ''}
      <div class="dgrid">
        <div class="dpanel"><h3>By department</h3><div class="tablewrap"><table class="inv"><thead><tr><th>Department</th><th class="num">Staff</th><th class="num">Gross</th><th class="num">Net</th><th class="num">Employer SS</th></tr></thead><tbody>
          ${depRows.length ? depRows.map((d) => `<tr><td>${esc(d.department_name || '—')}</td><td class="num">${esc(d.employees)}</td><td class="num">${MS.money(d.gross)}</td><td class="num">${MS.money(d.net)}</td><td class="num">${MS.money(d.employer_contributions)}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">No payslips.</td></tr>'}
        </tbody></table></div></div>
        <div class="dpanel pr-facts"><h3>Record</h3>${MS.kv([
          ['Month', monthName(r.month)], ['Pay date', MS.shortDate(r.pay_date)], ['Status', pill(st), true],
          ['Prepared by', r.prepared_by_name], ['Approved by', r.approved_by_name ? r.approved_by_name + ' · ' + MS.when(r.approved_at) : ''],
          ['Paid from', r.paid_from || ''], ['Paid', r.paid_at ? MS.when(r.paid_at) : '']])}
          ${(r.journal_entries || []).length ? `<h3 style="margin-top:12px">In the books</h3><div class="tablewrap"><table class="inv"><tbody>
            ${r.journal_entries.map((e) => `<tr><td>${MS.can('FINANCE_VIEW') ? MS.lnk('finance/accounts.html?journal=' + encodeURIComponent(e.journal_entry_id), e.entry_number) : esc(e.entry_number)}</td><td>${esc(MS.shortDate(e.entry_date))}</td><td class="wrap">${esc(e.description)}</td><td>${MS.pill(e.status)}</td></tr>`).join('')}
          </tbody></table></div>` : ''}
          ${!slips ? '<p class="fin-note">Individual pay is visible to Finance only.</p>' : ''}</div>
      </div>`;
    MS.clickable($('runView'));
  }

  function ask(o) {
    const f = $('noteForm');
    f.reset();
    $('noteTitle').textContent = o.title;
    $('noteInfo').textContent = o.info || '';
    $('noteError').textContent = '';
    $('noteSave').textContent = o.button;
    $('noteSave').dataset.label = o.button;
    $('noteSave').className = o.danger ? 'danger-solid' : 'primary';
    const dlg = MS.openDialog('noteDialog');
    $('noteCancel').onclick = () => dlg.close();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const t = $('noteText').value.trim();
      if (!t) { $('noteError').textContent = 'Please give a reason.'; return; }
      MS.busy($('noteSave'), true, 'Saving…');
      try { await o.run(t); dlg.close(); } catch (err) { $('noteError').textContent = err.message; } finally { MS.busy($('noteSave'), false); }
    };
  }

  function approve() {
    const f = $('approveForm');
    f.reset();
    $('approveError').textContent = '';
    $('apInfo').textContent = `Approve the ${monthName(run.month)} payroll: ${run.employee_count} employees, net pay ${MS.money(run.total_net)}, payroll cost ${MS.money(run.total_cost)}. It is posted to the books (salary expense and amounts owed for PAYE, social security and net pay) on ${MS.shortDate(run.pay_date)}.`;
    $('apNoPaye').hidden = $('apConfirmWrap').hidden = !run.no_paye_bands;
    const dlg = MS.openDialog('approveDialog');
    $('approveCancel').onclick = () => dlg.close();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = MS.formData(f);
      if (run.no_paye_bands && !d.confirm_no_paye) { $('approveError').textContent = 'Tick the box to confirm PAYE is 0, or send it back so Finance can enter the bands.'; return; }
      MS.busy($('approveSave'), true, 'Approving…');
      try { renderRun(await MS.call('PAYROLL_APPROVE', { payroll_run_id: run.payroll_run_id, confirm_no_paye: !!d.confirm_no_paye, comment: d.comment })); dlg.close(); MS.setMsg('dStatus', 'Approved and posted to the books.', 'ok'); }
      catch (err) { $('approveError').textContent = err.message; } finally { MS.busy($('approveSave'), false); }
    };
  }

  async function pay() {
    const f = $('payForm');
    f.reset();
    $('payError').textContent = '';
    $('payInfo').textContent = `Record that the net salaries of ${MS.money(run.total_net)} were paid (bank transfer or cash). This moves the money out of the bank account or till in the books, and makes the payslips final.`;
    $('payDate').value = MS.todayISO();
    try { $('payMoney').innerHTML = fin.moneyOptions(await fin.money(), '', 'BANK'); } catch (err) { $('payError').textContent = err.message; }
    const dlg = MS.openDialog('payDialog');
    $('payCancel').onclick = () => dlg.close();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = MS.formData(f);
      if (!d.money) { $('payError').textContent = 'Choose the bank account or till.'; return; }
      MS.busy($('paySave'), true, 'Saving…');
      try { renderRun(await MS.call('PAYROLL_PAY', Object.assign({ payroll_run_id: run.payroll_run_id, paid_date: d.paid_date }, fin.moneyPayload(d.money)))); dlg.close(); MS.setMsg('dStatus', 'Salaries paid. You can now email the payslips.', 'ok'); }
      catch (err) { $('payError').textContent = err.message; } finally { MS.busy($('paySave'), false); }
    };
  }

  async function onAction(e) {
    const b = e.target.closest('button[data-act]');
    if (!b || !run) return;
    const a = b.dataset.act;
    const call = async (action, label, payload, msg) => {
      MS.busy(b, true, label);
      try { renderRun(await MS.call(action, Object.assign({ payroll_run_id: run.payroll_run_id }, payload || {}))); MS.setMsg('dStatus', msg, 'ok'); }
      catch (err) { MS.busy(b, false); MS.alert(err.message); }
    };
    if (a === 'recalc') return call('PAYROLL_RECALCULATE', 'Recalculating…', {}, 'Recalculated with the latest salaries, components, overtime, bands and rates.');
    if (a === 'submit') {
      const okGo = await MS.confirm({ title: 'Submit for approval', message: `Submit the ${monthName(run.month)} payroll (net pay ${MS.money(run.total_net)}) for approval? It is recalculated first; after that it cannot be changed unless it is sent back.`, confirmText: 'Submit' });
      if (okGo) return call('PAYROLL_SUBMIT', 'Submitting…', {}, 'Submitted. The approvers have been told.');
      return;
    }
    if (a === 'approve') return approve();
    if (a === 'pay') return pay();
    if (a === 'return') return ask({ title: 'Send back to Finance', info: 'The payroll goes back to draft so Finance can correct and resubmit it.', button: 'Send back',
      run: async (t) => { renderRun(await MS.call('PAYROLL_RETURN', { payroll_run_id: run.payroll_run_id, reason: t })); MS.setMsg('dStatus', 'Sent back to Finance.', 'ok'); } });
    if (a === 'void') return ask({ title: 'Void payroll', danger: true, button: 'Void payroll',
      info: run.status === 'APPROVED' ? 'The journal posted on approval is reversed and the payslips are voided. The month can then be prepared again.' : 'The payslips are voided. The month can then be prepared again.',
      run: async (t) => { renderRun(await MS.call('PAYROLL_VOID', { payroll_run_id: run.payroll_run_id, reason: t })); MS.setMsg('dStatus', 'Payroll voided.', 'ok'); } });
    if (a === 'email') {
      const okGo = await MS.confirm({ title: 'Email payslips', message: 'Email each employee their own payslip (a short summary and a link to "My payslips")? Payslips already emailed are not sent again.', confirmText: 'Email payslips' });
      if (!okGo) return;
      MS.busy(b, true, 'Sending…');
      try {
        const r = await MS.call('PAYSLIPS_EMAIL', { payroll_run_id: run.payroll_run_id });
        renderRun(r.run);
        MS.setMsg('dStatus', r.sent + ' payslip' + (r.sent === 1 ? '' : 's') + ' emailed.' + (r.skipped.length ? ' Not sent: ' + r.skipped.map((s) => s.name + ' (' + s.reason + ')').join(', ') + '.' : ''), r.skipped.length ? '' : 'ok');
      } catch (err) { MS.busy(b, false); MS.alert(err.message); }
    }
  }

  async function loadRun() {
    $('listView').hidden = true;
    $('runView').hidden = false;
    $('dCrumbs').hidden = false;
    MS.setMsg('dStatus', 'Loading…');
    try { renderRun(await MS.call('PAYROLL_GET', { payroll_run_id: id })); MS.setMsg('dStatus', ''); }
    catch (err) { MS.setMsg('dStatus', err.message, 'error'); $('runView').innerHTML = '<p><a class="lnk" href="people/payroll.html">Back to payroll</a></p>'; }
  }

  MS.boot({ page: 'payroll', any: ['PAYROLL_PREPARE', 'PAYROLL_APPROVE', 'FINANCE_PAYROLL_VIEW'], ref: true }).then(async () => {
    $('dActions').addEventListener('click', onAction);
    if (id) return loadRun();
    if (MS.can('PAYROLL_PREPARE')) {
      $('dActions').innerHTML = '<button type="button" class="primary" id="newBtn">Prepare payroll</button>';
      $('newBtn').onclick = openNew;
    }
    try { await loadSetup(); } catch (err) { MS.setMsg('dStatus', err.message, 'error'); return; }
    if (setup.can.detail) {
      $('tabComponents').hidden = false;
      $('compEmployee').innerHTML = MS.options((setup.employees || []).map((e) => ({ value: e.employee_id, label: e.name })), MS.param('employee'), 'All employees');
      $('compAdd').hidden = !MS.can('PAYROLL_PREPARE');
    }
    $('compAdd').onclick = () => openComponent(null);
    $('compEmployee').onchange = loadComponents;
    $('compInactive').onchange = loadComponents;
    $('bandAdd').onclick = () => openBand(null);
    $('ratesForm').addEventListener('submit', saveRates);
    $('tabs').addEventListener('click', (e) => { const b = e.target.closest('button[data-tab]'); if (b) showTab(b.dataset.tab); });
    MS.clickable($('runsBody'));
    const t = MS.param('tab');
    if (t === 'bands' || (t === 'components' && setup.can.detail)) showTab(t);
    loadRuns();
  });
})();
