/* User accounts. admin/users.html lists them; admin/users.html?id= shows one account with its roles and
   the account actions (email, reset password, suspend, reactivate, deactivate, delete). */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const id = MS.param('id');
  const state = { page: 1, q: '', status: '' };

  // ---------- list ----------
  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    try {
      const r = await MS.call('USER_LIST', { page: state.page, page_size: 50, search: state.q, filters: { status: state.status }, sort: 'username', dir: 'asc' });
      MS.setMsg('listMsg', MS.count(r.total, 'account'));
      $('listBody').innerHTML = r.rows.length ? r.rows.map((u) => {
        const href = 'admin/users.html?id=' + encodeURIComponent(u.user_id);
        return `<tr class="clk" data-href="${href}">
          <td><b>${MS.lnk(href, u.username)}</b></td>
          <td>${esc(u.display_name)}${u.email ? `<span class="sub">${esc(u.email)}</span>` : ''}</td>
          <td class="wrap">${(u.roles || []).map((x) => `<span class="pill role">${esc(x.role_name)}</span>`).join(' ')}</td>
          <td>${esc(MS.when(u.last_login_at)) || '<span class="sub">never</span>'}</td>
          <td>${MS.pill(u.status)}${u.must_change_password === true ? '<span class="sub">must change password</span>' : ''}</td>
        </tr>`;
      }).join('') : `<tr><td colspan="5" class="empty">${state.q ? 'No account matches.' : 'No accounts yet.'}</td></tr>`;
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
      roleBoxes($('cRoles'), pos ? pos.default_role_id : '');
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

  function listPage() {
    $('listView').hidden = false;
    $('listActions').innerHTML = [
      MS.can('USER_CREATE') && MS.can('EMPLOYEE_VIEW') && '<button type="button" class="primary" id="createBtn">Create login</button>',
      MS.can('EMPLOYMENT_EDIT') && '<a class="btn" href="people/employees.html">Create logins from Employees</a>'
    ].filter(Boolean).join('');
    if ($('createBtn')) $('createBtn').onclick = createLogin;
    $('statusFilter').innerHTML = MS.options(['ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'LOCKED'], '', 'Any status');
    $('search').addEventListener('input', MS.debounce(() => { state.q = $('search').value.trim(); state.page = 1; load(); }, 300));
    $('statusFilter').addEventListener('change', () => { state.status = $('statusFilter').value; state.page = 1; load(); });
    $('reloadBtn').addEventListener('click', load);
    MS.clickable($('listBody'));
    load();
    if (MS.param('add') && $('createBtn')) createLogin();
  }

  // ---------- one account ----------
  let user = null;

  function renderOne(u) {
    user = u;
    const self = u.user_id === MS.user.user_id;
    document.title = u.display_name + ' · MS BMS';
    $('dTitle').innerHTML = esc(u.display_name) + ' <span style="font-weight:400;color:var(--muted);font-size:13px">' + esc(u.username) + '</span> ' + MS.pill(u.status);
    $('dCrumbs').innerHTML = `<a href="admin/users.html">User accounts</a> › ${esc(u.username)}`;
    const b = [];
    if (MS.can('USER_EDIT')) b.push('<button type="button" data-act="email">Change email</button>');
    if (!self) {
      if (MS.can('USER_EDIT')) b.push('<button type="button" data-act="reset">Reset password</button>');
      if (MS.can('USER_SUSPEND') && u.status === 'ACTIVE') b.push('<button type="button" data-act="suspend">Suspend</button>');
      if (MS.can('USER_SUSPEND') && u.status !== 'ACTIVE') b.push('<button type="button" data-act="reactivate">Reactivate</button>');
      if (MS.can('USER_DEACTIVATE') && u.status !== 'DEACTIVATED') b.push('<button type="button" class="danger" data-act="deactivate">Deactivate</button>');
      if (MS.can('USER_DELETE') && !u.last_login_at) b.push('<button type="button" class="danger" data-act="delete">Delete</button>');
    }
    $('dActions').innerHTML = b.join('');
    const canRoles = MS.can('USER_ROLE_ASSIGN') && !self;
    const held = (u.roles || []).map((r) => r.role_code);
    const addable = ((MS.refCache && MS.refCache.roles) || []).filter((r) => held.indexOf(r.role_code) < 0);
    $('dBody').innerHTML = `
      <div class="dgrid">
        <div class="dpanel"><h3>Account</h3>${MS.kv([
          ['Username', u.username], ['Status', MS.pill(u.status), true], ['Reason', u.status_reason],
          ['Email', u.email],
          ['Employee', u.employee_id ? (MS.can('EMPLOYEE_VIEW') ? MS.lnk('people/employee.html?id=' + encodeURIComponent(u.employee_id), u.employee_name + ' (' + u.employee_number + ')') : esc(u.employee_name + ' (' + u.employee_number + ')')) : '', true],
          ['Last sign-in', MS.when(u.last_login_at) || 'never'],
          ['Must change password', u.must_change_password === true ? 'Yes' : 'No'],
          ['Failed sign-ins', u.failed_login_count ? String(u.failed_login_count) : ''],
          ['Locked until', MS.when(u.locked_until)],
          ['Created', MS.when(u.created_at)]])}
          ${MS.can('AUDIT_VIEW') ? `<p style="margin:10px 0 0"><a class="lnk" href="admin/activity.html?user=${encodeURIComponent(u.user_id)}">What this account did (activity log)</a></p>` : ''}</div>
        <div class="dpanel"><h3>Roles</h3>
          <div class="tablewrap"><table class="inv"><thead><tr><th>Role</th><th></th></tr></thead><tbody>
          ${(u.roles || []).length ? u.roles.map((r) => `<tr><td>${esc(r.role_name)}</td><td>${canRoles ? `<div class="acts"><button type="button" data-remove="${esc(r.role_code)}">Remove</button></div>` : ''}</td></tr>`).join('') : '<tr><td colspan="2" class="empty">No roles.</td></tr>'}
          </tbody></table></div>
          ${canRoles && addable.length ? `<div class="inline-add"><select id="addRole">${MS.options(addable.map((r) => ({ value: r.role_code, label: r.role_name })))}</select><button type="button" id="addRoleBtn">Add role</button></div>` : ''}
          ${self ? '<p class="hint" style="margin-top:10px">You cannot change your own roles or account status.</p>' : ''}
        </div>
      </div>`;
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
        if (action === 'USER_DELETE') { location.replace('admin/users.html'); return; }
        loadOne('Done.');
      } catch (err) { MS.setMsg('dStatus', err.message, 'error'); }
    };
    if (what === 'email') return changeEmail();
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
    if (what === 'delete') return withReason('USER_DELETE', { title: 'Delete', message: 'Only accounts that were never used can be deleted.', confirmText: 'Delete', danger: true });
  }

  async function removeRole(code) {
    const r = (user.roles || []).find((x) => x.role_code === code);
    const why = await MS.askReason({ title: 'Remove role', message: 'Remove ' + (r ? r.role_name : code) + ' from ' + user.display_name + '?', confirmText: 'Remove' });
    if (why === null) return;
    try { await MS.call('USER_ROLE_REMOVE', { user_id: user.user_id, role_code: code, reason: why }); loadOne(); } catch (err) { MS.setMsg('dStatus', err.message, 'error'); }
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
    $('dBody').addEventListener('click', (e) => { const b = e.target.closest('[data-remove]'); if (b) removeRole(b.dataset.remove); });
    loadOne();
  });
})();
