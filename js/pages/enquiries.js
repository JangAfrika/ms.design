/* Enquiries: log what a customer asks for, acknowledge it in time, quote it or close it. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const state = { page: 1, q: '', status: '' };
  const OPEN = ['NEW', 'ACKNOWLEDGED'];
  let rows = [];

  MS.reload = () => load();
  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    try {
      const r = await MS.recall('ENQUIRY_LIST', { page: state.page, page_size: 50, search: state.q, filters: { status: state.status }, sort: 'received_at', dir: 'desc' });
      rows = r.rows;
      const late = rows.filter((e) => e.overdue).length;
      MS.setMsg('listMsg', r.total + ' enquir' + (r.total === 1 ? 'y' : 'ies') + (late ? ' · ' + late + ' not acknowledged in time' : ''), late ? 'error' : '');
      $('listBody').innerHTML = rows.length ? rows.map((e) => {
        const open = OPEN.indexOf(e.status) >= 0;
        const acts = [
          e.status === 'NEW' && `<button type="button" data-act="ack" data-id="${esc(e.enquiry_id)}">Acknowledge</button>`,
          open && e.customer_id && MS.can('QUOTATION_CREATE') && `<a href="customers/quotation.html?new=1&customer=${encodeURIComponent(e.customer_id)}&enquiry=${encodeURIComponent(e.enquiry_id)}">Quote</a>`,
          open && `<button type="button" data-act="close" data-id="${esc(e.enquiry_id)}">Close</button>`,
          e.quotation_id && MS.can('QUOTATION_VIEW') && `<a href="customers/quotation.html?id=${encodeURIComponent(e.quotation_id)}">Quotation</a>`
        ].filter(Boolean).join('');
        const who = e.customer_id && MS.can('CUSTOMER_VIEW') ? MS.lnk('customers/customer.html?id=' + encodeURIComponent(e.customer_id), e.customer_name) : esc(e.customer_name || '');
        return `<tr>
          <td><b>${esc(e.enquiry_number)}</b><span class="sub">${esc(MS.label(e.channel))}</span></td>
          <td>${who}${e.customer_id ? '' : '<span class="sub">Prospect</span>'}</td>
          <td class="wrap">${esc(String(e.description || '').slice(0, 120))}${String(e.description || '').length > 120 ? '…' : ''}</td>
          <td class="${e.overdue ? 'late' : ''}">${esc(MS.when(e.received_at))}${e.status === 'NEW' && e.acknowledge_due_at ? `<span class="sub">Acknowledge by ${esc(MS.when(e.acknowledge_due_at))}</span>` : ''}</td>
          <td>${MS.pill(e.status, MS.statusLabel(e.status, 'customer_enquiries'))}${e.overdue ? ' ' + MS.pill('OVERDUE', 'Late') : ''}</td>
          <td><div class="acts">${acts}</div></td>
        </tr>`;
      }).join('') : `<tr><td colspan="6" class="empty">${state.q || state.status ? 'No enquiry matches.' : 'No enquiries yet.'}</td></tr>`;
      pager(r);
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  function pager(r) {
    const pages = Math.max(1, Math.ceil(r.total / r.page_size));
    $('pager').innerHTML = pages > 1 ? `<button type="button" id="pPrev"${state.page <= 1 ? ' disabled' : ''}>Previous</button><span>Page ${state.page} of ${pages}</span><button type="button" id="pNext"${state.page >= pages ? ' disabled' : ''}>Next</button>` : '';
    if (pages > 1) {
      $('pPrev').onclick = () => { state.page--; load(); };
      $('pNext').onclick = () => { state.page++; load(); };
    }
  }

  async function add() {
    const f = $('enqForm');
    f.reset();
    $('enqError').textContent = '';
    $('eChannel').innerHTML = MS.options(MS.enumOf('customer_enquiries.channel'), 'WALK_IN');
    $('eCustomer').innerHTML = '<option value="">— new prospect —</option>';
    const dlg = MS.openDialog('enqDialog');
    if (MS.can('CUSTOMER_VIEW')) {
      MS.call('CUSTOMER_LIST', { page_size: 100, sort: 'customer_name', dir: 'asc', filters: { status: 'ACTIVE' } }).then((r) => {
        $('eCustomer').innerHTML = MS.options(r.rows.map((c) => ({ value: c.customer_id, label: c.customer_name + ' (' + c.customer_number + ')' })), '', '— new prospect —');
      }).catch(() => {});
    }
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = MS.formData(f);
      if (!d.customer_id && !d.prospect_name) { $('enqError').textContent = 'Choose a customer or enter the prospect name.'; return; }
      if (!d.description) { $('enqError').textContent = 'Say what the customer needs.'; return; }
      if (d.customer_id) d.prospect_name = '';
      MS.busy($('enqSave'), true, 'Saving…');
      try { await MS.call('ENQUIRY_CREATE', d); dlg.close(); state.page = 1; load(); } catch (err) { $('enqError').textContent = err.message; } finally { MS.busy($('enqSave'), false); }
    };
    $('enqCancel').onclick = () => dlg.close();
  }

  function closeEnquiry(e) {
    const f = $('closeForm');
    f.reset();
    $('closeError').textContent = '';
    $('closeInfo').textContent = 'Close ' + e.enquiry_number + ' (' + (e.customer_name || '') + ') without a quotation. Say why.';
    const dlg = MS.openDialog('closeDialog');
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      const d = MS.formData(f);
      if (!d.reason) { $('closeError').textContent = 'Enter the reason.'; return; }
      MS.busy($('closeSave'), true, 'Closing…');
      try { await MS.call('ENQUIRY_CLOSE', { enquiry_id: e.enquiry_id, status: 'CANCELLED', reason: d.reason }); dlg.close(); load(); } catch (err) { $('closeError').textContent = err.message; } finally { MS.busy($('closeSave'), false); }
    };
    $('closeCancel').onclick = () => dlg.close();
  }

  async function onAction(ev) {
    const b = ev.target.closest('button[data-act]');
    if (!b) return;
    const e = rows.find((x) => x.enquiry_id === b.dataset.id);
    if (!e) return;
    if (b.dataset.act === 'close') return closeEnquiry(e);
    if (b.dataset.act === 'ack') {
      MS.busy(b, true, 'Saving…');
      try { await MS.call('ENQUIRY_ACKNOWLEDGE', { enquiry_id: e.enquiry_id }); load(); } catch (err) { MS.busy(b, false); MS.alert(err.message); }
    }
  }

  MS.boot({ page: 'enquiries', any: ['ENQUIRY_MANAGE'], ref: true }).then(() => {
    $('statusFilter').innerHTML = MS.options(['NEW', 'ACKNOWLEDGED', 'QUOTED', 'WON', 'LOST', 'CANCELLED'].map((s) => ({ value: s, label: MS.statusLabel(s, 'customer_enquiries') })), '', 'Any status');
    $('addBtn').addEventListener('click', add);
    $('search').addEventListener('input', MS.debounce(() => { state.q = $('search').value.trim(); state.page = 1; load(); }, 300));
    $('statusFilter').addEventListener('change', () => { state.status = $('statusFilter').value; state.page = 1; load(); });
    $('reloadBtn').addEventListener('click', load);
    $('listBody').addEventListener('click', onAction);
    load();
    if (MS.param('add')) add();
  });
})();
