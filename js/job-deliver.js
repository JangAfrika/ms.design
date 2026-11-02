(function () {
  const MS = window.MS;
  const { esc } = MS;
  const jd = (MS.jobDeliver = {});

  function dlg() {
    let d = document.getElementById('deliverDlg');
    if (!d) { d = document.createElement('dialog'); d.id = 'deliverDlg'; d.className = 'fin-wide'; document.body.appendChild(d); }
    return d;
  }

  jd.moneyPicture = (m) => {
    const inv = (m.invoices || []).map((i) => `<tr><td><b>${esc(i.invoice_number)}</b> <span class="sub">${esc(MS.label(i.invoice_type))}</span></td><td class="num">${esc(MS.money(i.total_amount))}</td><td class="num">${esc(MS.money(i.amount_paid))}</td><td class="num">${esc(MS.money(i.balance_due))}</td><td>${MS.pill(i.status, MS.statusLabel(i.status, 'invoices'))}</td></tr>`).join('');
    const pay = (m.payments || []).map((p) => `<tr><td>${esc(MS.shortDate(p.payment_date))}</td><td>${esc(MS.label(p.payment_method))}${p.reference ? ' <span class="sub">' + esc(p.reference) + '</span>' : ''}</td><td>${esc(p.invoice_number)}</td><td class="num">${esc(MS.money(p.amount))}</td><td>${p.receipt_number ? esc(p.receipt_number) : '<span class="sub">no receipt</span>'}</td></tr>`).join('');
    return `<div class="dlv-sum"><span><span class="k">Invoiced</span><b>${esc(MS.money(m.invoiced))}</b></span><span><span class="k">Paid</span><b>${esc(MS.money(m.paid))}</b></span><span><span class="k">Balance</span><b class="${m.balance > 0.005 ? 'late' : ''}">${esc(MS.money(m.balance))}</b></span><span class="grow"></span>${MS.payChip({ pay: { status: m.status, label: m.status_label, balance: m.balance } })}</div>
      <div class="tablewrap"><table class="inv"><thead><tr><th>Invoice</th><th class="num">Total</th><th class="num">Paid</th><th class="num">Balance</th><th>Status</th></tr></thead><tbody>${inv || '<tr><td colspan="5" class="empty">No invoice has been issued.</td></tr>'}</tbody></table></div>
      <div class="tablewrap"><table class="inv"><thead><tr><th>Date</th><th>Method</th><th>Invoice</th><th class="num">Amount</th><th>Receipt</th></tr></thead><tbody>${pay || '<tr><td colspan="5" class="empty">No payment recorded yet.</td></tr>'}</tbody></table></div>`;
  };

  jd.open = async (jobId, onDone) => {
    const d = dlg();
    d.innerHTML = `<div class="dlg"><h3>Job delivered</h3>${MS.skeleton(6)}</div>`;
    d.showModal();
    let r;
    try { r = await MS.call('JOB_DELIVER_PREVIEW', { job_id: jobId }); } catch (err) {
      d.innerHTML = `<div class="dlg"><h3>Job delivered</h3><div class="err">${esc(err.message)}</div><div class="btns"><button type="button" id="dvClose">Close</button></div></div>`;
      d.querySelector('#dvClose').onclick = () => d.close();
      return;
    }
    const ok = r.can_deliver;
    d.innerHTML = `<form class="dlg" id="dvForm" novalidate><h3>Job delivered · ${esc(r.job_number)}</h3>
      <p class="sub">${esc(r.job_name)} · ${esc(r.customer_name)}</p>
      ${MS.jobDeliver.moneyPicture(r.money)}
      ${ok ? '<div class="notice-bar ok"><b>Everything is paid.</b> Confirm the customer has the job and it moves to Job History.</div>'
        : `<div class="notice-bar danger"><b>This job cannot be marked delivered yet.</b><ul>${r.reasons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`}
      ${ok ? `<label class="check"><input type="checkbox" id="dvConfirm"> The job was delivered to the customer and the payments above are complete.</label>
        <label>Delivery note (optional) <input id="dvNote" type="text" maxlength="500" placeholder="For example: collected by the customer"></label>` : ''}
      <div class="err" id="dvError"></div>
      <div class="btns"><button type="button" id="dvClose">${ok ? 'Cancel' : 'Close'}</button>${ok ? '<button type="submit" class="primary" id="dvGo">Job delivered</button>' : ''}</div></form>`;
    d.querySelector('#dvClose').onclick = () => d.close();
    const form = d.querySelector('#dvForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!ok) return;
      const err = d.querySelector('#dvError');
      err.textContent = '';
      if (!d.querySelector('#dvConfirm').checked) { err.textContent = 'Tick the box to confirm.'; return; }
      try {
        await MS.busy(d.querySelector('#dvGo'), MS.call('JOB_DELIVER', { job_id: jobId, confirm: true, note: d.querySelector('#dvNote').value.trim() }), 'Saving…');
        d.close();
        if (onDone) onDone();
      } catch (x) { err.textContent = x.message; }
    });
  };
})();
