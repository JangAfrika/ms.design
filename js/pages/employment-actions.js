(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const state = { page: 1, q: '', status: '' };
  let rows = [];

  const canProcess = (r) => MS.can('USER_DEACTIVATE') && ['SUBMITTED', 'UNDER_REVIEW'].indexOf(r.status) >= 0 && r.requested_by !== MS.user.user_id;

  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    try {
      const r = await MS.call('EMPLOYMENT_ACTION_LIST', { page: state.page, page_size: 50, search: state.q, filters: { status: state.status }, sort: 'created_at', dir: 'desc' });
      rows = r.rows;
      MS.setMsg('listMsg', MS.count(r.total, 'notice'));
      $('listBody').innerHTML = rows.length ? rows.map((x, i) => `<tr>
          <td><b>${MS.can('EMPLOYEE_VIEW') ? MS.lnk('people/employee.html?id=' + encodeURIComponent(x.employee_id), x.employee_name || 'Employee') : esc(x.employee_name)}</b></td>
          <td>${esc(MS.label(x.action_type))}</td>
          <td>${esc(MS.shortDate(x.effective_date))}</td>
          <td>${esc(x.requested_by_name || '')}<span class="sub">${esc(MS.shortDate(x.created_at))}</span></td>
          <td class="wrap reason">${esc(x.reason || '')}</td>
          <td>${MS.pill(x.status)}</td>
          <td class="wrap">${esc(x.action_taken || '')}</td>
          <td>${canProcess(x) ? `<div class="acts"><button type="button" class="pay" data-apply="${i}">Apply</button><button type="button" data-reject="${i}">Reject</button></div>` : ''}</td>
        </tr>`).join('') : `<tr><td colspan="8" class="empty">${state.q || state.status ? 'No notice matches.' : 'No employment notices yet.'}</td></tr>`;
      MS.pager('pager', r, state, load);
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  async function process(r, decision) {
    const apply = decision === 'ACTION';
    const note = await MS.askReason(apply
      ? { title: 'Apply ' + MS.label(r.action_type).toLowerCase(), message: 'This changes ' + r.employee_name + '’s account and employment record now.', confirmText: 'Apply', label: 'Note' }
      : { title: 'Reject notice', message: 'Why is it not being applied?', confirmText: 'Reject', danger: true });
    if (note === null) return;
    MS.setMsg('listMsg', 'Saving…');
    try {
      await MS.call('EMPLOYMENT_ACTION_PROCESS', { request_id: r.request_id, decision, note });
      load();
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  function add() {
    const f = $('noticeForm');
    f.reset();
    const ref = MS.refCache || { employees: [] };
    $('nEmployee').innerHTML = MS.options(ref.employees.filter((e) => e.employee_id !== MS.user.employee_id)
      .map((e) => ({ value: e.employee_id, label: e.name + ' (' + e.employee_number + ')' })), MS.param('employee'), '— choose —');
    $('nType').innerHTML = MS.options(MS.enumOf('employment_action_requests.action_type'), 'SUSPENSION');
    f.elements.effective_date.value = MS.todayISO();
    $('noticeError').textContent = '';
    const dlg = MS.openDialog('noticeDialog');
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      const d = MS.formData(f);
      if (!d.employee_id) { $('noticeError').textContent = 'Choose the employee.'; return; }
      if (!d.effective_date) { $('noticeError').textContent = 'Enter the effective date.'; return; }
      if (!d.reason) { $('noticeError').textContent = 'Give the reason.'; return; }
      MS.busy($('noticeSave'), true, 'Sending…');
      try { await MS.call('EMPLOYMENT_ACTION_CREATE', d); dlg.close(); state.page = 1; load(); } catch (err) { $('noticeError').textContent = err.message; } finally { MS.busy($('noticeSave'), false); }
    };
    $('noticeCancel').onclick = () => dlg.close();
  }

  MS.boot({ page: 'employment-actions', any: ['EMPLOYMENT_ACTION_REQUEST', 'USER_DEACTIVATE'], ref: true }).then(() => {
    $('intro').textContent = MS.can('USER_DEACTIVATE')
      ? 'Notices from the CEO. Apply one to change the person’s login account and employment record, or reject it with a reason. You cannot process a notice you raised.'
      : 'Notices you send reach the System Administrator, who applies the account change. You can follow them here.';
    $('statusFilter').innerHTML = MS.options(['SUBMITTED', 'UNDER_REVIEW', 'ACTIONED', 'REJECTED', 'CANCELLED'].map((s) => ({ value: s, label: MS.statusLabel(s) })), '', 'Any status');
    $('addBtn').hidden = !MS.can('EMPLOYMENT_ACTION_REQUEST');
    $('addBtn').addEventListener('click', add);
    $('search').addEventListener('input', MS.debounce(() => { state.q = $('search').value.trim(); state.page = 1; load(); }, 300));
    $('statusFilter').addEventListener('change', () => { state.status = $('statusFilter').value; state.page = 1; load(); });
    $('reloadBtn').addEventListener('click', load);
    $('listBody').addEventListener('click', (e) => {
      const a = e.target.closest('[data-apply]'), j = e.target.closest('[data-reject]');
      if (a) process(rows[Number(a.dataset.apply)], 'ACTION');
      if (j) process(rows[Number(j.dataset.reject)], 'REJECT');
    });
    load();
    if (MS.param('add') && MS.can('EMPLOYMENT_ACTION_REQUEST')) add();
  });
})();
