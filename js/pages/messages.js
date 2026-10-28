(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const mg = MS.mg, sc = MS.sc, dc = MS.dc;
  const state = { mode: 'msg', tab: 'req-incoming', page: 1, search: '', open: '' };
  let rows = [], people = null, thread = null, listSig = '', threadSig = '', typed = 0, readBusy = false;
  const PRIS = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
  const when = (v) => (v ? new Date(v).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
  const visible = () => document.visibilityState !== 'hidden';
  MS.liveSafe = true;

  MS.reload = () => (state.mode === 'msg' ? Promise.all([loadList(), state.open ? loadThread(false) : null]) : loadRequests());

  function setMode(mode) {
    state.mode = mode;
    $('mx').hidden = mode !== 'msg';
    $('reqWrap').hidden = mode !== 'req';
    $('newReq').hidden = mode !== 'req';
    document.querySelectorAll('#mxSwitch button').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
    MS.setMsg('msg', '');
    MS.reload();
  }

  async function loadList() {
    try {
      const r = await MS.recall('MESSAGE_THREAD_LIST', { search: state.search, page_size: 50 });
      rows = r.rows;
      $('newMsg').hidden = !r.can.send;
      MS.store.update({ unread_messages: r.unread || 0 });
      MS.setMessageDot(r.unread || 0);
      const sig = JSON.stringify([rows, state.open]);
      if (sig === listSig) return;
      listSig = sig;
      $('mxRows').innerHTML = rows.length ? rows.map((c) => `<li data-id="${esc(c.thread_id)}" class="${c.unread ? 'unread' : ''}${c.thread_id === state.open ? ' current' : ''}">
        <div><div class="nm"><b>${esc(c.with.name)}</b>${c.unread ? '<span class="mx-dot" title="Unread"></span>' : ''}</div><div class="sbj">${esc(c.subject || '(no subject)')}</div><div class="pv">${c.last_mine ? 'You: ' : ''}${esc(c.preview)}</div></div>
        <span class="at">${esc(when(c.at))}</span></li>`).join('') : `<li class="mx-empty">${state.search ? 'No conversation matches.' : 'No messages yet.'}</li>`;
    } catch (err) { MS.setMsg('msg', err.message, 'error'); }
  }

  function shell(t) {
    $('mxThread').innerHTML = `<div class="mx-head"><div><h2 id="mxTitle"></h2><div class="sub" id="mxWith"></div></div>
        <div class="btns"><button type="button" class="mx-back" id="mxBack">${MS.icon('back')} Back</button><button type="button" id="mxDel">${MS.icon('x')} Delete</button></div></div>
      <div class="mx-bubbles" id="mxBubbles"></div>
      <form class="mx-reply" id="mxReply"><textarea id="mxBody" rows="2" maxlength="10000" placeholder="Write a reply" aria-label="Write a reply"></textarea><button type="submit" class="primary" id="mxGo" disabled>${MS.icon('send')} Send</button></form>`;
    $('mxBack').onclick = () => openThread('');
    $('mxDel').onclick = removeThread;
    const box = $('mxBody'), go = $('mxGo');
    const fit = () => { go.disabled = !box.value.trim(); };
    box.addEventListener('input', () => { fit(); typed = Date.now(); });
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $('mxReply').requestSubmit(); } });
    $('mxReply').onsubmit = sendReply;
  }

  function paint(t, stick) {
    $('mxTitle').textContent = t.subject || '(no subject)';
    $('mxWith').textContent = 'With ' + t.with.name + (t.with.role ? ' · ' + t.with.role : '');
    $('mxReply').hidden = !t.can_reply;
    const box = $('mxBubbles');
    const near = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    const sig = JSON.stringify(t.messages.map((m) => [m.message_id, m.read_at]));
    if (sig === threadSig) return;
    const first = threadSig === '';
    threadSig = sig;
    box.innerHTML = t.messages.map((m) => `<div class="mx-b ${m.mine ? 'mine' : 'theirs'}"><div class="tx">${esc(m.body)}</div><div class="meta">${m.mine ? 'You' : esc(m.from)} · ${esc(when(m.sent_at))}${m.mine && m.read_at ? ' · read' : ''}</div></div>`).join('');
    if (first || stick || near || t.messages[t.messages.length - 1].mine) box.scrollTop = box.scrollHeight;
  }

  async function loadThread(first) {
    if (!state.open) return;
    const id = state.open;
    try {
      const t = await MS.call('MESSAGE_THREAD_GET', { thread_id: id });
      if (id !== state.open) return;
      thread = t;
      if (first || !$('mxBubbles')) { shell(t); threadSig = ''; }
      paint(t, first);
      markRead();
    } catch (err) {
      if (id !== state.open) return;
      if (err.code === 'NOT_FOUND') { openThread(''); return; }
      MS.setMsg('msg', err.message, 'error');
    }
  }

  async function markRead() {
    if (readBusy || !thread || !visible() || !thread.messages.some((m) => m.unread)) return;
    readBusy = true;
    const id = state.open;
    try {
      await MS.call('MESSAGE_THREAD_READ', { thread_id: id });
      thread.messages.forEach((m) => { m.unread = false; });
      listSig = '';
      await loadList();
    } catch (err) {  } finally { readBusy = false; }
  }

  function openThread(id) {
    state.open = id;
    thread = null; threadSig = ''; listSig = '';
    $('mx').classList.toggle('has-open', !!id);
    try { const u = new URL(location.href); if (id) u.searchParams.set('thread', id); else u.searchParams.delete('thread'); history.replaceState(null, '', u.toString()); } catch (e) {  }
    if (!id) $('mxThread').innerHTML = '<div class="mx-empty">Choose a conversation, or start a new one.</div>';
    else $('mxThread').innerHTML = '<div class="mx-empty">Loading…</div>';
    loadList();
    if (id) loadThread(true);
  }

  async function sendReply(e) {
    e.preventDefault();
    const box = $('mxBody'), text = box.value.trim();
    if (!text || !state.open) return;
    $('mxGo').disabled = true;
    try {
      await MS.call('MESSAGE_SEND', { thread_id: state.open, body: text });
      box.value = '';
      await Promise.all([loadThread(false), loadList()]);
      $('mxBubbles').scrollTop = $('mxBubbles').scrollHeight;
    } catch (err) { MS.toast(err.message, 'error'); $('mxGo').disabled = !box.value.trim(); }
    box.focus();
  }

  async function removeThread() {
    const ok = await MS.confirm('Delete this conversation?', 'It is removed from your messages only. The other person keeps their copy.', { danger: true, confirmText: 'Delete' });
    if (!ok) return;
    try { await MS.call('MESSAGE_THREAD_HIDE', { thread_id: state.open }); openThread(''); } catch (err) { MS.toast(err.message, 'error'); }
  }

  async function loadPeople() { if (!people) people = await MS.call('MESSAGE_PEOPLE_LIST'); return people; }
  const personOpts = (sel, blank) => MS.options(people.rows.map((p) => ({ value: p.user_id, label: p.name + (p.department_name ? ' · ' + p.department_name : '') })), sel, blank);

  const chosen = new Map();
  function drawPick() {
    const q = $('mxWho').value.trim().toLowerCase();
    const list = people.rows.filter((p) => !q || (p.name + ' ' + (p.position_title || '') + ' ' + (p.department_name || '')).toLowerCase().indexOf(q) >= 0);
    $('mxPick').innerHTML = list.length ? list.map((p) => `<label><input type="checkbox" value="${esc(p.user_id)}"${chosen.has(p.user_id) ? ' checked' : ''}><span>${esc(p.name)} <span class="rl">· ${esc(p.position_title || p.department_name || '')}</span></span></label>`).join('') : '<div class="mx-empty">Nobody found.</div>';
    $('mxChips').innerHTML = Array.from(chosen.values()).map((p) => `<button type="button" data-rm="${esc(p.user_id)}" aria-label="Remove ${esc(p.name)}">${esc(p.name)} ×</button>`).join('');
  }

  async function compose(toId, subject) {
    try { await loadPeople(); } catch (err) { MS.setMsg('msg', err.message, 'error'); return; }
    chosen.clear();
    if (toId) { const p = people.rows.find((x) => x.user_id === toId); if (p) chosen.set(toId, p); }
    $('mxForm').reset(); $('mxErr').textContent = ''; $('mxSub').value = subject || '';
    drawPick();
    MS.openDialog('mxNew');
  }

  function wireCompose() {
    $('mxWho').addEventListener('input', drawPick);
    $('mxPick').addEventListener('change', (e) => {
      const i = e.target.closest('input[type=checkbox]'); if (!i) return;
      if (i.checked) chosen.set(i.value, people.rows.find((p) => p.user_id === i.value)); else chosen.delete(i.value);
      drawPick();
    });
    $('mxChips').addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (b) { chosen.delete(b.dataset.rm); drawPick(); } });
    $('mxCancel').onclick = () => $('mxNew').close();
    $('mxForm').onsubmit = async (e) => {
      e.preventDefault();
      const to = Array.from(chosen.keys()), subject = $('mxSub').value.trim(), body = $('mxText').value.trim();
      if (!to.length) { $('mxErr').textContent = 'Choose who it goes to.'; return; }
      if (!subject) { $('mxErr').textContent = 'Write a subject.'; return; }
      if (!body) { $('mxErr').textContent = 'Write the message.'; return; }
      MS.busy($('mxSend'), true, 'Sending…');
      try {
        const r = await MS.call('MESSAGE_SEND', { to, subject, body });
        $('mxNew').close();
        MS.toast(r.sent > 1 ? 'Sent to ' + r.sent + ' people, each privately.' : 'Message sent.');
        openThread(r.thread_ids[0]);
      } catch (err) { $('mxErr').textContent = err.message; } finally { MS.busy($('mxSend'), false); }
    };
  }

  async function loadRequests() {
    MS.setMsg('msg', 'Loading…');
    try {
      const r = await MS.recall('REQUEST_LIST', { tab: state.tab.slice(4), page: state.page, page_size: 50 });
      rows = r.rows;
      $('newReq').hidden = !r.can.send;
      MS.setMsg('msg', r.total + ' request' + (r.total === 1 ? '' : 's') + (r.counts.overdue ? ' · ' + r.counts.overdue + ' overdue' : ''));
      $('reqBody').innerHTML = rows.length ? rows.map((q) => `<tr><td><b>${esc(q.subject)}</b><div class="sub">${esc(String(q.description).slice(0, 90))}</div></td><td>${esc(q.requester_name)}<div class="sub">${esc(q.from_department)}</div></td><td>${esc(q.recipient_name || q.department_name)}</td>
        <td>${q.priority === 'URGENT' ? '<span class="pill failed">Urgent</span>' : esc(MS.label(q.priority))}</td><td class="${q.overdue ? 'late' : ''}">${esc(MS.shortDate(q.due_date))}</td><td>${MS.pill(q.status)}</td><td class="acts"><button type="button" data-ropen="${esc(q.internal_request_id)}">Open</button></td></tr>`).join('')
        : '<tr><td colspan="7" class="empty">No requests.</td></tr>';
      sc.pager('pager', r, state, loadRequests);
    } catch (err) { MS.setMsg('msg', err.message, 'error'); }
  }
  const load = () => MS.reload();

  async function newRequest() {
    try { await loadPeople(); } catch (err) { MS.setMsg('msg', err.message, 'error'); return; }
    sc.ask({ title: 'New request', wide: true, label: 'What you need', required: true, button: 'Send request',
      info: 'Goes to a department (everyone in it can answer) or to one person in it.',
      extra: `<label class="req">Department <select id="qDep">${mg.deptOptions(people.departments, '', '— choose —')}</select></label><label>A particular person (optional) <select id="qTo">${personOpts('', '— anyone in the department —')}</select></label>
        <label class="req">Subject <input id="qSub" maxlength="200"></label><div class="two"><label>Priority <select id="qPri">${MS.options(PRIS.map((p) => ({ value: p, label: MS.label(p) })), 'NORMAL')}</select></label><label>Needed by <input id="qDue" type="date" min="${MS.todayISO()}"></label></div>`,
      run: async (t) => { await MS.call('REQUEST_SAVE', dc.clean({ department_id: dc.val('qDep'), recipient_id: dc.val('qTo'), subject: dc.val('qSub'), description: t, priority: dc.val('qPri'), due_date: dc.val('qDue') })); await load(); } });
  }

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
    wireCompose();
    sc.tabs('tabs', state, loadRequests);
    document.querySelectorAll('#mxSwitch button').forEach((b) => { b.onclick = () => setMode(b.dataset.mode); });
    $('newMsg').onclick = () => compose('', '');
    $('newReq').onclick = newRequest;
    let t = 0;
    $('mxSearch').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { state.search = $('mxSearch').value.trim(); listSig = ''; loadList(); }, 250); });
    $('mxRows').addEventListener('click', (e) => { const li = e.target.closest('li[data-id]'); if (li) openThread(li.dataset.id); });
    $('reqBody').addEventListener('click', (e) => { const b = e.target.closest('[data-ropen]'); if (b) openReq(rows.find((x) => x.internal_request_id === b.dataset.ropen)); });
    document.addEventListener('visibilitychange', markRead);
    window.addEventListener('focus', markRead);
    if (MS.param('tab') && /^req-/.test(MS.param('tab'))) { state.tab = MS.param('tab'); sc.setTab('tabs', state.tab, state); setMode('req'); } else setMode('msg');
    const want = MS.param('thread') || MS.param('with');
    if (MS.param('with')) compose(MS.param('with'), ''); else if (want) openThread(want); else openThread('');
  });
})();
