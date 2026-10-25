/* Messages between two people, and internal requests from one department to another (with a due date and an answer). */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const mg = MS.mg, sc = MS.sc, dc = MS.dc;
  const state = { tab: 'inbox', page: 1 };
  let rows = [], people = null;
  const PRIS = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
  const isReq = () => state.tab.indexOf('req-') === 0;

  MS.reload = () => load();
  async function load() {
    MS.setMsg('msg', 'Loading…');
    $('msgWrap').hidden = isReq(); $('reqWrap').hidden = !isReq();
    try {
      if (!isReq()) {
        const r = await MS.recall('MESSAGE_LIST', { box: state.tab, page: state.page, page_size: 50 });
        rows = r.rows;
        $('newMsg').hidden = !r.can.send;
        if (state.tab === 'inbox') { MS.store.update({ unread_messages: r.unread || 0 }); MS.setMessageDot(r.unread || 0); }
        MS.setMsg('msg', r.total + ' message' + (r.total === 1 ? '' : 's') + (r.unread ? ' · ' + r.unread + ' unread' : ''));
        $('msgBody').innerHTML = rows.length ? rows.map((m) => `<tr class="${m.unread ? 'mg-unread' : ''}"><td>${m.unread ? '<b>' : ''}${esc(state.tab === 'sent' ? m.recipient_name : m.sender_name)}${m.unread ? '</b>' : ''}</td><td>${m.unread ? '<b>' : ''}${esc(m.subject || '(no subject)')}${m.unread ? '</b>' : ''}<div class="sub">${esc(String(m.body).slice(0, 90))}</div></td><td>${esc(MS.when(m.created_at))}</td>
          <td class="acts"><button type="button" data-open="${esc(m.message_id)}">Open</button></td></tr>`).join('') : '<tr><td colspan="4" class="empty">No messages.</td></tr>';
        sc.pager('pager', r, state, load);
        return;
      }
      const r = await MS.recall('REQUEST_LIST', { tab: state.tab.slice(4), page: state.page, page_size: 50 });
      rows = r.rows;
      $('newReq').hidden = !r.can.send;
      MS.setMsg('msg', r.total + ' request' + (r.total === 1 ? '' : 's') + (r.counts.overdue ? ' · ' + r.counts.overdue + ' overdue' : ''));
      $('reqBody').innerHTML = rows.length ? rows.map((q) => `<tr><td><b>${esc(q.subject)}</b><div class="sub">${esc(String(q.description).slice(0, 90))}</div></td><td>${esc(q.requester_name)}<div class="sub">${esc(q.from_department)}</div></td><td>${esc(q.recipient_name || q.department_name)}</td>
        <td>${q.priority === 'URGENT' ? '<span class="pill failed">Urgent</span>' : esc(MS.label(q.priority))}</td><td class="${q.overdue ? 'late' : ''}">${esc(MS.shortDate(q.due_date))}</td><td>${MS.pill(q.status)}</td><td class="acts"><button type="button" data-ropen="${esc(q.internal_request_id)}">Open</button></td></tr>`).join('')
        : '<tr><td colspan="7" class="empty">No requests.</td></tr>';
      sc.pager('pager', r, state, load);
    } catch (err) { MS.setMsg('msg', err.message, 'error'); }
  }

  async function loadPeople() { if (!people) people = await MS.call('MESSAGE_PEOPLE_LIST'); return people; }
  const personOpts = (sel, blank) => MS.options(people.rows.map((p) => ({ value: p.user_id, label: p.name + (p.department_name ? ' · ' + p.department_name : '') })), sel, blank);

  async function compose(to, subject) {
    try { await loadPeople(); } catch (err) { MS.setMsg('msg', err.message, 'error'); return; }
    sc.ask({ title: 'New message', wide: true, label: 'Message', required: true, button: 'Send',
      extra: `<label class="req">To <select id="mTo">${personOpts(to, '— choose —')}</select></label><label>Subject <input id="mSub" maxlength="200" value="${esc(subject || '')}"></label>`,
      run: async (t) => { await MS.call('MESSAGE_SEND', dc.clean({ recipient_id: dc.val('mTo'), subject: dc.val('mSub'), body: t })); state.tab = 'sent'; sc.setTab('tabs', 'sent', state); await load(); } });
  }

  async function openMsg(id) {
    await sc.view(() => MS.call('MESSAGE_GET', { message_id: id }), (m) => ({
      html: `<h3>${esc(m.subject || '(no subject)')}</h3>${MS.kv([['From', m.sender_name], ['To', m.recipient_name], ['Sent', MS.when(m.created_at)]])}<div class="mg-pre">${esc(m.body)}</div>`,
      buttons: [m.related_table === 'role_requests' && MS.can('USER_ROLE_ASSIGN') ? ['mRoles', 'Open role requests', 'primary', () => { location.href = 'admin/users.html?tab=requests'; }] : null,
        !m.is_mine_sent ? ['mReply', 'Reply', 'primary', () => { sc.closeView(); compose(m.sender_id, /^Re:/.test(m.subject) ? m.subject : 'Re: ' + m.subject); }] : null,
        !m.is_mine_sent && m.status !== 'ARCHIVED' ? ['mArch', 'Archive', '', async () => { try { await MS.call('MESSAGE_ARCHIVE', { message_id: m.message_id }); sc.closeView(); await load(); } catch (err) { sc.viewError(err.message); } }] : null]
    }));
    load();
  }

  async function newRequest() {
    try { await loadPeople(); } catch (err) { MS.setMsg('msg', err.message, 'error'); return; }
    sc.ask({ title: 'New request', wide: true, label: 'What you need', required: true, button: 'Send request',
      info: 'Goes to a department (everyone in it can answer) or to one person in it.',
      extra: `<label class="req">Department <select id="qDep">${mg.deptOptions(people.departments, '', '— choose —')}</select></label><label>A particular person (optional) <select id="qTo">${personOpts('', '— anyone in the department —')}</select></label>
        <label class="req">Subject <input id="qSub" maxlength="200"></label><div class="two"><label>Priority <select id="qPri">${MS.options(PRIS.map((p) => ({ value: p, label: MS.label(p) })), 'NORMAL')}</select></label><label>Needed by <input id="qDue" type="date" min="${MS.todayISO()}"></label></div>`,
      run: async (t) => { await MS.call('REQUEST_SAVE', dc.clean({ department_id: dc.val('qDep'), recipient_id: dc.val('qTo'), subject: dc.val('qSub'), description: t, priority: dc.val('qPri'), due_date: dc.val('qDue') })); await load(); } });
  }

  /** The CEO / Admin ask the System Administrator to give a person a role. Nothing here changes any account. */
  async function requestRole() {
    let o;
    try { o = await MS.call('ROLE_REQUEST_OPTIONS'); } catch (err) { MS.setMsg('msg', err.message, 'error'); return; }
    sc.ask({ title: 'Request a role', wide: true, label: 'Note for the System Administrator (optional)', required: false, button: 'Send request',
      info: 'Only the System Administrator gives roles. Tell them who the person is and which role they now have; they get a message and a notification, and you are told when it is done.',
      extra: `<label class="req">Person's full name <input id="rrName" maxlength="80" autocomplete="off"></label><label class="req">Email the person signs in with <input id="rrEmail" type="email" maxlength="120" autocomplete="off"></label>
        <label class="req">Role <select id="rrRole">${MS.options(o.roles.map((r) => ({ value: r.role_code, label: r.role_name })), '', '— choose —')}</select></label>`,
      run: async (t) => {
        if (!dc.val('rrName') || !dc.val('rrEmail') || !dc.val('rrRole')) throw new Error('Fill in the name, the email and the role.');
        await MS.call('ROLE_REQUEST_CREATE', dc.clean({ person_name: dc.val('rrName'), person_email: dc.val('rrEmail'), role_code: dc.val('rrRole'), note: t }));
        await load();
        MS.setMsg('msg', 'Request sent to the System Administrator.', 'ok');
      } });
  }

  function openReq(q) {
    const c = q.can;
    const step = (key, label, status, needText, cls) => (c[key] ? [key, label, cls || '', () => {
      sc.closeView();
      sc.ask({ title: label + ' · ' + q.subject, noText: !needText, required: needText, label: 'Your answer', button: label, danger: status === 'REJECTED',
        run: async (t) => { await MS.call('REQUEST_UPDATE', dc.clean({ internal_request_id: q.internal_request_id, status, response: t })); await load(); } });
    }] : null);
    sc.view(async () => q, (x) => ({
      html: `<h3>${esc(x.subject)}</h3>${MS.kv([['From', x.requester_name + (x.from_department ? ' (' + x.from_department + ')' : '')], ['To', x.recipient_name || x.department_name], ['Priority', MS.label(x.priority)], ['Needed by', MS.shortDate(x.due_date)], ['Status', MS.pill(x.status), true], ['Answered', MS.when(x.resolved_date)]])}
        <div class="mg-pre">${esc(x.description)}</div>${x.response ? `<h3 class="sub-h">Answer</h3><div class="mg-pre">${esc(x.response)}</div>` : ''}`,
      buttons: [step('acknowledge', 'Acknowledge', 'ACKNOWLEDGED', false), step('progress', 'Start work', 'IN_PROGRESS', false), step('resolve', 'Resolve', 'RESOLVED', true, 'primary'), step('reject', 'Reject', 'REJECTED', true), step('close', 'Close', 'CLOSED', false)]
    }));
  }

  MS.boot({ page: 'messages', any: ['MESSAGE_USE'] }).then(() => {
    if (MS.can('ROLE_REQUEST')) { $('roleReq').hidden = false; $('roleReq').onclick = requestRole; if (MS.param('role')) requestRole(); }
    sc.tabs('tabs', state, load);
    $('newMsg').onclick = () => compose('', '');
    $('newReq').onclick = newRequest;
    $('msgBody').addEventListener('click', (e) => { const b = e.target.closest('[data-open]'); if (b) openMsg(b.dataset.open); });
    $('reqBody').addEventListener('click', (e) => { const b = e.target.closest('[data-ropen]'); if (b) openReq(rows.find((x) => x.internal_request_id === b.dataset.ropen)); });
    if (MS.param('tab')) { state.tab = MS.param('tab'); sc.setTab('tabs', state.tab, state); }
    load();
  });
})();
