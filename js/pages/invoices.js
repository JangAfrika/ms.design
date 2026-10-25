/* Invoices: what customers owe. Filters by status, type, customer and overdue; "New invoice" for a job or a customer. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const state = { page: 1, q: '', status: '', type: '', customer: MS.param('customer'), overdue: !!MS.param('overdue'), open: false };

  async function ageing() {
    try {
      const a = await MS.call('INVOICE_AGEING', {});
      const t = a.totals;
      const late = MS.fin.r2(t['1-30'] + t['31-60'] + t['61-90'] + t['90+']);
      $('ageCards').innerHTML = `
        <div class="card"><div class="k">Customers owe</div><div class="v">${MS.money(t.total)}</div><div class="s">${a.rows.length} customer${a.rows.length === 1 ? '' : 's'} with open invoices</div></div>
        <div class="card"><div class="k">Not yet due</div><div class="v">${MS.money(t.CURRENT)}</div><div class="s">within payment terms</div></div>
        <div class="card${late > 0 ? ' red' : ''}"><div class="k">Overdue</div><div class="v">${MS.money(late)}</div><div class="s">1–30 ${esc(MS.money(t['1-30']))} · 31–60 ${esc(MS.money(t['31-60']))}</div></div>
        <div class="card${t['90+'] > 0 ? ' red' : ''}"><div class="k">Over 60 days</div><div class="v">${MS.money(MS.fin.r2(t['61-90'] + t['90+']))}</div><div class="s">over 90 days ${esc(MS.money(t['90+']))}</div></div>`;
    } catch (err) { $('ageCards').innerHTML = ''; }
  }

  MS.reload = () => load();
  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    try {
      const r = await MS.recall('INVOICE_LIST', { page: state.page, page_size: 50, search: state.q, overdue: state.overdue, open: state.open,
        filters: { status: state.status, invoice_type: state.type, customer_id: state.customer }, sort: 'invoice_date', dir: 'desc' });
      MS.setMsg('listMsg', r.total + ' invoice' + (r.total === 1 ? '' : 's') + (r.totals ? ' · open balance ' + MS.money(r.totals.balance_due) : ''));
      $('listBody').innerHTML = r.rows.length ? r.rows.map((i) => {
        const href = 'finance/invoice.html?id=' + encodeURIComponent(i.invoice_id);
        const cn = i.invoice_type === 'CREDIT_NOTE';
        return `<tr class="clk${i.status === 'VOID' ? ' void' : ''}" data-href="${esc(href)}">
          <td><b>${MS.lnk(href, i.status === 'DRAFT' ? 'Draft' : i.invoice_number)}</b>${i.invoice_type !== 'INVOICE' ? `<span class="sub">${esc(MS.label(i.invoice_type))}</span>` : ''}</td>
          <td>${esc(MS.shortDate(i.invoice_date))}</td>
          <td class="wrap">${esc(i.customer_name)}</td>
          <td>${esc(i.job_number || '')}</td>
          <td>${cn ? '' : esc(MS.shortDate(i.due_date))}${i.is_overdue ? `<span class="sub late">${esc(i.days_overdue)} days late</span>` : ''}</td>
          <td class="num${cn ? ' neg' : ''}">${cn ? '− ' : ''}${MS.money(i.total_amount)}</td>
          <td class="num">${cn || i.status === 'VOID' || i.status === 'DRAFT' ? '' : MS.money(i.balance_due)}</td>
          <td>${MS.pill(i.is_overdue ? 'OVERDUE' : i.status, i.is_overdue ? 'Overdue' : MS.statusLabel(i.status, 'invoices'))}</td>
        </tr>`;
      }).join('') : `<tr><td colspan="8" class="empty">${state.q || state.status || state.overdue ? 'No invoice matches.' : 'No invoices yet.'}</td></tr>`;
      pager(r);
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  function pager(r) {
    const pages = Math.max(1, Math.ceil(r.total / r.page_size));
    $('pager').innerHTML = pages > 1 ? `<button type="button" id="pPrev"${state.page <= 1 ? ' disabled' : ''}>Previous</button><span>Page ${state.page} of ${pages}</span><button type="button" id="pNext"${state.page >= pages ? ' disabled' : ''}>Next</button>` : '';
    if (pages > 1) { $('pPrev').onclick = () => { state.page--; load(); }; $('pNext').onclick = () => { state.page++; load(); }; }
  }

  async function openNew(pre) {
    pre = pre || {};
    const f = $('newForm');
    f.reset();
    $('newError').textContent = '';
    $('nDepositRow').hidden = true;
    const custs = await MS.fin.customers().catch(() => []);
    $('nCustomer').innerHTML = MS.options(custs.map((c) => ({ value: c.customer_id, label: c.customer_name + ' (' + c.customer_number + ')' })), pre.customer || '', '— choose customer —');
    const jobs = async () => {
      $('nJob').innerHTML = '<option value="">— no job (type the lines) —</option>';
      if (!$('nCustomer').value) return;
      try {
        const o = await MS.call('CUSTOMER_OPEN_ITEMS', { customer_id: $('nCustomer').value });
        $('nJob').innerHTML = MS.options(o.jobs.map((j) => ({ value: j.job_id, label: j.job_number + ' – ' + j.job_name + ' (' + MS.statusLabel(j.status, 'jobs') + ')' })), pre.job || '', '— no job (type the lines) —');
      } catch (err) { $('newError').textContent = err.message; }
    };
    $('nCustomer').onchange = jobs;
    $('nType').onchange = () => { $('nDepositRow').hidden = $('nType').value !== 'DEPOSIT_INVOICE'; };
    await jobs();
    const dlg = MS.openDialog('newDialog');
    $('newCancel').onclick = () => dlg.close();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = MS.formData(f);
      if (!d.customer_id) { $('newError').textContent = 'Choose the customer.'; return; }
      if (d.invoice_type === 'DEPOSIT_INVOICE' && !d.job_id) { $('newError').textContent = 'A deposit invoice is for a job: choose the job.'; return; }
      if (!d.job_id) { location.href = 'finance/invoice.html?new=1&customer=' + encodeURIComponent(d.customer_id); return; }
      const payload = { customer_id: d.customer_id, job_id: d.job_id, invoice_type: d.invoice_type };
      if (d.invoice_type === 'DEPOSIT_INVOICE') { payload.deposit_pct = d.deposit_pct; payload.deposit_amount = d.deposit_amount; }
      MS.busy($('newSave'), true, 'Creating…');
      try {
        const inv = await MS.call('INVOICE_CREATE', payload);
        location.href = 'finance/invoice.html?id=' + encodeURIComponent(inv.invoice_id);
      } catch (err) { $('newError').textContent = err.message; MS.busy($('newSave'), false); }
    };
  }

  MS.boot({ page: 'invoices', any: ['FINANCE_VIEW', 'INVOICE_CREATE', 'PAYMENT_RECORD'], ref: true }).then(async () => {
    $('statusFilter').innerHTML = MS.options(['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID'].map((s) => ({ value: s, label: MS.statusLabel(s, 'invoices') })), '', 'Any status');
    $('typeFilter').innerHTML = MS.options([{ value: 'INVOICE', label: 'Invoices' }, { value: 'DEPOSIT_INVOICE', label: 'Deposit invoices' }, { value: 'CREDIT_NOTE', label: 'Credit notes' }], '', 'All types');
    $('overdueOnly').checked = state.overdue;
    $('newBtn').hidden = !MS.can('INVOICE_CREATE');
    $('newBtn').addEventListener('click', () => openNew({}));
    $('search').addEventListener('input', MS.debounce(() => { state.q = $('search').value.trim(); state.page = 1; load(); }, 300));
    $('statusFilter').addEventListener('change', () => { state.status = $('statusFilter').value; state.page = 1; load(); });
    $('typeFilter').addEventListener('change', () => { state.type = $('typeFilter').value; state.page = 1; load(); });
    $('custFilter').addEventListener('change', () => { state.customer = $('custFilter').value; state.page = 1; load(); });
    $('overdueOnly').addEventListener('change', () => { state.overdue = $('overdueOnly').checked; state.page = 1; load(); });
    $('openOnly').addEventListener('change', () => { state.open = $('openOnly').checked; state.page = 1; load(); });
    $('reloadBtn').addEventListener('click', () => { load(); ageing(); });
    MS.clickable($('listBody'));
    MS.fin.customers().then((cs) => { $('custFilter').innerHTML = MS.options(cs.map((c) => ({ value: c.customer_id, label: c.customer_name })), state.customer, 'All customers'); }).catch(() => {});
    ageing();
    load();
    if ((MS.param('new') || MS.param('job')) && MS.can('INVOICE_CREATE')) openNew({ customer: MS.param('customer'), job: MS.param('job') });
  });
})();
