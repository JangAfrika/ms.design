/* One quotation: create (?new=1&customer=&enquiry=), edit lines and discount while a draft,
   send, revise, approve the discount, record the customer's answer, then create the job. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const id = MS.param('id');
  const isNew = !!MS.param('new');
  const EDITABLE = ['DRAFT', 'REVISED'];
  let quote = null;
  let editor = null;

  const units = () => {
    const u = MS.enumOf('quotation_items.unit');
    return u.length ? u : (MS.enumOf('services.unit').length ? MS.enumOf('services.unit') : ['PCS']);
  };
  const services = () => (MS.refCache && MS.refCache.services) || [];

  /* ---------- the line editor (used when creating and while a draft) ---------- */
  function lineEditor(box, items, onChange) {
    box.innerHTML = `<div class="tablewrap"><table class="inv lines"><thead><tr><th>Service</th><th>Description</th><th class="num">Qty</th><th>Unit</th><th class="num">Unit price</th><th class="num">Line total</th><th></th></tr></thead><tbody></tbody></table></div>
      <div class="lines-foot"><button type="button" class="add-line">Add line</button></div>`;
    const body = box.querySelector('tbody');
    const total = () => Array.from(body.querySelectorAll('tr')).reduce((s, tr) => s + (Number(tr.querySelector('[data-f=quantity]').value) || 0) * (Number(tr.querySelector('[data-f=unit_price]').value) || 0), 0);
    function recalc() {
      body.querySelectorAll('tr').forEach((tr) => {
        const q = Number(tr.querySelector('[data-f=quantity]').value) || 0, p = Number(tr.querySelector('[data-f=unit_price]').value) || 0;
        tr.querySelector('.lt').textContent = MS.money(Math.round(q * p * 100) / 100);
      });
      if (onChange) onChange(total());
    }
    function addRow(it) {
      it = it || {};
      const tr = document.createElement('tr');
      const svcOpts = MS.options(services().map((s) => ({ value: s.service_id, label: s.service_name })), it.service_id || '', '—');
      const unitList = units().indexOf(it.unit || 'PCS') >= 0 ? units() : units().concat([it.unit]);
      tr.innerHTML = `<td class="s"><select data-f="service_id" aria-label="Service">${svcOpts}</select></td>
        <td class="d"><input data-f="description" type="text" maxlength="300" value="${esc(it.description || '')}" placeholder="e.g. A5 flyers, 4 colour, 130gsm" aria-label="Description"></td>
        <td class="q"><input data-f="quantity" type="number" min="0" step="any" value="${esc(it.quantity == null || it.quantity === '' ? 1 : it.quantity)}" aria-label="Quantity"></td>
        <td class="u"><select data-f="unit" aria-label="Unit">${MS.options(unitList, it.unit || 'PCS')}</select></td>
        <td class="p"><input data-f="unit_price" type="number" min="0" step="0.01" value="${esc(it.unit_price == null ? '' : it.unit_price)}" aria-label="Unit price"></td>
        <td class="num lt"></td>
        <td><button type="button" class="x" title="Remove line" aria-label="Remove line">×</button></td>`;
      const svc = tr.querySelector('[data-f=service_id]');
      svc.addEventListener('change', () => {
        const s = services().find((x) => x.service_id === svc.value);
        if (!s) return;
        const d = tr.querySelector('[data-f=description]');
        if (!d.value) d.value = s.service_name;
        if (s.base_price !== '' && s.base_price != null) tr.querySelector('[data-f=unit_price]').value = s.base_price;
        if (s.unit) {
          const u = tr.querySelector('[data-f=unit]');
          if (!Array.from(u.options).some((o) => o.value === s.unit)) u.insertAdjacentHTML('beforeend', MS.options([s.unit]));
          u.value = s.unit;
        }
        recalc();
      });
      tr.querySelector('.x').addEventListener('click', () => { tr.remove(); if (!body.children.length) addRow(); recalc(); });
      tr.addEventListener('input', recalc);
      body.appendChild(tr);
      recalc();
    }
    (items && items.length ? items : [{}]).forEach(addRow);
    box.querySelector('.add-line').addEventListener('click', () => { addRow(); const last = body.lastElementChild; if (last) last.querySelector('[data-f=description]').focus(); });
    return {
      total,
      items: () => Array.from(body.querySelectorAll('tr')).map((tr) => {
        const g = (n) => tr.querySelector('[data-f=' + n + ']').value.trim();
        return { service_id: g('service_id'), description: g('description'), quantity: Number(g('quantity')), unit: g('unit'), unit_price: Number(g('unit_price') || 0) };
      }).filter((x) => x.description || x.unit_price)
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

  const totalsHtml = (sub, disc, tax, total, approved) => `<div class="totals">
      <div><span>Subtotal</span><span>${MS.money(sub)}</span></div>
      <div><span>Discount${Number(disc) > 0 ? (approved ? ' (approved)' : ' (needs approval)') : ''}</span><span>${Number(disc) > 0 ? '− ' : ''}${MS.money(disc || 0)}</span></div>
      ${tax !== null && Number(tax) ? `<div><span>Tax</span><span>${MS.money(tax)}</span></div>` : ''}
      <div class="big"><span>Total</span><span>${total === null ? MS.money(Math.max(0, sub - (Number(disc) || 0))) : MS.money(total)}</span></div>
    </div>`;

  /* ---------- a new quotation ---------- */
  async function renderNew() {
    if (!MS.can('QUOTATION_CREATE')) { MS.setMsg('dStatus', 'You cannot create quotations.', 'error'); return; }
    const custId = MS.param('customer'), enqId = MS.param('enquiry');
    document.title = 'New quotation · MS BMS';
    $('dTitle').textContent = 'New quotation';
    $('dCrumbs').innerHTML = '<a href="customers/quotations.html">Quotations</a> › New';
    $('dActions').innerHTML = '';
    $('dBody').innerHTML = `
      ${enqId ? '<div class="notice-bar">This quotation answers a customer enquiry. Saving it marks the enquiry as quoted.</div>' : ''}
      <form id="newForm" novalidate>
        <div class="dgrid" style="margin-top:0">
          <div class="dpanel wide"><h3>Quotation</h3>
            <div class="qhead">
              <label class="req">Customer <select name="customer_id" id="qCustomer"><option value="">Loading…</option></select></label>
              <label>Valid until <input name="valid_until" type="date"><span class="qhint">Leave empty for the usual 14 days</span></label>
              <label>Deposit required (%) <input name="deposit_required_pct" type="number" min="0" max="100" step="1"><span class="qhint">Leave empty for the usual deposit</span></label>
              <label>Discount (${esc((window.APP_CONFIG && window.APP_CONFIG.CURRENCY) || 'GMD')}) <input name="discount_amount" id="qDiscount" type="number" min="0" step="0.01"><span class="qhint">A manager must approve any discount</span></label>
            </div>
          </div>
          <div class="dpanel wide"><h3>Line items</h3><div id="qLines"></div><div id="qTotals"></div></div>
        </div>
        <div class="err" id="newError" style="margin-top:10px"></div>
        <div class="btns" style="margin-top:10px;display:flex;gap:8px;justify-content:flex-end">
          <a class="btn" href="${enqId ? 'customers/enquiries.html' : custId ? 'customers/customer.html?id=' + encodeURIComponent(custId) : 'customers/quotations.html'}">Cancel</a>
          <button type="submit" class="primary" id="newSave">Save draft</button>
        </div>
      </form>`;
    const showTotals = () => { $('qTotals').innerHTML = totalsHtml(editor.total(), Number($('qDiscount').value) || 0, null, null, false); };
    editor = lineEditor($('qLines'), [], () => { if (editor && $('qTotals')) showTotals(); });
    showTotals();
    $('qDiscount').addEventListener('input', showTotals);
    try {
      const r = await MS.call('CUSTOMER_LIST', { page_size: 100, sort: 'customer_name', dir: 'asc', filters: { status: 'ACTIVE' } });
      const list = r.rows.map((c) => ({ value: c.customer_id, label: c.customer_name + ' (' + c.customer_number + ')' }));
      if (custId && !list.some((o) => o.value === custId)) {
        try { const c = await MS.call('CUSTOMER_GET', { customer_id: custId }); list.unshift({ value: c.customer_id, label: c.customer_name + ' (' + c.customer_number + ')' }); } catch (e) { /* not visible */ }
      }
      $('qCustomer').innerHTML = MS.options(list, custId, '— choose customer —');
    } catch (err) { $('newError').textContent = err.message; }
    $('newForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = $('newForm');
      const d = {
        customer_id: f.customer_id.value, valid_until: f.valid_until.value,
        deposit_required_pct: f.deposit_required_pct.value === '' ? '' : Number(f.deposit_required_pct.value),
        discount_amount: Number(f.discount_amount.value) || 0, items: editor.items()
      };
      if (enqId) d.enquiry_id = enqId;
      const bad = !d.customer_id ? 'Choose the customer.' : check(d.items);
      if (bad) { $('newError').textContent = bad; return; }
      $('newError').textContent = '';
      MS.busy($('newSave'), true, 'Saving…');
      try {
        const q = await MS.call('QUOTATION_CREATE', d);
        location.replace('customers/quotation.html?id=' + encodeURIComponent(q.quotation_id));
      } catch (err) { $('newError').textContent = err.message; MS.busy($('newSave'), false); }
    });
  }

  /* ---------- one quotation ---------- */
  function render(q) {
    quote = q;
    const st = q.status;
    const canEdit = EDITABLE.indexOf(st) >= 0 && MS.can('QUOTATION_CREATE');
    const nexts = q.allowed_next || [];
    const disc = Number(q.discount_amount) > 0;
    const needsApproval = disc && !q.approved_by;
    const jobs = q.jobs || [], versions = q.versions || [], items = q.items || [];
    document.title = 'Quotation ' + q.quotation_number + ' · MS BMS';
    $('dTitle').innerHTML = 'Quotation ' + esc(q.quotation_number) + ' ' + MS.pill(st, MS.statusLabel(st, 'quotations'));
    $('dCrumbs').innerHTML = `<a href="customers/quotations.html">Quotations</a> › ${esc(q.quotation_number)}`;
    const can = MS.can('QUOTATION_CREATE');
    $('dActions').innerHTML = [
      canEdit && nexts.indexOf('SENT') >= 0 && '<button type="button" class="primary" data-act="send">Mark as sent</button>',
      st === 'SENT' && can && nexts.indexOf('ACCEPTED') >= 0 && '<button type="button" class="primary" data-act="accept">Customer accepted</button>',
      st === 'SENT' && can && nexts.indexOf('REVISED') >= 0 && '<button type="button" data-act="revise">Revise</button>',
      st === 'SENT' && can && nexts.indexOf('REJECTED') >= 0 && '<button type="button" data-act="reject">Customer rejected</button>',
      needsApproval && MS.can('QUOTATION_APPROVE') && ['DRAFT', 'SENT', 'REVISED'].indexOf(st) >= 0 && q.prepared_by !== MS.user.user_id && '<button type="button" data-act="approve">Approve discount</button>',
      st === 'ACCEPTED' && !jobs.length && MS.can('JOB_CREATE') && `<a class="btn primary" href="jobs/job-new.html?quotation=${encodeURIComponent(q.quotation_id)}&customer=${encodeURIComponent(q.customer_id)}">Create job</a>`,
      st === 'SENT' && can && nexts.indexOf('EXPIRED') >= 0 && '<button type="button" data-act="expire">Mark expired</button>',
      can && nexts.indexOf('CANCELLED') >= 0 && '<button type="button" class="danger" data-act="cancel">Cancel quotation</button>',
      '<button type="button" data-act="print">Print</button>'
    ].filter(Boolean).join('');

    const notices = [];
    if (needsApproval && ['DRAFT', 'SENT', 'REVISED'].indexOf(st) >= 0) notices.push(`The discount of ${esc(MS.money(q.discount_amount))} needs approval by a manager before the customer can accept.`);
    if (st === 'SENT' && q.valid_until && String(q.valid_until).slice(0, 10) < MS.todayISO()) notices.push('This quotation is past its valid-until date.');
    if (st === 'ACCEPTED' && !jobs.length) notices.push('The customer accepted this quotation. The next step is to create the job.');

    const custLink = MS.can('CUSTOMER_VIEW') ? MS.lnk('customers/customer.html?id=' + encodeURIComponent(q.customer_id), q.customer_name) : esc(q.customer_name);
    $('dBody').innerHTML = `
      ${notices.map((n) => `<div class="notice-bar">${n}</div>`).join('')}
      <div class="cards">
        <div class="card"><div class="k">Total</div><div class="v">${MS.money(q.total_amount)}</div><div class="s">${items.length} line${items.length === 1 ? '' : 's'}</div></div>
        <div class="card${needsApproval ? ' red' : ''}"><div class="k">Discount</div><div class="v">${MS.money(q.discount_amount || 0)}</div><div class="s">${disc ? (q.approved_by ? 'approved' : 'needs approval') : 'none'}</div></div>
        <div class="card"><div class="k">Deposit required</div><div class="v">${esc(q.deposit_required_pct || 0)}%</div><div class="s">${MS.money(Math.round(Number(q.total_amount || 0) * Number(q.deposit_required_pct || 0)) / 100)}</div></div>
        <div class="card"><div class="k">Version</div><div class="v">${esc(q.current_version_no || 1)}</div><div class="s">${versions.length} sent</div></div>
      </div>
      <div class="dgrid">
        <div class="dpanel"><h3>Details</h3>${MS.kv([['Customer', custLink, true], ['Status', MS.pill(st, MS.statusLabel(st, 'quotations')), true],
          ['Date', MS.shortDate(q.quotation_date)], ['Valid until', MS.shortDate(q.valid_until)],
          ['Accepted on', MS.when(q.customer_accepted_at)], ['From enquiry', q.enquiry_id && MS.can('ENQUIRY_MANAGE') ? '<a class="lnk" href="customers/enquiries.html">Yes</a>' : (q.enquiry_id ? 'Yes' : ''), true]])}</div>
        <div class="dpanel"><h3>Totals</h3>${totalsHtml(q.subtotal, q.discount_amount, q.tax_amount, q.total_amount, !!q.approved_by)}</div>
        <div class="dpanel wide" id="linesPanel"><h3>Line items</h3><div id="linesBox"></div></div>
        ${jobs.length ? `<div class="dpanel wide"><h3>Jobs</h3><div class="tablewrap"><table class="inv"><thead><tr><th>Job</th><th>Status</th></tr></thead><tbody id="jobRows">
          ${jobs.map((j) => `<tr class="clk" data-href="jobs/job.html?id=${encodeURIComponent(j.job_id)}"><td><b>${MS.lnk('jobs/job.html?id=' + encodeURIComponent(j.job_id), j.job_number)}</b></td><td>${MS.pill(j.status, MS.statusLabel(j.status, 'jobs'))}</td></tr>`).join('')}
        </tbody></table></div></div>` : ''}
        ${versions.length ? `<div class="dpanel wide"><h3>Versions sent</h3><div class="tablewrap"><table class="inv"><thead><tr><th>Version</th><th class="num">Total</th><th>Note</th><th>Sent</th></tr></thead><tbody>
          ${versions.slice().sort((a, b) => a.version_no - b.version_no).map((v) => `<tr><td>${esc(v.version_no)}</td><td class="num">${MS.money(v.total_amount)}</td><td class="wrap">${esc(v.change_note || '')}</td><td>${esc(MS.when(v.created_at))}</td></tr>`).join('')}
        </tbody></table></div></div>` : ''}
      </div>`;
    if ($('jobRows')) MS.clickable($('jobRows'));

    if (canEdit) {
      $('linesBox').innerHTML = `<div class="qhead" style="margin-bottom:12px">
          <label>Valid until <input id="eValid" type="date" value="${esc(String(q.valid_until || '').slice(0, 10))}"></label>
          <label>Deposit required (%) <input id="eDeposit" type="number" min="0" max="100" step="1" value="${esc(q.deposit_required_pct)}"></label>
          <label>Discount (${esc((window.APP_CONFIG && window.APP_CONFIG.CURRENCY) || 'GMD')}) <input id="eDiscount" type="number" min="0" step="0.01" value="${esc(q.discount_amount || '')}"><span class="qhint">Changing it needs a new approval</span></label>
        </div><div id="eLines"></div><div id="eTotals"></div>
        <div class="err" id="editError"></div>
        <div class="lines-foot" style="justify-content:flex-end"><button type="button" class="primary" id="saveLines">Save changes</button></div>`;
      const showTotals = () => { $('eTotals').innerHTML = totalsHtml(editor.total(), Number($('eDiscount').value) || 0, null, null, !!q.approved_by && Number($('eDiscount').value) === Number(q.discount_amount)); };
      editor = null;
      editor = lineEditor($('eLines'), items, () => { if (editor && $('eTotals')) showTotals(); });
      showTotals();
      $('eDiscount').addEventListener('input', showTotals);
      $('saveLines').addEventListener('click', saveChanges);
    } else {
      editor = null;
      $('linesBox').innerHTML = `<div class="tablewrap"><table class="inv"><thead><tr><th>#</th><th>Description</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Total</th></tr></thead><tbody>
        ${items.length ? items.map((i) => `<tr><td>${esc(i.line_no)}</td><td class="wrap">${esc(i.description)}</td><td class="num">${esc(MS.num(i.quantity))} ${esc(i.unit || '')}</td><td class="num">${MS.money(i.unit_price)}</td><td class="num">${MS.money(i.line_total)}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">No lines.</td></tr>'}
      </tbody></table></div>`;
    }
  }

  async function saveChanges() {
    const items = editor.items();
    const bad = check(items);
    if (bad) { $('editError').textContent = bad; return; }
    $('editError').textContent = '';
    const dep = $('eDeposit').value;
    MS.busy($('saveLines'), true, 'Saving…');
    try {
      const q = await MS.call('QUOTATION_UPDATE', { quotation_id: quote.quotation_id, items, discount_amount: Number($('eDiscount').value) || 0,
        valid_until: $('eValid').value, deposit_required_pct: dep === '' ? '' : Number(dep) });
      render(q);
      MS.setMsg('dStatus', 'Changes saved.', 'ok');
    } catch (err) { $('editError').textContent = err.message; MS.busy($('saveLines'), false); }
  }

  /* a small form asking for a note or a reason; resolves with the text, or null when cancelled */
  function ask(o) {
    return new Promise((resolve) => {
      const f = $('noteForm');
      f.reset();
      $('noteTitle').textContent = o.title;
      $('noteInfo').textContent = o.info || '';
      $('noteInfo').hidden = !o.info;
      $('noteLabel').firstChild.textContent = o.label + ' ';
      $('noteLabel').classList.toggle('req', !!o.required);
      $('noteError').textContent = '';
      $('noteSave').textContent = o.button;
      $('noteSave').dataset.label = o.button;
      $('noteSave').className = o.danger ? 'danger-solid' : 'primary';
      const dlg = MS.openDialog('noteDialog');
      let answered = null;
      f.onsubmit = async (e) => {
        e.preventDefault();
        const text = $('noteText').value.trim();
        if (o.required && !text) { $('noteError').textContent = 'Please fill this in.'; return; }
        if (!o.run) { answered = text; dlg.close(); return; }
        MS.busy($('noteSave'), true, 'Saving…');
        try { await o.run(text); answered = text; dlg.close(); } catch (err) { $('noteError').textContent = err.message; } finally { MS.busy($('noteSave'), false); }
      };
      $('noteCancel').onclick = () => dlg.close();
      dlg.addEventListener('close', () => resolve(answered), { once: true });
    });
  }

  const act = (action, payload) => MS.call(action, Object.assign({ quotation_id: quote.quotation_id }, payload || {})).then((q) => { render(q); return q; });

  async function onAction(e) {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const a = b.dataset.act;
    const q = quote;
    const direct = async (fn, done) => {
      MS.busy(b, true);
      try { await fn(); MS.setMsg('dStatus', done, 'ok'); } catch (err) { MS.busy(b, false); MS.alert(err.message); }
    };
    if (a === 'print') return window.print();
    if (editor && a !== 'cancel' && $('saveLines') && dirty()) {
      const go = await MS.confirm({ title: 'Unsaved changes', message: 'You have changed the lines but not saved them. Continue without saving?', confirmText: 'Continue' });
      if (!go) return;
    }
    if (a === 'send') {
      const first = !(q.versions || []).length;
      if (first) {
        if (await MS.confirm({ title: 'Mark as sent', message: 'Record that quotation ' + q.quotation_number + ' was sent to ' + q.customer_name + '? The lines are frozen as version 1.', confirmText: 'Mark as sent' }))
          direct(() => act('QUOTATION_SEND'), 'Marked as sent.');
      } else {
        await ask({ title: 'Send the revised quotation', info: 'This saves the current lines as a new version.', label: 'What changed?', button: 'Mark as sent',
          run: (t) => act('QUOTATION_SEND', { change_note: t }).then(() => MS.setMsg('dStatus', 'Marked as sent.', 'ok')) });
      }
    } else if (a === 'accept') {
      if (await MS.confirm({ title: 'Customer accepted', message: 'Record that ' + q.customer_name + ' accepted quotation ' + q.quotation_number + ' (' + MS.money(q.total_amount) + ')?', confirmText: 'Record acceptance' }))
        direct(() => act('QUOTATION_DECISION', { status: 'ACCEPTED' }), 'Acceptance recorded.');
    } else if (a === 'revise') {
      await ask({ title: 'Revise quotation', info: 'Reopens the quotation so you can change it, then send it again as a new version.', label: 'Reason (optional)', button: 'Reopen for changes',
        run: (t) => act('QUOTATION_REVISE', { reason: t }).then(() => MS.setMsg('dStatus', 'Reopened for changes.', 'ok')) });
    } else if (a === 'reject') {
      await ask({ title: 'Customer rejected', info: 'Record that the customer rejected this quotation.', label: 'Reason', required: true, danger: true, button: 'Record rejection',
        run: (t) => act('QUOTATION_DECISION', { status: 'REJECTED', reason: t }).then(() => MS.setMsg('dStatus', 'Rejection recorded.', 'ok')) });
    } else if (a === 'expire') {
      if (await MS.confirm({ title: 'Mark expired', message: 'The customer did not answer in time. Mark quotation ' + q.quotation_number + ' as expired?', confirmText: 'Mark expired' }))
        direct(() => act('QUOTATION_DECISION', { status: 'EXPIRED' }), 'Marked as expired.');
    } else if (a === 'cancel') {
      await ask({ title: 'Cancel quotation', info: 'Cancel ' + q.quotation_number + '. This cannot be undone.', label: 'Reason', required: true, danger: true, button: 'Cancel quotation',
        run: (t) => act('QUOTATION_DECISION', { status: 'CANCELLED', reason: t }).then(() => MS.setMsg('dStatus', 'Quotation cancelled.', 'ok')) });
    } else if (a === 'approve') {
      await ask({ title: 'Approve discount', info: 'Approve a discount of ' + MS.money(q.discount_amount) + ' on ' + q.quotation_number + ' (subtotal ' + MS.money(q.subtotal) + ').', label: 'Comment (optional)', button: 'Approve discount',
        run: (t) => act('QUOTATION_APPROVE', { comment: t }).then(() => MS.setMsg('dStatus', 'Discount approved.', 'ok')) });
    }
  }

  function dirty() {
    if (!editor || !quote) return false;
    const now = JSON.stringify(editor.items().map((i) => [i.service_id || '', i.description, i.quantity, i.unit, i.unit_price]));
    const was = JSON.stringify((quote.items || []).map((i) => [i.service_id || '', i.description, Number(i.quantity), i.unit, Number(i.unit_price)]));
    return now !== was || (Number($('eDiscount').value) || 0) !== (Number(quote.discount_amount) || 0);
  }

  async function load() {
    MS.setMsg('dStatus', 'Loading…');
    try {
      const q = await MS.call('QUOTATION_GET', { quotation_id: id });
      MS.setMsg('dStatus', '');
      render(q);
    } catch (err) {
      MS.setMsg('dStatus', err.message, 'error');
      $('dBody').innerHTML = '<p><a class="lnk" href="customers/quotations.html">Back to quotations</a></p>';
    }
  }

  MS.boot({ page: 'quotations', any: ['QUOTATION_VIEW', 'QUOTATION_CREATE'], ref: true }).then(() => {
    $('dActions').addEventListener('click', onAction);
    if (isNew) { MS.setMsg('dStatus', ''); renderNew(); } else if (id) load();
    else { MS.setMsg('dStatus', 'No quotation chosen.', 'error'); $('dBody').innerHTML = '<p><a class="lnk" href="customers/quotations.html">Back to quotations</a></p>'; }
  });
})();
