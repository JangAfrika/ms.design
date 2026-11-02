(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const state = { page: 1, q: '', status: '' };
  const STATUSES = ['DRAFT', 'SENT', 'CHANGES_REQUESTED', 'REVISED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED'];

  MS.reload = () => load();
  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    try {
      const r = await MS.recall('QUOTATION_LIST', { page: state.page, page_size: 50, search: state.q, filters: { status: state.status === 'AWAITING' ? '' : state.status }, awaiting_job: state.status === 'AWAITING', sort: 'quotation_number', dir: 'desc' });
      MS.setMsg('listMsg', r.total + ' proforma invoice' + (r.total === 1 ? '' : 's'));
      const today = MS.todayISO();
      $('listBody').innerHTML = r.rows.length ? r.rows.map((q) => {
        const href = 'customers/quotation.html?id=' + encodeURIComponent(q.quotation_id);
        const stale = q.status === 'SENT' && q.valid_until && String(q.valid_until).slice(0, 10) < today;
        return `<tr class="clk" data-href="${esc(href)}">
          <td><b>${MS.lnk(href, q.quotation_number)}</b></td>
          <td>${esc(q.customer_name || '')}</td>
          <td>${esc(MS.shortDate(q.quotation_date))}</td>
          <td class="${stale ? 'late' : ''}">${esc(MS.shortDate(q.valid_until))}</td>
          <td class="num">${MS.money(q.total_amount)}</td>
          <td>${MS.pill(q.status, MS.statusLabel(q.status, 'quotations'))}${Number(q.discount_amount) > 0 && !q.approved_by && ['DRAFT', 'SENT', 'REVISED'].indexOf(q.status) >= 0 ? ' ' + MS.pill('PENDING', 'Discount to approve') : ''}</td>
        </tr>`;
      }).join('') : `<tr><td colspan="6" class="empty">${state.q || state.status ? 'No proforma invoice matches.' : 'No proforma invoices yet.'}</td></tr>`;
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

  MS.boot({ page: 'quotations', any: ['QUOTATION_VIEW'], ref: true }).then(() => {
    $('statusFilter').innerHTML = MS.options(STATUSES.map((s) => ({ value: s, label: MS.statusLabel(s, 'quotations') })).concat([{ value: 'AWAITING', label: 'Approved, no job card yet' }]), MS.param('status'), 'Any status');
    state.status = $('statusFilter').value;
    $('addBtn').hidden = !MS.can('QUOTATION_CREATE');
    $('search').addEventListener('input', MS.debounce(() => { state.q = $('search').value.trim(); state.page = 1; load(); }, 300));
    $('statusFilter').addEventListener('change', () => { state.status = $('statusFilter').value; state.page = 1; load(); });
    $('reloadBtn').addEventListener('click', load);
    MS.clickable($('listBody'));
    load();
  });
})();
