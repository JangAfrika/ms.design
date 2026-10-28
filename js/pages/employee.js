(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const id = MS.param('id');
  let emp = null;

  const current = (e) => (e.employment_history || []).find((x) => x.is_current === true) || {};
  const fullName = (e) => e.first_name + ' ' + e.last_name;

  function formDialog(dlgId, formId, errId, saveId, cancelId, save) {
    const f = $(formId);
    $(errId).textContent = '';
    const dlg = MS.openDialog(dlgId);
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      $(errId).textContent = '';
      MS.busy($(saveId), true, 'Saving…');
      try {
        const done = await save(MS.formData(f));
        if (done !== false) { dlg.close(); if (done !== 'keep') load(); }
      } catch (err) { $(errId).textContent = err.message; } finally { MS.busy($(saveId), false); }
    };
    $(cancelId).onclick = () => dlg.close();
    return dlg;
  }

  function render(e) {
    emp = e;
    const self = e.employee_id === MS.user.employee_id;
    const name = fullName(e);
    const pay = MS.can('FINANCE_PAYROLL_VIEW');
    document.title = name + ' · MS BMS';
    $('dTitle').innerHTML = esc(name) + ' <span class="sub" style="font-weight:400;color:var(--muted);font-size:13px">' + esc(e.employee_number) + '</span> ' + MS.pill(e.employment_status || e.status);
    $('dCrumbs').innerHTML = `<a href="people/employees.html">Employees</a> › ${esc(name)}`;
    $('dActions').innerHTML = [
      MS.can('USER_CREATE') && e.account_status === 'NO_ACCOUNT' && '<button type="button" class="primary" id="loginBtn">Create login</button>',
      e.user_id && MS.can('USER_VIEW') && `<a class="btn" href="admin/users.html?id=${encodeURIComponent(e.user_id)}">User account</a>`,
      MS.can('EMPLOYMENT_EDIT') && '<button type="button" id="editBtn">Edit details</button>',
      MS.can('EMPLOYMENT_EDIT') && '<button type="button" id="jobBtn">Change position / pay</button>',
      MS.can('EMPLOYMENT_EDIT') && !self && '<button type="button" id="statusBtn">Employment status</button>',
      MS.can('EMPLOYMENT_ACTION_REQUEST') && !self && '<button type="button" id="noticeBtn">Employment notice…</button>',
      MS.can('EMPLOYEE_DELETE') && MS.can('USER_DELETE') && !self && '<button type="button" class="danger" id="deleteBtn">' + MS.icon('trash') + ' Delete permanently</button>'
    ].filter(Boolean).join('');
    const cur = current(e);
    $('dBody').innerHTML = `
      <div class="dgrid">
        <div class="dpanel"><h3>Employment</h3>${MS.kv([
          ['Staff number', e.employee_number], ['Position', e.position_title || '—'], ['Department', e.department_name || '—'],
          ['Reports to', e.reporting_manager_name || '—'], ['Employment type', cur.employment_type ? MS.label(cur.employment_type) : ''],
          ['Since', MS.shortDate(cur.start_date)], ['Employment', MS.pill(e.employment_status || e.status), true],
          ['Login account', e.account_status === 'NO_ACCOUNT' ? 'No login yet' : MS.pill(e.account_status), true],
          pay && cur.basic_salary !== undefined && cur.basic_salary !== '' ? ['Basic salary', MS.money(cur.basic_salary)] : ['', '']])}</div>
        <div class="dpanel"><h3>Personal details</h3>${MS.kv([
          ['Other names', e.other_names], ['Phone', e.phone || '—'], ['Address', e.address], ['Nationality', e.nationality],
          ['Gender', e.gender ? MS.label(e.gender) : ''], ['Date of birth', MS.shortDate(e.date_of_birth)],
          ['National ID number', e.national_id_number], ['Emergency contact', e.emergency_contact]])}
</div>
        ${MS.canAny(['PAYROLL_PREPARE', 'FINANCE_PAYROLL_VIEW']) ? '<div class="dpanel wide" id="payPanel"><h3>Pay</h3><p class="empty">Loading…</p></div>' : ''}
      </div>`;
    if ($('payPanel')) loadPay(e);
    if ($('loginBtn')) $('loginBtn').onclick = createLogin;
    if ($('editBtn')) $('editBtn').onclick = editDetails;
    if ($('jobBtn')) $('jobBtn').onclick = changeEmployment;
    if ($('statusBtn')) $('statusBtn').onclick = changeStatus;
    if ($('noticeBtn')) $('noticeBtn').onclick = sendNotice;
    if ($('deleteBtn')) $('deleteBtn').onclick = async () => {
      const r = await MS.peopleDelete.one({ kind: 'employee', id: e.employee_id, name });
      if (r) location.replace('people/employees.html');
    };
  }

  async function loadPay(e) {
    const box = $('payPanel');
    const link = 'people/payroll.html?tab=components&employee=' + encodeURIComponent(e.employee_id);
    try {
      const r = await MS.call('PAY_COMPONENT_LIST', { employee_id: e.employee_id });
      box.innerHTML = `<h3>Pay <span class="sub" style="font-weight:400;color:var(--muted)">allowances and deductions added to each payroll</span> ${MS.lnk(link, 'Manage in Payroll')}</h3>
        <div class="tablewrap"><table class="inv"><tbody>${r.rows.length ? r.rows.map((c) => `<tr><td class="wrap">${esc(c.description)}</td>
          <td>${c.component_type === 'EARNING' ? 'Earning' : 'Deduction'}</td><td class="num">${c.component_type === 'DEDUCTION' ? '− ' : ''}${MS.money(c.amount)} / month</td>
          <td>${esc(MS.shortDate(c.valid_from))} – ${c.valid_to ? esc(MS.shortDate(c.valid_to)) : 'until stopped'}</td></tr>`).join('')
          : '<tr><td class="empty">No pay components: basic salary only.</td></tr>'}</tbody></table></div>`;
    } catch (err) { box.innerHTML = '<h3>Pay</h3><p class="empty">' + esc(err.message) + '</p>'; }
  }

  const PROFILE = ['first_name', 'last_name', 'other_names', 'phone', 'address', 'nationality', 'date_of_birth', 'gender', 'national_id_number', 'emergency_contact'];

  function editDetails() {
    const f = $('editForm');
    f.reset();
    $('edGender').innerHTML = MS.options(MS.enumOf('employees.gender'), emp.gender || '', '—');
    PROFILE.forEach((k) => { if (k !== 'gender') f.elements[k].value = emp[k] || ''; });
    formDialog('editDialog', 'editForm', 'editError', 'editSave', 'editCancel', async (d) => {
      if (!d.first_name || !d.last_name) { $('editError').textContent = 'Enter the first and last name.'; return false; }
      const ch = MS.changed(d, emp);
      if (!Object.keys(ch).length) return true;
      await MS.call('EMPLOYEE_UPDATE', Object.assign({ employee_id: emp.employee_id }, ch));
      MS.store.dropRef();
      return true;
    });
  }

  function changeEmployment() {
    const f = $('jobForm');
    f.reset();
    const cur = current(emp);
    const ref = MS.refCache || { positions: [] };
    $('jPosition').innerHTML = MS.options(ref.positions.slice().sort((a, b) => (a.position_title < b.position_title ? -1 : 1))
      .map((p) => ({ value: p.position_id, label: p.position_title })), cur.position_id);
    $('jManager').innerHTML = MS.employeeOptions(cur.reporting_manager_id || '');
    const pay = MS.can('FINANCE_PAYROLL_VIEW');
    $('jSalaryWrap').hidden = !pay;
    if (pay) f.elements.basic_salary.value = cur.basic_salary === undefined ? '' : cur.basic_salary;
    f.elements.effective_date.value = MS.todayISO();
    formDialog('jobDialog', 'jobForm', 'jobError', 'jobSave', 'jobCancel', async (d) => {
      if (!d.change_reason) { $('jobError').textContent = 'Give the reason for the change.'; return false; }
      if (d.reporting_manager_id === emp.employee_id) { $('jobError').textContent = 'An employee cannot report to themselves.'; return false; }
      const p = { employee_id: emp.employee_id, change_reason: d.change_reason, effective_date: d.effective_date };
      if (d.position_id && d.position_id !== cur.position_id) p.position_id = d.position_id;
      if (d.reporting_manager_id !== (cur.reporting_manager_id || '')) p.reporting_manager_id = d.reporting_manager_id;
      if (pay && d.basic_salary !== '' && String(d.basic_salary) !== String(cur.basic_salary)) p.basic_salary = d.basic_salary;
      await MS.call('EMPLOYMENT_UPDATE', p);
      MS.store.dropRef();
      return true;
    });
  }

  function changeStatus() {
    const f = $('statusForm');
    f.reset();
    $('sStatus').innerHTML = MS.options(['ACTIVE', 'SUSPENDED', 'TERMINATED'], emp.employment_status || 'ACTIVE');
    f.elements.effective_date.value = MS.todayISO();
    formDialog('statusDialog', 'statusForm', 'statusError', 'statusSave', 'statusCancel', async (d) => {
      if (!d.reason) { $('statusError').textContent = 'Give a reason.'; return false; }
      if (d.status === 'TERMINATED' && !(await MS.confirm({ title: 'End this employment?', message: 'The employment record of ' + fullName(emp) + ' is marked terminated. History is kept.', confirmText: 'Terminate', danger: true }))) return false;
      await MS.call('EMPLOYMENT_STATUS', { employee_id: emp.employee_id, status: d.status, effective_date: d.effective_date, reason: d.reason });
      return true;
    });
  }

  function sendNotice() {
    const f = $('noticeForm');
    f.reset();
    $('noticeTitle').textContent = 'Employment notice · ' + fullName(emp);
    $('nType').innerHTML = MS.options(MS.enumOf('employment_action_requests.action_type'), 'SUSPENSION');
    f.elements.effective_date.value = MS.todayISO();
    formDialog('noticeDialog', 'noticeForm', 'noticeError', 'noticeSave', 'noticeCancel', async (d) => {
      if (!d.effective_date) { $('noticeError').textContent = 'Enter the effective date.'; return false; }
      if (!d.reason) { $('noticeError').textContent = 'Give the reason.'; return false; }
      await MS.call('EMPLOYMENT_ACTION_CREATE', Object.assign(d, { employee_id: emp.employee_id }));
      MS.setMsg('dStatus', 'Notice sent to the System Administrator.', 'ok');
      return 'keep';
    });
  }

  function createLogin() {
    const f = $('loginForm');
    f.reset();
    $('loginTitle').textContent = 'Create login for ' + emp.first_name;
    f.elements.username.value = (emp.first_name + '.' + emp.last_name).toLowerCase().replace(/[^a-z0-9.]/g, '');
    const cur = current(emp);
    const pos = ((MS.refCache && MS.refCache.positions) || []).find((p) => p.position_id === cur.position_id);
    const roles = (MS.refCache && MS.refCache.roles) || [];
    $('loginRoles').innerHTML = roles.length ? roles.map((r) => `<label class="check"><input type="checkbox" value="${esc(r.role_code)}"> ${esc(r.role_name)}</label>`).join('') : '<span class="hint">No roles available.</span>';
    formDialog('loginDialog', 'loginForm', 'loginError', 'loginSave', 'loginCancel', async () => {
      const username = f.elements.username.value.trim().toLowerCase();
      const email = f.elements.email.value.trim();
      if (!username || !email) { $('loginError').textContent = 'Enter the username and email.'; return false; }
      const role_codes = Array.from($('loginRoles').querySelectorAll('input:checked')).map((i) => i.value);
      const r = await MS.call('USER_CREATE', { employee_id: emp.employee_id, username, email, role_codes });
      $('loginDialog').close();
      await MS.showPassword('Login created', r.temporary_password, emp.first_name, r.email_sent && r.email);
      load();
      return 'keep';
    });
  }

  async function load() {
    MS.setMsg('dStatus', 'Loading…');
    try {
      const e = await MS.call('EMPLOYEE_GET', { employee_id: id });
      MS.setMsg('dStatus', '');
      render(e);
    } catch (err) {
      MS.setMsg('dStatus', err.message, 'error');
      $('dBody').innerHTML = '<p><a class="lnk" href="people/employees.html">Back to employees</a></p>';
    }
  }

  MS.boot({ page: 'employees', ref: true }).then(() => {
    if (!id) { location.replace('people/employees.html'); return; }
    load();
  });
})();
