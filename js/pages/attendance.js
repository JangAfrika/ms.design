(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const sc = MS.sc, dc = MS.dc, hr = MS.hr;
  const state = { tab: 'day', date: MS.todayISO(), month: hr.monthNow() };
  let day = null, hol = null;

  MS.reload = () => load();
  function load() {
    $('dayPane').hidden = state.tab !== 'day';
    $('monthPane').hidden = state.tab !== 'month';
    $('holPane').hidden = state.tab !== 'holidays';
    $('restBtn').hidden = true;
    $('holBtn').hidden = true;
    return ({ day: loadDay, month: loadMonth, holidays: loadHolidays })[state.tab]();
  }

  async function loadDay() {
    MS.setMsg('msg', 'Loading…');
    try {
      day = await MS.recall('ATTENDANCE_DAY_GET', { date: state.date });
      $('dDate').value = day.date;
      $('dNext').disabled = day.date >= MS.todayISO();
      $('dNote').textContent = day.holiday ? 'Public holiday: ' + day.holiday : !day.is_workday ? 'Rest day' : 'Work ' + day.workday_start + ' to ' + day.workday_end;
      $('restBtn').hidden = !(MS.can('ATTENDANCE_RECORD') && day.can.record);
      const c = day.counts;
      $('dCards').innerHTML = `<div class="card green"><div class="k">On time</div><div class="v">${esc(c.present)}</div><div class="s">of ${esc(day.total)} people</div></div>
        <div class="card"><div class="k">Late</div><div class="v">${esc(c.late)}</div><div class="s">arrived after the start</div></div>
        <div class="card ${c.absent ? 'red' : ''}"><div class="k">Absent</div><div class="v">${esc(c.absent)}</div><div class="s">${esc(c.sick)} sick</div></div>
        <div class="card ${c.not_recorded && day.is_workday ? 'red' : ''}"><div class="k">Not recorded</div><div class="v">${esc(c.not_recorded)}</div><div class="s">${esc(c.on_leave)} on leave</div></div>`;
      MS.setMsg('msg', day.total + ' people in your register');
      $('dBody').innerHTML = day.rows.length ? day.rows.map((r) => `<tr>
        <td>${hr.person(r.name, r.department_name + (r.position_title ? ' · ' + r.position_title : ''))}</td>
        <td>${r.attendance_status ? MS.pill(r.attendance_status) : r.on_leave ? MS.pill('ON_LEAVE') + `<div class="sub">${esc(MS.label(r.leave_type))}, approved</div>` : '<span class="muted">not recorded</span>'}</td>
        <td>${hr.clock(r.clock_in)}</td><td>${hr.clock(r.clock_out)}</td><td class="num">${Number(r.minutes_late) ? esc(r.minutes_late) : ''}</td>
        <td>${esc(r.notes || '')}${r.recorded_by_name ? `<div class="sub">${esc(r.recorded_by_name)}</div>` : ''}${r.is_self ? '<div class="sub">your own row: use My HR</div>' : ''}</td>
        <td class="acts">${r.can_edit ? (r.attendance_id ? `<button type="button" data-fix="${esc(r.employee_id)}">Correct</button>` : `<button type="button" class="primary" data-rec="${esc(r.employee_id)}">Record</button>`) : ''}</td></tr>`).join('')
        : '<tr><td colspan="7" class="empty">Nobody in your register.</td></tr>';
    } catch (err) { MS.setMsg('msg', err.message, 'error'); }
  }

  function entryForm(r, isFix) {
    const sel = r.attendance_status || 'PRESENT';
    sc.ask({ title: (isFix ? 'Correct attendance · ' : 'Record attendance · ') + r.name, wide: true,
      info: MS.shortDate(day.date) + (isFix ? '. A correction keeps the old value in the activity log, with your reason.' : '. Late is worked out from the time in against the work start time.'),
      extra: `<label class="req">Status <select id="aSt">${MS.options(hr.ATT_STATUSES.filter((s) => s !== 'ON_LEAVE' || r.on_leave), sel)}</select></label>
        <div class="two"><label>Time in <input id="aIn" type="time" value="${esc(r.clock_in || '')}"></label><label>Time out <input id="aOut" type="time" value="${esc(r.clock_out || '')}"></label></div>
        <label>Note <input id="aNote" type="text" maxlength="200" value="${esc(r.notes || '')}"></label>`,
      label: isFix ? 'Why is it being corrected' : 'Reason (optional)', required: isFix, button: isFix ? 'Save correction' : 'Save',
      run: async (t) => {
        const f = { attendance_status: dc.val('aSt'), clock_in: dc.val('aIn'), clock_out: dc.val('aOut'), notes: dc.val('aNote') };
        if (isFix) await MS.call('ATTENDANCE_CORRECT', Object.assign({ attendance_id: r.attendance_id, reason: t }, f));
        else await MS.call('ATTENDANCE_SAVE', Object.assign({ employee_id: r.employee_id, attendance_date: day.date }, dc.clean(f)));
        await load();
      } });
  }

  async function loadMonth() {
    MS.setMsg('msg', 'Loading…');
    try {
      const r = await MS.recall('ATTENDANCE_REPORT_GET', { month: state.month });
      const t = r.totals;
      $('mNote').textContent = 'Target ' + r.target + ' %. Days nobody recorded are shown but left out of the figures.';
      $('mCards').innerHTML = `<div class="card ${t.attendance_ok === false ? 'red' : 'green'}"><div class="k">Attendance</div><div class="v">${esc(hr.pct(t.attendance_pct))}</div><div class="s">${esc(t.attended)} of ${esc(t.scheduled)} working days</div></div>
        <div class="card ${t.punctuality_ok === false ? 'red' : 'green'}"><div class="k">Punctuality</div><div class="v">${esc(hr.pct(t.punctuality_pct))}</div><div class="s">${esc(t.present)} on time, ${esc(t.late)} late</div></div>
        <div class="card ${t.absent ? 'red' : ''}"><div class="k">Absent</div><div class="v">${esc(t.absent)}</div><div class="s">${esc(t.sick)} sick · ${esc(t.on_leave)} on leave</div></div>
        <div class="card"><div class="k">Not recorded</div><div class="v">${esc(t.unrecorded)}</div><div class="s">working days with no entry</div></div>`;
      const cells = (x) => `<td class="num">${esc(x.present)}</td><td class="num">${esc(x.late)}</td><td class="num">${esc(x.absent)}</td>`;
      $('mDeps').innerHTML = r.departments.length ? r.departments.map((x) => `<tr><td><b>${esc(x.department_name)}</b></td><td class="num">${esc(x.staff)}</td>${cells(x)}<td class="num">${esc(x.sick)}</td><td class="num">${esc(x.unrecorded)}</td><td class="num">${hr.pctCell(x.attendance_pct, x.attendance_ok)}</td><td class="num">${hr.pctCell(x.punctuality_pct, x.punctuality_ok)}</td></tr>`).join('') : '<tr><td colspan="9" class="empty">No people.</td></tr>';
      $('mBody').innerHTML = r.people.length ? r.people.map((x) => `<tr><td>${hr.person(x.name, x.department_name)}</td>${cells(x)}<td class="num">${esc(x.on_leave)}</td><td class="num">${esc(x.sick)}</td><td class="num">${esc(x.unrecorded)}</td><td class="num">${hr.pctCell(x.attendance_pct, x.attendance_ok)}</td><td class="num">${hr.pctCell(x.punctuality_pct, x.punctuality_ok)}</td></tr>`).join('') : '<tr><td colspan="9" class="empty">No people.</td></tr>';
      MS.setMsg('msg', hr.monthName(r.month));
    } catch (err) { MS.setMsg('msg', err.message, 'error'); }
  }

  async function loadHolidays() {
    MS.setMsg('msg', 'Loading…');
    try {
      hol = await MS.recall('HOLIDAY_LIST', {});
      $('holBtn').hidden = !(MS.canAny(['ATTENDANCE_RECORD', 'LEAVE_APPROVE']) && hol.can_manage);
      $('hBody').innerHTML = hol.rows.length ? hol.rows.map((h) => `<tr><td>${esc(MS.shortDate(h.date))}</td><td>${esc(h.weekday)}</td><td>${esc(h.name)}</td><td class="acts">${hol.can_manage ? `<button type="button" class="danger" data-del="${esc(h.date)}">Remove</button>` : ''}</td></tr>`).join('') : '<tr><td colspan="4" class="empty">No public holiday has been entered.</td></tr>';
      MS.setMsg('msg', hol.total + ' public holiday' + (hol.total === 1 ? '' : 's'));
    } catch (err) { MS.setMsg('msg', err.message, 'error'); }
  }

  function holidayForm() {
    sc.ask({ title: 'Add a public holiday', info: 'Entering the same date again replaces its name.', noText: true, button: 'Save',
      extra: '<div class="two"><label class="req">Date <input id="hDate" type="date"></label><label class="req">Name <input id="hName" type="text" maxlength="80"></label></div>',
      run: async () => {
        if (!dc.val('hDate') || !dc.val('hName')) throw new Error('Enter the date and the name of the holiday.');
        await MS.call('HOLIDAY_SAVE', { date: dc.val('hDate'), name: dc.val('hName') });
        await load();
      } });
  }

  MS.boot({ page: 'attendance', any: ['ATTENDANCE_RECORD', 'LEAVE_APPROVE'] }).then(() => {
    sc.tabs('tabs', state, load);
    hr.monthBar('mBar', state, load);
    const goDay = (n) => { const d = new Date(state.date + 'T00:00:00'); d.setDate(d.getDate() + n); state.date = MS.isoOf(d); load(); };
    $('dPrev').addEventListener('click', () => goDay(-1));
    $('dNext').addEventListener('click', () => goDay(1));
    $('dToday').addEventListener('click', () => { state.date = MS.todayISO(); load(); });
    $('dDate').addEventListener('change', () => { if ($('dDate').value) { state.date = $('dDate').value; load(); } });
    $('dBody').addEventListener('click', (e) => {
      const f = e.target.closest('[data-fix]'), r = e.target.closest('[data-rec]');
      const id = f ? f.dataset.fix : r ? r.dataset.rec : '';
      if (id) entryForm(day.rows.find((x) => x.employee_id === id), !!f);
    });
    $('restBtn').addEventListener('click', () => sc.ask({ title: 'Mark the rest present', noText: true, button: 'Mark present',
      info: 'Everyone in your register who has no entry for ' + MS.shortDate(state.date) + ' and is not on approved leave is marked PRESENT. Your own row is never touched.',
      run: async () => { const r = await MS.call('ATTENDANCE_MARK_REST', { attendance_date: state.date }); await load(); MS.setMsg('msg', r.marked + ' marked present.', 'ok'); } }));
    $('holBtn').addEventListener('click', holidayForm);
    $('hBody').addEventListener('click', (e) => {
      const b = e.target.closest('[data-del]');
      if (b) sc.ask({ title: 'Remove public holiday', danger: true, noText: true, button: 'Remove', info: MS.shortDate(b.dataset.del) + ' becomes a normal day again.',
        run: async () => { await MS.call('HOLIDAY_DELETE', { date: b.dataset.del }); await load(); } });
    });
    if (['month', 'holidays'].indexOf(MS.param('tab')) >= 0) sc.setTab('tabs', MS.param('tab'), state);
    load();
  });
})();
