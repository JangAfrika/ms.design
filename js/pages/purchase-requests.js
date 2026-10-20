/* Purchase requests: ask for stock or services to be bought, approve within the limit (not your own), hand over to
   Procurement for the purchase order; reject or cancel with a reason. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const sc = MS.sc;
  const state = { page: 1, q: '', status: '', tab: 'all' };
  let ref = null;
  let jobs = null;
  const STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'ORDERED', 'REJECTED', 'CANCELLED'];

  MS.reload = () => load();
  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    const p = { page: state.page, page_size: 50, search: state.q, filters: { status: state.status } };
    if (state.tab === 'approve') p.to_approve = true;
    if (state.tab === 'order') p.to_order = true;
    if (state.tab === 'mine') p.mine = true;
    try {
      const r = await MS.recall('PURCHASE_REQUEST_LIST', p);
      MS.setMsg('listMsg', r.total + ' request' + (r.total === 1 ? '' : 's'));
      $('listBody').innerHTML = r.rows.length ? r.rows.map((x) => `
        <tr class="clk${['REJECTED', 'CANCELLED'].indexOf(x.status) >= 0 ? ' void' : ''}" data-id="${esc(x.purchase_request_id)}">
          <td><b><a class="lnk" href="#" data-id="${esc(x.purchase_request_id)}">${esc(x.pr_number)}</a></b>${x.is_emergency === true ? ' <span class="pill failed">Emergency</span>' : ''}</td>
          <td>${esc(MS.shortDate(x.created_at))}</td>
          <td class="wrap">${esc(x.summary)}${x.job_number ? `<div class="sub">job ${esc(x.job_number)}</div>` : ''}</td>
          <td class="wrap">${esc(x.reason)}</td>
          <td>${esc(x.requested_by_name)}<div class="sub">${esc(x.department_name)}</div></td>
          <td class="num">${MS.money(x.estimated_total)}</td>
          <td>${MS.pill(x.status, MS.statusLabel(x.status, 'purchase_requests'))}</td>
        </tr>`).join('') : `<tr><td colspan="7" class="empty">${state.tab === 'approve' ? 'Nothing waiting for your approval.' : state.tab === 'order' ? 'Nothing waiting to be ordered.' : 'No purchase requests here.'}</td></tr>`;
      sc.pager('pager', r, state, load);
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  /* ---------- new request ---------- */
  async function openForm(prefill) {
    const f = $('prForm');
    f.reset();
    $('prError').textContent = '';
    try { ref = await sc.ref(); } catch (err) { $('prError').textContent = err.message; ref = { items: [], expense_accounts: [] }; }
    if (!jobs && MS.can('JOB_VIEW')) { try { jobs = (await MS.call('JOB_LIST', { page_size: 100, open_only: true })).rows; } catch (e) { jobs = []; } }
    const me = ((MS.refCache && MS.refCache.employees) || []).find((e) => e.employee_id === MS.user.employee_id);
    $('pDept').innerHTML = MS.options(((MS.refCache && MS.refCache.departments) || []).map((d) => ({ value: d.department_id, label: d.department_name })), me ? me.department_id : '', '— my department —');
    $('pJob').innerHTML = MS.options((jobs || []).map((j) => ({ value: j.job_id, label: j.job_number + ' – ' + j.job_name })), MS.param('job'), '— not for a job —');
    const priceOf = (id) => { const i = ref.items.find((x) => x.item_id === id); return i && i.average_unit_cost ? i.average_unit_cost : ''; };
    const draw = (rows) => sc.lines($('pLines'), [
      { f: 'item_id', label: 'Stock item', type: 'select', cls: 's', options: (r) => MS.options(ref.items.map((i) => ({ value: i.item_id, label: i.item_name + ' (' + i.item_code + ')' })), r.item_id || '', '— not a stock item —'),
        onPick: (tr, v) => { const p = tr.querySelector('[data-f=estimated_unit_price]'); if (v && !p.value) p.value = priceOf(v); tr.querySelector('[data-f=expense_account_id]').disabled = !!v; } },
      { f: 'description', label: 'Description', type: 'text', cls: 'd', placeholder: 'What exactly (size, colour …)' },
      { f: 'expense_account_id', label: 'Charged to', type: 'select', cls: 's', options: (r) => MS.options(ref.expense_accounts.map((a) => ({ value: a.account_id, label: a.account_code + ' ' + a.account_name })), r.expense_account_id || '', '—') },
      { f: 'quantity', label: 'Quantity', type: 'number', cls: 'q', num: true },
      { f: 'estimated_unit_price', label: 'Price each (estimate)', type: 'number', cls: 'p', num: true }
    ], rows, (all, box) => { box.innerHTML = '<b>Estimate: ' + esc(MS.money(all.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.estimated_unit_price) || 0), 0))) + '</b>'; });
    let editor = draw(prefill || []);
    $('pLow').hidden = !MS.can('INVENTORY_VIEW');
    $('pLow').onclick = async () => {
      try {
        const low = (await MS.call('STOCK_LOW_LIST', { page_size: 100 })).rows.filter((i) => i.suggested_order > 0);
        if (!low.length) { $('prError').textContent = 'Nothing is below its minimum level.'; return; }
        editor = draw(low.map((i) => ({ item_id: i.item_id, quantity: i.suggested_order, estimated_unit_price: i.average_unit_cost || '' })));
        if (!$('pReason').value) $('pReason').value = 'Restock: below the minimum level';
      } catch (err) { $('prError').textContent = err.message; }
    };
    const dlg = MS.openDialog('prDialog');
    $('prCancel').onclick = () => dlg.close();
    const save = async (draft, btn) => {
      const d = MS.formData(f);
      const items = editor.items();
      if (!d.reason) { $('prError').textContent = 'Say why it is needed.'; return; }
      if (!items.length) { $('prError').textContent = 'Add at least one line.'; return; }
      for (let i = 0; i < items.length; i++) {
        const l = items[i];
        if (!(l.quantity > 0)) { $('prError').textContent = 'Line ' + (i + 1) + ': enter the quantity.'; return; }
        if (!l.item_id && (!l.description || !l.expense_account_id)) { $('prError').textContent = 'Line ' + (i + 1) + ': choose the stock item, or describe it and choose the account it is charged to.'; return; }
        if (l.item_id) delete l.expense_account_id;
      }
      MS.busy(btn, true, 'Saving…');
      try {
        const r = await MS.call('PURCHASE_REQUEST_CREATE', { reason: d.reason, department_id: d.department_id, job_id: d.job_id, is_emergency: d.is_emergency, draft, items });
        dlg.close();
        MS.setMsg('listMsg', r.pr_number + (draft ? ' saved as a draft.' : ' sent for approval.'), 'ok');
        load();
        view(r.purchase_request_id);
      } catch (err) { $('prError').textContent = err.message; } finally { MS.busy(btn, false); }
    };
    $('prDraft').onclick = () => save(true, $('prDraft'));
    f.onsubmit = (e) => { e.preventDefault(); save(false, $('prSubmit')); };
  }

  /* ---------- one request ---------- */
  function view(id) {
    return sc.view(() => MS.call('PURCHASE_REQUEST_GET', { purchase_request_id: id }), (x) => {
      const refresh = () => { view(id); load(); };
      const mine = x.requested_by === MS.user.user_id;
      const html = `<h3>Purchase request ${esc(x.pr_number)} ${MS.pill(x.status, MS.statusLabel(x.status, 'purchase_requests'))}${x.is_emergency === true ? ' <span class="pill failed">Emergency</span>' : ''}</h3>
        <div class="dgrid" style="margin-top:8px">
          <div class="dpanel">${MS.kv([['Why', x.reason], ['Department', x.department_name], ['Job', x.job_id ? MS.lnk('jobs/job.html?id=' + encodeURIComponent(x.job_id), x.job_number) : '', true],
            ['Requested by', x.requested_by_name], ['Approved by', x.approved_by_name], ['Supplier chosen', x.selected_supplier_name], ['Supplier note', x.supplier_selection_note || ''],
            ['Rejected / cancelled because', x.status_reason || '']])}</div>
          <div class="dpanel wide"><div class="tablewrap"><table class="inv"><thead><tr><th>What</th><th>Charged to</th><th class="num">Quantity</th><th class="num">Price each</th><th class="num">Estimate</th></tr></thead><tbody>
            ${(x.items || []).map((i) => `<tr><td>${esc(i.description)}${i.is_stock ? ` <span class="sub">${esc(i.item_code)} · ${esc(MS.num(i.available))} free in store</span>` : ''}</td><td>${i.is_stock ? 'Stock' : esc(i.account_label)}</td>
              <td class="num">${esc(MS.num(i.quantity))}${sc.unit(i.unit)}</td><td class="num">${MS.money(i.estimated_unit_price)}</td><td class="num">${MS.money(i.line_total)}</td></tr>`).join('')}
            </tbody><tfoot><tr><td colspan="4">Total estimate</td><td class="num">${MS.money(x.estimated_total)}</td></tr></tfoot></table></div></div>
          ${(x.orders || []).length ? `<div class="dpanel wide"><h3>Purchase orders</h3><ul class="mini-list">${x.orders.map((o) => `<li><span>${MS.lnk('purchasing/purchase-orders.html?id=' + encodeURIComponent(o.purchase_order_id), o.po_number)} · ${esc(o.supplier_name)}</span><span class="n">${MS.money(o.total_amount)} ${MS.pill(o.status)}</span></li>`).join('')}</ul></div>` : ''}
          ${sc.history(x.history)}
        </div>`;
      return {
        html,
        buttons: [
          x.can_cancel && ['vCancel', 'Cancel request', 'danger', () => sc.ask({ title: 'Cancel ' + x.pr_number, label: 'Reason', required: true, danger: true, button: 'Cancel request',
            run: (t) => MS.call('PURCHASE_REQUEST_CANCEL', { purchase_request_id: x.purchase_request_id, reason: t }) }).then((ok) => ok && refresh())],
          x.status === 'DRAFT' && mine && ['vSubmit', 'Send for approval', 'primary', async (btn) => {
            MS.busy(btn, true);
            try { await MS.call('PURCHASE_REQUEST_SUBMIT', { purchase_request_id: x.purchase_request_id }); refresh(); } catch (err) { MS.busy(btn, false); sc.viewError(err.message); }
          }],
          x.can_approve && ['vReject', 'Reject', 'danger', () => sc.ask({ title: 'Reject ' + x.pr_number, label: 'Reason', required: true, danger: true, button: 'Reject',
            run: (t) => MS.call('PURCHASE_REQUEST_REJECT', { purchase_request_id: x.purchase_request_id, reason: t }) }).then((ok) => ok && refresh())],
          x.can_approve && ['vApprove', 'Approve', 'primary', () => sc.ask({ title: 'Approve ' + x.pr_number, info: MS.money(x.estimated_total) + ' requested by ' + x.requested_by_name + '. Procurement will then order it.',
            label: 'Comment (optional)', button: 'Approve',
            run: (t) => MS.call('PURCHASE_REQUEST_APPROVE', { purchase_request_id: x.purchase_request_id, comment: t }) }).then((ok) => ok && refresh())],
          x.can_order && ['vOrder', 'Make purchase order', 'primary', () => { location.href = 'purchasing/purchase-orders.html?pr=' + encodeURIComponent(x.purchase_request_id); }]
        ]
      };
    });
  }

  MS.boot({ page: 'purchase-requests', any: ['PURCHASE_REQUEST', 'PURCHASE_APPROVE'], ref: true }).then(() => {
    $('statusFilter').innerHTML = MS.options(STATUSES.map((s) => ({ value: s, label: MS.statusLabel(s, 'purchase_requests') })), '', 'Any status');
    $('newBtn').hidden = !MS.can('PURCHASE_REQUEST');
    $('tabApprove').hidden = !MS.can('PURCHASE_APPROVE');
    $('tabOrder').hidden = !MS.can('PO_CREATE');
    $('tabMine').hidden = !MS.can('PURCHASE_REQUEST');
    $('newBtn').addEventListener('click', () => openForm());
    sc.tabs('tabs', state, load);
    $('search').addEventListener('input', MS.debounce(() => { state.q = $('search').value.trim(); state.page = 1; load(); }, 300));
    $('statusFilter').addEventListener('change', () => { state.status = $('statusFilter').value; state.page = 1; load(); });
    $('reloadBtn').addEventListener('click', load);
    $('listBody').addEventListener('click', (e) => {
      const el = e.target.closest('[data-id]');
      if (!el) return;
      e.preventDefault();
      view(el.dataset.id);
    });
    const tab = MS.param('tab');
    if (tab && $('tabs').querySelector(`[data-tab="${tab}"]:not([hidden])`)) sc.setTab('tabs', tab, state);
    else if (MS.can('PO_CREATE')) sc.setTab('tabs', 'order', state);
    else if (MS.can('PURCHASE_APPROVE') && !MS.can('PURCHASE_REQUEST')) sc.setTab('tabs', 'approve', state);
    load();
    if (MS.param('new') && MS.can('PURCHASE_REQUEST')) {
      const item = MS.param('item');
      openForm(item ? [{ item_id: item, quantity: Number(MS.param('qty')) || '' }] : []).then(() => { if (MS.param('low')) $('pLow').click(); });
    }
    if (MS.param('id')) view(MS.param('id'));
  });
})();
