(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const id = MS.param('id');

  const pdfBtn = (kind, rid, ver, label) => `<button type="button" class="linkbtn" data-pdf="${esc(kind)}" data-id="${esc(rid)}"${ver ? ` data-ver="${esc(ver)}"` : ''}>${MS.icon('pdf')} ${esc(label || 'PDF')}</button>`;

  function customerPanel(c) {
    const contacts = (c.contacts || []).map((x) => `<li>${esc(x.contact_name)}${x.role_title ? ' (' + esc(x.role_title) + ')' : ''} <span class="sub">${esc([x.phone, x.email].filter(Boolean).join(' · '))}</span></li>`).join('');
    return `<div class="dpanel"><h3>Customer</h3>${MS.kv([['Name', c.customer_id ? `<a class="lnk" href="customers/customer.html?id=${encodeURIComponent(c.customer_id)}">${esc(c.customer_name)}</a>` : esc(c.customer_name), true],
      ['Number', c.customer_number], ['Type', MS.label(c.customer_type)], ['Phone', c.phone], ['Email', c.email], ['Address', c.address], ['Contact person', c.contact_person], ['TIN', c.tin_number]])}
      ${contacts ? `<ul class="mini-list">${contacts}</ul>` : ''}</div>`;
  }

  function proformaPanel(q, m) {
    if (!q) return `<div class="dpanel"><h3>Proforma invoice</h3><p class="sub">${m.proforma_number ? esc(m.proforma_number) : 'This job was not made from a proforma invoice.'}</p></div>`;
    const vers = (q.versions || []).map((v) => `<tr><td>Version ${esc(v.version_no)}</td><td>${esc(MS.when(v.created_at))}</td><td class="num">${esc(MS.money(v.total_amount))}</td><td class="wrap">${esc(v.change_note || '')}</td><td>${v.has_pdf ? pdfBtn('proforma', q.quotation_id, v.version_no) : ''}</td></tr>`).join('');
    const resp = (q.responses || []).map((r) => `<li>Version ${esc(r.version_no)}: ${MS.pill(r.response_type === 'APPROVED' ? 'APPROVED' : 'REVISION', r.response_type === 'APPROVED' ? 'Approved' : 'Changes requested')} by ${esc(r.respondent_name)} <span class="sub">${esc(MS.when(r.responded_at))}${r.comment ? ' · ' + esc(r.comment) : ''}</span></li>`).join('');
    return `<div class="dpanel wide"><h3>Proforma invoice ${esc(q.revision_label || q.quotation_number)}</h3>
      ${MS.kv([['Total', MS.money(q.total_amount)], ['Status', MS.statusLabel(q.status, 'quotations')], ['Approved', q.approved_at ? MS.when(q.approved_at) : ''], ['Deposit required', q.deposit_required_pct ? q.deposit_required_pct + '%' : '']])}
      <div class="tablewrap"><table class="inv"><thead><tr><th>Version</th><th>Sent</th><th class="num">Total</th><th>What changed</th><th></th></tr></thead><tbody>${vers || '<tr><td colspan="5" class="empty">No version was sent.</td></tr>'}</tbody></table></div>
      ${resp ? `<h4>Customer answers</h4><ul class="mini-list">${resp}</ul>` : ''}</div>`;
  }

  function cyclePanel(cy) {
    const secs = (cy.sections || []).map((s) => `<tr><td>${s.sequence_no}. ${esc(s.section_name)}</td><td>${esc(MS.when(s.activated_at))}</td><td>${esc(MS.when(s.completed_at))}</td><td>${esc(s.completed_by_name || '')}</td><td class="num">${s.duration_hours ? esc(s.duration_hours) + ' h' : ''}</td></tr>`).join('');
    const pd = (cy.pd_steps || []).map((s) => `<li>${esc(s.step_name)} ${MS.pill(s.status, s.status === 'NOT_NEEDED' ? 'Not needed' : s.status === 'DONE' ? 'Done' : 'To do')} <span class="sub">${esc(MS.when(s.completed_at))}${s.completed_by_name ? ' · ' + esc(s.completed_by_name) : ''}</span></li>`).join('');
    const proofs = (cy.proofs || []).map((p) => `<li>Proof ${esc(p.proof_no)} ${MS.pill(p.status, MS.label(p.status))} <span class="sub">sent ${esc(MS.when(p.sent_at))} by ${esc(p.sent_by_name)}${p.responded_at ? ' · answered ' + esc(MS.when(p.responded_at)) + ' by ' + esc(p.respondent_name) : ''}${p.comment ? ' · ' + esc(p.comment) : ''}</span></li>`).join('');
    const moves = (cy.movements || []).map((m) => `<li><span class="sub">${esc(MS.when(m.moved_at))}</span> ${esc(MS.label(m.action))}${m.to_location ? ': ' + esc(m.from_location ? m.from_location + ' → ' : '') + esc(m.to_location) : ''} <span class="sub">${esc(m.moved_by_name)}${m.note ? ' · ' + esc(m.note) : ''}</span></li>`).join('');
    return `<div class="dpanel wide"><h3>Job cycle</h3>
      ${MS.kv([['Created', MS.when(cy.created_at)], ['Finished', MS.when(cy.completed_at)], ['Delivered', MS.when(cy.delivered_at) + (cy.delivered_by_name ? ' by ' + cy.delivered_by_name : '')], ['Days start to finish', cy.total_days ? String(cy.total_days) : ''], ['Delivery note', cy.delivery_note]])}
      <div class="tablewrap"><table class="inv"><thead><tr><th>Section</th><th>Received</th><th>Completed</th><th>By</th><th class="num">Time</th></tr></thead><tbody>${secs || '<tr><td colspan="5" class="empty">No sections.</td></tr>'}</tbody></table></div>
      ${pd ? `<h4>Production Department</h4><ul class="mini-list">${pd}</ul>` : ''}
      ${proofs ? `<h4>Design proofs</h4><ul class="mini-list">${proofs}</ul>` : ''}
      ${(cy.files || []).length ? `<h4>Files</h4><ul class="mini-list">${cy.files.map((f) => `<li>${esc(f.file_name)} <span class="sub">${esc(MS.label(f.category))} · v${esc(f.version_no)} · ${esc(f.uploaded_by_name)}${f.approved_at ? ' · approved ' + esc(MS.when(f.approved_at)) : ''}</span></li>`).join('')}</ul>` : ''}
      ${moves ? `<details class="fold"><summary>Movement log (${cy.movements.length})</summary><ul class="mini-list">${moves}</ul></details>` : ''}</div>`;
  }

  function moneyPanels(m) {
    const inv = (m.invoices || []).map((i) => `<tr><td><b>${esc(i.invoice_number)}</b> <span class="sub">${esc(MS.label(i.invoice_type))}</span>${i.signed ? ' ' + MS.pill('VERIFIED', 'Signed') : ''}</td><td>${esc(MS.shortDate(i.invoice_date))}</td><td class="num">${esc(MS.money(i.total_amount))}</td><td class="num">${esc(MS.money(i.amount_paid))}</td><td class="num">${esc(MS.money(i.balance_due))}</td><td>${pdfBtn('invoice', i.invoice_id)}</td></tr>`).join('');
    const credits = (m.credit_notes || []).map((i) => `<tr><td>${esc(i.invoice_number)} <span class="sub">Credit note</span></td><td>${esc(MS.shortDate(i.invoice_date))}</td><td class="num">-${esc(MS.money(i.total_amount))}</td><td></td><td></td><td></td></tr>`).join('');
    const pay = (m.payments || []).map((p) => {
      const rc = (m.receipts || []).find((r) => r.receipt_id === p.receipt_id);
      return `<tr><td>${esc(MS.shortDate(p.payment_date))}</td><td>${esc(MS.label(p.payment_method))}${p.reference ? ' <span class="sub">' + esc(p.reference) + '</span>' : ''}</td><td>${esc(p.invoice_number)}</td><td class="num">${esc(MS.money(p.amount))}</td>
        <td>${p.receipt_number ? esc(p.receipt_number) + (rc && rc.signed ? ' ' + MS.pill('VERIFIED', 'Signed') : '') + ' ' + pdfBtn('receipt', p.customer_payment_id) : '<span class="sub">no receipt</span>'}</td></tr>`;
    }).join('');
    return `<div class="dpanel wide"><h3>Invoices</h3><div class="tablewrap"><table class="inv"><thead><tr><th>Invoice</th><th>Date</th><th class="num">Total</th><th class="num">Paid</th><th class="num">Balance</th><th></th></tr></thead><tbody>${inv + credits || '<tr><td colspan="6" class="empty">No invoice.</td></tr>'}</tbody></table></div></div>
      <div class="dpanel wide"><h3>Payments and receipts</h3><div class="tablewrap"><table class="inv"><thead><tr><th>Date</th><th>Method</th><th>Invoice</th><th class="num">Amount</th><th>Receipt</th></tr></thead><tbody>${pay || '<tr><td colspan="5" class="empty">No payment.</td></tr>'}</tbody></table></div>
      <div class="dlv-sum"><span><span class="k">Invoiced</span><b>${esc(MS.money(m.invoiced))}</b></span><span><span class="k">Paid</span><b>${esc(MS.money(m.paid))}</b></span><span><span class="k">Balance</span><b class="${m.balance > 0.005 ? 'late' : ''}">${esc(MS.money(m.balance))}</b></span><span class="grow"></span>${MS.payChip({ pay: { status: m.status, label: m.status_label, balance: m.balance } })}</div></div>`;
  }

  function itemsPanel(items) {
    return `<div class="dpanel"><h3>Items</h3><div class="tablewrap"><table class="inv"><thead><tr><th>#</th><th>Item</th><th class="num">Qty</th><th>Specification</th></tr></thead><tbody>${items.map((i) => `<tr><td>${i.line_no}</td><td class="wrap">${esc(i.description)}</td><td class="num">${esc(MS.num(i.quantity))}</td><td class="wrap">${esc(i.specifications || '')}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">No items.</td></tr>'}</tbody></table></div></div>`;
  }

  function render(r) {
    const j = r.job;
    document.title = 'Job ' + j.job_number + ' · MS BMS';
    $('hTitle').innerHTML = esc(j.job_number) + ' · ' + esc(j.job_name) + ' ' + MS.pill('DELIVERED', 'Delivered');
    $('hCrumbs').innerHTML = `<a href="jobs/job-history.html">Job History</a> › ${esc(j.job_number)}`;
    $('hActions').innerHTML = `<a class="btn" href="jobs/job.html?id=${encodeURIComponent(j.job_id)}">Job card</a>`;
    $('hBody').innerHTML = (MS.param('delivered') ? '<div class="notice-bar ok"><b>Job delivered.</b> It has left the working lists and is kept here.</div>' : '') +
      `<div class="dgrid">${customerPanel(r.customer)}${itemsPanel(r.items)}${proformaPanel(r.proforma, r.money)}${cyclePanel(r.cycle)}${moneyPanels(r.money)}</div>`;
  }

  MS.boot({ page: 'job-history', any: ['JOB_HISTORY_VIEW'] }).then(async () => {
    if (!id) { MS.setMsg('hMsg', 'No job chosen.', 'error'); return; }
    $('hBody').innerHTML = MS.skeleton(8);
    $('hBody').addEventListener('click', (e) => {
      const b = e.target.closest('[data-pdf]');
      if (b) MS.docs.pdf(b.dataset.pdf, b.dataset.id, b.dataset.ver ? Number(b.dataset.ver) : undefined, b);
    });
    try { render(await MS.call('JOB_HISTORY_GET', { job_id: id })); } catch (err) { $('hBody').innerHTML = ''; MS.setMsg('hMsg', err.message, 'error'); }
  });
})();
