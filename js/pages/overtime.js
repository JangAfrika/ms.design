/* Overtime register: request before the work, approve (never your own request), record the hours, a different person verifies them.
   Hours with no approved request are flagged unauthorised. Pay figures show only to people allowed to see payroll cost. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const sc = MS.sc, dc = MS.dc, hr = MS.hr;
  const req = { page: 1, status: '', month: '', q: '' }, work = { page: 1, status: '', auth: '', month: '', q: '' };
  const state = { tab: 'requests', month: hr.monthNow() };
  let ref = null, reqRows = [], recRows = [], jobs = null;

  const label = (c) => MS.label(c);
  MS.reload = () => load();
  function load() {
    $('reqPane').hidden = state.tab !== 'requests';
    $('workPane').hidden = state.tab !== 'worked';
    $('regPane').hidden = state.tab !== 'register';
    return ({ requests: loadRequests, worked: loadWorked, register: loadRegister })[state.tab]();
  }

  async function loadRequests() {
    MS.setMsg('msg', 'Loading…');
    try {
      const r = await MS.recall('OVERTIME_REQUEST_LIST', { page: req.page, page_size: 50, status: req.status, month: req.month, search: req.q });
      reqRows = r.rows;
      $('tReqN').textContent = r.to_decide || r.to_record ? '(' + ((r.to_decide || 0) + (r.to_record || 0)) + ')' : '';
      MS.setMsg('msg', r.total + ' request' + (r.total === 1 ? '' : 's') + (r.to_decide ? ' · ' + r.to_decide + ' to decide' : '') + (r.to_record ? ' · ' + r.to_record + ' ready for hours to be recorded' : ''));
      $('rBody').innerHTML = reqRows.length ? reqRows.map((o) => `<tr${o.status === 'CANCELLED' || o.status === 'REJECTED' ? ' class="void"' : ''}>
        <td>${hr.person(o.employee_name, o.department_name)}</td>
        <td>${esc(MS.shortDate(o.overtime_date))}</td><td>${esc(o.planned_start)}-${esc(o.planned_end)}<div class="sub">${esc(hr.hours(o.planned_hours))}</div></td>
        <td>${esc(label(o.reason_category))}${o.job_number ? `<div class="sub">${esc(o.job_number)} ${esc(o.job_name)}</div>` : ''}<div class="sub">${esc(o.reason)}</div></td>
        <td>${MS.pill(o.status)}${o.record_id ? `<div class="sub">${esc(hr.hours(o.hours_worked))} recorded</div>` : ''}${o.decision_comment ? `<div class="sub">${esc(o.decided_by_name)}: ${esc(o.decision_comment)}</div>` : ''}</td>
        <td>${esc(o.requested_by_name)}</td>
        <td class="acts">${o.can_decide ? `<button type="button" class="primary" data-dec="APPROVE" data-id="${esc(o.overtime_request_id)}">Approve</button><button type="button" class="danger" data-dec="REJECT" data-id="${esc(o.overtime_request_id)}">Reject</button>` : ''}${o.can_record ? `<button type="button" class="primary" data-rec="${esc(o.overtime_request_id)}">Record hours</button>` : ''}${o.can_cancel ? `<button type="button" data-can="${esc(o.overtime_request_id)}">Cancel</button>` : ''}</td></tr>`).join('')
        : '<tr><td colspan="7" class="empty">No overtime requests.</td></tr>';
      sc.pager('rPager', r, req, load);
    } catch (err) { MS.setMsg('msg', err.message, 'error'); }
  }

  async function loadWorked() {
    MS.setMsg('msg', 'Loading…');
    try {
      const r = await MS.recall('OVERTIME_RECORD_LIST', { page: work.page, page_size: 50, status: work.status, authorisation: work.auth, month: work.month, search: work.q });
      recRows = r.rows;
      $('tWorkN').textContent = r.to_verify ? '(' + r.to_verify + ')' : '';
      $('wHead').innerHTML = '<th>Person</th><th>Date</th><th>Worked</th><th>Authorised</th><th>Status</th>' + (r.show_pay ? '<th class="num">Cost</th>' : '') + '<th></th>';
      MS.setMsg('msg', r.total + ' record' + (r.total === 1 ? '' : 's') + (r.to_verify ? ' · ' + r.to_verify + ' for you to verify' : ''));
      $('wBody').innerHTML = recRows.length ? recRows.map((o) => `<tr${o.status === 'CANCELLED' || o.status === 'DISPUTED' ? ' class="void"' : ''}>
        <td>${hr.person(o.employee_name, o.department_name)}</td>
        <td>${esc(MS.shortDate(o.work_date))}</td><td>${esc(o.actual_start)}-${esc(o.actual_end)}<div class="sub">${esc(hr.hours(o.hours_worked))}${o.job_number ? ' · ' + esc(o.job_number) : ''}</div></td>
        <td>${MS.pill(o.authorisation_status)}${o.reason_category ? `<div class="sub">${esc(label(o.reason_category))}</div>` : ''}</td>
        <td>${MS.pill(o.status)}${o.status === 'VERIFIED' ? `<div class="sub">${esc(label(o.payment_status))}${o.verified_by_name ? ' · ' + esc(o.verified_by_name) : ''}</div>` : `<div class="sub">recorded by ${esc(o.recorded_by_name)}</div>`}</td>
        ${r.show_pay ? `<td class="num">${MS.money(o.cost_amount)}</td>` : ''}
        <td class="acts">${o.can_verify ? `<button type="button" class="primary" data-ver="${esc(o.overtime_record_id)}">Verify</button>` : ''}${o.can_dispute ? `<button type="button" class="danger" data-dis="${esc(o.overtime_record_id)}">Dispute</button>` : ''}${o.can_cancel ? `<button type="button" data-rcan="${esc(o.overtime_record_id)}">Cancel</button>` : ''}</td></tr>`).join('')
        : `<tr><td colspan="${r.show_pay ? 7 : 6}" class="empty">No overtime recorded.</td></tr>`;
      sc.pager('wPager', r, work, load);
    } catch (err) { MS.setMsg('msg', err.message, 'error'); }
  }

  async function loadRegister() {
    MS.setMsg('msg', 'Loading…');
    try {
      const r = await MS.recall('OVERTIME_REGISTER_GET', { month: state.month });
      const t = r.totals, pay = r.show_pay;
      $('gNote').textContent = 'Target: ' + r.target + ' % of overtime authorised before the work.';
      $('gCards').innerHTML = `<div class="card"><div class="k">Hours worked</div><div class="v">${esc(MS.num(t.hours))}</div><div class="s">${esc(t.records)} records</div></div>
        <div class="card ${t.authorised_pct !== null && t.authorised_pct < r.target ? 'red' : 'green'}"><div class="k">Authorised</div><div class="v">${esc(hr.pct(t.authorised_pct))}</div><div class="s">${esc(MS.num(t.authorised_hours))} hours</div></div>
        <div class="card ${t.unauthorised ? 'red' : ''}"><div class="k">Unauthorised</div><div class="v">${esc(t.unauthorised)}</div><div class="s">${esc(MS.num(t.unauthorised_hours))} hours, not paid</div></div>
        <div class="card"><div class="k">${pay ? 'Cost (verified)' : 'Requests'}</div><div class="v">${pay ? MS.money(t.cost) : esc(r.requests.total)}</div><div class="s">${pay ? esc(t.unpaid) + ' unpaid · ' + esc(t.paid) + ' paid' : esc(r.requests.waiting) + ' waiting · ' + esc(r.requests.approved) + ' approved'}</div></div>`;
      const head = (first) => `<th>${first}</th><th class="num">Records</th><th class="num">Hours</th><th class="num">Authorised h</th><th class="num">Unauthorised h</th><th class="num">Authorised %</th><th class="num">Verified</th><th class="num">Disputed</th>${pay ? '<th class="num">Cost</th>' : ''}`;
      const line = (x) => `<tr><td><b>${esc(x.name)}</b></td><td class="num">${esc(x.records)}</td><td class="num">${esc(MS.num(x.hours))}</td><td class="num">${esc(MS.num(x.authorised_hours))}</td><td class="num">${esc(MS.num(x.unauthorised_hours))}</td><td class="num">${hr.pctCell(x.authorised_pct, x.authorised_pct === null ? null : x.authorised_pct >= r.target)}</td><td class="num">${esc(x.verified)}</td><td class="num">${esc(x.disputed)}</td>${pay ? `<td class="num">${MS.money(x.cost)}</td>` : ''}</tr>`;
      const cols = pay ? 9 : 8;
      $('gHead').innerHTML = head('Person'); $('gDHead').innerHTML = head('Department'); $('gRHead').innerHTML = head('Reason');
      $('gBody').innerHTML = r.people.filter((x) => x.records || x.requests).map(line).join('') || `<tr><td colspan="${cols}" class="empty">No overtime this month.</td></tr>`;
      $('gDeps').innerHTML = r.departments.map(line).join('') || `<tr><td colspan="${cols}" class="empty">None.</td></tr>`;
      $('gReasons').innerHTML = r.reasons.map(line).join('') || `<tr><td colspan="${cols}" class="empty">None.</td></tr>`;
      MS.setMsg('msg', hr.monthName(r.month));
    } catch (err) { MS.setMsg('msg', err.message, 'error'); }
  }

  /* ---------- forms ---------- */
  async function jobOptions(selected) {
    if (jobs === null) { try { jobs = MS.can('JOB_VIEW') ? (await MS.call('JOB_LIST', { page_size: 100 })).rows : []; } catch (e) { jobs = []; } }
    return MS.options(jobs.map((j) => ({ value: j.job_id, label: j.job_number + ' · ' + j.job_name })), selected, '— none —');
  }
  const people = (selected) => MS.options(ref.employees.map((e) => ({ value: e.employee_id, label: e.name + (e.department_name ? ' · ' + e.department_name : '') })), selected, '— choose —');

  async function requestForm() {
    const jo = await jobOptions('');
    sc.ask({ title: 'Request overtime', wide: true,
      info: 'This must be sent before the work starts. Someone other than you approves it.',
      extra: `<label class="req">Person <select id="oEmp">${people('')}</select></label>
        <div class="two"><label class="req">Date <input id="oDate" type="date" value="${esc(MS.todayISO())}"></label><label class="req">Why <select id="oCat">${MS.options(ref.categories, '', '— choose —')}</select></label></div>
        <div class="two"><label class="req">From <input id="oFrom" type="time" value="17:00"></label><label class="req">To <input id="oTo" type="time" value="19:00"></label></div>
        <label>Job (needed when the reason is a job deadline) <select id="oJob">${jo}</select></label>`,
      label: 'Explain what must be done and why it cannot wait', required: true, button: 'Send request',
      run: async (t) => {
        if (!dc.val('oEmp') || !dc.val('oDate') || !dc.val('oFrom') || !dc.val('oTo') || !dc.val('oCat')) throw new Error('Fill in the person, date, times and reason.');
        await MS.call('OVERTIME_REQUEST', dc.clean({ employee_id: dc.val('oEmp'), overtime_date: dc.val('oDate'), planned_start: dc.val('oFrom'), planned_end: dc.val('oTo'), reason_category: dc.val('oCat'), job_id: dc.val('oJob'), reason: t }));
        await load();
      } });
  }

  function decideForm(o, decision) {
    const yes = decision === 'APPROVE';
    sc.ask({ title: (yes ? 'Approve overtime · ' : 'Reject overtime · ') + o.employee_name,
      info: MS.shortDate(o.overtime_date) + ' ' + o.planned_start + '-' + o.planned_end + ' (' + hr.hours(o.planned_hours) + '). ' + label(o.reason_category) + '. ' + o.reason,
      label: yes ? 'Note (optional)' : 'Why not', required: !yes, danger: !yes, button: yes ? 'Approve' : 'Reject',
      run: async (t) => { await MS.call('OVERTIME_DECIDE', dc.clean({ overtime_request_id: o.overtime_request_id, decision, comment: t })); await load(); } });
  }

  function cancelRequest(o) {
    sc.ask({ title: 'Cancel overtime request · ' + o.employee_name, danger: true, label: 'Why (needed when someone else asked for it)', button: 'Cancel request',
      run: async (t) => { await MS.call('OVERTIME_REQUEST_CANCEL', dc.clean({ overtime_request_id: o.overtime_request_id, reason: t })); await load(); } });
  }

  function recordForm(o) {
    sc.ask({ title: o ? 'Record hours · ' + o.employee_name : 'Record unplanned hours', wide: true,
      info: o ? 'Approved for ' + MS.shortDate(o.overtime_date) + ', ' + o.planned_start + '-' + o.planned_end + '. Record the hours actually worked; a different person checks them afterwards.'
        : 'There is no approved request, so these hours are flagged UNAUTHORISED, the managers are told, and they are not paid through payroll.',
      extra: (o ? '' : `<label class="req">Person <select id="cEmp">${people('')}</select></label><label class="req">Date <input id="cDate" type="date" value="${esc(MS.todayISO())}"></label>`) +
        `<div class="two"><label class="req">Started <input id="cFrom" type="time" value="${esc(o ? o.planned_start : '')}"></label><label class="req">Finished <input id="cTo" type="time" value="${esc(o ? o.planned_end : '')}"></label></div>`,
      noText: true, button: 'Record hours',
      run: async () => {
        if (!dc.val('cFrom') || !dc.val('cTo') || (!o && (!dc.val('cEmp') || !dc.val('cDate')))) throw new Error('Fill in the times' + (o ? '.' : ', the person and the date.'));
        const p = o ? { overtime_request_id: o.overtime_request_id, work_date: o.overtime_date } : { employee_id: dc.val('cEmp'), work_date: dc.val('cDate') };
        const r = await MS.call('OVERTIME_RECORD_ADD', Object.assign(p, { actual_start: dc.val('cFrom'), actual_end: dc.val('cTo') }));
        await load();
        dc.warn(r, 'msg');
      } });
  }

  const RECORD_FORMS = {
    ver: (o) => sc.ask({ title: 'Verify overtime · ' + o.employee_name, noText: true, button: 'Verify',
      info: MS.shortDate(o.work_date) + ' ' + o.actual_start + '-' + o.actual_end + ', ' + hr.hours(o.hours_worked) + '. Once verified, authorised hours go to the next payroll run' + (o.job_id ? ' and the cost is added to the job' : '') + '.',
      run: async () => { await MS.call('OVERTIME_VERIFY', { overtime_record_id: o.overtime_record_id }); await load(); } }),
    dis: (o) => sc.ask({ title: 'Dispute overtime · ' + o.employee_name, danger: true, label: 'Why', required: true, button: 'Dispute', info: 'The hours will not be paid and any cost added to a job is reversed.',
      run: async (t) => { await MS.call('OVERTIME_DISPUTE', { overtime_record_id: o.overtime_record_id, reason: t }); await load(); } }),
    rcan: (o) => sc.ask({ title: 'Cancel recorded hours · ' + o.employee_name, danger: true, label: 'Why', required: true, button: 'Cancel record',
      run: async (t) => { await MS.call('OVERTIME_RECORD_CANCEL', { overtime_record_id: o.overtime_record_id, reason: t }); await load(); } })
  };

  MS.boot({ page: 'overtime', any: ['OVERTIME_REQUEST', 'OVERTIME_APPROVE', 'OVERTIME_RECORD'] }).then(async () => {
    try { ref = await MS.call('OVERTIME_REF_GET'); } catch (err) { MS.setMsg('msg', err.message, 'error'); return; }
    $('reqBtn').hidden = !(MS.can('OVERTIME_REQUEST') && ref.can.request);
    $('recBtn').hidden = !(MS.can('OVERTIME_RECORD') && ref.can.record);
    $('rStatus').innerHTML = MS.options(['REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED'], '', 'Any status');
    $('wStatus').innerHTML = MS.options(['RECORDED', 'VERIFIED', 'DISPUTED', 'CANCELLED'], '', 'Any status');
    $('wAuth').innerHTML = MS.options([{ value: 'AUTHORISED', label: 'Authorised' }, { value: 'UNAUTHORISED', label: 'Unauthorised' }], '', 'Authorised or not');
    sc.tabs('tabs', state, load);
    hr.monthBar('gBar', state, load);
    const bind = (st, box, map) => Object.keys(map).forEach((id) => $(id).addEventListener('input', MS.debounce(() => { st[map[id]] = $(id).value.trim(); st.page = 1; load(); }, 250)));
    bind(req, 'req', { rStatus: 'status', rMonth: 'month', rSearch: 'q' });
    bind(work, 'work', { wStatus: 'status', wAuth: 'auth', wMonth: 'month', wSearch: 'q' });
    $('rReload').addEventListener('click', load);
    $('wReload').addEventListener('click', load);
    $('reqBtn').addEventListener('click', requestForm);
    $('recBtn').addEventListener('click', () => recordForm(null));
    $('rBody').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const o = reqRows.find((x) => x.overtime_request_id === (b.dataset.id || b.dataset.rec || b.dataset.can));
      if (b.dataset.dec) decideForm(o, b.dataset.dec);
      else if (b.dataset.rec) recordForm(o);
      else if (b.dataset.can) cancelRequest(o);
    });
    $('wBody').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const key = ['ver', 'dis', 'rcan'].find((k) => b.dataset[k]);
      if (key) RECORD_FORMS[key](recRows.find((x) => x.overtime_record_id === b.dataset[key]));
    });
    if (['worked', 'register'].indexOf(MS.param('tab')) >= 0) sc.setTab('tabs', MS.param('tab'), state);
    load();
  });
})();
