/* Supplier bills & payments: record a bill against its purchase order with the three-way match (order, goods received,
   bill); the Finance Manager accepts differences; payments are prepared, approved (not by the preparer, within the
   limit), paid from a till or bank, and can be reversed. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const sc = MS.sc;
  const fin = MS.fin;
  const state = { page: 1, q: '', tab: 'bills' };
  const isPay = () => state.tab.indexOf('pay') === 0;

  MS.reload = () => load();
  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    const p = { page: state.page, page_size: 50, search: state.q };
    try {
      if (isPay()) {
        if (state.tab === 'pay-approve') p.to_approve = true;
        if (state.tab === 'pay-pay') p.to_pay = true;
        const r = await MS.recall('SUPPLIER_PAYMENT_LIST', p);
        MS.setMsg('listMsg', r.total + ' payment' + (r.total === 1 ? '' : 's'));
        $('listHead').innerHTML = '<tr><th>Supplier</th><th>Bill</th><th>Date</th><th>From</th><th>Prepared by</th><th class="num">Amount</th><th>Status</th></tr>';
        $('listBody').innerHTML = r.rows.length ? r.rows.map((x) => `
          <tr class="clk${x.status === 'REVERSED' ? ' void' : ''}" data-pay="${esc(x.supplier_payment_id)}">
            <td><b><a class="lnk" href="#" data-pay="${esc(x.supplier_payment_id)}">${esc(x.supplier_name)}</a></b></td>
            <td>${esc(x.supplier_invoice_ref)}</td><td>${esc(MS.shortDate(x.payment_date))}</td><td>${esc(x.money_account_name)}</td>
            <td>${esc(x.prepared_by_name)}</td><td class="num">${MS.money(x.amount)}</td><td>${MS.pill(x.status, MS.statusLabel(x.status, 'supplier_payments'))}</td>
          </tr>`).join('') : `<tr><td colspan="7" class="empty">${state.tab === 'pay-approve' ? 'No payment waiting for your approval.' : state.tab === 'pay-pay' ? 'No approved payment waiting.' : 'No payments yet.'}</td></tr>`;
        sc.pager('pager', r, state, load);
        return;
      }
      if (state.tab === 'open') p.open_only = true;
      if (state.tab === 'mismatch') p.filters = { status: 'DISPUTED' };
      const r = await MS.recall('SUPPLIER_BILL_LIST', p);
      MS.setMsg('listMsg', r.total + ' bill' + (r.total === 1 ? '' : 's'));
      $('listHead').innerHTML = '<tr><th>Bill</th><th>Supplier</th><th>Order</th><th>Bill date</th><th>Due</th><th>Match</th><th class="num">Amount</th><th class="num">Still owed</th><th>Status</th></tr>';
      $('listBody').innerHTML = r.rows.length ? r.rows.map((b) => `
        <tr class="clk${b.status === 'VOID' ? ' void' : ''}" data-id="${esc(b.supplier_invoice_id)}">
          <td><b><a class="lnk" href="#" data-id="${esc(b.supplier_invoice_id)}">${esc(b.supplier_invoice_ref)}</a></b></td>
          <td>${esc(b.supplier_name)}</td><td>${esc(b.po_number)}</td><td>${esc(MS.shortDate(b.invoice_date))}</td>
          <td>${b.overdue ? `<span class="late">${esc(MS.shortDate(b.due_date))}</span>` : esc(MS.shortDate(b.due_date))}</td>
          <td>${b.match_status === 'MATCHED' ? '<span class="pill ok">Matches</span>' : b.match_status ? `<span class="pill ${b.match_approved_by ? 'pending' : 'bad'}">${b.match_approved_by ? 'Accepted' : 'Does not match'}</span>` : ''}</td>
          <td class="num">${MS.money(b.amount)}</td><td class="num">${MS.money(b.outstanding)}</td>
          <td>${MS.pill(b.status, MS.statusLabel(b.status, 'supplier_invoices'))}</td>
        </tr>`).join('') : `<tr><td colspan="9" class="empty">${state.tab === 'mismatch' ? 'No bill waiting on a decision.' : state.tab === 'open' ? 'Nothing owed to suppliers.' : 'No supplier bills yet.'}</td></tr>`;
      sc.pager('pager', r, state, load);
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  /* ---------- match result ---------- */
  function matchHtml(m) {
    if (!m || !m.lines) return '';
    return `<div class="dpanel wide" style="margin-top:10px"><h3>Three-way match: ${m.status === 'MATCHED' ? '<span class="pill ok">Matches</span>' : '<span class="pill failed">Does not match</span>'}</h3>
      <div class="tablewrap"><table class="inv"><thead><tr><th>What</th><th class="num">Ordered</th><th class="num">Received</th><th class="num">Billed before</th><th class="num">Billed now</th><th class="num">Order price</th><th class="num">Bill price</th><th class="num">Amount</th></tr></thead><tbody>
        ${m.lines.map((l) => `<tr><td>${esc(l.description)}</td><td class="num">${esc(MS.num(l.ordered))}</td><td class="num">${esc(MS.num(l.accepted))}</td><td class="num">${esc(MS.num(l.billed_before))}</td>
          <td class="num">${l.flags.indexOf('QUANTITY') >= 0 ? `<span class="late">${esc(MS.num(l.billed_quantity))}</span>` : esc(MS.num(l.billed_quantity))}</td>
          <td class="num">${MS.money(l.po_price)}</td><td class="num">${l.flags.indexOf('PRICE') >= 0 ? `<span class="late">${MS.money(l.billed_price)}</span>` : MS.money(l.billed_price)}</td><td class="num">${MS.money(l.line_total)}</td></tr>`).join('')}
      </tbody><tfoot><tr><td colspan="7">Lines (before tax)</td><td class="num">${MS.money(m.expected_net)}</td></tr><tr><td colspan="7">Bill (before tax)</td><td class="num">${MS.money(m.invoice_net)}</td></tr></tfoot></table></div>
      ${(m.notes || []).length ? `<ul class="mini-list">${m.notes.map((n) => `<li><span class="late">${esc(n)}</span></li>`).join('')}</ul>` : ''}</div>`;
  }

  /* ---------- record a bill ---------- */
  async function openForm(poId) {
    const f = $('billForm');
    f.reset();
    $('billError').textContent = '';
    $('bMatch').innerHTML = '';
    $('bLines').innerHTML = '';
    $('bDate').value = MS.todayISO();
    let pos = [];
    try { pos = (await MS.call('PURCHASE_ORDER_LIST', { to_bill: true, page_size: 100 })).rows; } catch (err) { $('billError').textContent = err.message; }
    $('bPo').innerHTML = MS.options(pos.map((po) => ({ value: po.purchase_order_id, label: po.po_number + ' · ' + po.supplier_name + ' · ' + MS.money(po.total_amount) })), poId || '', pos.length ? '— choose —' : '— nothing received to bill —');
    const lines = () => Array.from($('bLines').querySelectorAll('tr[data-po]')).map((tr) => ({ po_item_id: tr.dataset.po, quantity: Number(tr.querySelector('[data-f=q]').value || 0), unit_price: Number(tr.querySelector('[data-f=p]').value || 0) })).filter((l) => l.quantity > 0);
    const payload = () => { const d = MS.formData(f); return { purchase_order_id: $('bPo').value, supplier_invoice_ref: d.supplier_invoice_ref, invoice_date: d.invoice_date, due_date: d.due_date, amount: d.amount, tax_amount: d.tax_amount === '' ? 0 : d.tax_amount, lines: lines() }; };
    const drawLines = async () => {
      $('bLines').innerHTML = ''; $('bMatch').innerHTML = '';
      if (!$('bPo').value) return;
      try {
        const m = await MS.call('SUPPLIER_BILL_CHECK', { purchase_order_id: $('bPo').value, amount: 0 });
        $('bLines').innerHTML = m.lines.length ? sc.qtyTable([['What'], ['Received, not billed', 1], ['Billed quantity', 1], ['Bill price each', 1]], m.lines, (l) => `<tr data-po="${esc(l.po_item_id)}">
          <td>${esc(l.description)}</td><td class="num">${esc(MS.num(l.billable))}</td>
          <td class="q"><input data-f="q" type="number" min="0" step="any" value="${esc(l.billable)}" aria-label="Billed quantity"></td>
          <td class="p"><input data-f="p" type="number" min="0" step="0.01" value="${esc(l.po_price)}" aria-label="Bill price"></td></tr>`)
          : '<p class="fin-note">Everything received on this order has been billed already.</p>';
        const net = m.lines.reduce((s, l) => s + l.billable * l.po_price, 0);
        if (!$('bAmount').value) $('bAmount').value = fin.r2(net);
      } catch (err) { $('billError').textContent = err.message; }
    };
    $('bPo').onchange = drawLines;
    await drawLines();
    const dlg = MS.openDialog('billDialog');
    $('billCancel').onclick = () => dlg.close();
    $('billCheck').onclick = async () => {
      $('billError').textContent = '';
      if (!$('bPo').value) { $('billError').textContent = 'Choose the purchase order.'; return; }
      MS.busy($('billCheck'), true, 'Checking…');
      try { $('bMatch').innerHTML = matchHtml(await MS.call('SUPPLIER_BILL_CHECK', payload())); } catch (err) { $('billError').textContent = err.message; } finally { MS.busy($('billCheck'), false); }
    };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = payload();
      if (!d.purchase_order_id || !d.supplier_invoice_ref || !d.invoice_date || !(d.amount > 0)) { $('billError').textContent = 'Choose the order and enter the bill number, date and total.'; return; }
      MS.busy($('billSave'), true, 'Saving…');
      try {
        const b = await MS.call('SUPPLIER_BILL_RECORD', d);
        dlg.close();
        MS.setMsg('listMsg', b.status === 'DISPUTED' ? 'Bill ' + b.supplier_invoice_ref + ' does not match: it waits for the Finance Manager.' : 'Bill ' + b.supplier_invoice_ref + ' matches and is in the books.', b.status === 'DISPUTED' ? 'error' : 'ok');
        load();
        view(b.supplier_invoice_id);
      } catch (err) { $('billError').textContent = err.message; } finally { MS.busy($('billSave'), false); }
    };
  }

  /* ---------- one bill ---------- */
  function view(id) {
    return sc.view(() => MS.call('SUPPLIER_BILL_GET', { supplier_invoice_id: id }), (b) => {
      const refresh = () => { view(id); load(); };
      const html = `<h3>Supplier bill ${esc(b.supplier_invoice_ref)} ${MS.pill(b.status, MS.statusLabel(b.status, 'supplier_invoices'))}${b.overdue ? ' <span class="pill failed">Overdue</span>' : ''}</h3>
        <div class="dgrid" style="margin-top:8px">
          <div class="dpanel">${MS.kv([['Supplier', b.supplier_name], ['Order', b.purchase_order_id ? MS.lnk('purchasing/purchase-orders.html?id=' + encodeURIComponent(b.purchase_order_id), b.po_number) : '', true],
            ['Bill date', MS.shortDate(b.invoice_date)], ['Due', MS.shortDate(b.due_date)], ['Total', MS.money(b.amount)], ['Of which tax', Number(b.tax_amount) ? MS.money(b.tax_amount) : ''],
            ['Paid', MS.money(b.amount_paid)], ['Still owed', MS.money(b.outstanding)], ['Payments being prepared', Number(b.pending_payments) ? MS.money(b.pending_payments) : ''],
            ['Recorded by', b.recorded_by_name], ['Differences accepted by', b.match_approved_by_name], ['Why accepted', b.match_note || '']])}</div>
          ${matchHtml(b.match_details)}
          ${(b.payments || []).length ? `<div class="dpanel wide"><h3>Payments</h3><ul class="mini-list">${b.payments.map((x) => `<li><span><a class="lnk" href="#" data-open-pay="${esc(x.supplier_payment_id)}">${esc(MS.shortDate(x.payment_date))} · ${esc(x.money_account_name || MS.label(x.payment_method))}</a></span><span class="n">${MS.money(x.amount)} ${MS.pill(x.status, MS.statusLabel(x.status, 'supplier_payments'))}</span></li>`).join('')}</ul></div>` : ''}
          ${sc.history(b.history)}
          ${sc.journals(b.journal_entries)}
        </div>`;
      return {
        html,
        after: () => { MS.$('viewBody').querySelectorAll('[data-open-pay]').forEach((a) => { a.onclick = (e) => { e.preventDefault(); payView(a.dataset.openPay); }; }); },
        buttons: [
          b.can_void && ['vVoid', 'Void bill', 'danger', () => sc.ask({ title: 'Void bill ' + b.supplier_invoice_ref, info: 'Its entry in the books is reversed; the bill stays on record as void.', label: 'Reason', required: true, danger: true, button: 'Void',
            run: (t) => MS.call('SUPPLIER_BILL_VOID', { supplier_invoice_id: b.supplier_invoice_id, reason: t }) }).then((ok) => ok && refresh())],
          b.can_accept && ['vAccept', 'Accept the differences', 'primary', () => sc.ask({ title: 'Accept bill ' + b.supplier_invoice_ref, info: 'The bill is posted as it is; the price difference goes to the cost of materials (or the line\'s expense account).',
            label: 'Why is it accepted?', required: true, button: 'Accept and post',
            run: (t) => MS.call('SUPPLIER_BILL_ACCEPT', { supplier_invoice_id: b.supplier_invoice_id, note: t }) }).then((ok) => ok && refresh())],
          b.can_pay && ['vPay', 'Prepare payment', 'primary', () => preparePay(b).then((ok) => ok && refresh())]
        ]
      };
    });
  }

  async function preparePay(b) {
    let money = { cash: [], bank: [] };
    try { money = await fin.money(); } catch (e) { /* shown by the server */ }
    const left = fin.r2(b.outstanding - b.pending_payments);
    return sc.ask({ title: 'Pay ' + b.supplier_name, info: 'Bill ' + b.supplier_invoice_ref + ': ' + MS.money(left) + ' left to pay. Someone else approves the payment before it is made.',
      extra: `<div class="two"><label class="req">Amount <input type="number" id="ppAmount" min="0" step="0.01" value="${esc(left)}"></label>
        <label>Method <select id="ppMethod">${MS.options(MS.enumOf('supplier_payments.payment_method'), 'BANK_TRANSFER')}</select></label></div>
        <div class="two"><label class="req">Pay from <select id="ppFrom">${fin.moneyOptions(money, '', 'BANK_TRANSFER')}</select></label>
        <label>Pay on <input type="date" id="ppDate" value="${esc(MS.todayISO())}"></label></div>`,
      label: 'Reference (cheque or transfer number)', button: 'Prepare',
      run: (t) => MS.call('SUPPLIER_PAYMENT_PREPARE', Object.assign({ supplier_invoice_id: b.supplier_invoice_id, amount: Number($('ppAmount').value), payment_method: $('ppMethod').value,
        payment_date: $('ppDate').value, reference: t }, fin.moneyPayload($('ppFrom').value))) });
  }

  /* ---------- one payment ---------- */
  function payView(id) {
    return sc.view(() => MS.call('SUPPLIER_PAYMENT_GET', { supplier_payment_id: id }), (x) => {
      const refresh = () => { payView(id); load(); };
      const html = `<h3>Payment to ${esc(x.supplier_name)} ${MS.pill(x.status, MS.statusLabel(x.status, 'supplier_payments'))}</h3>
        <div class="dgrid" style="margin-top:8px">
          <div class="dpanel">${MS.kv([['Bill', `<a class="lnk" href="#" id="pvBill">${esc(x.supplier_invoice_ref)}</a>`, true], ['Amount', MS.money(x.amount)], ['Date', MS.shortDate(x.payment_date)],
            ['Method', MS.label(x.payment_method)], ['From', x.money_account_name], ['Reference', x.reference || ''], ['Prepared by', x.prepared_by_name], ['Approved by', x.approved_by_name]])}</div>
          ${sc.history(x.history)}
          ${sc.journals(x.journal_entries)}
        </div>`;
      return {
        html,
        after: () => { $('pvBill').onclick = (e) => { e.preventDefault(); view(x.supplier_invoice_id); }; },
        buttons: [
          x.can_cancel && ['vCancelPay', 'Cancel payment', 'danger', () => sc.ask({ title: 'Cancel this payment', info: 'Nothing has been paid yet; the bill stays owed.', label: 'Reason', required: true, danger: true, button: 'Cancel payment',
            run: (t) => MS.call('SUPPLIER_PAYMENT_CANCEL', { supplier_payment_id: x.supplier_payment_id, reason: t }) }).then((ok) => ok && refresh())],
          x.can_reverse && ['vReverse', 'Reverse', 'danger', () => sc.ask({ title: 'Reverse this payment', info: 'A mirror entry is posted and the bill is owed again.', label: 'Reason', required: true, danger: true, button: 'Reverse',
            run: (t) => MS.call('SUPPLIER_PAYMENT_REVERSE', { supplier_payment_id: x.supplier_payment_id, reason: t }) }).then((ok) => ok && refresh())],
          x.can_approve && ['vApprovePay', 'Approve', 'primary', () => sc.ask({ title: 'Approve payment', info: MS.money(x.amount) + ' to ' + x.supplier_name + ' from ' + x.money_account_name + ', prepared by ' + x.prepared_by_name + '.',
            label: 'Comment (optional)', button: 'Approve',
            run: (t) => MS.call('SUPPLIER_PAYMENT_APPROVE', { supplier_payment_id: x.supplier_payment_id, comment: t }) }).then((ok) => ok && refresh())],
          x.can_pay && ['vPayNow', 'Mark as paid', 'primary', () => sc.ask({ title: 'Pay ' + x.supplier_name, info: 'The books show ' + MS.money(x.amount) + ' leaving ' + x.money_account_name + '.',
            extra: `<label>Paid on <input type="date" id="pnDate" value="${esc(MS.todayISO())}"></label>`, label: 'Reference (optional)', button: 'Paid',
            run: (t) => MS.call('SUPPLIER_PAYMENT_PAY', Object.assign({ supplier_payment_id: x.supplier_payment_id, payment_date: $('pnDate').value }, t ? { reference: t } : {})) }).then((ok) => ok && refresh())]
        ]
      };
    });
  }

  MS.boot({ page: 'supplier-bills', any: ['FINANCE_VIEW', 'SUPPLIER_PAYMENT_PREPARE'], ref: true }).then(() => {
    $('newBtn').hidden = !MS.can('FINANCE_CREATE');
    $('tabMismatch').hidden = !MS.canAny(['FINANCE_APPROVE', 'FINANCE_CREATE']);
    $('tabPayApprove').hidden = !MS.can('FINANCE_APPROVE');
    $('tabPayPay').hidden = !MS.can('SUPPLIER_PAYMENT_PREPARE');
    $('newBtn').addEventListener('click', () => openForm(''));
    sc.tabs('tabs', state, load);
    $('search').addEventListener('input', MS.debounce(() => { state.q = $('search').value.trim(); state.page = 1; load(); }, 300));
    $('reloadBtn').addEventListener('click', load);
    $('listBody').addEventListener('click', (e) => {
      const p = e.target.closest('[data-pay]');
      if (p) { e.preventDefault(); payView(p.dataset.pay); return; }
      const el = e.target.closest('[data-id]');
      if (!el) return;
      e.preventDefault();
      view(el.dataset.id);
    });
    const tab = MS.param('tab');
    if (tab && $('tabs').querySelector(`[data-tab="${tab}"]:not([hidden])`)) sc.setTab('tabs', tab, state);
    else if (MS.param('payment')) sc.setTab('tabs', 'payments', state);
    load();
    if (MS.param('po') && MS.can('FINANCE_CREATE')) openForm(MS.param('po'));
    if (MS.param('id')) view(MS.param('id'));
    if (MS.param('payment')) payView(MS.param('payment'));
  });
})();
