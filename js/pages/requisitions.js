/* Requisitions & issues: ask the store for material (for a job or a department), approve (not your own),
   issue against the approved quantities (charged to the job), take unused material back. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const sc = MS.sc;
  const state = { page: 1, q: '', status: '', tab: 'all' };
  let items = null;
  let jobs = null;
  const STATUSES = ['SUBMITTED', 'APPROVED', 'PARTIALLY_ISSUED', 'ISSUED', 'REJECTED', 'CANCELLED'];

  MS.reload = () => load();
  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    const p = { page: state.page, page_size: 50, search: state.q, filters: { status: state.status } };
    if (state.tab === 'approve') p.to_approve = true;
    if (state.tab === 'issue') p.to_issue = true;
    if (state.tab === 'mine') p.mine = true;
    if (MS.param('job')) p.job_id = MS.param('job');
    try {
      const r = await MS.recall('REQUISITION_LIST', p);
      MS.setMsg('listMsg', r.total + ' requisition' + (r.total === 1 ? '' : 's'));
      $('listBody').innerHTML = r.rows.length ? r.rows.map((x) => `
        <tr class="clk${['REJECTED', 'CANCELLED'].indexOf(x.status) >= 0 ? ' void' : ''}" data-id="${esc(x.requisition_id)}">
          <td><b><a class="lnk" href="#" data-id="${esc(x.requisition_id)}">${esc(x.requisition_number)}</a></b>${x.is_emergency === true ? ' <span class="pill failed">Urgent</span>' : ''}</td>
          <td>${esc(MS.shortDate(x.created_at))}${x.required_by ? `<div class="sub">needed ${esc(MS.shortDate(x.required_by))}</div>` : ''}</td>
          <td>${x.job_id ? MS.lnk('jobs/job.html?id=' + encodeURIComponent(x.job_id), x.job_number) : '<span class="muted">—</span>'}</td>
          <td class="wrap">${esc(x.summary)}</td>
          <td>${esc(x.department_name)}</td>
          <td>${esc(x.requested_by_name)}</td>
          <td>${MS.pill(x.status, MS.statusLabel(x.status, 'stock_requisitions'))}</td>
        </tr>`).join('') : `<tr><td colspan="7" class="empty">${state.tab === 'approve' ? 'Nothing waiting for your approval.' : state.tab === 'issue' ? 'Nothing waiting to be issued.' : 'No requisitions here.'}</td></tr>`;
      sc.pager('pager', r, state, load);
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  async function itemList() {
    if (!items) items = (await sc.ref()).items;
    return items;
  }
  const itemOptions = (sel) => MS.options((items || []).map((i) => ({ value: i.item_id, label: i.item_name + ' (' + i.item_code + ') · ' + MS.num(i.available) + ' free' })), sel || '', '— choose —');

  /* ---------- new requisition ---------- */
  async function openForm() {
    const f = $('reqForm');
    f.reset();
    $('reqError').textContent = '';
    try { await itemList(); } catch (err) { $('reqError').textContent = err.message; }
    if (!jobs && MS.can('JOB_VIEW')) {
      try { jobs = (await MS.call('JOB_LIST', { page_size: 100, open_only: true })).rows; } catch (e) { jobs = []; }
    }
    $('rJob').innerHTML = MS.options((jobs || []).map((j) => ({ value: j.job_id, label: j.job_number + ' – ' + j.job_name })), MS.param('job'), '— not for a job —');
    const me = ((MS.refCache && MS.refCache.employees) || []).find((e) => e.employee_id === MS.user.employee_id);
    $('rDept').innerHTML = MS.options(((MS.refCache && MS.refCache.departments) || []).map((d) => ({ value: d.department_id, label: d.department_name })), me ? me.department_id : '', '— my department —');
    const editor = sc.lines($('rLines'), [
      { f: 'item_id', label: 'Item', type: 'select', cls: 'd', options: (r) => itemOptions(r.item_id) },
      { f: 'quantity_requested', label: 'Quantity', type: 'number', cls: 'q', num: true }
    ], []);
    const dlg = MS.openDialog('reqDialog');
    $('reqCancel').onclick = () => dlg.close();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = MS.formData(f);
      const lines = editor.items();
      for (let i = 0; i < lines.length; i++) {
        if (!lines[i].item_id || !(lines[i].quantity_requested > 0)) { $('reqError').textContent = 'Line ' + (i + 1) + ': choose the item and enter the quantity.'; return; }
      }
      if (!lines.length && !d.job_id) { $('reqError').textContent = 'Add at least one line, or choose the job.'; return; }
      MS.busy($('reqSave'), true, 'Sending…');
      try {
        const r = await MS.call('REQUISITION_CREATE', { job_id: d.job_id, department_id: d.department_id, required_by: d.required_by, is_emergency: d.is_emergency, items: lines });
        dlg.close();
        MS.setMsg('listMsg', r.requisition_number + ' sent for approval.', 'ok');
        load();
        view(r.requisition_id);
      } catch (err) { $('reqError').textContent = err.message; } finally { MS.busy($('reqSave'), false); }
    };
  }

  /* ---------- one requisition ---------- */
  function view(id) {
    return sc.view(() => MS.call('REQUISITION_GET', { requisition_id: id }), (x) => {
      const refresh = () => { view(id); load(); };
      const html = `<h3>Requisition ${esc(x.requisition_number)} ${MS.pill(x.status, MS.statusLabel(x.status, 'stock_requisitions'))}${x.is_emergency === true ? ' <span class="pill failed">Urgent</span>' : ''}</h3>
        <div class="dgrid" style="margin-top:8px">
          <div class="dpanel">${MS.kv([['Job', x.job_id ? MS.lnk('jobs/job.html?id=' + encodeURIComponent(x.job_id), x.job_number + ' – ' + x.job_name) : '', true],
            ['Department', x.department_name], ['Requested by', x.requested_by_name], ['Asked on', MS.when(x.created_at)], ['Needed by', MS.shortDate(x.required_by)],
            ['Approved by', x.approved_by_name], ['Reason', x.status_reason || x.rejection_reason || '']])}</div>
          <div class="dpanel wide"><div class="tablewrap"><table class="inv"><thead><tr><th>Item</th><th class="num">Asked</th><th class="num">Approved</th><th class="num">Issued</th><th class="num">Returned</th><th class="num">Free in store</th></tr></thead><tbody>
            ${(x.items || []).map((i) => `<tr><td>${esc(i.item_name)} <span class="sub">${esc(i.item_code)}</span></td><td class="num">${esc(MS.num(i.quantity_requested))}${sc.unit(i.unit)}</td>
              <td class="num">${i.quantity_approved === '' || i.quantity_approved == null ? '—' : esc(MS.num(i.quantity_approved))}</td><td class="num">${esc(MS.num(i.quantity_issued || 0))}</td>
              <td class="num">${esc(MS.num(i.quantity_returned || 0))}</td><td class="num">${i.outstanding > i.available ? `<span class="late">${esc(MS.num(i.available))}</span>` : esc(MS.num(i.available))}</td></tr>`).join('')}
          </tbody></table></div></div>
          ${(x.movements || []).length ? `<div class="dpanel wide"><h3>Issues and returns</h3>${sc.movements(x.movements, { item: true })}</div>` : ''}
          ${sc.history(x.history)}
          ${sc.journals(x.journal_entries)}
        </div>`;
      const qtyRows = (filter, val, attr, blank) => sc.qtyTable([['Item'], ['Left', 1], ['Quantity', 1]], (x.items || []).filter(filter), (i) =>
        `<tr><td>${esc(i.item_name)}</td><td class="num">${esc(MS.num(val(i)))}${sc.unit(i.unit)}</td><td class="q"><input type="number" min="0" step="any" ${attr}="${esc(i.requisition_item_id)}" value="${blank ? '' : esc(val(i))}" aria-label="Quantity"></td></tr>`);
      return {
        html,
        buttons: [
          x.can_cancel && ['vCancel', 'Cancel requisition', 'danger', () => sc.ask({ title: 'Cancel ' + x.requisition_number, label: 'Reason', required: true, danger: true, button: 'Cancel requisition',
            run: (t) => MS.call('REQUISITION_CANCEL', { requisition_id: x.requisition_id, reason: t }) }).then((ok) => ok && refresh())],
          x.can_approve && ['vReject', 'Reject', 'danger', () => sc.ask({ title: 'Reject ' + x.requisition_number, label: 'Reason', required: true, danger: true, button: 'Reject',
            run: (t) => MS.call('REQUISITION_REJECT', { requisition_id: x.requisition_id, reason: t }) }).then((ok) => ok && refresh())],
          x.can_approve && ['vApprove', 'Approve', 'primary', () => sc.ask({ title: 'Approve ' + x.requisition_number, info: 'You can approve less than was asked for.',
            extra: sc.qtyTable([['Item'], ['Asked', 1], ['Approve', 1]], x.items, (i) => `<tr><td>${esc(i.item_name)}</td><td class="num">${esc(MS.num(i.quantity_requested))}${sc.unit(i.unit)}</td><td class="q"><input type="number" min="0" step="any" data-appr="${esc(i.requisition_item_id)}" value="${esc(i.quantity_requested)}" aria-label="Quantity approved"></td></tr>`),
            label: 'Comment (optional)', button: 'Approve',
            run: (t) => MS.call('REQUISITION_APPROVE', { requisition_id: x.requisition_id, comment: t, items: sc.qtyValues('data-appr').map((v) => ({ requisition_item_id: v.id, quantity_approved: v.value })) }) }).then((ok) => ok && refresh())],
          x.can_return && ['vReturn', 'Take back unused', '', () => sc.ask({ title: 'Return to store · ' + x.requisition_number, info: 'Unused material comes back into stock and off the job\'s cost.',
            extra: qtyRows((i) => i.returnable > 0, (i) => i.returnable, 'data-ret', true),
            label: 'Why is it coming back?', required: true, button: 'Take into stock',
            run: (t) => MS.call('REQUISITION_RETURN', { requisition_id: x.requisition_id, reason: t, lines: sc.qtyValues('data-ret').filter((v) => v.value > 0).map((v) => ({ requisition_item_id: v.id, quantity: v.value })) }) }).then((ok) => ok && refresh())],
          x.can_issue && ['vIssue', 'Issue stock', 'primary', () => sc.ask({ title: 'Issue · ' + x.requisition_number, info: x.job_id ? 'The material is charged to job ' + x.job_number + '.' : 'The material is charged to ' + x.department_name + '.',
            extra: qtyRows((i) => i.outstanding > 0, (i) => i.outstanding, 'data-iss') + `<label>Handed to <select id="issTo">${MS.employeeOptions('', '— the person who asked —')}</select></label>`,
            label: 'Note', noText: true, button: 'Issue',
            run: () => MS.call('REQUISITION_ISSUE', { requisition_id: x.requisition_id, responsible_person_id: $('issTo').value, lines: sc.qtyValues('data-iss').filter((v) => v.value > 0).map((v) => ({ requisition_item_id: v.id, quantity: v.value })) }) }).then((ok) => ok && refresh())]
        ]
      };
    });
  }

  MS.boot({ page: 'requisitions', any: ['REQUISITION_CREATE', 'REQUISITION_APPROVE', 'INVENTORY_ISSUE'], ref: true }).then(() => {
    $('statusFilter').innerHTML = MS.options(STATUSES.map((s) => ({ value: s, label: MS.statusLabel(s, 'stock_requisitions') })), '', 'Any status');
    $('newBtn').hidden = !MS.can('REQUISITION_CREATE');
    $('tabApprove').hidden = !MS.can('REQUISITION_APPROVE');
    $('tabIssue').hidden = !MS.can('INVENTORY_ISSUE');
    $('tabMine').hidden = !MS.can('REQUISITION_CREATE');
    $('newBtn').addEventListener('click', openForm);
    sc.tabs('tabs', state, load);
    $('search').addEventListener('input', MS.debounce(() => { state.q = $('search').value.trim(); state.page = 1; load(); }, 300));
    $('statusFilter').addEventListener('change', () => { state.status = $('statusFilter').value; state.page = 1; load(); });
    $('reloadBtn').addEventListener('click', load);
    $('listBody').addEventListener('click', (e) => {
      if (e.target.closest('a[href]:not([data-id])')) return;
      const el = e.target.closest('[data-id]');
      if (!el) return;
      e.preventDefault();
      view(el.dataset.id);
    });
    const tab = MS.param('tab');
    if (tab && $('tabs').querySelector(`[data-tab="${tab}"]:not([hidden])`)) sc.setTab('tabs', tab, state);
    else if (MS.can('INVENTORY_ISSUE')) sc.setTab('tabs', 'issue', state);
    else if (MS.can('REQUISITION_APPROVE')) sc.setTab('tabs', 'approve', state);
    load();
    if (MS.param('new') && MS.can('REQUISITION_CREATE')) openForm();
    if (MS.param('id')) view(MS.param('id'));
  });
})();
