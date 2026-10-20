/* Employees: search, filter, page through; add an employee; each row opens the employee page. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const state = { page: 1, q: '', status: '' };

  MS.reload = () => load();
  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    try {
      const r = await MS.recall('EMPLOYEE_LIST', { page: state.page, page_size: 50, search: state.q, filters: { status: state.status }, sort: 'last_name', dir: 'asc' });
      MS.setMsg('listMsg', MS.count(r.total, 'employee'));
      $('listBody').innerHTML = r.rows.length ? r.rows.map((e) => {
        const href = 'people/employee.html?id=' + encodeURIComponent(e.employee_id);
        return `<tr class="clk" data-href="${href}">
          <td>${esc(e.employee_number)}</td>
          <td><b>${MS.lnk(href, e.first_name + ' ' + e.last_name)}</b>${e.phone ? `<span class="sub">${esc(e.phone)}</span>` : ''}</td>
          <td>${esc(e.position_title || '')}</td>
          <td>${esc(e.department_name || '')}</td>
          <td>${MS.pill(e.employment_status || e.status)}</td>
          <td>${e.account_status === 'NO_ACCOUNT' ? '<span class="pill off">No login</span>' : MS.pill(e.account_status)}</td>
        </tr>`;
      }).join('') : `<tr><td colspan="6" class="empty">${state.q ? 'No employee matches.' : 'No employees yet.'}</td></tr>`;
      MS.pager('pager', r, state, load);
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  function add() {
    const f = $('empForm');
    f.reset();
    const ref = MS.refCache || { positions: [] };
    $('eGender').innerHTML = MS.options(MS.enumOf('employees.gender'), '', '—');
    $('ePosition').innerHTML = MS.options(ref.positions.slice().sort((a, b) => (a.position_title < b.position_title ? -1 : 1))
      .map((p) => ({ value: p.position_id, label: p.position_title })), '', '— choose —');
    $('eManager').innerHTML = MS.employeeOptions('');
    $('eType').innerHTML = MS.options(MS.enumOf('employment_history.employment_type'), 'PERMANENT');
    f.elements.start_date.value = MS.todayISO();
    const pay = MS.can('FINANCE_PAYROLL_VIEW');
    $('eSalaryWrap').hidden = !pay;
    $('empError').textContent = '';
    const dlg = MS.openDialog('empDialog');
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      const d = MS.formData(f);
      if (!pay || d.basic_salary === '') delete d.basic_salary;
      Object.keys(d).forEach((k) => { if (d[k] === '') delete d[k]; });
      if (!d.first_name || !d.last_name) { $('empError').textContent = 'Enter the first and last name.'; return; }
      if (!d.position_id) { $('empError').textContent = 'Choose the position.'; return; }
      if (!d.start_date) { $('empError').textContent = 'Enter the start date.'; return; }
      MS.busy($('empSave'), true, 'Saving…');
      try {
        const e = await MS.call('EMPLOYEE_CREATE', d);
        MS.store.dropRef();
        try { await MS.ref(true); } catch (x) { /* the list still works */ }
        dlg.close();
        location.href = 'people/employee.html?id=' + encodeURIComponent(e.employee_id);
      } catch (err) { $('empError').textContent = err.message; } finally { MS.busy($('empSave'), false); }
    };
    $('empCancel').onclick = () => dlg.close();
  }

  MS.boot({ page: 'employees', any: ['EMPLOYEE_VIEW'], ref: true }).then(() => {
    $('statusFilter').innerHTML = MS.options(['ACTIVE', 'INACTIVE'], '', 'Any status');
    $('addBtn').hidden = !MS.can('EMPLOYMENT_EDIT');
    $('addBtn').addEventListener('click', add);
    $('search').addEventListener('input', MS.debounce(() => { state.q = $('search').value.trim(); state.page = 1; load(); }, 300));
    $('statusFilter').addEventListener('change', () => { state.status = $('statusFilter').value; state.page = 1; load(); });
    $('reloadBtn').addEventListener('click', load);
    MS.clickable($('listBody'));
    load();
    if (MS.param('add') && MS.can('EMPLOYMENT_EDIT')) add();
  });
})();
