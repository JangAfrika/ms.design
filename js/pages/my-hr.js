/* My HR: my attendance (clock in and out), leave balance and requests, overtime, training and the concerns I raised.
   Everything here is about the signed-in person only; no pay figures are shown. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const sc = MS.sc, dc = MS.dc, hr = MS.hr;
  const state = { month: hr.monthNow() };
  let d = null;

  async function load() {
    try {
      d = await MS.call('MY_HR_GET', { month: state.month });
      $('noStaff').hidden = !d.no_staff_record;
      $('body').hidden = !!d.no_staff_record;
      if (!d.no_staff_record) draw();
    } catch (err) { MS.setMsg('msg', err.message, 'error'); }
  }

  function draw() {
    const t = d.today, st = d.attendance.stats, can = d.can;
    $('leaveBtn').hidden = !(MS.can('LEAVE_REQUEST') && can.leave_request);
    $('concernBtn').hidden = !(MS.can('GRIEVANCE_RAISE') && can.raise_concern);
    const annual = d.leave.balance.find((b) => b.leave_type === 'ANNUAL');
    const tr = d.training.totals;
    $('cards').innerHTML = `<div class="card"><div class="k">Attendance · ${esc(hr.monthName(d.month))}</div><div class="v">${esc(hr.pct(st.attendance_pct))}</div><div class="s">${esc(st.attended)} of ${esc(st.scheduled)} working days · target ${esc(d.attendance.target)} %</div></div>
      <div class="card"><div class="k">On time</div><div class="v">${esc(hr.pct(st.punctuality_pct))}</div><div class="s">${esc(st.late)} late day${st.late === 1 ? '' : 's'}, ${esc(st.minutes_late)} minutes</div></div>
      <div class="card"><div class="k">Annual leave left</div><div class="v">${annual && annual.remaining !== null ? esc(MS.num(annual.remaining)) + ' days' : '–'}</div><div class="s">${annual ? esc(MS.num(annual.used)) + ' used · ' + esc(MS.num(annual.pending)) + ' waiting' : ''}</div></div>
      <div class="card ${tr.overdue ? 'red' : ''}"><div class="k">Required training</div><div class="v">${esc(tr.completed)} of ${esc(tr.required)}</div><div class="s">${tr.overdue ? esc(tr.overdue) + ' overdue' : 'none overdue'}</div></div>`;

    const row = t.row;
    const line = t.leave ? `On ${esc(MS.label(t.leave.leave_type).toLowerCase())} leave until ${esc(MS.shortDate(t.leave.end_date))}.`
      : row ? `${MS.pill(row.attendance_status)} ${row.clock_in ? 'In at <b>' + esc(row.clock_in) + '</b>' : ''}${row.clock_out ? ', out at <b>' + esc(row.clock_out) + '</b>' : ''}${Number(row.minutes_late) > 0 ? ' · ' + esc(row.minutes_late) + ' minutes late' : ''}`
      : t.holiday ? 'Public holiday: ' + esc(t.holiday) + '.' : !t.is_workday ? 'Today is a rest day.' : 'You have not clocked in yet.';
    $('todayBox').innerHTML = `<h3>Today · ${esc(MS.prettyDate(t.date))}</h3><div class="hr-clock"><div><div class="big">${line}</div><div class="sub">Work starts at ${esc(d.workday.start)}${d.workday.grace_minutes ? ' (' + esc(d.workday.grace_minutes) + ' minutes allowed)' : ''} and ends at ${esc(d.workday.end)}.</div></div>
      <div class="acts"><button type="button" class="primary" id="inBtn" hidden>Clock in</button><button type="button" id="outBtn" hidden>Clock out</button></div></div>`;
    $('inBtn').hidden = !(MS.can('ATTENDANCE_SELF') && can.clock && t.can_clock_in);
    $('outBtn').hidden = !(MS.can('ATTENDANCE_SELF') && can.clock && t.can_clock_out);
    $('inBtn').onclick = () => clock('ATTENDANCE_CLOCK_IN', 'inBtn');
    $('outBtn').onclick = () => clock('ATTENDANCE_CLOCK_OUT', 'outBtn');

    $('balBox').innerHTML = `<h3>Leave balance · ${esc(d.leave.year)}</h3>${hr.leaveBalanceTable(d.leave.balance)}`;
    $('holBox').innerHTML = `<h3>Public holidays, next 60 days</h3>${d.holidays.length ? `<ul class="mini-list">${d.holidays.map((h) => `<li><span>${esc(h.name)}</span><span class="a">${esc(MS.shortDate(h.date))}</span></li>`).join('')}</ul>` : '<p class="empty">None coming up.</p>'}`;

    const reqs = d.leave.requests;
    $('leaveBox').innerHTML = `<h3>My leave requests</h3>${reqs.length ? `<div class="tablewrap"><table class="inv"><thead><tr><th>Type</th><th>From</th><th>To</th><th class="num">Days</th><th>Status</th><th>Decided by</th><th></th></tr></thead><tbody id="leaveBody">
      ${reqs.map((l) => `<tr><td>${esc(MS.label(l.leave_type))}${l.reason ? `<div class="sub">${esc(l.reason)}</div>` : ''}</td><td>${esc(MS.shortDate(l.start_date))}</td><td>${esc(MS.shortDate(l.end_date))}</td><td class="num">${esc(l.days_requested)}</td><td>${MS.pill(l.status)}</td><td>${esc(l.approved_by_name || '')}</td><td class="acts">${l.can_cancel ? `<button type="button" data-lcan="${esc(l.leave_request_id)}">Cancel</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">No leave requested yet.</p>'}`;
    hr.wireLeave('leaveBody', () => reqs, load);

    $('attBox').innerHTML = `<h3>Attendance</h3><div class="toolbar" style="margin-top:0"><span id="monthBar"></span></div>${d.attendance.rows.length ? `<div class="tablewrap"><table class="inv"><thead><tr><th>Date</th><th>Status</th><th>In</th><th>Out</th><th class="num">Minutes late</th><th>Note</th></tr></thead><tbody>
      ${d.attendance.rows.map((r) => `<tr><td>${esc(MS.shortDate(r.attendance_date))}</td><td>${MS.pill(r.attendance_status)}</td><td>${hr.clock(r.clock_in)}</td><td>${hr.clock(r.clock_out)}</td><td class="num">${Number(r.minutes_late) ? esc(r.minutes_late) : ''}</td><td>${esc(r.notes || '')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Nothing recorded for this month.</p>'}`;
    hr.monthBar('monthBar', state, load);

    const o = d.overtime;
    $('otBox').innerHTML = `<h3>My overtime</h3>${o.requests.length || o.records.length ? `<div class="tablewrap"><table class="inv"><thead><tr><th>Date</th><th>Planned</th><th>Worked</th><th>Why</th><th>Status</th></tr></thead><tbody>
      ${o.requests.map((r) => { const rec = o.records.find((x) => x.overtime_request_id === r.overtime_request_id && x.status !== 'CANCELLED');
        return `<tr><td>${esc(MS.shortDate(r.overtime_date))}</td><td>${esc(r.planned_start)}-${esc(r.planned_end)} · ${esc(hr.hours(r.planned_hours))}</td><td>${rec ? esc(rec.actual_start) + '-' + esc(rec.actual_end) + ' · ' + esc(hr.hours(rec.hours_worked)) : ''}</td><td>${esc(MS.label(r.reason_category))}</td><td>${MS.pill(rec ? rec.status : r.status)}${rec && rec.payment_status === 'PAID' ? ' ' + MS.pill('PAID') : ''}</td></tr>`; }).join('')}
      ${o.records.filter((x) => !x.overtime_request_id).map((r) => `<tr><td>${esc(MS.shortDate(r.work_date))}</td><td></td><td>${esc(r.actual_start)}-${esc(r.actual_end)} · ${esc(hr.hours(r.hours_worked))}</td><td>No request</td><td>${MS.pill('UNAUTHORISED')}</td></tr>`).join('')}</tbody></table></div>
      <p class="fin-note">Overtime must be requested and approved before the work. Your supervisor records the hours and a second person checks them before they are paid.</p>` : '<p class="empty">No overtime.</p>'}`;

    const rows = d.training.rows;
    $('trainBox').innerHTML = `<h3>My training</h3>${rows.length ? `<div class="tablewrap"><table class="inv"><thead><tr><th>Training</th><th>Required</th><th>Due</th><th>Status</th><th>Done on</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td>${esc(r.training_title)}</td><td>${r.is_required ? 'Yes' : 'No'}</td><td class="${r.overdue ? 'late' : r.due_soon ? 'soon' : ''}">${esc(MS.shortDate(r.due_date))}${r.overdue ? ' (overdue)' : ''}</td><td>${MS.pill(r.status)}</td><td>${esc(MS.shortDate(r.completed_date))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">No training recorded.</p>'}`;

    const gs = d.grievances;
    $('concernBox').innerHTML = `<h3>My concerns</h3><p class="fin-note">What you write here can be read only by you and the people who handle staff concerns. It is not copied into notifications or the activity log.</p>${gs.length ? gs.map((g) => `<div class="hr-concern">
      <h4>${esc(MS.label(g.category))} · raised ${esc(MS.shortDate(g.received_date))} ${MS.pill(g.status)}</h4>
      <div class="sub">${g.status === 'CLOSED' || g.status === 'ADDRESSED' ? 'Answered' + (g.addressed_date ? ' on ' + esc(MS.shortDate(g.addressed_date)) : '') : 'Answer due by ' + esc(MS.shortDate(g.due_date))}${g.handled_by_name ? ' · handled by ' + esc(g.handled_by_name) : ''}</div>
      <div class="hr-pre">${esc(g.description)}</div>
      ${g.response ? `<div class="sub" style="margin-top:8px">Response</div><div class="hr-pre">${esc(g.response)}</div>` : ''}
      ${g.can_close && g.is_mine ? `<div style="margin-top:8px"><button type="button" data-gclose="${esc(g.grievance_id)}">Close this concern</button></div>` : ''}</div>`).join('') : '<p class="empty">You have not raised a concern.</p>'}`;
    $('concernBox').onclick = (e) => {
      const b = e.target.closest('[data-gclose]');
      if (b) closeConcern(b.dataset.gclose);
    };
  }

  async function clock(action, btnId) {
    MS.setMsg('msg', '');
    const b = $(btnId);
    MS.busy(b, true, 'Saving…');
    try {
      const r = await MS.call(action);
      MS.setMsg('msg', action === 'ATTENDANCE_CLOCK_IN' ? 'Clocked in at ' + r.clock_in + (Number(r.minutes_late) > 0 ? ' · ' + r.minutes_late + ' minutes late.' : ' · on time.') : 'Clocked out at ' + r.clock_out + '.', 'ok');
      await load();
    } catch (err) { MS.setMsg('msg', err.message, 'error'); MS.busy(b, false); }
  }

  function concernForm() {
    sc.ask({ title: 'Raise a concern', wide: true,
      info: 'Only you and the people who handle staff concerns can read this. You will get an answer within 7 working days.',
      extra: `<label class="req">About <select id="gCat">${MS.options(['WORKLOAD', 'PAY', 'CONFLICT', 'CONDITIONS', 'CONDUCT', 'OTHER'], '', '— choose —')}</select></label>`,
      label: 'What happened', required: true, button: 'Send concern',
      run: async (t) => {
        if (!dc.val('gCat')) throw new Error('Choose what the concern is about.');
        await MS.call('GRIEVANCE_RAISE', { category: dc.val('gCat'), description: t });
        MS.setMsg('msg', 'Your concern was sent. It must be answered within 7 working days.', 'ok');
        await load();
      } });
  }

  function closeConcern(id) {
    sc.ask({ title: 'Close this concern', info: 'Close it when you are satisfied with the response.', noText: true, button: 'Close concern',
      run: async () => { await MS.call('GRIEVANCE_CLOSE', { grievance_id: id }); await load(); } });
  }

  MS.boot({ page: 'my-hr', any: ['ATTENDANCE_SELF', 'LEAVE_REQUEST', 'GRIEVANCE_RAISE'] }).then(() => {
    $('leaveBtn').addEventListener('click', () => hr.requestLeave(load));
    $('concernBtn').addEventListener('click', concernForm);
    load().then(() => { if (MS.param('leave') && !$('leaveBtn').hidden) hr.requestLeave(load); });
  });
})();
