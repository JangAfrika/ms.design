/* Purchase orders: issue an order from an approved request (supplier and prices), print it for the supplier,
   follow deliveries and bills; cancel (nothing received) or close (rest not coming) with a reason. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const sc = MS.sc;
  const fin = MS.fin;
  const state = { page: 1, q: '', status: '', tab: 'open' };
  const STATUSES = ['ISSUED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED'];

  MS.reload = () => load();
  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    const p = { page: state.page, page_size: 50, search: state.q, filters: { status: state.status } };
    if (state.tab === 'open') p.open_only = true;
    if (state.tab === 'bill') p.to_bill = true;
    try {
      const r = await MS.recall('PURCHASE_ORDER_LIST', p);
      const money = r.rows.some((x) => x.total_amount !== undefined);
      $('totHead').hidden = !money;
      MS.setMsg('listMsg', r.total + ' order' + (r.total === 1 ? '' : 's'));
      $('listBody').innerHTML = r.rows.length ? r.rows.map((x) => `
        <tr class="clk${x.status === 'CANCELLED' ? ' void' : ''}" data-id="${esc(x.purchase_order_id)}">
          <td><b><a class="lnk" href="#" data-id="${esc(x.purchase_order_id)}">${esc(x.po_number)}</a></b><div class="sub">${esc(x.pr_number)}</div></td>
          <td>${esc(MS.shortDate(x.order_date))}</td>
          <td>${esc(x.supplier_name)}</td>
          <td class="wrap">${esc(x.summary)}${x.job_number ? `<div class="sub">job ${esc(x.job_number)}</div>` : ''}</td>
          <td>${x.late ? `<span class="late">${esc(MS.shortDate(x.expected_date))}</span>` : esc(MS.shortDate(x.expected_date))}</td>
          ${money ? `<td class="num">${MS.money(x.total_amount)}</td>` : ''}
          <td>${MS.pill(x.status, MS.statusLabel(x.status, 'purchase_orders'))}</td>
        </tr>`).join('') : `<tr><td colspan="7" class="empty">${state.tab === 'open' ? 'No open orders.' : 'No orders here.'}</td></tr>`;
      sc.pager('pager', r, state, load);
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  /* ---------- issue an order from an approved request ---------- */
  async function newOrder(prId) {
    let pr, ref;
    try { [pr, ref] = await Promise.all([MS.call('PURCHASE_REQUEST_GET', { purchase_request_id: prId }), sc.ref()]); }
    catch (err) { MS.setMsg('listMsg', err.message, 'error'); return; }
    if (pr.status !== 'APPROVED') { MS.alert(pr.pr_number + ' is ' + MS.statusLabel(pr.status, 'purchase_requests').toLowerCase() + '; only an approved request can be ordered.', 'Cannot order'); return; }
    const f = $('poForm');
    f.reset();
    $('poError').textContent = '';
    $('poTitle').textContent = 'Purchase order for ' + pr.pr_number;
    $('poInfo').textContent = pr.reason + ' · approved by ' + pr.approved_by_name + ' for ' + MS.money(pr.estimated_total) + '. The order may not be more than 10% above that.';
    const pref = (pr.items || []).map((i) => ref.items.find((x) => x.item_id === i.item_id)).find((x) => x && x.preferred_supplier_id);
    $('oSupplier').innerHTML = MS.options(ref.suppliers.map((s) => ({ value: s.supplier_id, label: s.supplier_name + ' (' + s.supplier_number + ')' })), pref ? pref.preferred_supplier_id : '', '— choose —');
    $('oLines').innerHTML = sc.qtyTable([['What'], ['Approved', 1], ['Order', 1], ['Price each', 1]], pr.items, (i) => `<tr data-pr="${esc(i.pr_item_id)}">
      <td>${esc(i.description)}${i.is_stock ? '' : ` <span class="sub">${esc(i.account_label)}</span>`}</td><td class="num">${esc(MS.num(i.quantity))}${sc.unit(i.unit)}</td>
      <td class="q"><input data-f="q" type="number" min="0" step="any" value="${esc(i.quantity)}" aria-label="Quantity"></td>
      <td class="p"><input data-f="p" type="number" min="0" step="0.01" value="${esc(i.estimated_unit_price)}" aria-label="Price"></td></tr>`);
    const rows = () => Array.from($('oLines').querySelectorAll('tr[data-pr]')).map((tr) => ({ pr_item_id: tr.dataset.pr, quantity: Number(tr.querySelector('[data-f=q]').value), unit_price: Number(tr.querySelector('[data-f=p]').value) }));
    const total = () => { const t = rows().reduce((s, l) => s + (l.quantity || 0) * (l.unit_price || 0), 0); $('oTotal').innerHTML = `<b>Order total: ${esc(MS.money(t))}</b>${t > pr.estimated_total * 1.1 + 0.009 ? ' <span class="late">more than 10% above the approved request</span>' : ''}`; };
    $('oLines').oninput = total;
    total();
    const dlg = MS.openDialog('poDialog');
    $('poCancel').onclick = () => dlg.close();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = MS.formData(f);
      if (!d.supplier_id) { $('poError').textContent = 'Choose the supplier.'; return; }
      const items = rows().filter((l) => l.quantity > 0);
      if (!items.length) { $('poError').textContent = 'Order at least one line.'; return; }
      MS.busy($('poSave'), true, 'Issuing…');
      try {
        const po = await MS.call('PURCHASE_ORDER_CREATE', { purchase_request_id: pr.purchase_request_id, supplier_id: d.supplier_id, expected_date: d.expected_date, supplier_selection_note: d.supplier_selection_note, items });
        dlg.close();
        history.replaceState(null, '', 'purchasing/purchase-orders.html?id=' + encodeURIComponent(po.purchase_order_id));
        load();
        view(po.purchase_order_id);
      } catch (err) { $('poError').textContent = err.message; } finally { MS.busy($('poSave'), false); }
    };
  }

  /* ---------- printable order ---------- */
  function poHtml(po) {
    const s = po.supplier || {};
    return `<div class="fdoc">
      ${fin.head(po.company, 'PURCHASE ORDER', po.po_number, po.status === 'CANCELLED' ? '<div><span class="stamp void">CANCELLED</span></div>' : '')}
      <div class="fdoc-parties">
        <div class="box"><div class="k">Supplier</div><b>${esc(s.supplier_name)}</b>${s.address ? '<div>' + esc(s.address) + '</div>' : ''}${s.phone ? '<div>' + esc(s.phone) + '</div>' : ''}${s.email ? '<div>' + esc(s.email) + '</div>' : ''}${s.tin_number ? '<div>TIN ' + esc(s.tin_number) + '</div>' : ''}</div>
        <div class="box"><dl class="fdoc-facts"><dt>Order date</dt><dd>${esc(MS.shortDate(po.order_date))}</dd>${po.expected_date ? `<dt>Deliver by</dt><dd>${esc(MS.shortDate(po.expected_date))}</dd>` : ''}
          <dt>Payment terms</dt><dd>${Number(s.payment_terms_days) ? esc(s.payment_terms_days) + ' days' : 'On delivery'}</dd><dt>Our reference</dt><dd>${esc(po.pr_number)}${po.job_number ? ' · job ' + esc(po.job_number) : ''}</dd>
          <dt>Ordered by</dt><dd>${esc(po.issued_by_name)}</dd></dl></div>
      </div>
      <div class="tablewrap"><table class="inv"><thead><tr><th>#</th><th>Description</th><th class="num">Quantity</th><th class="num">Unit price</th><th class="num">Amount</th></tr></thead><tbody>
        ${(po.items || []).map((i, n) => `<tr><td>${n + 1}</td><td class="wrap">${esc(i.description)}${i.item_code ? ` <span class="sub">${esc(i.item_code)}</span>` : ''}</td><td class="num">${esc(MS.num(i.quantity_ordered))}${sc.unit(i.unit)}</td><td class="num">${MS.money(i.unit_price)}</td><td class="num">${MS.money(i.line_total)}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="totals"><div class="big"><span>Total</span><span>${MS.money(po.total_amount)}</span></div></div>
      <div class="fdoc-foot"><span>Please quote ${esc(po.po_number)} on your delivery note and invoice. Goods are checked on arrival; anything damaged or not ordered is returned.</span><div class="fdoc-sign">Authorised signature</div></div>
    </div>`;
  }

  /* ---------- one order ---------- */
  function view(id) {
    return sc.view(() => MS.call('PURCHASE_ORDER_GET', { purchase_order_id: id }), (po) => {
      const refresh = () => { view(id); load(); };
      const money = po.total_amount !== undefined;
      const html = `<h3>Purchase order ${esc(po.po_number)} ${MS.pill(po.status, MS.statusLabel(po.status, 'purchase_orders'))}${po.late ? ' <span class="pill failed">Late</span>' : ''}</h3>
        <div class="dgrid" style="margin-top:8px">
          <div class="dpanel">${MS.kv([['Supplier', po.supplier_name], ['Phone', (po.supplier || {}).phone || ''], ['Ordered', MS.shortDate(po.order_date)], ['Expected', MS.shortDate(po.expected_date)],
            ['Request', MS.lnk('purchasing/purchase-requests.html?id=' + encodeURIComponent(po.purchase_request_id), po.pr_number), true],
            ['Job', po.job_id ? MS.lnk('jobs/job.html?id=' + encodeURIComponent(po.job_id), po.job_number) : '', true], ['Issued by', po.issued_by_name],
            ['Cancelled / closed because', po.status_reason || ''], ['Total', money ? MS.money(po.total_amount) : '']])}</div>
          <div class="dpanel wide"><div class="tablewrap"><table class="inv"><thead><tr><th>What</th><th class="num">Ordered</th><th class="num">Received</th><th class="num">Waiting check</th><th class="num">Still to come</th>${money ? '<th class="num">Price each</th><th class="num">Amount</th>' : ''}</tr></thead><tbody>
            ${(po.items || []).map((i) => `<tr><td>${esc(i.description)}${i.is_stock ? '' : ` <span class="sub">${esc(i.account_label)}</span>`}</td><td class="num">${esc(MS.num(i.quantity_ordered))}${sc.unit(i.unit)}</td>
              <td class="num">${esc(MS.num(i.quantity_received || 0))}</td><td class="num">${esc(MS.num(i.pending))}</td><td class="num">${esc(MS.num(i.outstanding))}</td>
              ${money ? `<td class="num">${MS.money(i.unit_price)}</td><td class="num">${MS.money(i.line_total)}</td>` : ''}</tr>`).join('')}
          </tbody></table></div></div>
          ${(po.receipts || []).length ? `<div class="dpanel"><h3>Goods received</h3><ul class="mini-list">${po.receipts.map((g) => `<li><span>${MS.lnk('purchasing/goods-received.html?id=' + encodeURIComponent(g.goods_receipt_id), g.grn_number)}</span><span class="n">${esc(MS.when(g.received_at))} ${MS.pill(g.status)}</span></li>`).join('')}</ul></div>` : ''}
          ${(po.bills || []).length ? `<div class="dpanel"><h3>Supplier bills</h3><ul class="mini-list">${po.bills.map((b) => `<li><span>${MS.lnk('purchasing/supplier-bills.html?id=' + encodeURIComponent(b.supplier_invoice_id), b.supplier_invoice_ref)}</span><span class="n">${MS.money(b.amount)} ${MS.pill(b.status)}</span></li>`).join('')}</ul></div>` : ''}
          ${sc.history(po.history)}
        </div>`;
      return {
        html,
        buttons: [
          money && ['vPrint', 'Print / PDF', '', () => fin.printHtml(poHtml(po))],
          po.can_cancel && ['vCancel', 'Cancel order', 'danger', () => sc.ask({ title: 'Cancel ' + po.po_number, info: 'The request goes back to "approved" so it can be ordered elsewhere.', label: 'Reason', required: true, danger: true, button: 'Cancel order',
            run: (t) => MS.call('PURCHASE_ORDER_CANCEL', { purchase_order_id: po.purchase_order_id, reason: t }) }).then((ok) => ok && refresh())],
          po.can_close && ['vClose2', 'Close (rest not coming)', '', () => sc.ask({ title: 'Close ' + po.po_number, info: 'What has not arrived will not be received on this order any more.', label: 'Reason', required: true, button: 'Close order',
            run: (t) => MS.call('PURCHASE_ORDER_CLOSE', { purchase_order_id: po.purchase_order_id, reason: t }) }).then((ok) => ok && refresh())],
          po.can_bill && ['vBill', 'Record supplier bill', '', () => { location.href = 'purchasing/supplier-bills.html?po=' + encodeURIComponent(po.purchase_order_id); }],
          po.can_receive && ['vReceive', 'Record goods received', 'primary', () => { location.href = 'purchasing/goods-received.html?po=' + encodeURIComponent(po.purchase_order_id); }]
        ]
      };
    });
  }

  MS.boot({ page: 'purchase-orders', any: ['PO_CREATE', 'PURCHASE_APPROVE', 'INVENTORY_RECEIVE', 'FINANCE_VIEW'], ref: true }).then(() => {
    $('statusFilter').innerHTML = MS.options(STATUSES.map((s) => ({ value: s, label: MS.statusLabel(s, 'purchase_orders') })), '', 'Any status');
    $('toOrderLink').hidden = !MS.can('PO_CREATE');
    $('tabBill').hidden = !MS.can('FINANCE_CREATE');
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
    if (MS.param('tab') === 'bill' && MS.can('FINANCE_CREATE')) sc.setTab('tabs', 'bill', state);
    load();
    if (MS.param('pr') && MS.can('PO_CREATE')) newOrder(MS.param('pr'));
    if (MS.param('id')) view(MS.param('id'));
  });
})();
