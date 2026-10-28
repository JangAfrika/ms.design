(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const id = MS.param('id');
  const fin = MS.fin;
  const FIN_RIGHTS = ['FINANCE_VIEW', 'PAYMENT_RECORD', 'INVOICE_CREATE'];
  let cust = null;

  function render(c) {
    cust = c;
    document.title = c.customer_name + ' · MS BMS';
    $('dTitle').innerHTML = esc(c.customer_name) + ' ' + MS.pill(c.status);
    $('dCrumbs').innerHTML = `<a href="customers/customers.html">Customers</a> › ${esc(c.customer_name)}`;
    $('dActions').innerHTML = [
      MS.can('QUOTATION_CREATE') && `<a class="btn primary" href="customers/quotation.html?new=1&customer=${encodeURIComponent(c.customer_id)}">New proforma invoice</a>`,
      MS.can('JOB_CREATE') && `<a class="btn" href="jobs/job-new.html?customer=${encodeURIComponent(c.customer_id)}">New job</a>`,
      MS.can('CUSTOMER_EDIT') && '<button type="button" id="editBtn">Edit</button>'
    ].filter(Boolean).join('');
    const jobs = c.jobs || [], quotes = c.quotations || [], contacts = c.contacts || [];
    const open = jobs.filter((j) => ['DONE', 'DELIVERED', 'CANCELLED'].indexOf(j.status) < 0);
    const tel = (v) => String(v || '').replace(/[^\d+]/g, '');
    const wa = tel(c.whatsapp || c.phone).replace(/^\+/, '');
    const place = [c.address, c.city, c.country].filter(Boolean).join(', ');
    $('dBody').innerHTML = `
      <section class="custcard" aria-label="Customer summary">
        <div class="av" aria-hidden="true">${esc(MS.initials(c.customer_name))}</div>
        <div>
          <h2>${esc(c.customer_name)}</h2>
          <div class="meta">${esc(c.customer_number)} · ${esc(MS.label(c.customer_type))}${c.business_type ? ' · ' + esc(c.business_type) : ''}${c.contact_person ? ' · Contact: ' + esc(c.contact_person) + (c.contact_title ? ' (' + esc(c.contact_title) + ')' : '') : ''}</div>
          <div class="tags">
            <span class="tag ${c.returning ? 'green' : 'grey'}">${esc(c.returning_label)}</span>
            ${c.is_major_client === true ? '<span class="tag amber">Major client</span>' : ''}
            ${c.preferred_contact ? `<span class="tag">Prefers ${esc(MS.label(c.preferred_contact))}</span>` : ''}
            ${c.heard_about_us ? `<span class="tag grey">Heard of us: ${esc(c.heard_about_us)}</span>` : ''}
          </div>
        </div>
        <div class="quick">
          ${c.phone ? `<a class="btn" href="tel:${esc(tel(c.phone))}">Call ${esc(c.phone)}</a>` : ''}
          ${wa ? `<a class="btn" href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
          ${c.email ? `<a class="btn" href="mailto:${esc(c.email)}">Email</a>` : ''}
        </div>
      </section>
      <div class="cards">
        <a class="card" href="#jobs"><div class="k">Jobs</div><div class="v">${jobs.length}</div><div class="s">${open.length} open</div></a>
        <a class="card" href="#quotes"><div class="k">Proforma invoices</div><div class="v">${quotes.length}</div><div class="s">${quotes.filter((q) => q.status === 'SENT').length} waiting for an answer</div></a>
        ${c.balance_due !== undefined ? `<div class="card ${Number(c.balance_due) > 0 ? 'red' : 'green'}"><div class="k">Balance due</div><div class="v">${MS.money(c.balance_due)}</div><div class="s">&nbsp;</div></div>` : ''}
      </div>
      <div class="dgrid">
        <div class="dpanel"><h3>Details</h3>${MS.kv([['Number', c.customer_number], ['Type', MS.label(c.customer_type)], ['Business', c.business_name], ['Kind of business', c.business_type],
          ['Contact person', [c.contact_person, c.contact_title].filter(Boolean).join(', ')], ['Phone', c.phone], ['Second phone', c.phone_secondary], ['WhatsApp', c.whatsapp],
          ['Email', c.email], ['Second email', c.email_secondary], ['Address', place], ['TIN number', c.tin_number], ['VAT number', c.vat_number],
          ['Credit terms', [c.payment_terms_days ? 'Pays within ' + c.payment_terms_days + ' days' : '', Number(c.credit_limit) ? 'limit ' + MS.money(c.credit_limit) : '', c.credit_notes].filter(Boolean).join(' · ')],
          ['Account manager', c.account_manager_name], ['Notes', c.notes]])}</div>
        <div class="dpanel"><h3>Contacts ${MS.can('CUSTOMER_EDIT') ? '<button type="button" class="linkbtn" id="addContact">Add contact</button>' : ''}</h3>
          <div class="tablewrap"><table class="inv"><thead><tr><th>Name</th><th>Role</th><th>Phone</th><th>Approves designs</th></tr></thead><tbody>
          ${contacts.length ? contacts.map((x) => `<tr><td>${esc(x.contact_name)}${x.is_primary === true ? ' <span class="pill ok">Primary</span>' : ''}${x.email ? `<div class="sub">${esc(x.email)}</div>` : ''}</td><td>${esc(x.role_title || '')}</td><td>${esc(x.phone || '')}</td><td>${x.can_approve_designs === true ? 'Yes' : ''}</td></tr>`).join('') : '<tr><td colspan="4" class="empty">No contacts yet.</td></tr>'}
          </tbody></table></div></div>
        <div class="dpanel wide" id="jobs"><h3>Jobs</h3><div class="tablewrap"><table class="inv"><thead><tr><th>Job</th><th>Name</th><th>Status</th><th>Deadline</th></tr></thead><tbody id="jobRows">
          ${jobs.length ? jobs.map((j) => `<tr class="clk" data-href="jobs/job.html?id=${encodeURIComponent(j.job_id)}"><td><b>${MS.lnk('jobs/job.html?id=' + encodeURIComponent(j.job_id), j.job_number)}</b></td><td>${esc(j.job_name)}</td><td>${MS.pill(j.status)}</td><td>${esc(MS.when(j.customer_deadline))}</td></tr>`).join('') : '<tr><td colspan="4" class="empty">No jobs yet.</td></tr>'}
        </tbody></table></div></div>
        ${MS.canAny(FIN_RIGHTS) ? '<div class="dpanel wide" id="account"><h3>Account <span class="h3-acts" id="acctActs"></span></h3><div id="acctBody"><p class="empty">Loading…</p></div></div>' : ''}
        <div class="dpanel wide" id="quotes"><h3>Proforma invoices</h3><div class="tablewrap"><table class="inv"><thead><tr><th>No.</th><th>Date</th><th class="num">Total</th><th>Status</th></tr></thead><tbody id="quoteRows">
          ${quotes.length ? quotes.map((q) => `<tr class="clk" data-href="customers/quotation.html?id=${encodeURIComponent(q.quotation_id)}"><td><b>${MS.lnk('customers/quotation.html?id=' + encodeURIComponent(q.quotation_id), q.quotation_number)}</b></td><td>${esc(MS.shortDate(q.quotation_date))}</td><td class="num">${MS.money(q.total_amount)}</td><td>${MS.pill(q.status)}</td></tr>`).join('') : '<tr><td colspan="4" class="empty">No proforma invoices yet.</td></tr>'}
        </tbody></table></div></div>
        <div class="dpanel wide" id="docsPanel"><h3>Documents (PDF)</h3><div id="docsBody"><p class="empty">Loading…</p></div></div>
      </div>`;
    loadDocs();
    MS.clickable($('jobRows'));
    MS.clickable($('quoteRows'));
    if ($('editBtn')) $('editBtn').addEventListener('click', async () => { if (await MS.customerForm(cust)) load(); });
    if ($('addContact')) $('addContact').addEventListener('click', addContact);
    if ($('account')) loadAccount();
  }

  async function loadDocs() {
    try {
      const d = await MS.call('CUSTOMER_DOCUMENTS', { customer_id: id });
      const row = (kind, did, num, date, amount, status, pdfOk, ver) => `<tr><td><b>${esc(num)}</b></td><td>${esc(MS.shortDate(date))}</td><td class="num">${MS.money(amount)}</td><td>${MS.pill(status, MS.statusLabel(status))}</td><td>${pdfOk ? `<button type="button" class="linkbtn" data-pdf="${kind}" data-id="${esc(did)}">Download PDF</button>` : ''}</td></tr>`;
      const sec = (title, rows) => rows.length ? `<h4 style="margin:10px 0 4px">${title}</h4><div class="tablewrap"><table class="inv"><thead><tr><th>No.</th><th>Date</th><th class="num">Amount</th><th>Status</th><th></th></tr></thead><tbody>${rows.join('')}</tbody></table></div>` : '';
      const html = sec('Proforma invoices', d.proformas.map((q) => row('proforma', q.id, q.number, q.date, q.total, q.status, q.has_pdf))) +
        sec('Invoices', d.invoices.map((i) => row('invoice', i.id, i.number, i.date, i.total, i.status, true))) +
        sec('Payments and receipts', d.payments.map((x) => row('receipt', x.id, x.number || 'Payment', x.date, x.amount, x.status, !!x.number && !x.receipt_void)));
      $('docsBody').innerHTML = html || '<p class="empty">No documents yet.</p>';
      $('docsBody').addEventListener('click', (e) => { const b = e.target.closest('[data-pdf]'); if (b) MS.docs.pdf(b.dataset.pdf, b.dataset.id, undefined, b); });
    } catch (err) { $('docsBody').innerHTML = `<p class="empty">${esc(err.message)}</p>`; }
  }

  async function loadAccount() {
    try {
      const s = await MS.call('CUSTOMER_STATEMENT_GET', { customer_id: id });
      const a = s.ageing;
      const late = fin.r2(a['1-30'] + a['31-60'] + a['61-90'] + a['90+']);
      $('acctActs').innerHTML = [
        s.can.record_payment && '<button type="button" class="linkbtn" id="acctPay">Record payment</button>',
        s.can.invoice && MS.lnk('finance/invoices.html?new=1&customer=' + encodeURIComponent(id), 'New invoice'),
        MS.lnk('finance/payments.html?customer=' + encodeURIComponent(id), 'All payments'),
        '<button type="button" class="linkbtn" id="acctPrint">Print statement</button>'
      ].filter(Boolean).join(' · ');
      $('acctBody').innerHTML = `
        <div class="cards">
          <div class="card ${s.balance_due > 0 ? 'red' : 'green'}"><div class="k">Owes us</div><div class="v">${MS.money(s.balance_due)}</div><div class="s">${s.open_invoices.length} open invoice${s.open_invoices.length === 1 ? '' : 's'}</div></div>
          <div class="card ${late > 0 ? 'red' : ''}"><div class="k">Overdue</div><div class="v">${MS.money(late)}</div><div class="s">${a['90+'] > 0 ? 'over 90 days ' + esc(MS.money(a['90+'])) : 'terms ' + esc(s.customer.payment_terms_days || 0) + ' days'}</div></div>
          <div class="card"><div class="k">Paid in advance</div><div class="v">${MS.money(s.advance)}</div><div class="s">${s.advance > 0 ? 'not yet used on an invoice' : '&nbsp;'}</div></div>
          <div class="card"><div class="k">Last payment</div><div class="v">${s.last_payment ? MS.money(s.last_payment.amount) : '–'}</div><div class="s">${s.last_payment ? esc(MS.shortDate(s.last_payment.date)) : 'none yet'}</div></div>
        </div>
        ${s.balance_due > 0 ? `<p class="fin-note">Not yet due ${esc(MS.money(a.CURRENT))} · 1–30 days ${esc(MS.money(a['1-30']))} · 31–60 ${esc(MS.money(a['31-60']))} · 61–90 ${esc(MS.money(a['61-90']))} · over 90 ${esc(MS.money(a['90+']))}</p>` : ''}
        <div class="tablewrap"><table class="inv"><thead><tr><th>Date</th><th>Document</th><th>Details</th><th class="num">Charged</th><th class="num">Paid / credited</th><th class="num">Balance</th></tr></thead><tbody id="acctRows">
        ${s.rows.length ? s.rows.slice().reverse().map((r) => {
          const href = r.kind === 'PAYMENT' ? 'finance/payments.html' : 'finance/invoice.html?id=' + encodeURIComponent(r.id);
          return `<tr class="clk" data-href="${esc(href)}"><td>${esc(MS.shortDate(r.date))}</td><td><b>${MS.lnk(href, r.ref || MS.label(r.kind))}</b></td>
            <td class="wrap">${esc(r.description)}${r.job_number ? ' · job ' + esc(r.job_number) : ''}${r.kind === 'INVOICE' || r.kind === 'DEPOSIT_INVOICE' ? ' ' + MS.pill(r.status, MS.statusLabel(r.status, 'invoices')) : ''}</td>
            <td class="num">${r.debit ? MS.money(r.debit) : ''}</td><td class="num">${r.credit ? MS.money(r.credit) : ''}</td><td class="num">${fin.amt(r.balance)}</td></tr>`;
        }).join('') : '<tr><td colspan="6" class="empty">No invoices or payments yet.</td></tr>'}
        </tbody></table></div>`;
      MS.clickable($('acctRows'));
      if ($('acctPay')) $('acctPay').addEventListener('click', async () => { const p = await fin.recordPayment({ customer_id: id, customer_name: cust.customer_name }); if (p) { load(); } });
      $('acctPrint').addEventListener('click', () => fin.printHtml(fin.statementHtml(s)));
    } catch (err) { $('acctBody').innerHTML = `<p class="err">${esc(err.message)}</p>`; }
  }

  function addContact() {
    const f = $('contactForm');
    f.reset();
    $('contactError').textContent = '';
    const dlg = MS.openDialog('contactDialog');
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = MS.formData(f);
      if (!d.contact_name) { $('contactError').textContent = 'Enter the contact name.'; return; }
      MS.busy($('contactSave'), true, 'Saving…');
      try { await MS.call('CONTACT_SAVE', Object.assign(d, { customer_id: id })); dlg.close(); load(); } catch (err) { $('contactError').textContent = err.message; } finally { MS.busy($('contactSave'), false); }
    };
    $('contactCancel').onclick = () => dlg.close();
  }

  async function load() {
    MS.setMsg('dStatus', 'Loading…');
    try {
      const c = await MS.call('CUSTOMER_GET', { customer_id: id });
      MS.setMsg('dStatus', '');
      render(c);
    } catch (err) {
      MS.setMsg('dStatus', err.message, 'error');
      $('dBody').innerHTML = '<p><a class="lnk" href="customers/customers.html">Back to customers</a></p>';
    }
  }

  MS.boot({ page: 'customers', any: ['CUSTOMER_VIEW'], ref: true }).then(() => { MS.reload = () => load(); load(); });
})();
