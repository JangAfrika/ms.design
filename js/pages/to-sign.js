(function () {
  const MS = window.MS;
  const { $, esc } = MS;

  MS.reload = () => load();
  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    try {
      const r = await MS.call('QUOTATION_TO_SIGN', {});
      MS.setMsg('listMsg', r.total ? r.total + ' proforma invoice' + (r.total === 1 ? '' : 's') + ' waiting for your signature' : 'Nothing is waiting for your signature.');
      $('listBody').innerHTML = r.rows.length ? r.rows.map((q) => {
        const href = 'customers/quotation.html?id=' + encodeURIComponent(q.quotation_id);
        return `<tr class="clk" data-href="${esc(href)}"><td><b>${MS.lnk(href, q.revision_label)}</b></td><td>${esc(q.customer_name)}</td><td class="num">${MS.money(q.total_amount)}</td>
          <td>${esc(MS.when(q.since))}</td><td>${q.discount_pending ? MS.pill('PENDING', 'Discount to approve first') : '<a class="btn primary" href="' + esc(href) + '">Open to sign</a>'}</td></tr>`;
      }).join('') : '<tr><td colspan="5" class="empty">No proforma invoice is waiting.</td></tr>';
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  $('reloadBtn').addEventListener('click', load);
  $('listBody').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-href]'); if (tr && !e.target.closest('a')) location.href = tr.dataset.href; });
  load();
})();
