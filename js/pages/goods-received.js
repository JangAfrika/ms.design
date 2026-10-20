/* Goods received: Stores records what arrived on a purchase order (accepted / rejected with a reason); a second person
   checks the note, which puts the accepted goods into stock at the order price and posts them as received, not billed. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const sc = MS.sc;
  const state = { page: 1, q: '', status: '', tab: 'all' };

  MS.reload = () => load();
  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    const p = { page: state.page, page_size: 50, search: state.q, filters: { status: state.status } };
    if (state.tab === 'verify') p.to_verify = true;
    try {
      const r = await MS.recall('GOODS_RECEIPT_LIST', p);
      MS.setMsg('listMsg', r.total + ' note' + (r.total === 1 ? '' : 's'));
      $('listBody').innerHTML = r.rows.length ? r.rows.map((g) => `
        <tr class="clk${g.status === 'DISPUTED' ? ' void' : ''}" data-id="${esc(g.goods_receipt_id)}">
          <td><b><a class="lnk" href="#" data-id="${esc(g.goods_receipt_id)}">${esc(g.grn_number)}</a></b></td>
          <td>${esc(MS.when(g.received_at))}</td>
          <td>${MS.lnk('purchasing/purchase-orders.html?id=' + encodeURIComponent(g.purchase_order_id), g.po_number)}</td>
          <td>${esc(g.supplier_name)}</td>
          <td class="wrap">${esc(g.summary)}${g.rejected_lines ? ` <span class="pill pending">${esc(g.rejected_lines)} with rejects</span>` : ''}</td>
          <td>${esc(g.received_by_name)}</td>
          <td>${MS.pill(g.status, g.status === 'RECEIVED' ? 'To check' : MS.statusLabel(g.status, 'goods_receipts'))}</td>
        </tr>`).join('') : `<tr><td colspan="7" class="empty">${state.tab === 'verify' ? 'Nothing waiting for you to check.' : 'No goods received yet.'}</td></tr>`;
      sc.pager('pager', r, state, load);
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  /* ---------- record a delivery ---------- */
  async function openForm(poId) {
    const f = $('grnForm');
    f.reset();
    $('grnError').textContent = '';
    $('gLines').innerHTML = '';
    let open = [];
    try { open = (await MS.call('PURCHASE_ORDER_LIST', { open_only: true, page_size: 100 })).rows; } catch (err) { $('grnError').textContent = err.message; }
    $('gPo').innerHTML = MS.options(open.map((po) => ({ value: po.purchase_order_id, label: po.po_number + ' · ' + po.supplier_name + (po.expected_date ? ' · expected ' + MS.shortDate(po.expected_date) : '') })), poId || '', open.length ? '— choose —' : '— no open orders —');
    const drawLines = async () => {
      $('gLines').innerHTML = '';
      if (!$('gPo').value) return;
      try {
        const po = await MS.call('PURCHASE_ORDER_GET', { purchase_order_id: $('gPo').value });
        const lines = (po.items || []).filter((i) => i.outstanding > 0);
        $('gLines').innerHTML = lines.length ? sc.qtyTable([['What'], ['Still to come', 1], ['Arrived', 1], ['Rejected', 1], ['Why rejected']], lines, (i) => `<tr data-po="${esc(i.po_item_id)}">
          <td>${esc(i.description)}</td><td class="num">${esc(MS.num(i.outstanding))}${sc.unit(i.unit)}</td>
          <td class="q"><input data-f="r" type="number" min="0" step="any" value="${esc(i.outstanding)}" aria-label="Arrived"></td>
          <td class="q"><input data-f="x" type="number" min="0" step="any" value="" aria-label="Rejected"></td>
          <td class="d"><input data-f="why" type="text" maxlength="300" placeholder="Damaged, wrong size …" aria-label="Why rejected"></td></tr>`)
          : '<p class="fin-note">Everything on this order has been received (or is waiting to be checked).</p>';
      } catch (err) { $('grnError').textContent = err.message; }
    };
    $('gPo').onchange = drawLines;
    await drawLines();
    const dlg = MS.openDialog('grnDialog');
    $('grnCancel').onclick = () => dlg.close();
    f.onsubmit = async (e) => {
      e.preventDefault();
      if (!$('gPo').value) { $('grnError').textContent = 'Choose the purchase order.'; return; }
      const lines = Array.from($('gLines').querySelectorAll('tr[data-po]')).map((tr) => {
        const g = (k) => tr.querySelector('[data-f=' + k + ']').value.trim();
        return { po_item_id: tr.dataset.po, quantity_received: Number(g('r') || 0), quantity_rejected: Number(g('x') || 0), rejection_reason: g('why') };
      }).filter((l) => l.quantity_received > 0);
      if (!lines.length) { $('grnError').textContent = 'Enter what arrived on at least one line.'; return; }
      const bad = lines.find((l) => l.quantity_rejected > 0 && !l.rejection_reason);
      if (bad) { $('grnError').textContent = 'Say why goods were rejected.'; return; }
      MS.busy($('grnSave'), true, 'Saving…');
      try {
        const g = await MS.call('GOODS_RECEIPT_CREATE', { purchase_order_id: $('gPo').value, lines });
        dlg.close();
        MS.setMsg('listMsg', g.grn_number + ' saved. Ask someone else to check it.', 'ok');
        load();
        view(g.goods_receipt_id);
      } catch (err) { $('grnError').textContent = err.message; } finally { MS.busy($('grnSave'), false); }
    };
  }

  /* ---------- one note ---------- */
  function view(id) {
    return sc.view(() => MS.call('GOODS_RECEIPT_GET', { goods_receipt_id: id }), (g) => {
      const refresh = () => { view(id); load(); };
      const cost = (g.items || []).some((i) => i.unit_price !== undefined);
      const html = `<h3>Goods received ${esc(g.grn_number)} ${MS.pill(g.status, g.status === 'RECEIVED' ? 'To check' : MS.statusLabel(g.status, 'goods_receipts'))}</h3>
        <div class="dgrid" style="margin-top:8px">
          <div class="dpanel">${MS.kv([['Order', MS.lnk('purchasing/purchase-orders.html?id=' + encodeURIComponent(g.purchase_order_id), g.po_number), true], ['Supplier', g.supplier_name],
            ['Received', MS.when(g.received_at)], ['Received by', g.received_by_name], ['Checked by', g.verified_by_name], ['Checked', MS.when(g.verified_at)]])}</div>
          <div class="dpanel wide"><div class="tablewrap"><table class="inv"><thead><tr><th>What</th><th class="num">Ordered</th><th class="num">Arrived</th><th class="num">Accepted</th><th class="num">Rejected</th><th>Why rejected</th>${cost ? '<th class="num">Value accepted</th>' : ''}</tr></thead><tbody>
            ${(g.items || []).map((i) => `<tr><td>${esc(i.description)}${i.is_stock ? '' : ' <span class="sub">not stock</span>'}</td><td class="num">${esc(MS.num(i.quantity_ordered))}${sc.unit(i.unit)}</td>
              <td class="num">${esc(MS.num(i.quantity_received))}</td><td class="num">${esc(MS.num(i.quantity_accepted))}</td><td class="num">${Number(i.quantity_rejected) ? `<span class="late">${esc(MS.num(i.quantity_rejected))}</span>` : '0'}</td>
              <td class="wrap">${esc(i.rejection_reason || '')}</td>${cost ? `<td class="num">${MS.money(i.accepted_value)}</td>` : ''}</tr>`).join('')}
          </tbody></table></div></div>
          ${(g.movements || []).length ? `<div class="dpanel wide"><h3>Into stock</h3>${sc.movements(g.movements, { item: true })}</div>` : ''}
          ${sc.history(g.history)}
          ${sc.journals(g.journal_entries)}
        </div>`;
      return {
        html,
        buttons: [
          g.can_verify && ['vDispute', 'Send back', 'danger', () => sc.ask({ title: 'Send ' + g.grn_number + ' back', info: 'Nothing goes into stock. Stores records the delivery again correctly.', label: 'What is wrong?', required: true, danger: true, button: 'Send back',
            run: (t) => MS.call('GOODS_RECEIPT_VERIFY', { goods_receipt_id: g.goods_receipt_id, decision: 'DISPUTE', reason: t }) }).then((ok) => ok && refresh())],
          g.can_verify && ['vVerify', 'Checked: put into stock', 'primary', () => sc.ask({ title: 'Check ' + g.grn_number, info: 'The accepted goods go into stock at the order price and are recorded as received, waiting for the supplier\'s bill.',
            label: 'Comment (optional)', button: 'Confirm',
            run: (t) => MS.call('GOODS_RECEIPT_VERIFY', { goods_receipt_id: g.goods_receipt_id, decision: 'VERIFY', reason: t }) }).then((ok) => ok && refresh())]
        ]
      };
    });
  }

  MS.boot({ page: 'goods-received', any: ['INVENTORY_RECEIVE', 'PO_CREATE'], ref: true }).then(() => {
    $('statusFilter').innerHTML = MS.options(['RECEIVED', 'POSTED', 'DISPUTED'].map((s) => ({ value: s, label: s === 'RECEIVED' ? 'To check' : MS.statusLabel(s, 'goods_receipts') })), '', 'Any status');
    $('newBtn').hidden = !MS.can('INVENTORY_RECEIVE');
    $('newBtn').addEventListener('click', () => openForm(''));
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
    if (MS.param('tab') === 'verify' || (!MS.can('INVENTORY_RECEIVE') && MS.can('PO_CREATE'))) sc.setTab('tabs', 'verify', state);
    load();
    if (MS.param('po') && MS.can('INVENTORY_RECEIVE')) openForm(MS.param('po'));
    if (MS.param('id')) view(MS.param('id'));
  });
})();
