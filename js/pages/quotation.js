(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const id = MS.param('id');
  const isNew = !!MS.param('new');
  const EDITABLE = ['DRAFT', 'REVISED', 'CHANGES_REQUESTED'];
  let quote = null;
  let editor = null;

  const services = () => (MS.refCache && MS.refCache.services) || [];

  function lineEditor(box, items, onChange) {
    box.innerHTML = `<div class="tablewrap"><table class="inv lines pro-lines"><thead><tr><th>Item</th><th>Description</th><th class="num">Qty</th><th>U/M</th><th>Delivery</th><th class="num">Unit price</th><th class="num">Total</th><th></th></tr></thead><tbody></tbody></table></div>
      <div class="lines-foot"><button type="button" class="add-line">Add line</button><span class="fin-note">Pick a service to fill the item, unit and price; you can change them.</span></div>`;
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
      tr.dataset.service = it.service_id || '';
      tr.innerHTML = `<td class="s"><input data-f="item_name" type="text" maxlength="150" value="${esc(it.item_name || '')}" placeholder="e.g. BANNER" aria-label="Item"><select data-f="service_id" aria-label="Service" class="svc">${MS.options(services().map((x) => ({ value: x.service_id, label: x.service_name })), it.service_id || '', 'Service…')}</select></td>
        <td class="d"><textarea data-f="description" rows="3" maxlength="500" placeholder="e.g. Material: vinyl, size 2m x 2m, full colour" aria-label="Description">${esc(it.description || '')}</textarea></td>
        <td class="q"><input data-f="quantity" type="number" min="0" step="any" value="${esc(it.quantity == null || it.quantity === '' ? 1 : it.quantity)}" aria-label="Quantity"></td>
        <td class="u"><input data-f="unit" type="text" maxlength="20" value="${esc(it.unit || '')}" placeholder="pcs" aria-label="Unit of measure"></td>
        <td class="u"><input data-f="delivery_text" type="text" maxlength="150" value="${esc(it.delivery_text || '')}" placeholder="Within 1 working day" aria-label="Delivery"></td>
        <td class="p"><input data-f="unit_price" type="number" min="0" step="0.01" value="${esc(it.unit_price == null ? '' : it.unit_price)}" aria-label="Unit price"></td>
        <td class="num lt"></td>
        <td><button type="button" class="x" title="Remove line" aria-label="Remove line">×</button></td>`;
      const svc = tr.querySelector('[data-f=service_id]');
      svc.addEventListener('change', () => {
        const s = services().find((x) => x.service_id === svc.value);
        if (!s) return;
        const n = tr.querySelector('[data-f=item_name]');
        if (!n.value) n.value = s.service_name;
        if (s.base_price !== '' && s.base_price != null) tr.querySelector('[data-f=unit_price]').value = s.base_price;
        if (s.unit && !tr.querySelector('[data-f=unit]').value) tr.querySelector('[data-f=unit]').value = String(s.unit).toLowerCase();
        recalc();
      });
      tr.querySelector('.x').addEventListener('click', () => { tr.remove(); if (!body.children.length) addRow(); recalc(); });
      tr.addEventListener('input', recalc);
      body.appendChild(tr);
      recalc();
    }
    (items && items.length ? items : [{}]).forEach(addRow);
    box.querySelector('.add-line').addEventListener('click', () => { addRow(); const last = body.lastElementChild; if (last) last.querySelector('[data-f=item_name]').focus(); });
    return {
      total,
      items: () => Array.from(body.querySelectorAll('tr')).map((tr) => {
        const g = (n) => tr.querySelector('[data-f=' + n + ']').value.trim();
        const o = { service_id: g('service_id'), item_name: g('item_name'), description: g('description'), quantity: Number(g('quantity')), unit: g('unit'), delivery_text: g('delivery_text'), unit_price: Number(g('unit_price') || 0) };
        if (!o.description && o.item_name) o.description = o.item_name;
        return o;
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
      ${tax !== null && Number(tax) ? `<div><span>VAT</span><span>${MS.money(tax)}</span></div>` : ''}
      <div class="big"><span>${total === null ? "Total before VAT" : "Total"}</span><span>${total === null ? MS.money(Math.max(0, sub - (Number(disc) || 0))) : MS.money(total)}</span></div>
    </div>`;

  async function renderNew() {
    if (!MS.can('QUOTATION_CREATE')) { MS.setMsg('dStatus', 'You cannot create quotations.', 'error'); return; }
    const custId = MS.param('customer');
    document.title = 'New proforma invoice · MS BMS';
    $('dTitle').textContent = 'New proforma invoice';
    $('dCrumbs').innerHTML = '<a href="customers/quotations.html">Proforma invoices</a> › New';
    $('dActions').innerHTML = '';
    $('dBody').innerHTML = `
      <form id="newForm" novalidate>
        <div class="dgrid" style="margin-top:0">
          <div class="dpanel wide"><h3>Proforma invoice</h3>
            <div class="qhead">
              <div class="qcust">
                <label class="req">Customer <select name="customer_id" id="qCustomer" aria-describedby="qCustHelp"><option value="">Loading…</option></select></label>
                <input type="search" id="qCustSearch" placeholder="Find by business, name or phone" aria-label="Find a customer by business, name or phone" autocomplete="off">
                ${MS.can('CUSTOMER_CREATE') ? '<button type="button" id="qNewCust">+ New customer</button>' : ''}
                <span class="fhelp" id="qCustHelp">Not in the list? ${MS.can('CUSTOMER_CREATE') ? 'Press <b>New customer</b>; you stay on this page and it is chosen for you.' : 'Ask Finance to add the customer first.'}</span>
              </div>
              <label>Valid until <input name="valid_until" type="date"><span class="qhint">Leave empty for the usual 14 days</span></label>
              <label>Discount (${esc((window.APP_CONFIG && window.APP_CONFIG.CURRENCY) || 'GMD')}) <input name="discount_amount" id="qDiscount" type="number" min="0" step="0.01"><span class="qhint">A manager must approve any discount</span></label>
            </div>
          </div>
          <div class="dpanel wide"><h3>Line items</h3><div id="qLines"></div><div id="qTotals"></div></div>
        </div>
        <div class="err" id="newError" style="margin-top:10px"></div>
        <div class="fbar">
          <a class="btn" href="${custId ? 'customers/customer.html?id=' + encodeURIComponent(custId) : 'customers/quotations.html'}">Cancel</a>
          <button type="submit" class="primary" id="newSave">Save proforma draft</button>
        </div>
      </form>`;
    const showTotals = () => { $('qTotals').innerHTML = totalsHtml(editor.total(), Number($('qDiscount').value) || 0, null, null, false); };
    editor = lineEditor($('qLines'), [], () => { if (editor && $('qTotals')) showTotals(); });
    showTotals();
    $('qDiscount').addEventListener('input', showTotals);
    const custLabel = (c) => c.customer_name + (c.phone ? ' · ' + c.phone : '') + ' (' + c.customer_number + ')';
    async function loadCustomers(selected, search) {
      try {
        const r = await MS.call('CUSTOMER_LIST', { page_size: 100, sort: 'customer_name', dir: 'asc', search: search || '', filters: { status: 'ACTIVE' } });
        const list = r.rows.map((c) => ({ value: c.customer_id, label: custLabel(c) }));
        if (selected && !list.some((o) => o.value === selected)) {
          try { const c = await MS.call('CUSTOMER_GET', { customer_id: selected }); list.unshift({ value: c.customer_id, label: custLabel(c) }); } catch (e) {  }
        }
        $('qCustomer').innerHTML = MS.options(list, selected, list.length ? '— choose customer —' : '— no customer matches —');
      } catch (err) { $('newError').textContent = err.message; }
    }
    await loadCustomers(custId, '');
    $('qCustSearch').addEventListener('input', MS.debounce(() => loadCustomers($('qCustomer').value, $('qCustSearch').value.trim()), 300));
    if ($('qNewCust')) {
      $('qNewCust').addEventListener('click', async () => {
        const c = await MS.customerForm(null, { name: $('qCustSearch').value.trim() });
        if (c) { $('qCustSearch').value = ''; await loadCustomers(c.customer_id, ''); MS.fieldErrors($('newForm'), {}); }
      });
    }
    $('newForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = $('newForm');
      const d = {
        customer_id: f.customer_id.value, valid_until: f.valid_until.value,
        discount_amount: Number(f.discount_amount.value) || 0, items: editor.items()
      };
      MS.clearFieldErrors(f);
      if (!d.customer_id) { MS.fieldErrors(f, { customer_id: 'Choose the customer, or add a new one.' }); return; }
      const bad = check(d.items);
      if (bad) { $('newError').textContent = bad; return; }
      $('newError').textContent = '';
      MS.busy($('newSave'), true, 'Saving…');
      try {
        const q = await MS.call('QUOTATION_CREATE', d);
        location.replace('customers/quotation.html?id=' + encodeURIComponent(q.quotation_id));
      } catch (err) { $('newError').textContent = err.message; MS.busy($('newSave'), false); }
    });
  }

  function render(q) {
    quote = q;
    const st = q.status;
    const canEdit = EDITABLE.indexOf(st) >= 0 && MS.can('QUOTATION_CREATE');
    const nexts = q.allowed_next || [];
    const disc = Number(q.discount_amount) > 0;
    const needsApproval = disc && !q.approved_by;
    const jobs = q.jobs || [], versions = q.versions || [], items = q.items || [];
    document.title = 'Proforma invoice ' + (q.revision_label || q.quotation_number) + ' · MS BMS';
    $('dTitle').innerHTML = 'Proforma invoice ' + esc(q.revision_label || q.quotation_number) + ' ' + MS.pill(st, MS.statusLabel(st, 'quotations'));
    $('dCrumbs').innerHTML = `<a href="customers/quotations.html">Proforma invoices</a> › ${esc(q.quotation_number)}`;
    const can = MS.can('QUOTATION_CREATE');
    const canInv = MS.can('INVOICE_CREATE');
    const sendable = ['DRAFT', 'REVISED', 'CHANGES_REQUESTED', 'SENT'].indexOf(st) >= 0;
    const label = q.revision_label || q.quotation_number;
    $('dActions').innerHTML = [
      sendable && can && `<button type="button" class="primary" data-act="email">${st === 'SENT' ? 'Send to customer again' : (q.has_sent_version ? 'Send revised version to customer' : 'Send to customer')}</button>`,
      canEdit && nexts.indexOf('SENT') >= 0 && '<button type="button" data-act="send" title="Only records that it was given to the customer in some other way">Mark as sent (outside the system)</button>',
      st === 'SENT' && can && nexts.indexOf('ACCEPTED') >= 0 && '<button type="button" data-act="accept" title="For when the customer approved by phone or on paper">Customer approved (by phone or paper)</button>',
      st === 'SENT' && can && nexts.indexOf('REVISED') >= 0 && '<button type="button" data-act="revise">Revise</button>',
      st === 'SENT' && can && nexts.indexOf('REJECTED') >= 0 && '<button type="button" data-act="reject">Customer rejected</button>',
      needsApproval && MS.can('QUOTATION_APPROVE') && ['DRAFT', 'SENT', 'REVISED', 'CHANGES_REQUESTED'].indexOf(st) >= 0 && q.prepared_by !== MS.user.user_id && '<button type="button" data-act="approve">Approve discount</button>',
      st === 'ACCEPTED' && canInv && !(q.invoices || []).length && '<button type="button" class="primary" data-act="invoice">Create invoice</button>',
      st === 'ACCEPTED' && !jobs.length && MS.can('JOB_CREATE') && `<a class="btn primary" href="jobs/job-new.html?quotation_id=${encodeURIComponent(q.quotation_id)}">Create job card</a>`,
      ['SENT', 'CHANGES_REQUESTED'].indexOf(st) >= 0 && can && nexts.indexOf('EXPIRED') >= 0 && '<button type="button" data-act="expire">Mark expired</button>',
      can && nexts.indexOf('CANCELLED') >= 0 && '<button type="button" class="danger" data-act="cancel">Cancel proforma invoice</button>',
      '<button type="button" data-act="preview">Preview</button>',
      '<button type="button" data-act="pdf">Download PDF</button>'
    ].filter(Boolean).join('');

    const notices = [];
    const lastReply = (q.responses || []).slice(-1)[0];
    if (st === 'CHANGES_REQUESTED' && lastReply) notices.push('<b>' + esc(lastReply.respondent_name) + '</b> asked for changes on ' + esc(MS.when(lastReply.responded_at)) + ': <q>' + esc(lastReply.comment) + '</q> Edit the lines below, then send the new revision.');
    if (needsApproval && ['DRAFT', 'SENT', 'REVISED', 'CHANGES_REQUESTED'].indexOf(st) >= 0) notices.push(`The discount of ${esc(MS.money(q.discount_amount))} needs approval by a manager before the customer can approve it.`);
    if (st === 'SENT' && q.valid_until && String(q.valid_until).slice(0, 10) < MS.todayISO()) notices.push('This proforma invoice is past its valid-until date.');
    if (st === 'ACCEPTED' && !jobs.length) notices.push('The customer approved this proforma invoice. The General Manager creates the job card next.');

    const custLink = MS.can('CUSTOMER_VIEW') ? MS.lnk('customers/customer.html?id=' + encodeURIComponent(q.customer_id), q.customer_name) : esc(q.customer_name);
    $('dBody').innerHTML = `
      ${notices.map((n) => `<div class="notice-bar">${n}</div>`).join('')}
      <div class="cards">
        <div class="card"><div class="k">Total</div><div class="v">${MS.money(q.total_amount)}</div><div class="s">${items.length} line${items.length === 1 ? '' : 's'}</div></div>
        <div class="card${needsApproval ? ' red' : ''}"><div class="k">Discount</div><div class="v">${MS.money(q.discount_amount || 0)}</div><div class="s">${disc ? (q.approved_by ? 'approved' : 'needs approval') : 'none'}</div></div>
        <div class="card"><div class="k">Revision</div><div class="v">${esc(q.current_version_no || 1)}</div><div class="s">${versions.length} sent</div></div>
      </div>
      <div class="dgrid">
        <div class="dpanel"><h3>Details</h3>${MS.kv([['Customer', custLink, true], ['Status', MS.pill(st, MS.statusLabel(st, 'quotations')), true],
          ['Date', MS.shortDate(q.quotation_date)], ['Valid until', MS.shortDate(q.valid_until)],
          ['Approved on', MS.when(q.customer_accepted_at)]])}</div>
        <div class="dpanel"><h3>Totals</h3>${totalsHtml(q.subtotal, q.discount_amount, q.tax_amount, q.total_amount, !!q.approved_by)}</div>
        <div class="dpanel wide" id="linesPanel"><h3>Line items</h3><div id="linesBox"></div></div>
        ${jobs.length ? `<div class="dpanel wide"><h3>Jobs</h3><div class="tablewrap"><table class="inv"><thead><tr><th>Job</th><th>Status</th></tr></thead><tbody id="jobRows">
          ${jobs.map((j) => `<tr class="clk" data-href="jobs/job.html?id=${encodeURIComponent(j.job_id)}"><td><b>${MS.lnk('jobs/job.html?id=' + encodeURIComponent(j.job_id), j.job_number)}</b></td><td>${MS.pill(j.status, MS.statusLabel(j.status, 'jobs'))}</td></tr>`).join('')}
        </tbody></table></div></div>` : ''}
        ${versions.length ? `<div class="dpanel wide"><h3>Revisions sent (kept, read-only)</h3><div class="tablewrap"><table class="inv"><thead><tr><th>Revision</th><th class="num">Total</th><th>What changed</th><th>Sent</th><th></th></tr></thead><tbody id="verRows">
          ${versions.slice().sort((a, b) => b.version_no - a.version_no).map((v) => `<tr><td>${esc(v.version_no >= 2 ? q.quotation_number + ' / Rev ' + v.version_no : q.quotation_number)}${v.version_no === q.current_version_no ? ' <span class="pill ok">Current</span>' : ''}</td><td class="num">${MS.money(v.total_amount)}</td><td class="wrap">${esc(v.change_note || '')}</td><td>${esc(MS.when(v.created_at))}${v.sent_to ? '<span class="sub">' + esc(v.sent_to) + '</span>' : ''}</td><td><button type="button" class="linkbtn" data-ver="${esc(v.version_no)}" data-do="view">View</button> · <button type="button" class="linkbtn" data-ver="${esc(v.version_no)}" data-do="pdf">PDF</button></td></tr>`).join('')}
        </tbody></table></div></div>` : ''}
        ${(q.responses || []).length ? `<div class="dpanel wide"><h3>Customer replies</h3><div class="tablewrap"><table class="inv"><thead><tr><th>When</th><th>Revision</th><th>Reply</th><th>Name typed by the customer</th><th>Comment</th></tr></thead><tbody>
          ${q.responses.map((r) => `<tr><td>${esc(MS.when(r.responded_at))}</td><td>${esc(r.version_no)}</td><td>${r.response_type === 'APPROVED' ? '<span class="pill ok">Approved</span>' : '<span class="pill warn">Changes requested</span>'}</td><td>${esc(r.respondent_name)}</td><td class="wrap">${esc(r.comment || '')}</td></tr>`).join('')}
        </tbody></table></div></div>` : ''}
        ${(q.invoices || []).length ? `<div class="dpanel wide"><h3>Invoices made from this proforma</h3><div class="tablewrap"><table class="inv"><tbody>
          ${q.invoices.map((i) => `<tr><td><b>${MS.lnk('finance/invoice.html?id=' + encodeURIComponent(i.invoice_id), i.invoice_number)}</b></td><td class="num">${MS.money(i.total_amount)}</td><td>${MS.pill(i.status)}</td></tr>`).join('')}
        </tbody></table></div></div>` : ''}
        ${(q.links || []).length ? `<div class="dpanel wide"><h3>Customer links</h3><p class="fin-note">${q.links.map((l) => 'Revision ' + esc(l.version_no) + ' to ' + esc(l.sent_to) + ': ' + (l.views ? 'opened ' + esc(l.views) + ' time' + (l.views === 1 ? '' : 's') + ', last ' + esc(MS.when(l.last_viewed_at)) : 'not opened yet') + ', works until ' + esc(MS.shortDate(l.expires_at))).join('<br>')}</p></div>` : ''}
      </div>`;
    if ($('jobRows')) MS.clickable($('jobRows'));
    if ($('verRows')) $('verRows').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-ver]');
      if (!b) return;
      if (b.dataset.do === 'pdf') MS.docs.pdf('proforma', quote.quotation_id, Number(b.dataset.ver), b); else MS.docs.preview('proforma', quote.quotation_id, Number(b.dataset.ver));
    });

    if (canEdit) {
      $('linesBox').innerHTML = `<div class="qhead" style="margin-bottom:12px">
          <label>Valid until <input id="eValid" type="date" value="${esc(String(q.valid_until || '').slice(0, 10))}"></label>
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
      $('linesBox').innerHTML = `<div class="tablewrap"><table class="inv"><thead><tr><th>Qty</th><th>Item</th><th>Description</th><th>U/M</th><th>Delivery</th><th class="num">Unit price</th><th class="num">Total</th></tr></thead><tbody>
        ${items.length ? items.map((i) => `<tr><td>${esc(MS.num(i.quantity))}</td><td class="wrap">${esc(i.item_name || '')}</td><td class="wrap pre">${esc(i.description)}</td><td>${esc(i.unit || '')}</td><td class="wrap">${esc(i.delivery_text || '')}</td><td class="num">${MS.money(i.unit_price)}</td><td class="num">${MS.money(i.line_total)}</td></tr>`).join('') : '<tr><td colspan="7" class="empty">No lines.</td></tr>'}
      </tbody></table></div>`;
    }
  }

  async function saveChanges() {
    const items = editor.items();
    const bad = check(items);
    if (bad) { $('editError').textContent = bad; return; }
    $('editError').textContent = '';
    MS.busy($('saveLines'), true, 'Saving…');
    try {
      const q = await MS.call('QUOTATION_UPDATE', { quotation_id: quote.quotation_id, items, discount_amount: Number($('eDiscount').value) || 0,
        valid_until: $('eValid').value });
      render(q);
      MS.setMsg('dStatus', 'Changes saved.', 'ok');
    } catch (err) { $('editError').textContent = err.message; MS.busy($('saveLines'), false); }
  }

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
    if (a === 'preview') return MS.docs.preview('proforma', q.quotation_id);
    if (a === 'pdf') return MS.docs.pdf('proforma', q.quotation_id, undefined, b);
    if (a === 'email') {
      if (editor && $('saveLines') && dirty()) { await MS.alert('Save your changes to the lines first, then send.', 'Unsaved changes'); return; }
      return MS.docs.send('proforma', q.quotation_id, () => load());
    }
    if (a === 'invoice') {
      if (await MS.confirm({ title: 'Create invoice', message: 'Make the invoice for ' + q.customer_name + ' from ' + q.quotation_number + ' (' + MS.money(q.total_amount) + ', lines and VAT copied)? It goes into the books; you then send it to the customer.', confirmText: 'Create invoice' })) {
        MS.busy(b, true, 'Creating…');
        try { const i = await MS.call('INVOICE_FROM_PROFORMA', { quotation_id: q.quotation_id }); location.href = 'finance/invoice.html?id=' + encodeURIComponent(i.invoice_id); } catch (err) { MS.busy(b, false); MS.alert(err.message); }
      }
      return;
    }
    if (a === 'print') return window.print();
    if (editor && a !== 'cancel' && $('saveLines') && dirty()) {
      const go = await MS.confirm({ title: 'Unsaved changes', message: 'You have changed the lines but not saved them. Continue without saving?', confirmText: 'Continue' });
      if (!go) return;
    }
    if (a === 'send') {
      const first = !(q.versions || []).length;
      if (first) {
        if (await MS.confirm({ title: 'Mark as sent', message: 'Record that proforma invoice ' + q.quotation_number + ' was sent to ' + q.customer_name + '? The lines are frozen as version 1.', confirmText: 'Mark as sent' }))
          direct(() => act('QUOTATION_SEND'), 'Marked as sent.');
      } else {
        await ask({ title: 'Send the revised proforma invoice', info: 'This saves the current lines as a new version.', label: 'What changed?', button: 'Mark as sent',
          run: (t) => act('QUOTATION_SEND', { change_note: t }).then(() => MS.setMsg('dStatus', 'Marked as sent.', 'ok')) });
      }
    } else if (a === 'accept') {
      if (await MS.confirm({ title: 'Customer approved', message: 'Record that ' + q.customer_name + ' approved proforma invoice ' + q.quotation_number + ' (' + MS.money(q.total_amount) + ')?', confirmText: 'Record approval' }))
        direct(() => act('QUOTATION_DECISION', { status: 'ACCEPTED' }), 'Approval recorded. The General Manager has been told to create the job card.');
    } else if (a === 'revise') {
      await ask({ title: 'Revise proforma invoice', info: 'Reopens the proforma invoice so you can change it, then send it again as a new version.', label: 'Reason (optional)', button: 'Reopen for changes',
        run: (t) => act('QUOTATION_REVISE', { reason: t }).then(() => MS.setMsg('dStatus', 'Reopened for changes.', 'ok')) });
    } else if (a === 'reject') {
      await ask({ title: 'Customer rejected', info: 'Record that the customer rejected this quotation.', label: 'Reason', required: true, danger: true, button: 'Record rejection',
        run: (t) => act('QUOTATION_DECISION', { status: 'REJECTED', reason: t }).then(() => MS.setMsg('dStatus', 'Rejection recorded.', 'ok')) });
    } else if (a === 'expire') {
      if (await MS.confirm({ title: 'Mark expired', message: 'The customer did not answer in time. Mark proforma invoice ' + q.quotation_number + ' as expired?', confirmText: 'Mark expired' }))
        direct(() => act('QUOTATION_DECISION', { status: 'EXPIRED' }), 'Marked as expired.');
    } else if (a === 'cancel') {
      await ask({ title: 'Cancel proforma invoice', info: 'Cancel ' + q.quotation_number + '. This cannot be undone.', label: 'Reason', required: true, danger: true, button: 'Cancel proforma invoice',
        run: (t) => act('QUOTATION_DECISION', { status: 'CANCELLED', reason: t }).then(() => MS.setMsg('dStatus', 'Proforma invoice cancelled.', 'ok')) });
    } else if (a === 'approve') {
      await ask({ title: 'Approve discount', info: 'Approve a discount of ' + MS.money(q.discount_amount) + ' on ' + q.quotation_number + ' (subtotal ' + MS.money(q.subtotal) + ').', label: 'Comment (optional)', button: 'Approve discount',
        run: (t) => act('QUOTATION_APPROVE', { comment: t }).then(() => MS.setMsg('dStatus', 'Discount approved.', 'ok')) });
    }
  }

  function dirty() {
    if (!editor || !quote) return false;
    const now = JSON.stringify(editor.items().map((i) => [i.service_id || '', i.item_name || '', i.description, i.quantity, i.unit || '', i.delivery_text || '', i.unit_price]));
    const was = JSON.stringify((quote.items || []).map((i) => [i.service_id || '', i.item_name || '', i.description, Number(i.quantity), i.unit || '', i.delivery_text || '', Number(i.unit_price)]));
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
      $('dBody').innerHTML = '<p><a class="lnk" href="customers/quotations.html">Back to proforma invoices</a></p>';
    }
  }

  MS.boot({ page: 'quotations', any: ['QUOTATION_VIEW', 'QUOTATION_CREATE'], ref: true }).then(() => {
    $('dActions').addEventListener('click', onAction);
    if (id && !isNew) MS.reload = () => load();
    if (isNew) { MS.setMsg('dStatus', ''); renderNew(); } else if (id) load();
    else { MS.setMsg('dStatus', 'No proforma invoice chosen.', 'error'); $('dBody').innerHTML = '<p><a class="lnk" href="customers/quotations.html">Back to proforma invoices</a></p>'; }
  });
})();
