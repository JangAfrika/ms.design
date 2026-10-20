/* Customers: search, filter, page through; add a customer; each row opens the customer page. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const state = { page: 1, q: '', status: '' };

  MS.reload = () => load();
  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    try {
      const r = await MS.recall('CUSTOMER_LIST', { page: state.page, page_size: 50, search: state.q, filters: { status: state.status }, sort: 'customer_name', dir: 'asc' });
      MS.setMsg('listMsg', r.total + ' customer' + (r.total === 1 ? '' : 's'));
      $('listBody').innerHTML = r.rows.length ? r.rows.map((c) => `
        <tr class="clk" data-href="customers/customer.html?id=${encodeURIComponent(c.customer_id)}">
          <td>${esc(c.customer_number)}</td>
          <td><b>${MS.lnk('customers/customer.html?id=' + encodeURIComponent(c.customer_id), c.customer_name)}</b>${c.is_major_client === true ? ' <span class="pill pending">Major</span>' : ''}</td>
          <td>${esc(MS.label(c.customer_type))}</td>
          <td>${esc(c.phone || '')}${c.email ? `<div class="sub">${esc(c.email)}</div>` : ''}</td>
          <td>${esc(c.account_manager_name || '')}</td>
          <td>${MS.pill(c.status)}</td>
        </tr>`).join('') : `<tr><td colspan="6" class="empty">${state.q ? 'No customer matches.' : 'No customers yet.'}</td></tr>`;
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
    const c = await MS.customerForm(null);
    if (c) location.href = 'customers/customer.html?id=' + encodeURIComponent(c.customer_id);
  }

  MS.boot({ page: 'customers', any: ['CUSTOMER_VIEW'], ref: true }).then(() => {
    $('statusFilter').innerHTML = MS.options(['ACTIVE', 'INACTIVE', 'BLOCKED'], '', 'Any status');
    $('addBtn').hidden = !MS.can('CUSTOMER_CREATE');
    $('addBtn').addEventListener('click', add);
    $('search').addEventListener('input', MS.debounce(() => { state.q = $('search').value.trim(); state.page = 1; load(); }, 300));
    $('statusFilter').addEventListener('change', () => { state.status = $('statusFilter').value; state.page = 1; load(); });
    $('reloadBtn').addEventListener('click', load);
    MS.clickable($('listBody'));
    load();
    if (MS.param('add') && MS.can('CUSTOMER_CREATE')) add();
  });
})();
