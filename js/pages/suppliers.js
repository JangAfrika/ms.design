/* Suppliers: Procurement keeps the list (contact, terms, status); bank details are seen and changed by Finance only. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const sc = MS.sc;
  const state = { page: 1, q: '', status: '' };

  MS.reload = () => load();
  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    try {
      const r = await MS.recall('SUPPLIER_LIST', { page: state.page, page_size: 50, search: state.q, filters: { status: state.status } });
      const owed = r.rows.some((s) => s.balance_owed !== undefined);
      $('owedHead').hidden = !owed;
      MS.setMsg('listMsg', r.total + ' supplier' + (r.total === 1 ? '' : 's'));
      $('listBody').innerHTML = r.rows.length ? r.rows.map((s) => `
        <tr class="clk${s.status === 'BLACKLISTED' ? ' void' : ''}" data-id="${esc(s.supplier_id)}">
          <td><a class="lnk" href="#" data-id="${esc(s.supplier_id)}">${esc(s.supplier_number)}</a></td>
          <td><b>${esc(s.supplier_name)}</b>${s.email ? `<div class="sub">${esc(s.email)}</div>` : ''}</td>
          <td>${esc(s.phone || '')}</td>
          <td>${Number(s.payment_terms_days) ? esc(s.payment_terms_days) + ' days' : 'On delivery'}</td>
          <td class="num">${esc(s.open_orders)}</td>
          ${owed ? `<td class="num">${MS.money(s.balance_owed)}</td>` : ''}
          <td>${MS.pill(s.status, MS.statusLabel(s.status, 'suppliers'))}</td>
        </tr>`).join('') : `<tr><td colspan="7" class="empty">${state.q || state.status ? 'No supplier matches.' : 'No suppliers yet.'}</td></tr>`;
      sc.pager('pager', r, state, load);
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  function openForm(s) {
    const manage = MS.can('SUPPLIER_MANAGE');
    const bank = MS.can('SUPPLIER_PAYMENT_PREPARE');
    const f = $('supForm');
    f.reset();
    $('supError').textContent = '';
    $('supTitle').textContent = s ? 'Edit ' + s.supplier_name : 'Add supplier';
    $('sName').value = s ? s.supplier_name : '';
    $('sPhone').value = s ? s.phone || '' : '';
    $('sEmail').value = s ? s.email || '' : '';
    $('sTin').value = s ? s.tin_number || '' : '';
    $('sAddress').value = s ? s.address || '' : '';
    $('sTerms').value = s ? s.payment_terms_days : 0;
    $('sStatus').innerHTML = MS.options(['ACTIVE', 'INACTIVE', 'BLACKLISTED'].map((x) => ({ value: x, label: MS.statusLabel(x, 'suppliers') })), s ? s.status : 'ACTIVE');
    $('sStatusLbl').hidden = !s;
    $('sReasonLbl').hidden = !s;
    $('sBankLbl').hidden = !bank;
    $('sBank').value = s && bank ? s.bank_details || '' : '';
    f.querySelectorAll('[name]').forEach((el) => { el.disabled = !manage; });
    const dlg = MS.openDialog('supDialog');
    $('supCancel').onclick = () => dlg.close();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = manage ? MS.formData(f) : {};
      if (manage && !d.supplier_name) { $('supError').textContent = 'Enter the supplier name.'; return; }
      if (manage && d.payment_terms_days === '') d.payment_terms_days = 0;
      if (s) d.supplier_id = s.supplier_id; else { delete d.status; delete d.reason; }
      if (s && !d.reason) delete d.reason;
      if (bank && (!s || $('sBank').value.trim() !== (s.bank_details || ''))) d.bank_details = $('sBank').value.trim();
      if (!manage && !('bank_details' in d)) { dlg.close(); return; }
      if (s && d.status === 'BLACKLISTED' && s.status !== 'BLACKLISTED' && !d.reason) { $('supError').textContent = 'Give the reason for blacklisting this supplier.'; return; }
      MS.busy($('supSave'), true, 'Saving…');
      try {
        try { await MS.call('SUPPLIER_SAVE', d); } catch (err) {
          if (err.code !== 'DUPLICATE' || !(await MS.confirm({ title: 'Possible duplicate', message: err.message + ' Add it anyway?', confirmText: 'Add anyway' }))) throw err;
          await MS.call('SUPPLIER_SAVE', Object.assign(d, { confirm_duplicate: true }));
        }
        dlg.close();
        load();
        if (s) view(s.supplier_id);
      } catch (err) { $('supError').textContent = err.message; } finally { MS.busy($('supSave'), false); }
    };
  }

  function view(id) {
    return sc.view(() => MS.call('SUPPLIER_GET', { supplier_id: id }), (s) => ({
      html: `<h3>${esc(s.supplier_name)} ${MS.pill(s.status, MS.statusLabel(s.status, 'suppliers'))}</h3>
        <div class="dgrid" style="margin-top:8px">
          <div class="dpanel">${MS.kv([['Number', s.supplier_number], ['Phone', s.phone || ''], ['Email', s.email || ''], ['Address', s.address || ''], ['TIN', s.tin_number || ''],
            ['Payment terms', Number(s.payment_terms_days) ? s.payment_terms_days + ' days' : 'On delivery'], ['Bank details', MS.can('SUPPLIER_PAYMENT_PREPARE') || MS.can('FINANCE_VIEW') ? s.bank_details || '' : '']])}</div>
          <div class="dpanel"><h3>Recent orders</h3>${(s.orders || []).length ? `<ul class="mini-list">${s.orders.map((o) => `<li><span>${MS.lnk('purchasing/purchase-orders.html?id=' + encodeURIComponent(o.purchase_order_id), o.po_number)} · ${esc(MS.shortDate(o.order_date))}</span><span class="n">${o.total_amount !== undefined ? MS.money(o.total_amount) : ''} ${MS.pill(o.status)}</span></li>`).join('')}</ul>` : '<p class="fin-note">No orders yet.</p>'}</div>
          ${s.bills ? `<div class="dpanel wide"><h3>Bills</h3>${s.bills.length ? `<ul class="mini-list">${s.bills.map((b) => `<li><span>${MS.lnk('purchasing/supplier-bills.html?id=' + encodeURIComponent(b.supplier_invoice_id), b.supplier_invoice_ref)} · due ${esc(MS.shortDate(b.due_date))}</span><span class="n">${MS.money(b.outstanding)} owed of ${MS.money(b.amount)} ${MS.pill(b.status)}</span></li>`).join('')}</ul>` : '<p class="fin-note">No bills yet.</p>'}</div>` : ''}
          ${sc.history(s.history)}
        </div>`,
      buttons: [MS.canAny(['SUPPLIER_MANAGE', 'SUPPLIER_PAYMENT_PREPARE']) && ['vEdit', 'Edit', 'primary', () => { sc.closeView(); openForm(s); }]]
    }));
  }

  MS.boot({ page: 'suppliers', any: ['SUPPLIER_MANAGE', 'PO_CREATE', 'FINANCE_VIEW'], ref: true }).then(() => {
    $('statusFilter').innerHTML = MS.options(['ACTIVE', 'INACTIVE', 'BLACKLISTED'].map((x) => ({ value: x, label: MS.statusLabel(x, 'suppliers') })), '', 'Any status');
    $('newBtn').hidden = !MS.can('SUPPLIER_MANAGE');
    $('newBtn').addEventListener('click', () => openForm(null));
    $('search').addEventListener('input', MS.debounce(() => { state.q = $('search').value.trim(); state.page = 1; load(); }, 300));
    $('statusFilter').addEventListener('change', () => { state.status = $('statusFilter').value; state.page = 1; load(); });
    $('reloadBtn').addEventListener('click', load);
    $('listBody').addEventListener('click', (e) => {
      const el = e.target.closest('[data-id]');
      if (!el) return;
      e.preventDefault();
      view(el.dataset.id);
    });
    load();
    if (MS.param('id')) view(MS.param('id'));
  });
})();
