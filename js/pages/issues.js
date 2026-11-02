(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const mg = MS.mg, sc = MS.sc, dc = MS.dc;
  const state = { tab: 'open', page: 1, priority: '', category: '' };
  let rows = [], list = null;
  const CATS = ['OPERATIONAL', 'FINANCIAL', 'STAFF', 'CUSTOMER', 'SAFETY', 'IT'], PRIS = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'];
  const pri = (p) => (p === 'CRITICAL' ? '<span class="pill failed">Critical</span>' : p === 'HIGH' ? '<span class="pill pending">High</span>' : esc(MS.label(p)));

  MS.reload = () => load();
  async function load() {
    MS.setMsg('msg', 'Loading…');
    try {
      const r = (list = await MS.recall('ISSUE_LIST', { tab: state.tab, page: state.page, page_size: 50, q: state.q || undefined, priority: state.priority || undefined, category: state.category || undefined }));
      rows = r.rows;
      const c = r.counts;
      $('cards').innerHTML = `<div class="card"><div class="k">Open</div><div class="v">${esc(c.open)}</div><div class="s">not resolved yet</div></div>
        <div class="card ${c.overdue ? 'red' : 'green'}"><div class="k">Past the agreed date</div><div class="v">${esc(c.overdue)}</div><div class="s">chased every day</div></div>
        <div class="card ${c.critical ? 'red' : ''}"><div class="k">Critical</div><div class="v">${esc(c.critical)}</div><div class="s">managers told at once</div></div>
        <div class="card"><div class="k">To check or review</div><div class="v">${esc(c.to_check)}</div><div class="s">resolved, not closed</div></div>`;
      $('newBtn').hidden = !(r.can.report && MS.can('ISSUE_REPORT'));
      MS.setMsg('msg', r.total + ' issue' + (r.total === 1 ? '' : 's'));
      $('issueBody').innerHTML = rows.length ? rows.map((i) => `<tr><td><b>${esc(i.issue_number)}</b></td><td>${esc(i.title)}<div class="sub">${esc(MS.label(i.category))} · ${esc(i.department_name)}</div></td><td>${pri(i.priority)}</td>
        <td>${MS.pill(i.status)}${i.escalated_to_md ? '<div class="sub late">escalated to CEO</div>' : ''}</td><td>${esc(i.assignee_names || '')}</td>
        <td class="${i.overdue ? 'late' : ''}">${esc(MS.shortDate(i.due_date))}</td><td class="acts"><button type="button" data-open="${esc(i.issue_id)}">Open</button></td></tr>`).join('')
        : '<tr><td colspan="7" class="empty">No issues here.</td></tr>';
      sc.pager('pager', r, state, load);
    } catch (err) { MS.setMsg('msg', err.message, 'error'); }
  }

  function reportForm() {
    sc.ask({ title: 'Report an issue', wide: true, label: 'What is wrong', required: true, button: 'Report issue',
      info: 'A critical issue is told to the managers at once. They will assign it and agree a date.',
      extra: `<label class="req">Short title <input id="iTitle" maxlength="200"></label>
        <div class="two"><label>Kind <select id="iCat">${MS.options(CATS.map((c) => ({ value: c, label: MS.label(c) })), 'OPERATIONAL')}</select></label><label>How urgent <select id="iPri">${MS.options(PRIS.map((c) => ({ value: c, label: MS.label(c) })), 'NORMAL')}</select></label></div>`,
      run: async (t) => { const i = await MS.call('ISSUE_REPORT', { title: dc.val('iTitle'), description: t, category: dc.val('iCat'), priority: dc.val('iPri') }); MS.setMsg('msg', 'Reported as ' + i.issue_number + '.', 'ok'); await load(); } });
  }

  async function open(id) {
    await sc.view(() => MS.call('ISSUE_GET', { issue_id: id }), (i) => {
      const c = i.can;
      const btn = (key, label, cls, perm, fn) => (c[key] && (!perm || MS.can(perm)) ? [key, label, cls, fn] : null);
      return {
        html: `<h3>${esc(i.issue_number)} · ${esc(i.title)}</h3>
          ${MS.kv([['Status', MS.pill(i.status), true], ['Kind', MS.label(i.category)], ['Urgency', pri(i.priority), true], ['Department', i.department_name], ['Reported by', i.identified_by_name], ['Assigned to', i.assignee_names],
            ['Agreed date', MS.shortDate(i.due_date)], ['Verified by', i.verified_by_name], ['KPI', i.kpi ? i.kpi.kpi_name + ' · ' + (i.kpi.rating || '') : '']])}
          <h3 class="sub-h">What is wrong</h3><div class="mg-pre">${esc(i.description)}</div>
          <h3 class="sub-h">Corrective actions</h3>${mg.list(i.actions.map((a) => `<span>${esc(a.action_description)} <span class="sub">${esc(a.responsible_name)}${a.due_date ? ' · by ' + esc(MS.shortDate(a.due_date)) : ''}</span> ${MS.pill(a.status)}</span>${a.can_finish && MS.can('ISSUE_REPORT') ? `<button type="button" data-fin="${esc(a.issue_action_id)}">Done</button>` : ''}`), 'No actions yet.')}
          <h3 class="sub-h">Discussion</h3>${mg.list(i.comments.map((m) => `<span><b>${esc(m.author_name)}</b> <span class="sub">${esc(MS.when(m.created_at))}</span><div class="mg-pre">${esc(m.body)}</div></span>`), 'No comments.')}
          ${i.waiting_for_other ? '<p class="hint">You resolved this issue, so another manager must verify it.</p>' : ''}`,
        buttons: [btn('assign', i.assignees.length ? 'Reassign' : 'Assign', 'primary', 'ISSUE_MANAGE', () => { sc.closeView(); assign(i); }),
          btn('start', 'Start work', '', 'ISSUE_REPORT', () => act('ISSUE_START', i, 'Start work', null)),
          btn('action', 'Add action', '', 'ISSUE_REPORT', () => { sc.closeView(); addAction(i); }),
          btn('resolve', 'Resolve', 'primary', 'ISSUE_REPORT', () => { sc.closeView(); resolve(i); }),
          btn('verify', 'Verify', 'primary', 'ISSUE_MANAGE', () => act('ISSUE_VERIFY', i, 'Verify the write-up', 'Note (optional)')),
          btn('close', 'Close after review', 'primary', 'ISSUE_MANAGE', () => act('ISSUE_CLOSE', i, 'Close after review', 'Review note (optional)')),
          btn('reopen', 'Send back', '', 'ISSUE_MANAGE', () => act('ISSUE_REOPEN', i, 'Send back', 'Why', true)),
          btn('escalate', 'Escalate to CEO', '', 'ISSUE_MANAGE', () => act('ISSUE_ESCALATE', i, 'Escalate to the CEO', 'Note (optional)')),
          btn('comment', 'Comment', '', 'ISSUE_REPORT', () => { sc.closeView(); comment(i); })],
        after: () => { $('viewBody').onclick = async (e) => {
          const b = e.target.closest('[data-fin]');
          if (!b) return;
          try { await MS.call('ISSUE_ACTION_DONE', { issue_action_id: b.dataset.fin }); await open(id); await load(); } catch (err) { sc.viewError(err.message); }
        }; }
      };
    });
  }

  function act(action, i, title, label, required) {
    sc.closeView();
    sc.ask({ title: title + ' · ' + i.issue_number, label: label || 'Note', noText: !label, required: !!required, button: title,
      run: async (t) => { await MS.call(action, dc.clean({ issue_id: i.issue_id, note: required ? undefined : t, reason: required ? t : undefined })); await load(); open(i.issue_id); } });
  }
  async function assign(i) {
    let people = [];
    try { people = (await MS.call('ISSUE_ASSIGNEE_LIST')).rows; } catch (err) { MS.setMsg('msg', err.message, 'error'); return; }
    sc.ask({ title: 'Assign ' + i.issue_number, wide: true, noText: true, button: 'Assign',
      info: 'Tick who will deal with it and agree a date. They are told at once.',
      extra: `${mg.peopleChecks('aWho', people, i.assignees.map((a) => a.employee_id))}<label class="req">Agreed date <input id="aDue" type="date" value="${esc(i.due_date || '')}" min="${MS.todayISO()}"></label>`,
      run: async () => { await MS.call('ISSUE_ASSIGN', dc.clean({ issue_id: i.issue_id, assignee_ids: mg.checked('aWho'), due_date: dc.val('aDue') })); await load(); open(i.issue_id); } });
  }
  async function addAction(i) {
    let people = [];
    try { people = (await MS.call('ISSUE_ASSIGNEE_LIST')).rows; } catch (err) {  people = i.assignees.map((a) => ({ employee_id: a.employee_id, name: a.name })); }
    sc.ask({ title: 'Corrective action · ' + i.issue_number, label: 'What must be done', required: true, button: 'Add action',
      extra: `<div class="two"><label class="req">Responsible <select id="xWho">${MS.options(people.map((p) => ({ value: p.employee_id, label: p.name })), '', '— choose —')}</select></label><label>By <input id="xDue" type="date"></label></div>`,
      run: async (t) => { await MS.call('ISSUE_ACTION_ADD', dc.clean({ issue_id: i.issue_id, action_description: t, responsible_id: dc.val('xWho'), due_date: dc.val('xDue') })); await load(); open(i.issue_id); } });
  }
  function resolve(i) {
    sc.ask({ title: 'Resolve ' + i.issue_number, wide: true, label: 'What was done to put it right', required: true, button: 'Mark resolved',
      info: 'All corrective actions must be done first. Another manager then checks this write-up.',
      run: async (t) => { await MS.call('ISSUE_RESOLVE', { issue_id: i.issue_id, resolution: t }); await load(); open(i.issue_id); } });
  }
  function comment(i) {
    sc.ask({ title: 'Comment · ' + i.issue_number, label: 'Comment', required: true, button: 'Add comment',
      run: async (t) => { await MS.call('ISSUE_COMMENT_ADD', { issue_id: i.issue_id, body: t }); open(i.issue_id); } });
  }

  MS.boot({ page: 'issues', any: ['ISSUE_REPORT'] }).then(() => {
    sc.tabs('tabs', state, load);
    $('newBtn').onclick = reportForm;
    $('priSel').onchange = () => { state.priority = $('priSel').value; state.page = 1; load(); };
    $('catSel').onchange = () => { state.category = $('catSel').value; state.page = 1; load(); };
    $('q').addEventListener('input', MS.debounce(() => { state.q = $('q').value.trim(); state.page = 1; load(); }));
    $('issueBody').addEventListener('click', (e) => { const b = e.target.closest('[data-open]'); if (b) open(b.dataset.open); });
    if (MS.param('id')) open(MS.param('id'));
    if (MS.param('new') && MS.can('ISSUE_REPORT')) reportForm();
    load();
  });
})();
