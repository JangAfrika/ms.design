/* Payments received: list, record a payment with allocation, receipt (print), allocate an advance, reverse. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const fin = MS.fin;
  const state = { page: 1, q: '', customer: MS.param('customer'), method: '', status: '', adv: !!MS.param('customer') };

  MS.reload = () => load();
  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    try {
      const r = await MS.recall('PAYMENT_LIST', { page: state.page, page_size: 50, search: state.q, unallocated: state.adv,
        filters: { customer_id: state.customer, payment_method: state.method, status: state.status }, sort: 'payment_date', dir: 'desc' });
      MS.setMsg('listMsg', r.total + ' payment' + (r.total === 1 ? '' : 's'));
      $('listBody').innerHTML = r.rows.length ? r.rows.map((p) => `
        <tr class="clk${p.status === 'REVERSED' ? ' void' : ''}" data-id="${esc(p.customer_payment_id)}">
          <td>${esc(MS.shortDate(p.payment_date))}</td>
          <td><b><a class="lnk" href="#" data-id="${esc(p.customer_payment_id)}">${esc(p.receipt_number || '—')}</a></b></td>
          <td class="wrap">${esc(p.customer_name)}</td>
          <td>${esc(MS.label(p.payment_method))}${p.reference ? `<span class="sub">${esc(p.reference)}</span>` : ''}</td>
          <td class="wrap">${esc(p.invoice_numbers || '')}</td>
          <td class="num">${MS.money(p.amount)}</td>
          <td class="num">${Number(p.unallocated_amount) > 0 ? MS.money(p.unallocated_amount) : ''}</td>
          <td>${MS.pill(p.status, MS.statusLabel(p.status, 'customer_payments'))}</td>
        </tr>`).join('') : `<tr><td colspan="8" class="empty">${state.q || state.customer ? 'No payment matches.' : 'No payments recorded yet.'}</td></tr>`;
      pager(r);
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  function pager(r) {
    const pages = Math.max(1, Math.ceil(r.total / r.page_size));
    $('pager').innerHTML = pages > 1 ? `<button type="button" id="pPrev"${state.page <= 1 ? ' disabled' : ''}>Previous</button><span>Page ${state.page} of ${pages}</span><button type="button" id="pNext"${state.page >= pages ? ' disabled' : ''}>Next</button>` : '';
    if (pages > 1) { $('pPrev').onclick = () => { state.page--; load(); }; $('pNext').onclick = () => { state.page++; load(); }; }
  }

  async function view(pid) {
    $('viewError').textContent = '';
    $('viewBody').innerHTML = '<p class="fin-note">Loading…</p>';
    $('viewBtns').innerHTML = '';
    const dlg = $('viewDialog');
    if (!dlg.open) dlg.showModal();
    let p;
    try { p = await MS.call('PAYMENT_GET', { customer_payment_id: pid }); } catch (err) { $('viewBody').innerHTML = ''; $('viewError').textContent = err.message; $('viewBtns').innerHTML = '<button type="button" id="vClose">Close</button>'; $('vClose').onclick = () => dlg.close(); return; }
    const rev = (p.allocations || []).filter((a) => a.status === 'REVERSED');
    $('viewBody').innerHTML = fin.receiptHtml(p) + `
      ${rev.length ? `<p class="fin-note">Reversed allocations: ${rev.map((a) => esc(a.invoice_number) + ' ' + esc(MS.money(a.amount))).join(', ')}</p>` : ''}
      ${(p.journal_entries || []).length && MS.can('FINANCE_VIEW') ? `<p class="fin-note">In the books: ${p.journal_entries.map((e) => MS.lnk('finance/accounts.html?journal=' + encodeURIComponent(e.journal_entry_id), e.entry_number) + ' (' + esc(MS.statusLabel(e.status)) + ')').join(', ')}</p>` : ''}`;
    const live = p.status !== 'REVERSED';
    $('viewBtns').innerHTML = [
      '<button type="button" id="vClose">Close</button>',
      live && Number(p.unallocated_amount) > 0 && MS.can('PAYMENT_RECORD') && '<button type="button" id="vAlloc">Allocate advance to open invoices</button>',
      live && MS.can('FINANCE_APPROVE') && '<button type="button" class="danger" id="vRev">Reverse</button>',
      live && MS.can('PAYMENT_RECORD') && `<button type="button" class="primary" id="vSend">${p.receipt_sent_at ? 'Send receipt again' : 'Send receipt'}</button>`,
      live && '<button type="button" id="vPdf">Receipt PDF</button>',
      '<button type="button" id="vPrint">Print</button>'
    ].filter(Boolean).join('');
    if (p.receipt_sent_at) $('viewBody').insertAdjacentHTML('beforeend', `<p class="fin-note">Receipt emailed ${esc(MS.when(p.receipt_sent_at))}${(p.emails || [])[0] ? ' to ' + esc(p.emails[0].to_email) + ' by ' + esc(p.emails[0].sent_by_name) : ''}.</p>`);
    if ($('vSend')) $('vSend').onclick = () => MS.docs.send('receipt', p.customer_payment_id, () => { view(pid); load(); });
    if ($('vPdf')) $('vPdf').onclick = (e) => MS.docs.pdf('receipt', p.customer_payment_id, undefined, e.currentTarget);
    $('vClose').onclick = () => dlg.close();
    $('vPrint').onclick = () => fin.printHtml(fin.receiptHtml(p));
    if ($('vAlloc')) $('vAlloc').onclick = async () => {
      MS.busy($('vAlloc'), true, 'Allocating…');
      try { await MS.call('PAYMENT_ALLOCATE', { customer_payment_id: p.customer_payment_id }); MS.setMsg('listMsg', 'Advance allocated to the oldest open invoices.', 'ok'); view(pid); load(); }
      catch (err) { MS.busy($('vAlloc'), false); $('viewError').textContent = err.message; }
    };
    if ($('vRev')) $('vRev').onclick = () => reverse(p);
  }

  function reverse(p) {
    const f = $('noteForm');
    f.reset();
    $('noteError').textContent = '';
    $('noteInfo').textContent = 'Reverse receipt ' + p.receipt_number + ' (' + MS.money(p.amount) + ' from ' + p.customer_name + '), e.g. a bounced cheque or a payment recorded twice. The invoices are reopened, the receipt is void and the books get a mirror entry.';
    const dlg = MS.openDialog('noteDialog');
    $('noteCancel').onclick = () => dlg.close();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const t = $('noteText').value.trim();
      if (!t) { $('noteError').textContent = 'Please give the reason.'; return; }
      MS.busy($('noteSave'), true, 'Reversing…');
      try { await MS.call('PAYMENT_REVERSE', { customer_payment_id: p.customer_payment_id, reason: t }); dlg.close(); view(p.customer_payment_id); load(); }
      catch (err) { $('noteError').textContent = err.message; } finally { MS.busy($('noteSave'), false); }
    };
  }

  MS.boot({ page: 'payments', any: ['FINANCE_VIEW', 'PAYMENT_RECORD'], ref: true }).then(() => {
    $('methodFilter').innerHTML = MS.options(MS.enumOf('customer_payments.payment_method'), '', 'Any method');
    $('statusFilter').innerHTML = MS.options(['RECORDED', 'PARTIALLY_ALLOCATED', 'ALLOCATED', 'REVERSED'].map((s) => ({ value: s, label: MS.statusLabel(s, 'customer_payments') })), '', 'Any status');
    $('advOnly').checked = state.adv;
    $('newBtn').hidden = !MS.can('PAYMENT_RECORD');
    $('newBtn').addEventListener('click', async () => { const p = await fin.recordPayment({}); if (p) { load(); if (p.customer_payment_id) view(p.customer_payment_id); } });
    $('search').addEventListener('input', MS.debounce(() => { state.q = $('search').value.trim(); state.page = 1; load(); }, 300));
    $('custFilter').addEventListener('change', () => { state.customer = $('custFilter').value; state.page = 1; load(); });
    $('methodFilter').addEventListener('change', () => { state.method = $('methodFilter').value; state.page = 1; load(); });
    $('statusFilter').addEventListener('change', () => { state.status = $('statusFilter').value; state.page = 1; load(); });
    $('advOnly').addEventListener('change', () => { state.adv = $('advOnly').checked; state.page = 1; load(); });
    $('reloadBtn').addEventListener('click', load);
    $('listBody').addEventListener('click', (e) => {
      const el = e.target.closest('[data-id]');
      if (!el) return;
      e.preventDefault();
      view(el.dataset.id);
    });
    fin.customers().then((cs) => { $('custFilter').innerHTML = MS.options(cs.map((c) => ({ value: c.customer_id, label: c.customer_name })), state.customer, 'All customers'); }).catch(() => {});
    load();
    if (MS.param('id')) view(MS.param('id'));
    if (MS.param('record') && MS.can('PAYMENT_RECORD')) fin.recordPayment({ customer_id: MS.param('customer'), job_id: MS.param('job') }).then((p) => { if (p) load(); });
  });
})();
