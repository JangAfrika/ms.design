(function () {
  const MS = window.MS;
  const esc = (s) => MS.esc(s);
  const fin = (MS.fin = {});
  const cache = {};

  fin.r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  fin.amt = (n) => (Number(n) < 0 ? '− ' + MS.money(-Number(n)) : MS.money(n || 0));

  fin.accounts = async function (types) {
    const key = 'acc:' + (types || []).join(',');
    if (!cache[key]) cache[key] = MS.call('ACCOUNT_LIST', { postable_only: true, types: types || [] }).then((r) => r.rows);
    return cache[key];
  };
  fin.accountOptions = (list, selected, blank) => MS.options(list.map((a) => ({ value: a.account_id, label: a.account_code + ' ' + a.account_name })), selected, blank);

  fin.money = async function (force) {
    if (!cache.money || force) cache.money = MS.call('CASH_BANK_LIST', {});
    return cache.money;
  };
  fin.moneyOptions = (m, selected, method) => {
    const list = [];
    (m.cash || []).forEach((c) => list.push({ value: 'C:' + c.cash_account_id, label: c.account_name + ' (' + c.gl_account_code + ')' }));
    (m.bank || []).forEach((b) => list.push({ value: 'B:' + b.bank_account_id, label: b.bank_name + ' ' + b.account_number_masked + ' (' + b.gl_account_code + ')' }));
    let sel = selected;
    if (!sel && method) {
      const c = list.find((o) => o.value.startsWith(method === 'CASH' ? 'C:' : 'B:'));
      sel = c ? c.value : '';
    }
    return MS.options(list, sel, list.length ? undefined : '— no till or bank yet —');
  };
  fin.moneyPayload = (v) => (v && v.startsWith('C:') ? { cash_account_id: v.slice(2) } : v && v.startsWith('B:') ? { bank_account_id: v.slice(2) } : {});

  fin.customers = async function () {
    if (!cache.customers) cache.customers = MS.call('CUSTOMER_LIST', { page_size: 100, sort: 'customer_name', dir: 'asc', filters: { status: 'ACTIVE' } }).then((r) => r.rows);
    return cache.customers;
  };

  fin.head = (co, title, number, extra, date, valid) => {
    co = co || {};
    const lines = (co.address_lines && co.address_lines.length ? co.address_lines : String(co.address || '').split(',')).map((x) => esc(String(x).trim())).filter(Boolean);
    const em = co.emails && co.emails.length ? co.emails : String(co.email || '').split(',').map((x) => x.trim()).filter(Boolean);
    const label = /RECEIPT/i.test(title) ? 'Receipt No' : /CREDIT/i.test(title) ? 'Credit Note No' : /PROFORMA/i.test(title) ? 'Proforma No' : /STATEMENT/i.test(title) ? 'Customer No' : 'Invoice No';
    const dt = date ? MS.docDate(date) : '';
    return `<div class="fdoc-head">
      <div class="fdoc-logo"><img src="${esc((window.APP_CONFIG && APP_CONFIG.APP_LOGO) || 'logo.png')}" alt=""><b>${esc(String(co.name || 'MS Designs & Printing').toUpperCase())}</b></div>
      <div class="fdoc-addr">${lines.join('<br>')}${co.phone ? '<br>Mob: ' + esc(co.phone) : ''}${em.length ? '<br>E-mail: ' + em.map(esc).join('<br>') : ''}</div>
    </div>
    <div class="fdoc-titlebar"><div class="t">${esc(title)}${extra || ''}</div>
      ${dt ? `<table class="fdoc-box"><tr><th>VAT NO:</th><td>${esc(co.vat_no || co.tin || '')}</td></tr><tr><th>Date:</th><td>${esc(dt)}</td></tr><tr><th>${esc(label)}:</th><td><b>${esc(number)}</b></td></tr>${valid ? `<tr><th>Valid until:</th><td>${esc(MS.docDate(valid))}</td></tr>` : ''}</table>` : `<div class="no">${esc(number)}</div>`}</div>`;
  };

  fin.receiptHtml = (p) => {
    const allocs = (p.allocations || []).filter((a) => a.status === 'ACTIVE');
    return `<div class="fdoc">
      ${fin.head(p.company, 'OFFICIAL RECEIPT', p.receipt_number || '', p.status === 'REVERSED' ? ' <span class="stamp void">VOID</span>' : '', p.payment_date)}
      <div class="fdoc-parties">
        <div class="box"><div class="k">Received from</div><b>${esc(p.customer_name)}</b>${p.customer && p.customer.phone ? '<div>' + esc(p.customer.phone) + '</div>' : ''}</div>
        <div class="box"><dl class="fdoc-facts"><dt>Date</dt><dd>${esc(MS.shortDate(p.payment_date))}</dd><dt>Method</dt><dd>${esc(MS.label(p.payment_method))}${p.reference ? ' · ' + esc(p.reference) : ''}</dd>
          <dt>Paid into</dt><dd>${esc(p.money_account_name)}</dd><dt>Received by</dt><dd>${esc(p.received_by_name)}</dd></dl></div>
      </div>
      <div class="tablewrap"><table class="inv"><thead><tr><th>For</th><th class="num">Amount</th></tr></thead><tbody>
        ${allocs.map((a) => `<tr><td>${esc(MS.label(a.invoice_type))} ${esc(a.invoice_number)}${a.job_number ? ' · job ' + esc(a.job_number) : ''}</td><td class="num">${MS.money(a.amount)}</td></tr>`).join('')}
        ${Number(p.unallocated_amount) > 0 ? `<tr><td>Held as advance on account</td><td class="num">${MS.money(p.unallocated_amount)}</td></tr>` : ''}
      </tbody></table></div>
      <div class="totals"><div class="big"><span>Total received</span><span>${MS.money(p.amount)}</span></div></div>
      <div class="fdoc-foot"><span>Thank you for your business.</span><div class="fdoc-sign">Signature &amp; stamp</div></div>
    </div>`;
  };

  fin.statementHtml = (s) => {
    const rows = s.rows || [];
    return `<div class="fdoc">
      ${fin.head(s.company, 'STATEMENT OF ACCOUNT', s.customer.customer_number || '', '', s.as_of)}
      <div class="fdoc-parties">
        <div class="box"><div class="k">Customer</div><b>${esc(s.customer.customer_name)}</b>${s.customer.address ? '<div>' + esc(s.customer.address) + '</div>' : ''}${s.customer.phone ? '<div>' + esc(s.customer.phone) + '</div>' : ''}${s.customer.tin_number ? '<div>TIN ' + esc(s.customer.tin_number) + '</div>' : ''}</div>
        <div class="box"><dl class="fdoc-facts"><dt>Balance due</dt><dd>${MS.money(s.balance_due)}</dd>${Number(s.advance) > 0 ? `<dt>Paid in advance</dt><dd>${MS.money(s.advance)}</dd>` : ''}
          <dt>Terms</dt><dd>${esc(s.customer.payment_terms_days || 0)} days</dd></dl></div>
      </div>
      <div class="tablewrap"><table class="inv"><thead><tr><th>Date</th><th>Document</th><th>Details</th><th class="num">Charged</th><th class="num">Paid / credited</th><th class="num">Balance</th></tr></thead><tbody>
        ${Number(s.opening_balance) ? `<tr><td colspan="5">Balance brought forward</td><td class="num">${fin.amt(s.opening_balance)}</td></tr>` : ''}
        ${rows.length ? rows.map((r) => `<tr><td>${esc(MS.shortDate(r.date))}</td><td>${esc(r.ref || '')}</td><td class="wrap">${esc(r.description)}${r.job_number ? ' · job ' + esc(r.job_number) : ''}${r.due_date ? ' · due ' + esc(MS.shortDate(r.due_date)) : ''}</td>
          <td class="num">${r.debit ? MS.money(r.debit) : ''}</td><td class="num">${r.credit ? MS.money(r.credit) : ''}</td><td class="num">${fin.amt(r.balance)}</td></tr>`).join('') : '<tr><td colspan="6" class="empty">Nothing in this period.</td></tr>'}
      </tbody></table></div>
      <div class="totals"><div class="big"><span>Balance on the account</span><span>${fin.amt(s.closing_balance)}</span></div></div>
      <div class="fdoc-foot"><span>Please pay the balance due by the due dates shown.</span></div>
    </div>`;
  };

  fin.printHtml = (html) => {
    let box = MS.$('printArea');
    if (!box) { box = document.createElement('div'); box.id = 'printArea'; document.querySelector('.main').appendChild(box); }
    box.innerHTML = html;
    document.body.classList.add('print-doc');
    const done = () => { document.body.classList.remove('print-doc'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
    setTimeout(done, 1500);
  };

  function ensurePayDialog() {
    if (MS.$('payDialog')) return MS.$('payDialog');
    const d = document.createElement('dialog');
    d.id = 'payDialog';
    d.className = 'fin-wide';
    d.innerHTML = `<form class="dlg" id="payForm" novalidate>
      <h3>Record payment received</h3>
      <div class="info">Allocate the money to the customer's open invoices. Anything not allocated stays on the customer's account as an advance, and a receipt is issued.</div>
      <label class="req">Customer <select name="customer_id" id="payCustomer"></select></label>
      <div class="three">
        <label class="req">Amount <input name="amount" id="payAmount" type="number" min="0" step="0.01"></label>
        <label class="req">Date <input name="payment_date" id="payDate" type="date"></label>
        <label class="req">Method <select name="payment_method" id="payMethod"></select></label>
      </div>
      <div class="two">
        <label class="req">Paid into <select id="payMoney"></select></label>
        <label>Reference <input name="reference" id="payRef" type="text" maxlength="80" placeholder="Cheque no., transfer or mobile money ID"></label>
      </div>
      <label>Deposit for job <select id="payJob"><option value="">— not a job deposit —</option></select><span class="qhint">If the job has no deposit invoice yet, one is issued for this amount.</span></label>
      <div id="payInvBox"></div>
      <div class="fin-left" id="payLeft"></div>
      <div class="err" id="payError"></div>
      <div class="btns">
        <button type="button" id="payCancel">Cancel</button>
        <button type="submit" class="primary" id="paySave">Record payment</button>
      </div>
    </form>`;
    document.querySelector('.main').appendChild(d);
    return d;
  }

  fin.recordPayment = async function (opts) {
    opts = opts || {};
    const d = ensurePayDialog();
    const f = MS.$('payForm');
    f.reset();
    MS.$('payError').textContent = '';
    MS.$('payDate').value = MS.todayISO();
    MS.$('payDate').max = MS.todayISO();
    MS.$('payMethod').innerHTML = MS.options(MS.enumOf('customer_payments.payment_method').length ? MS.enumOf('customer_payments.payment_method') : ['CASH', 'CHEQUE', 'BANK_TRANSFER', 'MOBILE_MONEY', 'POS'], 'CASH');
    let money = { cash: [], bank: [] };
    let open = { invoices: [], jobs: [], advance_total: 0 };
    try {
      money = await fin.money();
      const custs = await fin.customers();
      const list = custs.map((c) => ({ value: c.customer_id, label: c.customer_name + ' (' + c.customer_number + ')' }));
      if (opts.customer_id && !list.some((o) => o.value === opts.customer_id) && opts.customer_name) list.unshift({ value: opts.customer_id, label: opts.customer_name });
      MS.$('payCustomer').innerHTML = MS.options(list, opts.customer_id || '', '— choose customer —');
      MS.$('payCustomer').disabled = !!opts.customer_id;
    } catch (err) { MS.$('payError').textContent = err.message; }
    const setMoney = () => { MS.$('payMoney').innerHTML = fin.moneyOptions(money, '', MS.$('payMethod').value); };
    setMoney();
    MS.$('payMethod').onchange = setMoney;

    const left = () => {
      const amount = Number(MS.$('payAmount').value) || 0;
      const used = Array.from(d.querySelectorAll('input.amt')).reduce((s, i) => s + (Number(i.value) || 0), 0);
      const rest = fin.r2(amount - used);
      MS.$('payLeft').innerHTML = !amount ? '' : rest < 0 ? `<span class="neg">Allocated ${MS.money(used)} is more than the amount received.</span>`
        : rest > 0 ? (MS.$('payJob').value && !used ? `${MS.money(rest)} goes to the job's deposit invoice.` : `<b>${MS.money(rest)}</b> stays on the customer's account as an advance.`)
          : 'Fully allocated.';
    };
    const fillOldest = () => {
      let amount = Number(MS.$('payAmount').value) || 0;
      d.querySelectorAll('input.amt').forEach((i) => { const due = Number(i.dataset.due); const a = Math.min(due, amount); i.value = a > 0 ? fin.r2(a) : ''; amount = fin.r2(amount - a); });
      left();
    };
    async function loadOpen() {
      const cid = MS.$('payCustomer').value;
      MS.$('payInvBox').innerHTML = '';
      MS.$('payJob').innerHTML = '<option value="">— not a job deposit —</option>';
      if (!cid) return;
      try { open = await MS.call('CUSTOMER_OPEN_ITEMS', { customer_id: cid }); } catch (err) { MS.$('payError').textContent = err.message; return; }
      MS.$('payJob').innerHTML = MS.options(open.jobs.map((j) => ({ value: j.job_id, label: j.job_number + ' – ' + j.job_name })), opts.job_id || '', '— not a job deposit —');
      MS.$('payInvBox').innerHTML = open.invoices.length ? `<div class="tablewrap"><table class="inv"><thead><tr><th>Invoice</th><th>Due</th><th class="num">Balance due</th><th class="num">Allocate</th></tr></thead><tbody>
        ${open.invoices.map((i) => `<tr><td><b>${esc(i.invoice_number)}</b><span class="sub">${esc(MS.label(i.invoice_type))}${i.job_number ? ' · ' + esc(i.job_number) : ''}</span></td>
          <td>${esc(MS.shortDate(i.due_date))}${i.is_overdue ? ' <span class="pill failed">' + esc(i.days_overdue) + ' days late</span>' : ''}</td>
          <td class="num">${MS.money(i.balance_due)}</td>
          <td class="num"><input class="amt" type="number" min="0" step="0.01" data-inv="${esc(i.invoice_id)}" data-due="${esc(i.balance_due)}" aria-label="Allocate to ${esc(i.invoice_number)}"></td></tr>`).join('')}
        </tbody></table></div><div class="lines-foot"><button type="button" id="payFill">Fill oldest first</button>${open.advance_total ? `<span class="fin-note">The customer already has ${MS.money(open.advance_total)} on account (allocate it from Payments).</span>` : ''}</div>`
        : `<p class="fin-note">${esc(open.advance_total ? 'No open invoices. The customer has ' + MS.money(open.advance_total) + ' on account.' : 'This customer has no open invoices: the money is kept as an advance unless it is a job deposit.')}</p>`;
      if (MS.$('payFill')) MS.$('payFill').onclick = fillOldest;
      if (opts.invoice_id) {
        const inp = d.querySelector(`input.amt[data-inv="${CSS.escape(opts.invoice_id)}"]`);
        if (inp) { inp.value = opts.amount || inp.dataset.due; if (!MS.$('payAmount').value) MS.$('payAmount').value = inp.value; }
      }
      left();
    }
    MS.$('payCustomer').onchange = loadOpen;
    MS.$('payAmount').oninput = left;
    MS.$('payJob').onchange = left;
    d.oninput = (e) => { if (e.target.classList.contains('amt')) left(); };
    if (opts.amount) MS.$('payAmount').value = opts.amount;
    await loadOpen();
    MS.openDialog('payDialog');

    return new Promise((resolve) => {
      let saved = null;
      const send = async (confirmDup) => {
        const data = MS.formData(f);
        const allocations = Array.from(d.querySelectorAll('input.amt')).filter((i) => Number(i.value) > 0).map((i) => ({ invoice_id: i.dataset.inv, amount: Number(i.value) }));
        const payload = Object.assign({ customer_id: MS.$('payCustomer').value, amount: Number(data.amount) || 0, payment_date: data.payment_date,
          payment_method: data.payment_method, reference: data.reference, allocations }, fin.moneyPayload(MS.$('payMoney').value));
        if (MS.$('payJob').value) payload.deposit_job_id = MS.$('payJob').value;
        if (confirmDup) payload.confirm_duplicate = true;
        if (!payload.customer_id) { MS.$('payError').textContent = 'Choose the customer.'; return; }
        if (!(payload.amount > 0)) { MS.$('payError').textContent = 'Enter the amount received.'; return; }
        MS.busy(MS.$('paySave'), true, 'Saving…');
        try {
          saved = await MS.call('PAYMENT_RECORD', payload);
          d.close();
        } catch (err) {
          MS.busy(MS.$('paySave'), false);
          if (err.code === 'DUPLICATE_PAYMENT' && !payload.reference && !confirmDup) {
            if (await MS.confirm({ title: 'Same payment again?', message: err.message, confirmText: 'Yes, record it' })) return send(true);
          }
          MS.$('payError').textContent = err.message;
          return;
        }
        MS.busy(MS.$('paySave'), false);
      };
      f.onsubmit = (e) => { e.preventDefault(); send(false); };
      MS.$('payCancel').onclick = () => d.close();
      d.addEventListener('close', async () => {
        MS.$('payCustomer').disabled = false;
        if (saved && await MS.confirm({ title: 'Payment recorded', message: 'Receipt ' + saved.receipt_number + ' for ' + MS.money(saved.amount) + ' from ' + saved.customer_name + '. Print the receipt now?', confirmText: 'Print receipt', cancelText: 'Not now' })) {
          fin.printHtml(fin.receiptHtml(saved));
        }
        resolve(saved);
      }, { once: true });
    });
  };
})();
