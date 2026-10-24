/* One invoice, deposit invoice or credit note as a printable document: edit lines while a draft, issue, record
   payment, credit note, void a draft. ?new=1&customer= starts a typed invoice for a customer without a job. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const fin = MS.fin;
  const id = MS.param('id');
  let inv = null;
  let editor = null;
  let revAccounts = [];

  const TITLES = { INVOICE: 'Invoice', DEPOSIT_INVOICE: 'Deposit invoice', CREDIT_NOTE: 'Credit note' };

  async function loadAccounts() {
    if (revAccounts.length) return revAccounts;
    const list = await fin.accounts(['REVENUE', 'LIABILITY']);
    revAccounts = list.filter((a) => a.account_type === 'REVENUE' || a.account_code === '2150');
    return revAccounts;
  }

  /* ---------- line editor: description, qty, price, revenue account ---------- */
  function lineEditor(box, items, onChange) {
    box.innerHTML = `<div class="tablewrap"><table class="inv lines"><thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Unit price</th><th>Revenue account</th><th class="num">Amount</th><th></th></tr></thead><tbody></tbody></table></div>
      <div class="lines-foot"><button type="button" class="add-line">Add line</button><span class="fin-note">Use a negative price for a discount (4095) or to deduct a deposit already invoiced (2150).</span></div>`;
    const body = box.querySelector('tbody');
    const val = (tr, f) => tr.querySelector('[data-f=' + f + ']').value;
    const total = () => Array.from(body.querySelectorAll('tr')).reduce((s, tr) => s + fin.r2((Number(val(tr, 'quantity')) || 0) * (Number(val(tr, 'unit_price')) || 0)), 0);
    function recalc() {
      body.querySelectorAll('tr').forEach((tr) => { tr.querySelector('.lt').textContent = fin.amt(fin.r2((Number(val(tr, 'quantity')) || 0) * (Number(val(tr, 'unit_price')) || 0))); });
      if (onChange) onChange(total());
    }
    function addRow(it) {
      it = it || {};
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="d"><input data-f="description" type="text" maxlength="300" value="${esc(it.description || '')}" placeholder="e.g. 500 A5 flyers, 4 colour" aria-label="Description"></td>
        <td class="q"><input data-f="quantity" type="number" min="0" step="any" value="${esc(it.quantity == null || it.quantity === '' ? 1 : it.quantity)}" aria-label="Quantity"></td>
        <td class="p"><input data-f="unit_price" type="number" step="0.01" value="${esc(it.unit_price == null ? '' : it.unit_price)}" aria-label="Unit price"></td>
        <td class="a"><select data-f="revenue_account_id" aria-label="Revenue account">${fin.accountOptions(revAccounts, it.revenue_account_id || '', '— work it out from the description —')}</select></td>
        <td class="num lt"></td>
        <td><button type="button" class="x" title="Remove line" aria-label="Remove line">×</button></td>`;
      if (it.job_item_id) tr.dataset.jobItem = it.job_item_id;
      tr.querySelector('.x').addEventListener('click', () => { tr.remove(); if (!body.children.length) addRow(); recalc(); });
      tr.addEventListener('input', recalc);
      body.appendChild(tr);
      recalc();
    }
    (items && items.length ? items : [{}]).forEach(addRow);
    box.querySelector('.add-line').addEventListener('click', () => { addRow(); body.lastElementChild.querySelector('[data-f=description]').focus(); });
    return {
      total,
      items: () => Array.from(body.querySelectorAll('tr')).map((tr) => ({ description: val(tr, 'description').trim(), quantity: Number(val(tr, 'quantity')),
        unit_price: Number(val(tr, 'unit_price') || 0), revenue_account_id: val(tr, 'revenue_account_id'), job_item_id: tr.dataset.jobItem || '' }))
        .filter((x) => x.description || x.unit_price)
    };
  }

  function check(items) {
    if (!items.length) return 'Add at least one line.';
    for (let i = 0; i < items.length; i++) {
      if (!items[i].description) return 'Line ' + (i + 1) + ': enter a description.';
      if (!(items[i].quantity > 0)) return 'Line ' + (i + 1) + ': the quantity must be more than 0.';
    }
    return '';
  }

  /* ---------- new typed invoice for a customer ---------- */
  async function renderNew() {
    if (!MS.can('INVOICE_CREATE')) { MS.setMsg('dStatus', 'You cannot create invoices.', 'error'); return; }
    await loadAccounts().catch(() => []);
    const cust = MS.param('customer');
    $('dTitle').textContent = 'New invoice';
    $('dCrumbs').innerHTML = '<a href="finance/invoices.html">Invoices</a> › New';
    $('dBody').innerHTML = `<div class="dgrid" style="margin-top:0">
        <div class="dpanel wide"><h3>Invoice</h3><div class="qhead">
          <label class="req">Customer <select id="nCust"></select></label>
          <label>Invoice date <input id="nDate" type="date" value="${esc(MS.todayISO())}"></label>
          <label>Due date <input id="nDue" type="date"><span class="qhint">Empty: the customer's payment terms</span></label>
        </div></div>
        <div class="dpanel wide"><h3>Lines</h3><div id="nLines"></div><div class="totals" id="nTotal"></div></div>
      </div>
      <div class="err" id="newError" style="margin-top:10px"></div>
      <div class="btns" style="margin-top:10px;display:flex;gap:8px;justify-content:flex-end"><a class="btn" href="finance/invoices.html">Cancel</a><button type="button" class="primary" id="newSave">Save draft</button></div>`;
    const custs = await fin.customers().catch(() => []);
    $('nCust').innerHTML = MS.options(custs.map((c) => ({ value: c.customer_id, label: c.customer_name + ' (' + c.customer_number + ')' })), cust, '— choose customer —');
    editor = lineEditor($('nLines'), [], (t) => { if ($('nTotal')) $('nTotal').innerHTML = `<div class="big"><span>Total before VAT</span><span>${fin.amt(t)}</span></div>`; });
    $('newSave').onclick = async () => {
      const items = editor.items();
      const bad = !$('nCust').value ? 'Choose the customer.' : check(items);
      if (bad) { $('newError').textContent = bad; return; }
      MS.busy($('newSave'), true, 'Saving…');
      try {
        const r = await MS.call('INVOICE_CREATE', { customer_id: $('nCust').value, invoice_date: $('nDate').value, due_date: $('nDue').value, items });
        location.replace('finance/invoice.html?id=' + encodeURIComponent(r.invoice_id));
      } catch (err) { $('newError').textContent = err.message; MS.busy($('newSave'), false); }
    };
  }

  /* ---------- the document ---------- */
  function render(i) {
    inv = i;
    const st = i.status, draft = st === 'DRAFT', cn = i.invoice_type === 'CREDIT_NOTE';
    const title = TITLES[i.invoice_type] || 'Invoice';
    const number = draft ? 'DRAFT' : i.invoice_number;
    document.title = title + ' ' + number + ' · MS BMS';
    $('dTitle').innerHTML = esc(title) + ' ' + esc(number) + ' ' + MS.pill(i.is_overdue ? 'OVERDUE' : st, i.is_overdue ? 'Overdue' : MS.statusLabel(st, 'invoices'));
    $('dCrumbs').innerHTML = `<a href="finance/invoices.html">Invoices</a> › ${esc(number)}`;
    const canInv = MS.can('INVOICE_CREATE');
    $('dActions').innerHTML = [
      draft && canInv && '<button type="button" class="primary" data-act="issue">Issue</button>',
      draft && canInv && '<button type="button" data-act="edit">Edit lines</button>',
      i.is_open && MS.can('PAYMENT_RECORD') && '<button type="button" class="primary" data-act="pay">Record payment</button>',
      i.is_open && canInv && '<button type="button" data-act="credit">Credit note</button>',
      draft && canInv && '<button type="button" class="danger" data-act="void">Void draft</button>',
      !draft && st !== 'VOID' && canInv && '<button type="button" class="primary" data-act="send">Send to customer</button>',
      !draft && st !== 'VOID' && '<button type="button" data-act="pdf">Download PDF</button>',
      !draft && st !== 'VOID' && '<button type="button" data-act="preview">Preview</button>',
      '<button type="button" data-act="print">Print</button>'
    ].filter(Boolean).join('');
    const c = i.customer || {};
    const items = i.items || [];
    const allocs = (i.allocations || []).filter((a) => a.status === 'ACTIVE');
    const credited = (i.credit_notes || []).filter((x) => x.status !== 'DRAFT').reduce((s, x) => s + Number(x.total_amount || 0), 0);
    const notices = [];
    if (draft) notices.push('This is a draft: nothing is in the books yet. Check the lines and the revenue accounts, then Issue. Issued invoices cannot be changed (use a credit note).');
    if (i.is_overdue) notices.push(`Payment is ${esc(i.days_overdue)} days late (due ${esc(MS.shortDate(i.due_date))}).`);
    if (i.is_open && Number(i.customer_advance) > 0) notices.push(`The customer has ${esc(MS.money(i.customer_advance))} paid in advance. Allocate it from <a href="finance/payments.html?customer=${encodeURIComponent(i.customer_id)}">Payments received</a>.`);
    const stamp = st === 'PAID' && !cn ? '<div><span class="stamp">PAID</span></div>' : st === 'VOID' ? '<div><span class="stamp void">VOID</span></div>' : '';
    const job = i.job_id ? (MS.can('JOB_VIEW') ? MS.lnk('jobs/job.html?id=' + encodeURIComponent(i.job_id), i.job_number) : esc(i.job_number)) + (i.job_name ? ' – ' + esc(i.job_name) : '') : '';
    $('dBody').innerHTML = `
      ${notices.map((n) => `<div class="notice-bar no-print">${n}</div>`).join('')}
      <div class="fdoc">
        ${fin.head(i.company, title.toUpperCase(), number, stamp ? ' ' + stamp.replace(/<\/?div>/g, '') : '', i.invoice_date)}
        <div class="fdoc-parties">
          <div class="box"><div class="k">${cn ? 'Credit to' : 'Bill to'}</div>
            <b>${MS.can('CUSTOMER_VIEW') ? MS.lnk('customers/customer.html?id=' + encodeURIComponent(i.customer_id), i.customer_name) : esc(i.customer_name)}</b>
            ${c.address ? `<div>${esc(c.address)}</div>` : ''}${c.phone ? `<div>${esc(c.phone)}</div>` : ''}${c.email ? `<div>${esc(c.email)}</div>` : ''}
            ${c.tin_number ? `<div>TIN ${esc(c.tin_number)}</div>` : ''}<div class="sub">${esc(i.customer_number || '')}</div></div>
          <div class="box"><dl class="fdoc-facts">
            <dt>Date</dt><dd>${esc(MS.shortDate(i.invoice_date))}</dd>
            ${i.quotation_id ? `<dt>Proforma</dt><dd>${MS.lnk('customers/quotation.html?id=' + encodeURIComponent(i.quotation_id), i.quotation_number)}</dd>` : ''}
            ${cn ? `<dt>Credits</dt><dd>${MS.lnk('finance/invoice.html?id=' + encodeURIComponent(i.credited_invoice_id), i.credited_invoice_number)}</dd>` : `<dt>Due</dt><dd>${esc(MS.shortDate(i.due_date))}</dd>`}
            ${job ? `<dt>Job</dt><dd>${job}</dd>` : ''}
            ${i.issued_by_name ? `<dt>Issued by</dt><dd>${esc(i.issued_by_name)}</dd>` : ''}
          </dl></div>
        </div>
        <div id="linesBox"></div>
        <div class="totals">
          <div><span>Subtotal</span><span>${fin.amt(i.subtotal)}</span></div>
          ${Number(i.tax_amount) ? `<div><span>VAT</span><span>${fin.amt(i.tax_amount)}</span></div>` : ''}
          <div class="big"><span>Total</span><span>${fin.amt(i.total_amount)}</span></div>
          ${!cn && !draft && st !== 'VOID' ? `${Number(i.amount_paid) ? `<div><span>Paid</span><span>− ${MS.money(i.amount_paid)}</span></div>` : ''}
            ${credited ? `<div><span>Credited</span><span>− ${MS.money(credited)}</span></div>` : ''}
            <div class="due"><span>Balance due</span><span>${MS.money(i.balance_due)}</span></div>` : ''}
        </div>
        ${allocs.length ? `<h3 style="font-size:13px;margin:16px 0 6px">Payments received</h3><div class="tablewrap"><table class="inv"><thead><tr><th>Date</th><th>Receipt</th><th>Method</th><th class="num">Amount</th></tr></thead><tbody>
          ${allocs.map((a) => `<tr><td>${esc(MS.shortDate(a.payment_date))}</td><td>${esc(a.receipt_number)}</td><td>${esc(MS.label(a.payment_method))}${a.reference ? ' · ' + esc(a.reference) : ''}</td><td class="num">${MS.money(a.amount)}</td></tr>`).join('')}
        </tbody></table></div>` : ''}
        <div class="fdoc-foot"><span>${cn ? 'This credit note reduces the balance of the invoice named above.' : 'Please quote the invoice number when you pay. Thank you for your business.'}</span><div class="fdoc-sign">Authorised signature</div></div>
      </div>
      <div class="dgrid no-print">
        ${(i.credit_notes || []).length ? `<div class="dpanel"><h3>Credit notes</h3><div class="tablewrap"><table class="inv"><tbody>
          ${i.credit_notes.map((x) => `<tr class="clk" data-href="finance/invoice.html?id=${encodeURIComponent(x.invoice_id)}"><td>${MS.lnk('finance/invoice.html?id=' + encodeURIComponent(x.invoice_id), x.status === 'DRAFT' ? 'Draft' : x.invoice_number)}</td><td>${esc(MS.shortDate(x.invoice_date))}</td><td class="num">${MS.money(x.total_amount)}</td></tr>`).join('')}
        </tbody></table></div></div>` : ''}
        ${MS.docs.history(i.emails)}
        ${(i.journal_entries || []).length ? `<div class="dpanel"><h3>In the books</h3><div class="tablewrap"><table class="inv"><tbody>
          ${i.journal_entries.map((e) => `<tr><td>${MS.can('FINANCE_VIEW') ? MS.lnk('finance/accounts.html?journal=' + encodeURIComponent(e.journal_entry_id), e.entry_number) : esc(e.entry_number)}</td><td>${esc(MS.shortDate(e.entry_date))}</td><td>${MS.pill(e.status)}</td></tr>`).join('')}
        </tbody></table></div></div>` : ''}
      </div>`;
    MS.clickable($('dBody'));
    showLines(false);
  }

  function showLines(editing) {
    const i = inv;
    const box = $('linesBox');
    if (editing) {
      box.innerHTML = `<div class="no-print"><div class="qhead" style="margin-bottom:10px"><label>Invoice date <input id="eDate" type="date" value="${esc(i.invoice_date)}"></label>
        <label>Due date <input id="eDue" type="date" value="${esc(i.due_date)}"></label></div>
        <div id="eLines"></div><div class="err" id="editError"></div>
        <div class="lines-foot" style="justify-content:flex-end"><button type="button" id="editCancel">Cancel</button><button type="button" class="primary" id="editSave">Save changes</button></div></div>`;
      editor = lineEditor($('eLines'), (i.items || []).map((x) => ({ description: x.description, quantity: x.quantity, unit_price: x.unit_price, revenue_account_id: x.revenue_account_id, job_item_id: x.job_item_id })));
      $('editCancel').onclick = () => showLines(false);
      $('editSave').onclick = async () => {
        const items = editor.items();
        const bad = check(items);
        if (bad) { $('editError').textContent = bad; return; }
        MS.busy($('editSave'), true, 'Saving…');
        try { render(await MS.call('INVOICE_UPDATE', { invoice_id: i.invoice_id, items, invoice_date: $('eDate').value, due_date: $('eDue').value })); MS.setMsg('dStatus', 'Changes saved.', 'ok'); }
        catch (err) { $('editError').textContent = err.message; MS.busy($('editSave'), false); }
      };
      return;
    }
    editor = null;
    const showVat = (i.items || []).some((x) => Number(x.tax_rate_pct));
    box.innerHTML = `<div class="tablewrap"><table class="inv"><thead><tr><th>#</th><th>Description</th><th class="num">Qty</th><th class="num">Unit price</th>${showVat ? '<th class="num">VAT %</th>' : ''}<th class="no-print">Account</th><th class="num">Amount</th></tr></thead><tbody>
      ${(i.items || []).length ? i.items.map((x) => `<tr><td>${esc(x.line_no)}</td><td class="wrap">${esc(x.description)}</td><td class="num">${esc(MS.num(x.quantity))}</td><td class="num">${fin.amt(x.unit_price)}</td>${showVat ? `<td class="num">${esc(x.tax_rate_pct || 0)}</td>` : ''}<td class="no-print"><span class="sub">${esc(x.account_code + ' ' + x.account_name)}</span></td><td class="num">${fin.amt(x.line_total)}</td></tr>`).join('') : '<tr><td colspan="7" class="empty">No lines.</td></tr>'}
    </tbody></table></div>`;
  }

  function ask(o) {
    return new Promise((resolve) => {
      const f = $('noteForm');
      f.reset();
      $('noteTitle').textContent = o.title;
      $('noteInfo').textContent = o.info || '';
      $('noteError').textContent = '';
      $('noteSave').textContent = o.button;
      $('noteSave').dataset.label = o.button;
      $('noteSave').className = o.danger ? 'danger-solid' : 'primary';
      const dlg = MS.openDialog('noteDialog');
      let done = false;
      f.onsubmit = async (e) => {
        e.preventDefault();
        const t = $('noteText').value.trim();
        if (!t) { $('noteError').textContent = 'Please give a reason.'; return; }
        MS.busy($('noteSave'), true, 'Saving…');
        try { await o.run(t); done = true; dlg.close(); } catch (err) { $('noteError').textContent = err.message; } finally { MS.busy($('noteSave'), false); }
      };
      $('noteCancel').onclick = () => dlg.close();
      dlg.addEventListener('close', () => resolve(done), { once: true });
    });
  }

  async function creditNote() {
    await loadAccounts().catch(() => []);
    const f = $('cnForm');
    f.reset();
    $('cnError').textContent = '';
    $('cnInfo').textContent = 'A credit note reduces what ' + inv.customer_name + ' owes on ' + inv.invoice_number + ' (open balance ' + MS.money(inv.balance_due) + '). VAT is added the same way as on the invoice.';
    const first = (inv.items || []).find((x) => Number(x.line_total) > 0) || {};
    $('cnAccount').innerHTML = fin.accountOptions(revAccounts, first.revenue_account_id || '');
    $('cnAccount').disabled = inv.invoice_type === 'DEPOSIT_INVOICE';
    const dlg = MS.openDialog('cnDialog');
    $('cnCancel').onclick = () => dlg.close();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = MS.formData(f);
      if (!(Number(d.amount) > 0)) { $('cnError').textContent = 'Enter the amount to credit.'; return; }
      if (!d.reason) { $('cnError').textContent = 'Give the reason.'; return; }
      MS.busy($('cnSave'), true, 'Issuing…');
      try {
        const r = await MS.call('CREDIT_NOTE_CREATE', { invoice_id: inv.invoice_id, amount: Number(d.amount), reason: d.reason, revenue_account_id: $('cnAccount').disabled ? '' : d.revenue_account_id });
        dlg.close();
        location.href = 'finance/invoice.html?id=' + encodeURIComponent(r.invoice_id);
      } catch (err) { $('cnError').textContent = err.message; MS.busy($('cnSave'), false); }
    };
  }

  async function onAction(e) {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const a = b.dataset.act;
    if (a === 'print') return window.print();
    if (a === 'pdf') return MS.docs.pdf('invoice', inv.invoice_id, undefined, b);
    if (a === 'preview') return MS.docs.preview('invoice', inv.invoice_id);
    if (a === 'send') return MS.docs.send('invoice', inv.invoice_id, () => load());
    if (a === 'edit') { await loadAccounts().catch(() => []); return showLines(true); }
    if (a === 'issue') {
      if (editor) { MS.alert('Save or cancel your changes to the lines first.', 'Unsaved changes'); return; }
      const ok = await MS.confirm({ title: 'Issue ' + (TITLES[inv.invoice_type] || 'invoice').toLowerCase(), message: 'Issue it to ' + inv.customer_name + ' for ' + MS.money(inv.total_amount) + '? It gets its number and goes into the books; after that it cannot be changed.', confirmText: 'Issue' });
      if (!ok) return;
      MS.busy(b, true, 'Issuing…');
      try { render(await MS.call('INVOICE_ISSUE', { invoice_id: inv.invoice_id })); MS.setMsg('dStatus', 'Issued as ' + inv.invoice_number + '.', 'ok'); } catch (err) { MS.busy(b, false); MS.alert(err.message); }
    } else if (a === 'void') {
      await ask({ title: 'Void draft', info: 'The draft is kept for the record but can no longer be issued.', button: 'Void draft', danger: true,
        run: (t) => MS.call('INVOICE_VOID', { invoice_id: inv.invoice_id, reason: t }).then(render) });
    } else if (a === 'pay') {
      const p = await fin.recordPayment({ customer_id: inv.customer_id, customer_name: inv.customer_name, invoice_id: inv.invoice_id });
      if (p) {
        load();
        if (p.customer_payment_id && MS.can('PAYMENT_RECORD') && await MS.confirm({ title: 'Payment recorded', message: 'Receipt ' + (p.receipt_number || '') + ' was made. Send it to the customer now?', confirmText: 'Send receipt', cancelText: 'Later' })) MS.docs.send('receipt', p.customer_payment_id, () => load());
      }
    } else if (a === 'credit') creditNote();
  }

  async function load() {
    MS.setMsg('dStatus', 'Loading…');
    try { render(await MS.call('INVOICE_GET', { invoice_id: id })); MS.setMsg('dStatus', ''); }
    catch (err) { MS.setMsg('dStatus', err.message, 'error'); $('dBody').innerHTML = '<p><a class="lnk" href="finance/invoices.html">Back to invoices</a></p>'; }
  }

  MS.boot({ page: 'invoices', any: ['FINANCE_VIEW', 'INVOICE_CREATE', 'PAYMENT_RECORD'], ref: true }).then(() => {
    $('dActions').addEventListener('click', onAction);
    if (MS.param('new')) { MS.setMsg('dStatus', ''); renderNew(); } else if (id) load();
    else { MS.setMsg('dStatus', 'No invoice chosen.', 'error'); $('dBody').innerHTML = '<p><a class="lnk" href="finance/invoices.html">Back to invoices</a></p>'; }
  });
})();
