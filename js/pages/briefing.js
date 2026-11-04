(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const mg = MS.mg, sc = MS.sc, dc = MS.dc;
  const state = { date: MS.param('date') || MS.todayISO() };
  let b = null;

  const jobs = (list, extra) => mg.list(list.map((j) => `<span>${MS.lnk('jobs/job.html?id=' + encodeURIComponent(j.job_id), j.job_number)} ${esc(j.job_name)} <span class="sub">${esc(j.customer_name)}${extra && j[extra] ? ' · ' + esc(j[extra]) : ''}</span></span><span>${MS.pill(j.status)} <span class="sub">${esc(MS.when(j.customer_deadline))}</span></span>`), 'None.');
  const people = (list) => (list.length ? list.map((p) => esc(p.name)).join(', ') : '<span class="muted">none</span>');
  const panel = (t, body, wide) => `<div class="dpanel${wide ? ' wide' : ''}"><h3>${esc(t)}</h3>${body}</div>`;

  MS.reload = () => load();
  async function load() {
    MS.setMsg('msg', 'Loading…');
    try {
      b = await MS.recall('MEETING_BRIEFING_GET', { date: state.date });
      $('dateIn').value = b.date;
      MS.setMsg('msg', (b.working_day ? 'Working day' : b.holiday ? 'Public holiday: ' + b.holiday : 'Rest day') + (b.held ? ' · briefing held at ' + MS.when(b.held.held_at) + ' by ' + b.held.chair_name : ' · briefing not recorded yet'), b.held ? 'ok' : '');
      $('heldBtn').hidden = !(b.can.hold && MS.can('MEETING_MANAGE'));
      const s = b.staff.counts, cu = b.customers;
      $('cards').innerHTML = `<div class="card"><div class="k">Present</div><div class="v">${esc(s.present + s.late)} of ${esc(s.staff)}</div><div class="s">${esc(s.late)} late · ${esc(s.on_leave)} on leave</div></div>
        <div class="card ${s.absent || s.not_recorded ? 'red' : 'green'}"><div class="k">Absent or not recorded</div><div class="v">${esc(s.absent)} / ${esc(s.not_recorded)}</div><div class="s">absent / not recorded</div></div>
        <div class="card ${b.urgent.length ? 'red' : 'green'}"><div class="k">Urgent jobs</div><div class="v">${esc(b.urgent.length)}</div><div class="s">past their deadline</div></div>
        <div class="card ${b.on_hold.length ? 'red' : 'green'}"><div class="k">Jobs on hold</div><div class="v">${esc(b.on_hold.length)}</div><div class="s">waiting for a decision</div></div>
        <div class="card ${b.actions_due.length ? 'red' : 'green'}"><div class="k">Actions due</div><div class="v">${esc(b.actions_due.length)}</div><div class="s">open, due today or earlier</div></div>`;
      $('brief').innerHTML = [
        panel('Jobs due today', jobs(b.due_today)), panel('Jobs due tomorrow', jobs(b.due_tomorrow)),
        panel('Urgent jobs', jobs(b.urgent, 'reason'), true),
        panel('On hold', jobs(b.on_hold, 'reason')),
        panel('Customers', `<h4>Open complaints</h4>${mg.list(cu.complaints.map((c) => `<span>${esc(c.complaint_number)} ${esc(c.customer_name)} <span class="sub">${esc(MS.label(c.severity))}</span></span>${c.overdue ? '<span class="late">overdue</span>' : MS.pill(c.status)}`), 'None.')}
          <h4>Customer issues</h4>${mg.list(cu.issues.map((i) => `<span>${MS.lnk('management/issues.html?id=' + encodeURIComponent(i.issue_id), i.issue_number)} ${esc(i.title)}</span>${MS.pill(i.status)}`), 'None.')}`),
        panel('Staff', `<p><b>Absent:</b> ${people(b.staff.people.absent)}</p><p><b>Late:</b> ${people(b.staff.people.late)}</p><p><b>On leave:</b> ${people(b.staff.people.on_leave)}</p><p><b>Not recorded:</b> ${people(b.staff.people.not_recorded)}</p>
          <h4>Overtime today</h4>${mg.list(b.staff.overtime_today.map((o) => `<span>${esc(o.employee_name)}</span><span class="sub">${esc(o.planned)} · ${esc(MS.label(o.reason))}</span>`), 'None.')}<h4>Leave starting tomorrow</h4>${mg.list(b.staff.leave_starting_tomorrow.map((l) => `<span>${esc(l.employee_name)}</span><span class="sub">${esc(MS.label(l.leave_type))} until ${esc(MS.shortDate(l.end_date))}</span>`), 'None.')}`),
        panel('Actions due', mg.list(b.actions_due.map((a) => `<span>${esc(a.action_description)} <span class="sub">${esc(a.assignee_names)} · ${esc(a.meeting_title)}</span></span><span class="${a.overdue ? 'late' : ''}">${esc(MS.shortDate(a.deadline))}</span>`), 'None.'), true)
      ].join('');
    } catch (err) { MS.setMsg('msg', err.message, 'error'); }
  }

  function heldForm() {
    const here = b.staff.people.present.concat(b.staff.people.late);
    sc.ask({ title: 'Briefing held · ' + MS.shortDate(b.date), wide: true, label: 'Notes (optional)', button: 'Record as held',
      info: 'Records that the daily briefing took place. Tick who attended; you are included.',
      extra: mg.peopleChecks('hWho', here, here.map((p) => p.employee_id)),
      run: async (t) => { await MS.call('MEETING_BRIEFING_HELD', dc.clean({ date: b.date, attendee_ids: mg.checked('hWho'), notes: t })); await load(); } });
  }

  MS.boot({ page: 'briefing', any: ['MEETING_MANAGE'] }).then(() => {
    $('dateIn').onchange = () => { if ($('dateIn').value) { state.date = $('dateIn').value; load(); } };
    $('heldBtn').onclick = heldForm;
    $('printBtn').onclick = mg.print;
    load();
  });
})();
