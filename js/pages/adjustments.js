/* Stock adjustments: the store reports damage, expiry, loss or found stock; a manager (not the requester, within the
   stock adjustment limit) approves it, which moves the stock and posts the loss or gain. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const sc = MS.sc;
  const state = { page: 1, q: '', status: '', tab: 'all' };
  let items = null;

  MS.reload = () => load();
  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    const p = { page: state.page, page_size: 50, search: state.q, filters: { status: state.status } };
    if (state.tab === 'approve') p.to_approve = true;
    if (state.tab === 'mine') p.mine = true;
    try {
      const r = await MS.recall('STOCK_ADJUSTMENT_LIST', p);
      const cost = r.rows.some((a) => a.value_change !== undefined);
      $('valHead').hidden = !cost;
      MS.setMsg('listMsg', r.total + ' adjustment' + (r.total === 1 ? '' : 's'));
      $('listBody').innerHTML = r.rows.length ? r.rows.map((a) => `
        <tr class="clk${a.status === 'REJECTED' ? ' void' : ''}" data-id="${esc(a.adjustment_id)}">
          <td><a class="lnk" href="#" data-id="${esc(a.adjustment_id)}">${esc(MS.shortDate(a.created_at))}</a></td>
          <td><b>${esc(a.item_name)}</b> <span class="sub">${esc(a.item_code)}</span></td>
          <td>${esc(MS.label(a.adjustment_type))}</td>
          <td class="num">${a.quantity_change > 0 ? '+' : ''}${esc(MS.num(a.quantity_change))}${sc.unit(a.unit)}</td>
          ${cost ? `<td class="num">${MS.money(a.value_change)}</td>` : ''}
          <td class="wrap">${esc(a.reason)}</td>
          <td>${esc(a.requested_by_name)}</td>
          <td>${MS.pill(a.status, MS.statusLabel(a.status, 'stock_adjustments'))}</td>
        </tr>`).join('') : `<tr><td colspan="8" class="empty">${state.tab === 'approve' ? 'Nothing waiting for your approval.' : 'No adjustments here.'}</td></tr>`;
      sc.pager('pager', r, state, load);
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  async function openForm() {
    const f = $('adjForm');
    f.reset();
    $('adjError').textContent = '';
    try { if (!items) items = (await sc.ref()).items; } catch (err) { $('adjError').textContent = err.message; items = []; }
    $('aItem').innerHTML = MS.options(items.map((i) => ({ value: i.item_id, label: i.item_name + ' (' + i.item_code + ') · ' + MS.num(i.available) + ' free' })), MS.param('item'), '— choose —');
    $('aType').innerHTML = MS.options(MS.enumOf('stock_adjustments.adjustment_type').filter((t) => t !== 'COUNT_VARIANCE'), 'DAMAGE');
    const dlg = MS.openDialog('adjDialog');
    $('adjCancel').onclick = () => dlg.close();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = MS.formData(f);
      if (!d.item_id || !(d.quantity > 0) || !d.reason) { $('adjError').textContent = 'Choose the item, enter the quantity and say what happened.'; return; }
      const payload = { item_id: d.item_id, adjustment_type: d.adjustment_type, quantity_change: Number($('aDir').value) * d.quantity, reason: d.reason };
      if (d.unit_cost !== '') payload.unit_cost = d.unit_cost;
      MS.busy($('adjSave'), true, 'Sending…');
      try { await MS.call('STOCK_ADJUSTMENT_REQUEST', payload); dlg.close(); MS.setMsg('listMsg', 'Sent for approval.', 'ok'); load(); }
      catch (err) { $('adjError').textContent = err.message; } finally { MS.busy($('adjSave'), false); }
    };
  }

  function view(id) {
    return sc.view(() => MS.call('STOCK_ADJUSTMENT_GET', { adjustment_id: id }), (a) => {
      const refresh = () => { view(id); load(); };
      const html = `<h3>${esc(MS.label(a.adjustment_type))} · ${esc(a.item_name)} ${MS.pill(a.status, MS.statusLabel(a.status, 'stock_adjustments'))}</h3>
        <div class="dgrid" style="margin-top:8px">
          <div class="dpanel">${MS.kv([['Item', MS.lnk('stores/items.html?id=' + encodeURIComponent(a.item_id), a.item_name + ' (' + a.item_code + ')'), true],
            ['Change', (a.quantity_change > 0 ? '+' : '') + MS.num(a.quantity_change) + ' ' + MS.label(a.unit).toLowerCase()], ['Value', a.value_change === undefined ? '' : MS.money(a.value_change)],
            ['On hand now', MS.num(a.on_hand)], ['Reason', a.reason], ['Requested by', a.requested_by_name], ['Decided by', a.approved_by_name],
            ['From the count', a.from_count ? MS.lnk('stores/stock-counts.html?id=' + encodeURIComponent(a.stock_count_id), 'Open the count') : '', true]])}</div>
          ${(a.movements || []).length ? `<div class="dpanel wide"><h3>Stock movement</h3>${sc.movements(a.movements)}</div>` : ''}
          ${sc.history(a.history)}
          ${sc.journals(a.journal_entries)}
        </div>`;
      return {
        html,
        buttons: [
          a.can_approve && ['vReject', 'Reject', 'danger', () => sc.ask({ title: 'Reject the adjustment', label: 'Reason', required: true, danger: true, button: 'Reject',
            run: (t) => MS.call('STOCK_ADJUSTMENT_REJECT', { adjustment_id: a.adjustment_id, reason: t }) }).then((ok) => ok && refresh())],
          a.can_approve && ['vApprove', 'Approve', 'primary', () => sc.ask({ title: 'Approve the adjustment',
            info: 'The stock of ' + a.item_name + ' changes by ' + MS.num(a.quantity_change) + (a.value_change !== undefined ? ' and ' + MS.money(Math.abs(a.value_change)) + ' is posted as a ' + (a.quantity_change < 0 ? 'loss' : 'gain') : '') + '.',
            label: 'Comment (optional)', button: 'Approve',
            run: (t) => MS.call('STOCK_ADJUSTMENT_APPROVE', { adjustment_id: a.adjustment_id, comment: t }) }).then((ok) => ok && refresh())]
        ]
      };
    });
  }

  MS.boot({ page: 'adjustments', any: ['INVENTORY_ADJUST', 'INVENTORY_ADJUST_APPROVE'], ref: true }).then(() => {
    $('statusFilter').innerHTML = MS.options(['REQUESTED', 'POSTED', 'REJECTED'].map((s) => ({ value: s, label: MS.statusLabel(s, 'stock_adjustments') })), '', 'Any status');
    $('newBtn').hidden = !MS.can('INVENTORY_ADJUST');
    $('tabApprove').hidden = !MS.can('INVENTORY_ADJUST_APPROVE');
    $('tabMine').hidden = !MS.can('INVENTORY_ADJUST');
    $('newBtn').addEventListener('click', openForm);
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
    if (MS.can('INVENTORY_ADJUST_APPROVE') && !MS.can('INVENTORY_ADJUST')) sc.setTab('tabs', 'approve', state);
    load();
    if (MS.param('new') && MS.can('INVENTORY_ADJUST')) openForm();
    if (MS.param('id')) view(MS.param('id'));
  });
})();
