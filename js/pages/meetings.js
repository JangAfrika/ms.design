/* Meetings: schedule (daily briefing, weekly, monthly, KPI review), agenda, attendance, minutes (approved by the chair) and action points. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const mg = MS.mg, sc = MS.sc, dc = MS.dc;
  const state = { tab: 'upcoming', page: 1 };
  let rows = [], acts = [], ref = null;

  MS.reload = () => load();
  async function load() {
    MS.setMsg('msg', 'Loading…');
    const isActs = state.tab === 'actions';
    $('mtgWrap').hidden = isActs; $('actWrap').hidden = !isActs;
    try {
      if (isActs) {
        const r = await MS.recall('MEETING_ACTION_LIST', { tab: state.sub || 'open', page: state.page, page_size: 50 });
        acts = r.rows;
        MS.setMsg('msg', r.total + ' action' + (r.total === 1 ? '' : 's'));
        $('actBody').innerHTML = acts.length ? acts.map((a) => `<tr><td>${esc(a.action_description)}<div class="sub">${esc(a.meeting_title)}</div></td><td>${esc(a.assignee_names)}</td><td class="${a.overdue ? 'late' : ''}">${esc(MS.shortDate(a.deadline))}</td><td>${MS.pill(a.status)}</td>
          <td class="acts">${a.can_update ? `<button type="button" data-prog="${esc(a.meeting_action_id)}">In progress</button><button type="button" class="primary" data-done="${esc(a.meeting_action_id)}">Done</button>${MS.can('MEETING_MANAGE') ? `<button type="button" class="danger" data-cx="${esc(a.meeting_action_id)}">Cancel</button>` : ''}` : ''}</td></tr>`).join('')
          : '<tr><td colspan="5" class="empty">No actions here.</td></tr>';
        sc.pager('pager', r, state, load);
        return;
      }
      const r = await MS.recall('MEETING_LIST', { tab: state.tab, page: state.page, page_size: 50 });
      rows = r.rows;
      const c = r.counts;
      $('cards').innerHTML = `<div class="card"><div class="k">Coming up</div><div class="v">${esc(c.upcoming)}</div><div class="s">scheduled</div></div>
        <div class="card ${c.late_to_hold ? 'red' : 'green'}"><div class="k">Not recorded as held</div><div class="v">${esc(c.late_to_hold)}</div><div class="s">date has passed</div></div>
        <div class="card ${c.minutes_missing ? 'red' : 'green'}"><div class="k">Minutes missing</div><div class="v">${esc(c.minutes_missing)}</div><div class="s">held, no minutes yet</div></div>`;
      $('newBtn').hidden = !(r.can.schedule && MS.can('MEETING_MANAGE'));
      MS.setMsg('msg', r.total + ' meeting' + (r.total === 1 ? '' : 's'));
      $('mtgBody').innerHTML = rows.length ? rows.map((m) => `<tr><td><b>${esc(m.title)}</b><div class="sub">${esc(MS.label(m.meeting_type))}${m.department_name ? ' · ' + esc(m.department_name) : ''}</div></td><td>${esc(MS.when(m.scheduled_at))}</td><td>${esc(m.chair_name)}</td>
        <td>${MS.pill(m.status)}${m.status === 'SCHEDULED' && m.scheduled_at.slice(0, 10) < MS.todayISO() ? '<div class="sub late">not recorded as held</div>' : ''}</td><td>${esc(m.present_count)} / ${esc(m.attendee_count)}</td><td>${m.minutes_status ? MS.pill(m.minutes_status) : (m.status === 'HELD' ? '<span class="late">missing</span>' : '')}</td>
        <td>${esc(m.actions_open || '')}</td><td class="acts"><button type="button" data-open="${esc(m.meeting_id)}">Open</button></td></tr>`).join('') : '<tr><td colspan="8" class="empty">No meetings here.</td></tr>';
      sc.pager('pager', r, state, load);
    } catch (err) { MS.setMsg('msg', err.message, 'error'); }
  }

  async function scheduleForm(m) {
    try { ref = ref || await MS.call('MEETING_REF_GET'); } catch (err) { MS.setMsg('msg', err.message, 'error'); return; }
    const isNew = !m;
    m = m || { meeting_type: ref.types[0], scheduled_at: '' };
    sc.ask({ title: isNew ? 'Schedule a meeting' : 'Change ' + m.title, wide: true, noText: true, button: 'Save',
      extra: `<div class="two"><label class="req">Kind <select id="mType">${MS.options(ref.types.map((t) => ({ value: t, label: MS.label(t) })), m.meeting_type)}</select></label><label class="req">Title <input id="mTitle" maxlength="200" value="${esc(m.title || '')}"></label></div>
        <div class="two"><label class="req">When <input id="mWhen" type="datetime-local" value="${esc(m.scheduled_at ? MS.toLocalInput(m.scheduled_at) : '')}"></label><label>Chair <select id="mChair">${mg.personOptions(ref.rows, m.chaired_by || (MS.user && MS.user.employee_id) || '')}</select></label></div>
        <label>Department (blank for the whole company) <select id="mDep">${mg.deptOptions(ref.departments, m.department_id, '— whole company —')}</select></label>
        ${isNew ? `<label>Agenda (one item per line) <textarea id="mAgenda" rows="3" maxlength="2000"></textarea></label><label>Invite</label>${mg.peopleChecks('mWho', ref.rows, [])}` : ''}`,
      run: async () => {
        if (!dc.val('mWhen')) throw new Error('Enter when the meeting takes place.');
        const body = { meeting_type: dc.val('mType'), title: dc.val('mTitle'), scheduled_at: dc.iso('mWhen'), chaired_by: dc.val('mChair'), department_id: dc.val('mDep') };
        if (isNew) { body.agenda = dc.val('mAgenda').split('\n').map((t) => t.trim()).filter(Boolean).map((topic) => ({ topic })); body.attendee_ids = mg.checked('mWho'); } else body.meeting_id = m.meeting_id;
        await MS.call('MEETING_SAVE', body);
        await load();
      } });
  }

  async function open(id) {
    await sc.view(() => MS.call('MEETING_GET', { meeting_id: id }), (m) => {
      const c = m.can, mgr = MS.can('MEETING_MANAGE');
      const btn = (ok, label, cls, fn) => (ok ? [label, label, cls, fn] : null);
      return {
        html: `<h3>${esc(m.title)}</h3>${MS.kv([['Kind', MS.label(m.meeting_type)], ['When', MS.when(m.scheduled_at)], ['Chair', m.chair_name], ['Department', m.department_name], ['Status', MS.pill(m.status), true], ['Held at', MS.when(m.held_at)], ['KPI review', m.kpi_review_period ? mg.monthLabel(m.kpi_review_period) : '']])}
          <h3 class="sub-h">Agenda</h3>${mg.list(m.agenda.map((a) => `<span>${esc(a.item_no)}. ${esc(a.topic)}</span><span class="sub">${esc(a.presenter_name)}</span>`), 'No agenda yet.')}
          <h3 class="sub-h">Attendance</h3>${mg.list(m.attendees.map((a) => `<span>${esc(a.name)} <span class="sub">${esc(a.position_title)}</span></span>${MS.pill(a.attendance)}`))}
          <h3 class="sub-h">Minutes</h3>${m.minutes ? `<p>${MS.pill(m.minutes.status)} <span class="sub">written by ${esc(m.minutes.recorded_by_name)}${m.minutes.approved_by_name ? ', approved by ' + esc(m.minutes.approved_by_name) : ''}</span></p><div class="mg-pre">${esc(m.minutes.summary)}</div>${m.minutes.decisions ? `<h3 class="sub-h">Decisions</h3><div class="mg-pre">${esc(m.minutes.decisions)}</div>` : ''}` : '<p class="muted">No minutes yet.</p>'}
          <h3 class="sub-h">Actions</h3>${mg.list(m.actions.map((a) => `<span>${esc(a.action_description)} <span class="sub">${esc(a.assignee_names)} · by ${esc(MS.shortDate(a.deadline))}</span></span>${MS.pill(a.status)}`), 'No actions.')}`,
        buttons: [btn(c.hold && mgr, 'Record as held', 'primary', () => act(m, 'HELD', 'Record as held', false)),
          btn(c.edit && mgr, 'Change', '', () => { sc.closeView(); scheduleForm(m); }),
          btn(c.edit && mgr, 'Add agenda item', '', () => { sc.closeView(); agendaForm(m); }),
          btn(c.postpone && mgr, 'Postpone', '', () => { sc.closeView(); postpone(m); }),
          btn(c.cancel && mgr, 'Cancel meeting', '', () => act(m, 'CANCELLED', 'Cancel the meeting', true)),
          btn(c.attendance && mgr, 'Mark attendance', '', () => { sc.closeView(); attendance(m); }),
          btn(c.minutes && mgr, 'Write minutes', 'primary', () => { sc.closeView(); minutes(m); }),
          btn(c.approve_minutes, 'Approve minutes', 'primary', () => approve(m)),
          btn(c.action && mgr, 'Add action', 'primary', () => { sc.closeView(); actionForm(m); })]
          .map((b) => b && [b[0].replace(/\W/g, ''), b[1], b[2], b[3]])
      };
    });
  }

  function act(m, status, title, needReason) {
    sc.closeView();
    sc.ask({ title: title + ' · ' + m.title, label: 'Reason', noText: !needReason, required: needReason, danger: status === 'CANCELLED', button: title,
      run: async (t) => { await MS.call('MEETING_STATUS_SET', dc.clean({ meeting_id: m.meeting_id, status, reason: t })); await load(); open(m.meeting_id); } });
  }
  function postpone(m) {
    sc.ask({ title: 'Postpone · ' + m.title, label: 'Reason', required: true, button: 'Postpone', extra: '<label class="req">New date and time <input id="pWhen" type="datetime-local"></label>',
      run: async (t) => { if (!dc.val('pWhen')) throw new Error('Enter the new date and time.'); await MS.call('MEETING_STATUS_SET', { meeting_id: m.meeting_id, status: 'POSTPONED', reason: t, scheduled_at: dc.iso('pWhen') }); await load(); } });
  }
  function agendaForm(m) {
    sc.ask({ title: 'Agenda item · ' + m.title, label: 'Topic', required: true, button: 'Add', run: async (t) => { await MS.call('MEETING_AGENDA_ADD', { meeting_id: m.meeting_id, topic: t }); await load(); open(m.meeting_id); } });
  }
  function attendance(m) {
    sc.ask({ title: 'Attendance · ' + m.title, noText: true, wide: true, button: 'Save',
      extra: `<div class="tablewrap"><table class="inv"><tbody>${m.attendees.map((a) => `<tr><td>${esc(a.name)}</td><td><select data-emp="${esc(a.employee_id)}">${MS.options(['PRESENT', 'ABSENT', 'EXCUSED', 'INVITED'].map((x) => ({ value: x, label: MS.label(x) })), a.attendance)}</select></td></tr>`).join('')}</tbody></table></div>`,
      run: async () => { await MS.call('MEETING_ATTENDEES_SET', { meeting_id: m.meeting_id, attendance: Array.from(MS.$('noteExtra').querySelectorAll('select')).map((s) => ({ employee_id: s.dataset.emp, attendance: s.value })) }); await load(); open(m.meeting_id); } });
  }
  function minutes(m) {
    const mn = m.minutes || {};
    sc.ask({ title: 'Minutes · ' + m.title, wide: true, label: 'Summary of the meeting', required: true, button: 'Save minutes', info: 'The person in the chair approves the minutes afterwards.',
      extra: `<label>Decisions <textarea id="mDec" rows="3" maxlength="20000">${esc(mn.decisions || '')}</textarea></label>`,
      run: async (t) => { await MS.call('MEETING_MINUTES_SAVE', dc.clean({ meeting_id: m.meeting_id, summary: t, decisions: dc.val('mDec') })); await load(); open(m.meeting_id); } });
    MS.$('noteText').value = mn.summary || '';
  }
  async function approve(m) {
    try { await MS.call('MEETING_MINUTES_APPROVE', { meeting_id: m.meeting_id }); await load(); open(m.meeting_id); } catch (err) { sc.viewError(err.message); }
  }
  function actionForm(m) {
    sc.ask({ title: 'Action · ' + m.title, wide: true, label: 'What must be done', required: true, button: 'Add action',
      extra: `<label class="req">By <input id="aBy" type="date" min="${MS.todayISO()}"></label><label class="req">Responsible</label>${mg.peopleChecks('aWho', m.attendees, [])}`,
      run: async (t) => { await MS.call('MEETING_ACTION_SAVE', { meeting_id: m.meeting_id, action_description: t, deadline: dc.val('aBy'), employee_ids: mg.checked('aWho') }); await load(); open(m.meeting_id); } });
  }

  MS.boot({ page: 'meetings', any: ['MEETING_MANAGE', 'KPI_VIEW'] }).then(() => {
    sc.tabs('tabs', state, load);
    $('subTabs').addEventListener('click', (e) => { const b = e.target.closest('button[data-sub]'); if (!b) return; state.sub = b.dataset.sub; $('subTabs').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); state.page = 1; load(); });
    $('newBtn').onclick = () => scheduleForm(null);
    $('briefLink').hidden = !MS.can('MEETING_MANAGE');
    $('mtgBody').addEventListener('click', (e) => { const b = e.target.closest('[data-open]'); if (b) open(b.dataset.open); });
    $('actBody').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const id = b.dataset.prog || b.dataset.done || b.dataset.cx;
      if (b.dataset.cx) sc.ask({ title: 'Cancel this action', label: 'Why', required: true, danger: true, button: 'Cancel action', run: async (t) => { await MS.call('MEETING_ACTION_UPDATE', { meeting_action_id: id, status: 'CANCELLED', reason: t }); await load(); } });
      else MS.call('MEETING_ACTION_UPDATE', { meeting_action_id: id, status: b.dataset.done ? 'DONE' : 'IN_PROGRESS' }).then(load).catch((err) => MS.setMsg('msg', err.message, 'error'));
    });
    if (MS.param('id')) open(MS.param('id'));
    if (MS.param('tab') === 'actions') { sc.setTab('tabs', 'actions', state); }
    load();
  });
})();
