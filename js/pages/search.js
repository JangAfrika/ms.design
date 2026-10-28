(function () {
  const MS = window.MS;
  const { $, esc } = MS;

  const table = (head, rows, empty) => `<div class="tablewrap"><table class="inv"><thead><tr>${head.map((h) => `<th${h.num ? ' class="num"' : ''}>${esc(h.t || h)}</th>`).join('')}</tr></thead><tbody class="clkbox">
    ${rows.length ? rows.join('') : `<tr><td colspan="${head.length}" class="empty">${esc(empty || 'Nothing found.')}</td></tr>`}</tbody></table></div>`;
  const panel = (title, n, body) => `<div class="dpanel wide"><h3>${esc(title)} <span class="pill off">${n}</span></h3>${body}</div>`;
  const row = (href, cells) => `<tr class="clk" data-href="${esc(href)}">${cells.map((c) => `<td${c.cls ? ` class="${c.cls}"` : ''}>${c.h !== undefined ? c.h : esc(c)}</td>`).join('')}</tr>`;

  async function run(q) {
    $('sTitle').textContent = q ? 'Search: ' + q : 'Search';
    document.title = (q ? 'Search: ' + q : 'Search') + ' · MS BMS';
    $('sBody').innerHTML = '';
    if (!q) { MS.setMsg('sMsg', 'Type what you are looking for: a job number, customer name, phone number, proforma invoice number or a person.'); return; }
    if (q.length < 2) { MS.setMsg('sMsg', 'Type at least 2 characters.', 'error'); return; }
    MS.setMsg('sMsg', 'Searching…');
    try {
      const r = await MS.call('SEARCH', { q });
      const parts = [];
      let n = 0;
      if (r.jobs) {
        n += r.jobs.length;
        parts.push(panel('Jobs', r.jobs.length, table(['Job', 'Name', 'Customer', 'Status', 'Deadline'], r.jobs.map((j) => {
          const href = 'jobs/job.html?id=' + encodeURIComponent(j.job_id);
          return row(href, [{ h: `<b>${MS.lnk(href, j.job_number)}</b>` }, j.job_name, j.customer_name || '',
            { h: MS.pill(j.status, MS.statusLabel(j.status, 'jobs')) }, { h: esc(MS.when(j.customer_deadline)), cls: j.overdue ? 'late' : '' }]);
        }), 'No jobs match.')));
      }
      if (r.customers) {
        n += r.customers.length;
        parts.push(panel('Customers', r.customers.length, table(['No.', 'Customer', 'Phone'], r.customers.map((c) => {
          const href = 'customers/customer.html?id=' + encodeURIComponent(c.customer_id);
          return row(href, [c.customer_number, { h: `<b>${MS.lnk(href, c.customer_name)}</b>` }, c.phone || '']);
        }), 'No customers match.')));
      }
      if (r.quotations) {
        n += r.quotations.length;
        parts.push(panel('Proforma invoices', r.quotations.length, table(['No.', 'Customer', 'Status'], r.quotations.map((x) => {
          const href = 'customers/quotation.html?id=' + encodeURIComponent(x.quotation_id);
          return row(href, [{ h: `<b>${MS.lnk(href, x.quotation_number)}</b>` }, x.customer_name || '', { h: MS.pill(x.status, MS.statusLabel(x.status, 'quotations')) }]);
        }), 'No proforma invoices match.')));
      }
      if (r.employees) {
        n += r.employees.length;
        parts.push(panel('Employees', r.employees.length, table(['No.', 'Name', 'Status'], r.employees.map((e) => {
          const href = 'people/employee.html?id=' + encodeURIComponent(e.employee_id);
          return row(href, [e.employee_number, { h: `<b>${MS.lnk(href, e.name)}</b>` }, { h: MS.pill(e.status) }]);
        }), 'No employees match.')));
      }
      const none = parts.filter((x) => / <span class="pill off">0<\/span>/.test(x)).map((x) => x.match(/<h3>([^<]+) </)[1].toLowerCase());
      MS.setMsg('sMsg', n ? n + ' result' + (n === 1 ? '' : 's') + ' (up to 10 of each kind)' + (none.length ? '. Nothing in ' + none.join(', ') + '.' : '') : 'Nothing matches "' + q + '".');
      $('sBody').innerHTML = (n ? parts.filter((x) => !/ <span class="pill off">0<\/span>/.test(x)) : parts).join('');
      document.querySelectorAll('#sBody .clkbox').forEach(MS.clickable);
    } catch (err) { MS.setMsg('sMsg', err.message, 'error'); }
  }

  MS.boot({ page: 'search' }).then(() => {
    const q = MS.param('q').trim();
    $('sInput').value = q;
    $('sForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = $('sInput').value.trim();
      history.replaceState(null, '', 'search.html' + (v ? '?q=' + encodeURIComponent(v) : ''));
      if (MS.$('appSearchInput')) MS.$('appSearchInput').value = v;
      run(v);
    });
    run(q);
  });
})();
