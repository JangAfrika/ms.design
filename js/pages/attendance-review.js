(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const sc = MS.sc, hr = MS.hr;
  const state = { month: MS.param('month') || hr.shiftMonth(hr.monthNow(), -1) };
  let data = null;

  const LABEL = { NONE: ['Not submitted', 'off'], DRAFT: ['Draft', 'pending'], SUBMITTED: ['Waiting for approval', 'waiting'], APPROVED: ['Approved and locked', 'ok'], RETURNED: ['Sent back', 'failed'] };
  const pill = (s) => { const l = LABEL[s] || [s, 'off']; return `<span class="pill ${l[1]}">${MS.icon(l[1] === 'ok' ? 'check' : l[1] === 'failed' ? 'alert' : 'clock')}${esc(l[0])}</span>`; };

  function step(cls, icon, title, sub) {
    return `<div class="ar-step ${cls}">${MS.icon(icon)}<div><b>${esc(title)}</b><div class="sub">${sub}</div></div></div>`;
  }

  function steps(r) {
    const v = r.review, st = r.status;
    const sent = !!v && (st === 'SUBMITTED' || st === 'APPROVED');
    const who = (name, at, note) => esc(name) + ' · ' + esc(MS.when(at)) + (note ? '<br>' + esc(note) : '');
    const out = [];
    out.push(step(sent ? 'done' : st === 'RETURNED' ? 'bad' : 'now', 'user', '1. General Manager submits', sent ? who(v.prepared_by_name, v.submitted_at) : st === 'RETURNED' ? 'Sent back by ' + esc(v.returned_by_name) + ': ' + esc(v.return_reason) : r.ended ? 'Review the month, then submit.' : 'Can be submitted after the month ends.'));
    out.push(step(v && v.hr_approved_at ? 'done' : st === 'SUBMITTED' ? 'now' : '', 'team', '2. Admin (HR) approves', v && v.hr_approved_at ? who(v.hr_approved_by_name, v.hr_approved_at, v.hr_note) : 'Waiting'));
    out.push(step(v && v.ceo_approved_at ? 'done' : st === 'SUBMITTED' ? 'now' : '', 'shield', '3. CEO approves', v && v.ceo_approved_at ? who(v.ceo_approved_by_name, v.ceo_approved_at, v.ceo_note) : 'Waiting'));
    out.push(step(st === 'APPROVED' ? 'done' : '', 'lock', '4. Approved', st === 'APPROVED' ? 'The month is locked.' : 'After both approvals the month is locked.'));
    $('steps').innerHTML = out.join('');
  }

  function render(r) {
    data = r;
    const rep = r.report, t = rep.totals;
    $('mStatus').innerHTML = pill(r.status) + (r.frozen ? ' <span class="muted">figures as submitted</span>' : '');
    steps(r);
    const fl = rep.flags || { unrecorded: [], no_signout: [] };
    const warn = [];
    if (fl.unrecorded.length) warn.push(`<div class="msg error">${MS.icon('alert')} Working days with no entry: ${fl.unrecorded.map((x) => esc(x.name) + ' (' + x.days + ')').join(', ')}. Record them in <a href="people/attendance.html?tab=month">Attendance</a> before submitting.</div>`);
    if (fl.no_signout.length) warn.push(`<div class="msg">${MS.icon('clock')} Signed in but never signed out: ${fl.no_signout.map((x) => esc(x.name) + ' (' + x.days + ')').join(', ')}.</div>`);
    if (r.review && r.status === 'RETURNED') warn.push(`<div class="msg error">${MS.icon('alert')} Sent back by ${esc(r.review.returned_by_name)}: ${esc(r.review.return_reason)}</div>`);
    $('banner').innerHTML = warn.join('');
    $('mCards').innerHTML = `<div class="card ${t.attendance_ok === false ? 'red' : 'green'}"><div class="k">Attendance</div><div class="v">${esc(hr.pct(t.attendance_pct))}</div><div class="s">${esc(t.attended)} of ${esc(t.scheduled)} scheduled days</div></div>
      <div class="card ${t.punctuality_ok === false ? 'red' : 'green'}"><div class="k">Punctuality</div><div class="v">${esc(hr.pct(t.punctuality_pct))}</div><div class="s">${esc(t.present)} on time, ${esc(t.late)} late</div></div>
      <div class="card ${t.absent ? 'red' : ''}"><div class="k">Absent</div><div class="v">${esc(t.absent)}</div><div class="s">${esc(t.sick)} sick · ${esc(t.on_leave)} on leave</div></div>
      <div class="card ${t.unrecorded ? 'red' : ''}"><div class="k">Not recorded</div><div class="v">${esc(t.unrecorded)}</div><div class="s">${esc(t.staff)} people in the month</div></div>`;
    const cells = (x) => `<td class="num">${esc(x.present)}</td><td class="num">${esc(x.late)}</td><td class="num">${esc(x.absent)}</td><td class="num">${esc(x.on_leave)}</td><td class="num">${esc(x.sick)}</td>`;
    $('mDeps').innerHTML = rep.departments.length ? rep.departments.map((x) => `<tr><td><b>${esc(x.department_name)}</b></td><td class="num">${esc(x.staff)}</td>${cells(x)}<td class="num">${hr.pctCell(x.attendance_pct, x.attendance_ok)}</td></tr>`).join('') : '<tr><td colspan="8" class="empty">No staff.</td></tr>';
    $('mBody').innerHTML = rep.people.length ? rep.people.map((x) => `<tr><td>${hr.person(x.name, x.department_name)}</td>${cells(x)}<td class="num">${x.unrecorded ? `<span class="hr-warn">${esc(x.unrecorded)}</span>` : '0'}</td><td class="num">${hr.pctCell(x.attendance_pct, x.attendance_ok)}</td>
      <td>${x.no_signout ? `<span class="ar-flag amber">${esc(x.no_signout)} no sign-out</span>` : ''}${x.absent ? `<span class="ar-flag red">${esc(x.absent)} absent</span>` : ''}</td></tr>`).join('') : '<tr><td colspan="9" class="empty">No staff.</td></tr>';
    const note = r.review ? r.review.note || '' : '';
    $('noteBox').innerHTML = r.can.save ? `<textarea id="noteText" rows="3" maxlength="4000" placeholder="Anything the approvers should know about this month">${esc(note)}</textarea>` : `<div class="ar-note">${esc(note) || '<span class="muted">No comment.</span>'}</div>`;
    const b = [];
    if (r.can.save) b.push(`<button type="button" data-a="save">${MS.icon('file')} Save comment</button>`);
    if (r.can.submit) b.push(`<button type="button" class="primary" data-a="submit">${MS.icon('send')} Submit for approval</button>`);
    if (r.can.hr_approve) b.push(`<button type="button" class="primary" data-a="hr">${MS.icon('check')} Approve (Admin, HR)</button>`);
    if (r.can.ceo_approve) b.push(`<button type="button" class="primary" data-a="ceo">${MS.icon('check')} Approve (CEO)</button>`);
    if (r.can.send_back) b.push(`<button type="button" class="danger" data-a="back">${MS.icon('undo')} Send back</button>`);
    $('btns').innerHTML = b.join('');
    MS.setMsg('msg', r.month_name + (r.can.save && !r.ended ? ' has not ended yet. You can write the comment now and submit after the month ends.' : ''));
  }

  async function load() {
    MS.setMsg('msg', 'Loading…');
    try { render(await MS.call('ATT_REVIEW_GET', { month: state.month })); } catch (err) { MS.setMsg('msg', err.message, 'error'); }
  }
  MS.reload = () => load();

  const noteVal = () => ($('noteText') ? $('noteText').value : undefined);

  function act(a) {
    const m = state.month, name = data.month_name;
    if (a === 'save') return MS.call('ATT_REVIEW_SAVE', { month: m, note: noteVal() }).then((r) => { render(r); MS.toast('Saved', 'ok'); }).catch((e) => MS.setMsg('msg', e.message, 'error'));
    if (a === 'submit') return sc.ask({ title: 'Submit attendance for ' + name, noText: true, button: 'Submit',
      info: 'The figures are frozen as they are now and sent to the Admin (HR) and the CEO for approval.',
      run: async () => { render(await MS.call('ATT_REVIEW_SUBMIT', { month: m, note: noteVal() })); } });
    if (a === 'hr' || a === 'ceo') return sc.ask({ title: 'Approve attendance for ' + name, label: 'Comment (optional)', button: 'Approve',
      info: 'When both the Admin (HR) and the CEO have approved, the month is locked and attendance for it can no longer be changed.',
      run: async (t) => { render(await MS.call(a === 'hr' ? 'ATT_REVIEW_HR_APPROVE' : 'ATT_REVIEW_CEO_APPROVE', { month: m, note: t })); } });
    if (a === 'back') return sc.ask({ title: 'Send back to the General Manager', danger: true, label: 'What must be corrected', required: true, button: 'Send back',
      info: 'Any approval already given is cleared. The General Manager corrects the month and submits again.',
      run: async (t) => { render(await MS.call('ATT_REVIEW_RETURN', { month: m, reason: t })); } });
  }

  MS.boot({ page: 'attendance-review', any: ['ATTENDANCE_REVIEW_SUBMIT', 'ATTENDANCE_REVIEW_HR', 'ATTENDANCE_REVIEW_CEO', 'ATTENDANCE_RECORD'] }).then(() => {
    hr.monthBar('mBar', state, load);
    $('printBtn').addEventListener('click', () => window.print());
    $('btns').addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (b) act(b.dataset.a); });
    load();
  });
})();
