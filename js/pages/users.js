(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const id = MS.param('id');
  const state = { page: 1, q: '', status: '', tab: ['signups', 'requests'].indexOf(MS.param('tab')) >= 0 ? MS.param('tab') : 'all' };
  const how = (u) => (u.signup_source === 'GOOGLE' ? 'Google' : u.signup_source === 'SELF' ? 'Sign-up form' : 'Made by the administrator');
  const waiting = (u) => u.approval_status && u.approval_status !== 'APPROVED';
  const accountPill = (u) => (u.approval_status === 'PENDING' ? MS.pill('PENDING', 'Waiting for approval') : u.approval_status === 'REJECTED' ? MS.pill('REJECTED', 'Sign-up rejected') : MS.pill(u.status));

  function signupRows(rows) {
    $('listHead').innerHTML = '<tr><th>Name</th><th>Email and phone</th><th>Signed up with</th><th>Email confirmed</th><th></th></tr>';
    return rows.length ? rows.map((u) => {
      const href = 'admin/users.html?id=' + encodeURIComponent(u.user_id);
      return `<tr>
        <td><b>${MS.lnk(href, u.display_name)}</b><span class="sub">${esc(u.username)}</span></td>
        <td>${esc(u.email)}${u.phone ? `<span class="sub">${esc(u.phone)}</span>` : ''}</td>
        <td>${esc(how(u))}</td>
        <td>${esc(MS.when(u.email_verified_at || u.created_at))}</td>
        <td>${MS.can('USER_ROLE_ASSIGN') ? `<div class="signup-acts"><button type="button" class="primary" data-approve="${esc(u.user_id)}">Approve</button><button type="button" class="danger" data-reject="${esc(u.user_id)}">Reject</button></div>` : ''}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="5" class="empty">No new sign-ups are waiting.</td></tr>';
  }

  let requests = [];
  function requestRows(rows) {
    $('listHead').innerHTML = '<tr><th>Person</th><th>Role asked for</th><th>Asked by</th><th>Status</th><th></th></tr>';
    return rows.length ? rows.map((q) => `<tr>
        <td><b>${esc(q.person_name)}</b><span class="sub">${esc(q.person_email)}</span>${q.note ? `<span class="sub">${esc(q.note)}</span>` : ''}</td>
        <td>${esc(q.role_name)}</td>
        <td>${esc(q.requested_by_name)}<span class="sub">${esc(MS.when(q.created_at))}</span></td>
        <td>${MS.pill(q.status)}${q.status === 'DECLINED' && q.handled_note ? `<span class="sub">${esc(q.handled_note)}</span>` : ''}${q.user_status === 'NO_LOGIN_YET' && q.status === 'OPEN' ? '<span class="sub">no login yet</span>' : ''}${q.user_status === 'WAITING_FOR_APPROVAL' ? '<span class="sub">sign-up waiting for approval</span>' : ''}</td>
        <td>${q.status === 'OPEN' ? `<div class="signup-acts">${q.can.open_user ? `<a class="btn primary" href="admin/users.html?id=${encodeURIComponent(q.user_id)}">Open ${esc(q.person_name.split(' ')[0])}'s roles</a>` : ''}${q.can.decline ? `<button type="button" class="danger" data-decline="${esc(q.role_request_id)}">Decline</button>` : ''}</div>` : ''}</td>
      </tr>`).join('') : '<tr><td colspan="5" class="empty">No role requests.</td></tr>';
  }
  async function loadRequests() {
    const r = await MS.call('ROLE_REQUEST_LIST', { page: state.page, page_size: 50, search: state.q });
    requests = r.rows;
    $('requestCount').hidden = !r.open;
    $('requestCount').textContent = r.open || '';
    MS.setMsg('listMsg', MS.count(r.total, 'request') + (r.open ? ' · ' + r.open + ' waiting' : ''));
    $('listBody').innerHTML = requestRows(r.rows);
    MS.pager('pager', r, state, load);
  }
  async function declineRequest(q) {
    const reason = await MS.askReason({ title: 'Decline: ' + q.person_name + ' as ' + q.role_name, message: 'The person who asked is told your reason.', confirmText: 'Decline', danger: true });
    if (reason === null) return;
    try { await MS.call('ROLE_REQUEST_DECLINE', { role_request_id: q.role_request_id, reason }); await load(); MS.setMsg('listMsg', 'Request declined.', 'ok'); } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  let listed = [];
  const canDelete = () => MS.can('USER_DELETE');
  let pick = null;
  const syncBoxes = () => {
    document.querySelectorAll('#listBody input[data-sel]').forEach((i) => { i.checked = pick.has(i.dataset.sel); });
    const all = $('selAll');
    if (all) { const boxes = Array.from(document.querySelectorAll('#listBody input[data-sel]:not(:disabled)')); all.checked = !!boxes.length && boxes.every((i) => i.checked); }
  };
  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    const signups = state.tab === 'signups', reqs = state.tab === 'requests';
    $('signupNote').hidden = !signups;
    $('requestNote').hidden = !reqs;
    $('statusFilter').hidden = signups || reqs;
    if (reqs) { try { await loadRequests(); } catch (err) { MS.setMsg('listMsg', err.message, 'error'); } return; }
    try {
      const r = await MS.call('USER_LIST', { page: state.page, page_size: 50, search: state.q, filters: signups ? {} : { status: state.status }, signups: signups || undefined });
      listed = r.rows;
      $('signupCount').hidden = !r.signups_waiting;
      $('signupCount').textContent = r.signups_waiting || '';
      MS.setMsg('listMsg', signups ? MS.count(r.total, 'sign-up') + ' waiting' : MS.count(r.total, 'account'));
      if (signups) { $('listBody').innerHTML = signupRows(r.rows); MS.pager('pager', r, state, load); return; }
      const del = canDelete();
      $('listHead').innerHTML = '<tr>' + (del ? '<th class="sel"><input type="checkbox" id="selAll" aria-label="Select everyone on this page"></th>' : '') + '<th>Username</th><th>Name</th><th>Roles</th><th>Last sign-in</th><th>Status</th></tr>';
      $('listBody').innerHTML = r.rows.length ? r.rows.map((u) => {
        const href = 'admin/users.html?id=' + encodeURIComponent(u.user_id);
        return `<tr class="clk" data-href="${href}">
          ${del ? `<td class="sel">${u.user_id === MS.user.user_id ? '' : `<input type="checkbox" data-sel="${esc(u.user_id)}" data-name="${esc(u.display_name)}" aria-label="Select ${esc(u.display_name)}">`}</td>` : ''}
          <td><b>${MS.lnk(href, u.username)}</b></td>
          <td>${esc(u.display_name)}${u.email ? `<span class="sub">${esc(u.email)}</span>` : ''}</td>
          <td class="wrap">${(u.roles || []).map((x) => `<span class="pill role">${esc(x.role_name)}</span>`).join(' ')}</td>
          <td>${esc(MS.when(u.last_login_at)) || '<span class="sub">never</span>'}</td>
          <td>${accountPill(u)}${u.must_change_password === true ? '<span class="sub">must change password</span>' : ''}${u.approval_status === 'PENDING' && !u.email_verified ? '<span class="sub">email not confirmed yet</span>' : ''}</td>
        </tr>`;
      }).join('') : `<tr><td colspan="${del ? 6 : 5}" class="empty">${state.q ? 'No account matches.' : 'No accounts yet.'}</td></tr>`;
      if (del) syncBoxes();
      MS.pager('pager', r, state, load);
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  const roleBoxes = (box, checkedRoleId) => {
    const roles = (MS.refCache && MS.refCache.roles) || [];
    box.innerHTML = roles.length ? roles.map((r) => `<label class="check"><input type="checkbox" value="${esc(r.role_code)}"${r.role_id === checkedRoleId ? ' checked' : ''}> ${esc(r.role_name)}</label>`).join('') : '<span class="hint">No roles available.</span>';
  };

  async function createLogin() {
    const f = $('createForm');
    f.reset();
    $('createError').textContent = 'Loading employees…';
    $('cRoles').innerHTML = '';
    const dlg = MS.openDialog('createDialog');
    let list = [];
    try {
      const pages = [];
      for (let p = 1; p < 20; p++) {
        const r = await MS.call('EMPLOYEE_LIST', { page: p, page_size: 100, filters: { status: 'ACTIVE' }, sort: 'last_name', dir: 'asc' });
        pages.push(...r.rows);
        if (p * r.page_size >= r.total) break;
      }
      list = pages.filter((e) => e.account_status === 'NO_ACCOUNT');
      $('createError').textContent = list.length ? '' : 'Every active employee already has a login.';
    } catch (err) { $('createError').textContent = err.message; }
    $('cEmployee').innerHTML = MS.options(list.map((e) => ({ value: e.employee_id, label: e.first_name + ' ' + e.last_name + ' · ' + (e.position_title || e.employee_number) })), '', '— choose —');
    const posOf = (eid) => {
      const re = ((MS.refCache && MS.refCache.employees) || []).find((x) => x.employee_id === eid);
      return re && ((MS.refCache.positions || []).find((p) => p.position_id === re.position_id));
    };
    $('cEmployee').onchange = () => {
      const e = list.find((x) => x.employee_id === $('cEmployee').value);
      f.elements.username.value = e ? (e.first_name + '.' + e.last_name).toLowerCase().replace(/[^a-z0-9.]/g, '') : '';
      const pos = e && posOf(e.employee_id);
      roleBoxes($('cRoles'), '');
    };
    roleBoxes($('cRoles'), '');
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      const d = MS.formData(f);
      const e = list.find((x) => x.employee_id === d.employee_id);
      if (!e) { $('createError').textContent = 'Choose the employee.'; return; }
      if (!d.username || !d.email) { $('createError').textContent = 'Enter the username and email.'; return; }
      const role_codes = Array.from($('cRoles').querySelectorAll('input:checked')).map((i) => i.value);
      MS.busy($('createSave'), true, 'Creating…');
      try {
        const r = await MS.call('USER_CREATE', { employee_id: e.employee_id, username: d.username.toLowerCase(), email: d.email, role_codes });
        dlg.close();
        await MS.showPassword('Login created', r.temporary_password, e.first_name, r.email_sent && r.email);
        location.href = 'admin/users.html?id=' + encodeURIComponent(r.user.user_id);
      } catch (err) { $('createError').textContent = err.message; } finally { MS.busy($('createSave'), false); }
    };
    $('createCancel').onclick = () => dlg.close();
  }

  let freeEmployees = null;
  async function approveSignup(u, done) {
    const f = $('approveForm');
    f.reset();
    $('apTitle').textContent = 'Approve ' + u.display_name;
    $('apInfo').textContent = u.email + ' · ' + how(u) + '. Choose the roles for their job. They get an email with the sign-in link.';
    roleBoxes($('apRoles'), '');
    $('apError').textContent = '';
    $('apEmployee').innerHTML = MS.options([], '', '— not on the staff list —');
    const dlg = MS.openDialog('approveDialog');
    if (MS.can('EMPLOYEE_VIEW') && !freeEmployees) {
      try {
        const all = [];
        for (let p = 1; p < 20; p++) {
          const r = await MS.call('EMPLOYEE_LIST', { page: p, page_size: 100, filters: { status: 'ACTIVE' }, sort: 'last_name', dir: 'asc' });
          all.push(...r.rows);
          if (p * r.page_size >= r.total) break;
        }
        freeEmployees = all.filter((e) => e.account_status === 'NO_ACCOUNT');
      } catch (err) { freeEmployees = []; }
    }
    $('apEmployee').innerHTML = MS.options((freeEmployees || []).map((e) => ({ value: e.employee_id, label: e.first_name + ' ' + e.last_name + ' · ' + (e.position_title || e.employee_number) })), '', '— not on the staff list —');
    $('apEmployee').onchange = () => {
      const re = ((MS.refCache && MS.refCache.employees) || []).find((x) => x.employee_id === $('apEmployee').value);
      const pos = re && (MS.refCache.positions || []).find((p) => p.position_id === re.position_id);
    };
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      const role_codes = Array.from($('apRoles').querySelectorAll('input:checked')).map((i) => i.value);
      if (!role_codes.length) { $('apError').textContent = 'Choose at least one role.'; return; }
      MS.busy($('apSave'), true, 'Approving…');
      try {
        const r = await MS.call('USER_SIGNUP_APPROVE', { user_id: u.user_id, role_codes, employee_id: $('apEmployee').value || undefined, note: f.elements.note.value.trim() });
        freeEmployees = null;
        dlg.close();
        done(u.display_name + ' is approved' + (r.email_sent ? ' and has been emailed.' : '.'));
      } catch (err) { $('apError').textContent = err.message; } finally { MS.busy($('apSave'), false); }
    };
    $('apCancel').onclick = () => dlg.close();
  }

  async function rejectSignup(u, done, msgBox) {
    const reason = await MS.askReason({ title: 'Reject ' + u.display_name, message: 'They cannot sign in and get an email with your reason.', confirmText: 'Reject', danger: true });
    if (reason === null) return;
    try { await MS.call('USER_SIGNUP_REJECT', { user_id: u.user_id, reason }); done('Sign-up rejected.'); } catch (err) { MS.setMsg(msgBox, err.message, 'error'); }
  }

  function listPage() {
    $('listView').hidden = false;
    $('listActions').innerHTML = [
      MS.can('USER_CREATE') && MS.can('EMPLOYEE_VIEW') && '<button type="button" class="primary" id="createBtn">Create login</button>',
      MS.can('EMPLOYMENT_EDIT') && '<a class="btn" href="people/employees.html">Create logins from Employees</a>',
      MS.can('USER_DELETE') && MS.can('EMPLOYEE_DELETE') && '<button type="button" class="danger" id="delAllBtn">' + MS.icon('trash') + ' Delete all except me</button>'
    ].filter(Boolean).join('');
    if ($('createBtn')) $('createBtn').onclick = createLogin;
    if (canDelete()) {
      pick = MS.peopleSelect({ bar: 'selBar', kind: 'user', reload: () => load(), sync: syncBoxes });
      $('delAllBtn') && ($('delAllBtn').onclick = async () => { if (await MS.peopleDelete.all()) { pick.clear(); state.page = 1; load(); } });
      $('listBody').addEventListener('change', (e) => { const i = e.target.closest('input[data-sel]'); if (i) { pick.toggle(i.dataset.sel, i.dataset.name, i.checked); syncBoxes(); } });
      $('listHead').addEventListener('change', (e) => {
        if (e.target.id !== 'selAll') return;
        document.querySelectorAll('#listBody input[data-sel]').forEach((i) => { i.checked = e.target.checked; pick.toggle(i.dataset.sel, i.dataset.name, i.checked); });
      });
    }
    $('statusFilter').innerHTML = MS.options(['ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'LOCKED'], '', 'Any status');
    $('search').addEventListener('input', MS.debounce(() => { state.q = $('search').value.trim(); state.page = 1; load(); }, 300));
    $('statusFilter').addEventListener('change', () => { state.status = $('statusFilter').value; state.page = 1; load(); });
    $('reloadBtn').addEventListener('click', load);
    $('tabs').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-tab]');
      if (!b) return;
      state.tab = b.dataset.tab;
      state.page = 1;
      $('tabs').querySelectorAll('button[data-tab]').forEach((x) => x.classList.toggle('on', x === b));
      history.replaceState(null, '', location.pathname + (state.tab === 'all' ? '' : '?tab=' + state.tab));
      load();
    });
    $('tabs').querySelectorAll('button[data-tab]').forEach((x) => x.classList.toggle('on', x.dataset.tab === state.tab));
    if (MS.can('USER_ROLE_ASSIGN')) {
      $('tabRequests').hidden = false;
      if (state.tab !== 'requests') MS.call('ROLE_REQUEST_LIST', { status: 'OPEN', page_size: 1 }).then((r) => { $('requestCount').hidden = !r.open; $('requestCount').textContent = r.open || ''; }).catch(() => {});
    } else if (state.tab === 'requests') { state.tab = 'all'; $('tabs').querySelectorAll('button[data-tab]').forEach((x) => x.classList.toggle('on', x.dataset.tab === 'all')); }
    const after = (text) => { load().then(() => MS.setMsg('listMsg', text, 'ok')); };
    $('listBody').addEventListener('click', (e) => {
      const d = e.target.closest('[data-decline]');
      if (d) { e.stopPropagation(); const q = requests.find((x) => x.role_request_id === d.getAttribute('data-decline')); if (q) declineRequest(q); return; }
      const a = e.target.closest('[data-approve]'), r = e.target.closest('[data-reject]');
      const u = (a || r) && listed.find((x) => x.user_id === (a || r).getAttribute(a ? 'data-approve' : 'data-reject'));
      if (!u) return;
      e.stopPropagation();
      if (a) approveSignup(u, after); else rejectSignup(u, after, 'listMsg');
    });
    MS.clickable($('listBody'));
    load();
    if (MS.param('add') && $('createBtn')) createLogin();
  }

  let user = null;

  function renderOne(u) {
    user = u;
    const self = u.user_id === MS.user.user_id;
    document.title = u.display_name + ' · MS BMS';
    $('dTitle').innerHTML = esc(u.display_name) + ' <span style="font-weight:400;color:var(--muted);font-size:13px">' + esc(u.username) + '</span> ' + accountPill(u);
    $('dCrumbs').innerHTML = `<a href="admin/users.html">User accounts</a> › ${esc(u.username)}`;
    const b = [];
    if (waiting(u) && !self && MS.can('USER_ROLE_ASSIGN') && u.email_verified) {
      b.push('<button type="button" class="primary" data-act="approve">Approve sign-up</button>');
      if (u.approval_status === 'PENDING') b.push('<button type="button" class="danger" data-act="reject">Reject</button>');
    }
    if (MS.can('USER_EDIT')) b.push('<button type="button" data-act="email">Change email</button>');
    if (!self) {
      if (MS.can('USER_EDIT')) b.push('<button type="button" data-act="reset">Reset password</button>');
      if (MS.can('USER_SUSPEND') && u.status === 'ACTIVE') b.push('<button type="button" data-act="suspend">Suspend</button>');
      if (MS.can('USER_SUSPEND') && u.status !== 'ACTIVE') b.push('<button type="button" data-act="reactivate">Reactivate</button>');
      if (MS.can('USER_DEACTIVATE') && u.status !== 'DEACTIVATED') b.push('<button type="button" class="danger" data-act="deactivate">Deactivate</button>');
      if (MS.can('USER_DELETE')) b.push('<button type="button" class="danger" data-act="delete">' + MS.icon('trash') + ' Delete permanently</button>');
    }
    $('dActions').innerHTML = b.join('');
    const canRoles = MS.can('USER_ROLE_ASSIGN') && !self && !waiting(u);
    const held = (u.roles || []).map((r) => r.role_code);
    const addable = ((MS.refCache && MS.refCache.roles) || []).filter((r) => held.indexOf(r.role_code) < 0);
    $('dBody').innerHTML = `
      <div class="dgrid">
        <div class="dpanel"><h3>Account</h3>${MS.kv([
          ['Username', u.username], ['Status', accountPill(u), true], ['Reason', u.status_reason],
          ['Email', u.email + (waiting(u) && !u.email_verified ? ' (not confirmed yet)' : '')], ['Phone', u.phone],
          ['Made by', how(u)], ['Sign-up decided', u.approved_at ? MS.when(u.approved_at) + (u.approval_note ? ' · ' + u.approval_note : '') : ''],
          ['Employee', u.employee_id ? (MS.can('EMPLOYEE_VIEW') ? MS.lnk('people/employee.html?id=' + encodeURIComponent(u.employee_id), u.employee_name + ' (' + u.employee_number + ')') : esc(u.employee_name + ' (' + u.employee_number + ')')) : '', true],
          ['Last sign-in', MS.when(u.last_login_at) || 'never'],
          ['Fingerprints', u.passkey_count ? u.passkey_count + ' turned on' : 'none'],
          ['Must change password', u.must_change_password === true ? 'Yes' : 'No'],
          ['Failed sign-ins', u.failed_login_count ? String(u.failed_login_count) : ''],
          ['Locked until', MS.when(u.locked_until)],
          ['Created', MS.when(u.created_at)]])}</div>
        ${u.passkey_count ? '<div class="dpanel"><h3>Fingerprint sign-in</h3><div id="dPasskeys"><p class="empty">Loading…</p></div></div>' : ''}
        <div class="dpanel"><h3>Roles</h3>
          <div class="tablewrap"><table class="inv"><thead><tr><th>Role</th><th></th></tr></thead><tbody>
          ${(u.roles || []).length ? u.roles.map((r) => `<tr><td>${esc(r.role_name)}</td><td>${canRoles ? `<div class="acts"><button type="button" data-remove="${esc(r.role_code)}">Remove</button></div>` : ''}</td></tr>`).join('') : '<tr><td colspan="2" class="empty">No roles.</td></tr>'}
          </tbody></table></div>
          ${canRoles && addable.length ? `<div class="inline-add"><select id="addRole">${MS.options(addable.map((r) => ({ value: r.role_code, label: r.role_name })))}</select><button type="button" id="addRoleBtn">Add role</button></div>` : ''}
          ${self ? '<p class="hint" style="margin-top:10px">You cannot change your own roles or account status.</p>' : ''}
        </div>
      </div>`;
    if ($('dPasskeys')) {
      MS.call('PASSKEY_LIST', { user_id: u.user_id }).then((r) => {
        const canRemove = MS.can('USER_EDIT');
        $('dPasskeys').innerHTML = `<div class="tablewrap"><table class="inv"><thead><tr><th>Device</th><th>Last used</th><th></th></tr></thead><tbody>${r.rows.map((k) => `<tr><td>${esc(k.device_label)}</td><td>${esc(k.last_used_at ? MS.when(k.last_used_at) : 'not yet')}</td><td>${canRemove ? `<div class="acts"><button type="button" data-pk="${esc(k.passkey_id)}" data-name="${esc(k.device_label)}">Remove</button></div>` : ''}</td></tr>`).join('')}</tbody></table></div>
          <p class="hint" style="margin-top:10px">For a lost phone: remove its fingerprint here. The person can still sign in with their password.</p>`;
      }).catch((err) => { $('dPasskeys').innerHTML = `<p class="empty">${esc(err.message)}</p>`; });
    }
    if ($('addRoleBtn')) $('addRoleBtn').onclick = async () => {
      MS.busy($('addRoleBtn'), true, 'Adding…');
      try { await MS.call('USER_ROLE_ASSIGN', { user_id: u.user_id, role_code: $('addRole').value }); loadOne(); } catch (err) { MS.setMsg('dStatus', err.message, 'error'); MS.busy($('addRoleBtn'), false); }
    };
  }

  async function act(what) {
    const u = user;
    const withReason = async (action, o) => {
      const reason = await MS.askReason(o);
      if (reason === null) return;
      MS.setMsg('dStatus', 'Saving…');
      try {
        await MS.call(action, { user_id: u.user_id, reason });
        loadOne('Done.');
      } catch (err) { MS.setMsg('dStatus', err.message, 'error'); }
    };
    if (what === 'email') return changeEmail();
    if (what === 'approve') return approveSignup(u, (t) => loadOne(t));
    if (what === 'reject') return rejectSignup(u, (t) => loadOne(t), 'dStatus');
    if (what === 'reset') {
      if (!(await MS.confirm({ title: 'Reset password', message: 'Create a new one-time password for ' + u.display_name + '? Their sessions end now.', confirmText: 'Reset' }))) return;
      try {
        const r = await MS.call('USER_RESET_PASSWORD', { user_id: u.user_id });
        await MS.showPassword('Password reset', r.temporary_password, u.display_name, r.email_sent && r.email);
        loadOne();
      } catch (err) { MS.setMsg('dStatus', err.message, 'error'); }
      return;
    }
    if (what === 'suspend') return withReason('USER_SUSPEND', { title: 'Suspend', message: 'Sign-in is blocked until reactivated. Their sessions end now.', confirmText: 'Suspend' });
    if (what === 'reactivate') return withReason('USER_REACTIVATE', { title: 'Reactivate', message: 'Allow ' + u.display_name + ' to sign in again.', confirmText: 'Reactivate' });
    if (what === 'deactivate') return withReason('USER_DEACTIVATE', { title: 'Deactivate', message: 'Permanently blocks this account. History is kept.', confirmText: 'Deactivate', danger: true });
    if (what === 'delete') {
      const r = await MS.peopleDelete.one({ kind: 'user', id: u.user_id, name: u.display_name, employeeLabel: u.employee_id && MS.can('EMPLOYEE_DELETE') ? u.employee_name + ', ' + u.employee_number : '' });
      if (r) location.replace('admin/users.html');
      return;
    }
  }

  async function removeRole(code) {
    const r = (user.roles || []).find((x) => x.role_code === code);
    const why = await MS.askReason({ title: 'Remove role', message: 'Remove ' + (r ? r.role_name : code) + ' from ' + user.display_name + '?', confirmText: 'Remove' });
    if (why === null) return;
    try { await MS.call('USER_ROLE_REMOVE', { user_id: user.user_id, role_code: code, reason: why }); loadOne(); } catch (err) { MS.setMsg('dStatus', err.message, 'error'); }
  }

  async function removePasskey(passkeyId, name) {
    if (!(await MS.confirm({ title: 'Remove fingerprint', message: 'Remove "' + name + '" for ' + user.display_name + '? They sign in with their password until they turn it on again.', confirmText: 'Remove', danger: true }))) return;
    try { await MS.call('PASSKEY_REVOKE', { passkey_id: passkeyId }); loadOne('Fingerprint removed.'); } catch (err) { MS.setMsg('dStatus', err.message, 'error'); }
  }

  function changeEmail() {
    const f = $('emailForm');
    f.reset();
    f.elements.email.value = user.email || '';
    $('emailError').textContent = '';
    const dlg = MS.openDialog('emailDialog');
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      const email = f.elements.email.value.trim();
      if (!email) { $('emailError').textContent = 'Enter the email.'; return; }
      MS.busy($('emailSave'), true, 'Saving…');
      try { await MS.call('USER_EDIT', { user_id: user.user_id, email }); dlg.close(); loadOne(); } catch (err) { $('emailError').textContent = err.message; } finally { MS.busy($('emailSave'), false); }
    };
    $('emailCancel').onclick = () => dlg.close();
  }

  async function loadOne(note) {
    MS.setMsg('dStatus', 'Loading…');
    try {
      const u = await MS.call('USER_GET', { user_id: id });
      MS.setMsg('dStatus', note || '', note ? 'ok' : '');
      renderOne(u);
    } catch (err) {
      MS.setMsg('dStatus', err.message, 'error');
      $('dBody').innerHTML = '<p><a class="lnk" href="admin/users.html">Back to user accounts</a></p>';
    }
  }

  MS.boot({ page: 'users', any: ['USER_VIEW'], ref: true }).then(() => {
    if (!id) { listPage(); return; }
    $('oneView').hidden = false;
    $('dActions').addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b) act(b.dataset.act); });
    $('dBody').addEventListener('click', (e) => {
      const b = e.target.closest('[data-remove]'), k = e.target.closest('[data-pk]');
      if (b) removeRole(b.dataset.remove);
      if (k) removePasskey(k.dataset.pk, k.dataset.name);
    });
    loadOne();
  });
})();
