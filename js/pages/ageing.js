/* Receivables ageing: what each customer owes, by how late it is (INVOICE_AGEING), as at a date. Click a customer for the account. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const fin = MS.fin;
  const BUCKETS = ['CURRENT', '1-30', '31-60', '61-90', '90+'];
  let data = null;
  const cell = (n, red) => `<td class="num${red && Number(n) > 0 ? ' neg' : ''}">${Number(n) ? MS.money(n) : '–'}</td>`;
  const late = (r) => fin.r2(r['1-30'] + r['31-60'] + r['61-90'] + r['90+']);

  MS.reload = () => load();
  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    try {
      data = await MS.recall('INVOICE_AGEING', { as_of: $('asOf').value });
      MS.setMsg('listMsg', 'As at ' + MS.shortDate(data.as_of));
      draw();
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  function draw() {
    const t = data.totals;
    const q = $('search').value.trim().toLowerCase();
    const rows = data.rows.filter((r) => (!$('lateOnly').checked || late(r) > 0) && (!q || r.customer_name.toLowerCase().includes(q)));
    $('ageCards').innerHTML = `
      <div class="card"><div class="k">Customers owe</div><div class="v">${MS.money(t.total)}</div><div class="s">${data.rows.length} customer${data.rows.length === 1 ? '' : 's'}</div></div>
      <div class="card"><div class="k">Not yet due</div><div class="v">${MS.money(t.CURRENT)}</div><div class="s">within payment terms</div></div>
      <div class="card${late(t) > 0 ? ' red' : ''}"><div class="k">Overdue</div><div class="v">${MS.money(late(t))}</div><div class="s">${t.total ? esc(Math.round(100 * late(t) / t.total) + ' % of what is owed') : '&nbsp;'}</div></div>
      <div class="card${t['90+'] > 0 ? ' red' : ''}"><div class="k">Over 90 days</div><div class="v">${MS.money(t['90+'])}</div><div class="s">chase or escalate</div></div>`;
    $('listBody').innerHTML = rows.length ? rows.map((r) => {
      const href = 'customers/customer.html?id=' + encodeURIComponent(r.customer_id) + '#account';
      return `<tr class="clk" data-href="${esc(href)}"><td class="wrap"><b>${MS.lnk(href, r.customer_name)}</b></td>${BUCKETS.map((b) => cell(r[b], b !== 'CURRENT')).join('')}
        <td class="num"><b>${MS.money(r.total)}</b></td>${cell(r.advance)}</tr>`;
    }).join('') : '<tr><td colspan="8" class="empty">' + (data.rows.length ? 'No customer matches.' : 'Nobody owes anything.') + '</td></tr>';
    const sum = (k) => fin.r2(rows.reduce((s, r) => s + (Number(r[k]) || 0), 0));
    $('listFoot').innerHTML = rows.length ? `<tr class="tot"><td>Total</td>${BUCKETS.map((b) => `<td class="num">${MS.money(sum(b))}</td>`).join('')}<td class="num">${MS.money(sum('total'))}</td><td class="num">${MS.money(sum('advance'))}</td></tr>` : '';
    MS.clickable($('listBody'));
  }

  MS.boot({ page: 'ageing', any: ['FINANCE_VIEW', 'INVOICE_CREATE', 'PAYMENT_RECORD'] }).then(() => {
    $('asOf').value = MS.todayISO();
    $('asOf').addEventListener('change', load);
    $('lateOnly').addEventListener('change', () => data && draw());
    $('search').addEventListener('input', MS.debounce(() => data && draw(), 200));
    $('reloadBtn').addEventListener('click', load);
    $('printBtn').addEventListener('click', () => window.print());
    load();
  });
})();
