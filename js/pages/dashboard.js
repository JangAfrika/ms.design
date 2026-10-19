/* Overview: what needs attention today, filtered by the person's role and access. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;

  const jobTable = (list) => `<div class="tablewrap"><table class="inv"><thead><tr><th>Job</th><th>Name</th><th>Customer</th><th>Status</th><th>Deadline</th></tr></thead><tbody class="clkbox">
    ${list.length ? list.map((j) => `<tr class="clk" data-href="jobs/job.html?id=${encodeURIComponent(j.job_id)}"><td><b>${MS.lnk('jobs/job.html?id=' + encodeURIComponent(j.job_id), j.job_number)}</b>${j.priority === 'EMERGENCY' ? ' ' + MS.pill('EMERGENCY', 'Emergency') : ''}</td><td>${esc(j.job_name)}</td><td>${esc(j.customer_name || '')}</td><td>${MS.pill(j.status)}</td><td class="${j.overdue ? 'late' : ''}">${esc(MS.when(j.customer_deadline))}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">None.</td></tr>'}
  </tbody></table></div>`;
  const panel = (title, body, wide) => `<div class="dpanel${wide ? ' wide' : ''}"><h3>${esc(title)}</h3>${body}</div>`;
  const card = (k, v, s, href, tone, area) => ({ area: area || 'jobs', html: `<a class="card${tone ? ' ' + tone : ''}" href="${href}"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div><div class="s">${esc(s || '')}</div></a>` });

  // what each screen is for, in a few words
  const ABOUT = {
    notifications: 'Alerts and messages for you', jobs: 'Every job and its Work Sheet', 'job-new': 'Open a Work Sheet for a new job',
    designs: 'Design tasks, proofs and approvals', items: 'Materials and stock levels', customers: 'Customer records and contacts',
    enquiries: 'New requests from customers', quotations: 'Prices sent to customers', employees: 'Staff records and positions',
    'employment-actions': 'Notices and employment changes', users: 'Logins, resets and roles', roles: 'Who may do what',
    settings: 'Numbers, limits and options', activity: 'Who changed what, and when',
    invoices: 'Bill customers and see what they owe', payments: 'Money received and receipts', expenses: 'Spending, with approval',
    'cash-forecast': 'Cash expected in and out, week by week', budget: 'This year\'s budget against what was spent',
    reports: 'Profit and loss by month', close: 'Close the month and lock the books', 'monthly-report': 'The Finance Manager\'s report for the month',
    accounts: 'Chart of accounts and journal entries', payroll: 'Monthly pay run and payslips',
    requisitions: 'Ask for, approve and issue material', 'stock-counts': 'Count the shelves and explain differences',
    adjustments: 'Damage, loss and found stock, with approval', 'opening-stock': 'What was on the shelves on day one, checked by Finance',
    'purchase-requests': 'Ask for something to be bought',
    'purchase-orders': 'Orders sent to suppliers', 'goods-received': 'Check deliveries into stock',
    'supplier-bills': 'Supplier bills, matching and payments', suppliers: 'Supplier contacts and terms'
  };
  // the screens each job uses most come first
  const FOCUS = [
    [/SYSTEM_ADMIN/, ['users', 'roles', 'employees', 'settings', 'activity']],
    [/CEO|GENERAL_MANAGER/, ['jobs', 'monthly-report', 'reports', 'cash-forecast', 'purchase-requests', 'budget', 'quotations', 'customers', 'designs', 'payroll', 'employees']],
    [/GRAPHIC|DESIGN/, ['designs', 'jobs']],
    [/SALES/, ['enquiries', 'quotations', 'customers', 'jobs', 'job-new']],
    [/STORES/, ['requisitions', 'items', 'goods-received', 'stock-counts', 'adjustments', 'opening-stock', 'purchase-requests', 'jobs']],
    [/PROCUREMENT/, ['purchase-requests', 'purchase-orders', 'goods-received', 'suppliers', 'items', 'jobs']],
    [/FINANCE/, ['invoices', 'payments', 'expenses', 'supplier-bills', 'cash-forecast', 'close', 'monthly-report', 'payroll', 'budget', 'reports']],
    [/PRODUCTION|MACHINE|DRIVER/, ['jobs', 'designs', 'requisitions', 'items']]
  ];

  // the numbers each job watches most come first; everyone starts with what waits for them
  const AREAS = [
    [/SYSTEM_ADMIN/, ['approve', 'accounts', 'people']],
    [/CEO|GENERAL_MANAGER/, ['approve', 'finance', 'jobs', 'sales', 'purchasing', 'design', 'people']],
    [/FINANCE/, ['approve', 'finance', 'purchasing', 'people', 'jobs']],
    [/STORES|PROCUREMENT/, ['approve', 'stores', 'purchasing', 'jobs']],
    [/SALES/, ['approve', 'sales', 'jobs']],
    [/GRAPHIC|DESIGN/, ['approve', 'design', 'jobs']],
    [/PRODUCTION|MACHINE|DRIVER/, ['approve', 'jobs', 'design', 'stores']]
  ];
  const who = () => { const u = MS.user || {}; return [].concat(u.roles || [], u.position_code || []).join(' '); };
  const areaOrder = () => (AREAS.find(([re]) => re.test(who())) || [null, ['approve', 'jobs']])[1];
  const QUICK_MAX = 9;

  function quickStart() {
    const u = MS.user || {};
    const who = [].concat(u.roles || [], u.position_code || []).join(' ');
    const focus = (FOCUS.find(([re]) => re.test(who)) || [null, ['jobs']])[1];
    const pages = [];
    MS.NAV.forEach((g) => g.items.forEach((n) => { if (n.page !== 'dashboard' && n.page !== 'job-new' && (!n.any || MS.canAny(n.any))) pages.push(n); }));
    pages.sort((x, y) => (focus.indexOf(x.page) + 1 || 99) - (focus.indexOf(y.page) + 1 || 99));
    const tile = (href, icon, title, sub, cls) => `<a href="${href}"${cls ? ` class="${cls}"` : ''}><span class="qi">${MS.icon(icon)}</span><span><b>${esc(title)}</b><small>${esc(sub)}</small></span></a>`;
    const actions = [
      MS.can('JOB_CREATE') && tile('jobs/job-new.html', 'plus', 'New job', ABOUT['job-new'], 'do'),
      MS.can('ENQUIRY_MANAGE') && tile('customers/enquiries.html?add=1', 'plus', 'New enquiry', 'Log a customer request', 'do'),
      MS.can('QUOTATION_CREATE') && tile('customers/quotation.html?new=1', 'plus', 'New quotation', 'Price a job for a customer', 'do'),
      MS.can('CUSTOMER_CREATE') && tile('customers/customers.html?add=1', 'plus', 'Add customer', 'Save a new customer', 'do'),
      MS.can('EMPLOYMENT_EDIT') && tile('people/employees.html?add=1', 'plus', 'Add employee', 'Start a staff record', 'do')
    ].filter(Boolean);
    $('dashQuick').innerHTML = actions.join('') + pages.slice(0, QUICK_MAX).map((n) => tile(n.href, n.icon, n.label, ABOUT[n.page] || '')).join('') +
      tile('account.html', 'user', 'My account', 'Password and your details');
    const role = u.position || (u.roles || []).map(MS.label).join(', ');
    $('dashWho').textContent = (role ? role + ' · ' : '') + new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + '  ·  Press / to search';
  }

  function approvalHref(a) {
    if (a.kind === 'QUOTATION_DISCOUNT') return 'customers/quotation.html?id=' + encodeURIComponent(a.id);
    if (a.kind === 'EMPLOYMENT_ACTION') return 'people/employment-actions.html';
    if (a.kind === 'EXPENSE') return 'finance/expenses.html?id=' + encodeURIComponent(a.id);
    if (a.kind === 'PAYROLL') return 'people/payroll.html?id=' + encodeURIComponent(a.id);
    if (a.kind === 'BUDGET') return 'finance/budget.html?year=' + encodeURIComponent(a.year);
    if (a.kind === 'FIN_REPORT') return 'finance/monthly-report.html?period=' + encodeURIComponent(a.id);
    if (a.kind === 'EMERGENCY_PRIORITY') return 'jobs/job.html?id=' + encodeURIComponent(a.job_id) + '#priority';
    if (a.kind === 'REQUISITION') return 'stores/requisitions.html?id=' + encodeURIComponent(a.id);
    if (a.kind === 'STOCK_ADJUSTMENT') return 'stores/adjustments.html?id=' + encodeURIComponent(a.id);
    if (a.kind === 'STOCK_COUNT') return 'stores/stock-counts.html?id=' + encodeURIComponent(a.id);
    if (a.kind === 'OPENING_STOCK') return 'stores/opening-stock.html?id=' + encodeURIComponent(a.id);
    if (a.kind === 'SIGNUP') return 'admin/users.html?tab=signups';
    if (a.kind === 'PURCHASE_REQUEST') return 'purchasing/purchase-requests.html?id=' + encodeURIComponent(a.id);
    if (a.kind === 'GOODS_RECEIPT') return 'purchasing/goods-received.html?id=' + encodeURIComponent(a.id);
    if (a.kind === 'SUPPLIER_BILL') return 'purchasing/supplier-bills.html?id=' + encodeURIComponent(a.id);
    if (a.kind === 'SUPPLIER_PAYMENT') return 'purchasing/supplier-bills.html?payment=' + encodeURIComponent(a.id);
    if (String(a.kind).indexOf('DESIGN') === 0) return 'jobs/design.html?task=' + encodeURIComponent(a.id);
    return 'jobs/job.html?id=' + encodeURIComponent(a.job_id || a.id);
  }

  function render(d) {
    const w = d.widgets;
    const cards = [];
    if (w.open_jobs !== undefined) {
      cards.push(card('Open jobs', w.open_jobs, 'in progress now', 'jobs/jobs.html'));
      cards.push(card('Delayed', w.delayed_jobs.length, 'past their deadline', 'jobs/jobs.html?f=overdue', w.delayed_jobs.length ? 'red' : ''));
      cards.push(card('Due in 48 hours', w.due_next_48h.length, 'deliver soon', 'jobs/jobs.html?f=due', ''));
      cards.push(card('Ready for delivery', w.ready_for_delivery.length, 'waiting to go out', 'jobs/jobs.html?status=READY', w.ready_for_delivery.length ? 'green' : ''));
    }
    if (w.design_queue) cards.push(card('Design tasks', w.design_queue.tasks.length, w.design_queue.overdue + ' overdue', 'jobs/designs.html', w.design_queue.overdue ? 'red' : '', 'design'));
    if (w.enquiries) cards.push(card('Enquiries to answer', w.enquiries.open, (w.enquiries.unacknowledged_overdue || 0) + ' waiting too long', 'customers/enquiries.html', w.enquiries.unacknowledged_overdue ? 'red' : '', 'sales'));
    if (w.emergency_month) {
      const e = w.emergency_month;
      cards.push(card('Emergency jobs this month', e.approved, (e.pending ? e.pending + ' waiting · ' : '') + e.rejected + ' not approved', 'jobs/jobs.html?priority=EMERGENCY&status=*', e.pending ? 'red' : '', 'jobs'));
    }
    if (w.fin_report_due) {
      const f = w.fin_report_due;
      cards.push(card('Monthly report ' + f.month_name, f.late ? 'Overdue' : 'Due ' + MS.shortDate(f.due_date), (f.late ? 'was due on ' + MS.shortDate(f.due_date) : f.status === 'RETURNED' ? 'returned for changes' : 'Monthly report due on ' + MS.shortDate(f.due_date)) + (f.more ? ' · ' + f.more + ' more' : ''),
        'finance/monthly-report.html?period=' + encodeURIComponent(f.period), f.late || f.status === 'RETURNED' ? 'red' : '', 'finance'));
    }
    if (w.finance) {
      const f = w.finance;
      cards.push(card('Cash and bank', MS.money(f.cash_and_bank), 'in the books today', 'finance/accounts.html', f.cash_and_bank < 0 ? 'red' : '', 'finance'));
      cards.push(card('Owed by customers', MS.money(f.owed_by_customers), f.overdue_invoices ? MS.money(f.overdue_amount) + ' overdue on ' + f.overdue_invoices + ' invoice' + (f.overdue_invoices === 1 ? '' : 's') : 'nothing overdue', 'finance/invoices.html' + (f.overdue_invoices ? '?overdue=1' : ''), f.overdue_invoices ? 'red' : '', 'finance'));
      cards.push(card('Expenses', f.expenses_waiting + ' to approve', f.expenses_to_pay + ' approved, not paid yet', 'finance/expenses.html', f.expenses_waiting ? 'red' : '', 'finance'));
      cards.push(card('Profit this month', MS.money(f.month_profit), 'on sales of ' + MS.money(f.month_revenue), 'finance/reports.html', f.month_profit < 0 ? 'red' : 'green', 'finance'));
    }
    if (w.people) {
      cards.push(card('Active staff', w.people.active_staff, 'on the payroll list', 'people/employees.html', '', 'people'));
      if (w.people.payroll) cards.push(card('Payroll ' + w.people.payroll.period, MS.label(w.people.payroll.status), 'this month\'s pay run', 'people/payroll.html', w.people.payroll.status === 'SUBMITTED' ? 'red' : w.people.payroll.status === 'PAID' ? 'green' : '', 'people'));
    }
    if (w.stores) {
      const st = w.stores;
      cards.push(card('Low stock', st.low_stock, 'items at or below the minimum', 'stores/items.html?low=1', st.low_stock ? 'red' : '', 'stores'));
      if (MS.can('INVENTORY_ISSUE')) cards.push(card('To issue', st.to_issue, 'approved requisitions', 'stores/requisitions.html?tab=issue', st.to_issue ? 'red' : '', 'stores'));
      if (MS.canAny(['INVENTORY_RECEIVE', 'PO_CREATE'])) {
        cards.push(card('Goods expected', st.goods_expected, st.goods_late ? st.goods_late + ' late' : 'open purchase orders', 'purchasing/purchase-orders.html', st.goods_late ? 'red' : '', 'purchasing'));
        cards.push(card('Deliveries to check', st.grn_to_verify, 'goods received, not checked yet', 'purchasing/goods-received.html?tab=verify', st.grn_to_verify ? 'red' : '', 'purchasing'));
      }
      if (MS.can('PO_CREATE')) cards.push(card('Requests to order', st.requests_to_order, 'approved, no purchase order yet', 'purchasing/purchase-requests.html?tab=order', st.requests_to_order ? 'red' : '', 'purchasing'));
    }
    if (w.accounts) {
      cards.push(card('Active logins', w.accounts.active, w.accounts.must_change + ' still on a first password', 'admin/users.html', '', 'accounts'));
      cards.push(card('Locked logins', w.accounts.locked, 'too many wrong passwords', 'admin/users.html', w.accounts.locked ? 'red' : '', 'accounts'));
      cards.push(card('New sign-ups waiting', w.accounts.signups_waiting || 0, 'approve or reject them', 'admin/users.html?tab=signups', w.accounts.signups_waiting ? 'red' : '', 'accounts'));
    }
    cards.unshift(card('Waiting for my approval', w.pending_approvals.length, 'approve or reject', '#approvals', w.pending_approvals.length ? 'red' : '', 'approve'));
    const order = areaOrder();
    cards.sort((x, y) => (order.indexOf(x.area) + 1 || 99) - (order.indexOf(y.area) + 1 || 99));
    $('dashCards').innerHTML = cards.map((c) => c.html).join('');

    const panels = [];
    if (!w.my_tasks.length) panels.push(panel('My work', '<p class="empty">Nothing is assigned to you right now.</p>', true));
    else {
      panels.push(panel('My work', `<div class="tablewrap"><table class="inv"><thead><tr><th>Job</th><th>Task</th><th>Status</th><th>Due</th></tr></thead><tbody class="clkbox">${w.my_tasks.map((t) =>
        `<tr class="clk" data-href="${t.design_task_id ? 'jobs/design.html?task=' + encodeURIComponent(t.design_task_id) : 'jobs/job.html?id=' + encodeURIComponent(t.job_id)}"><td><b>${esc(t.job_number || '')}</b></td><td>${esc(t.title)}</td><td>${MS.pill(t.status)}</td><td>${esc(MS.when(t.due))}</td></tr>`).join('')}</tbody></table></div>`, true));
    }
    panels.push(`<div class="dpanel wide" id="approvals"><h3>Waiting for my approval</h3>${w.pending_approvals.length ? `<div class="tablewrap"><table class="inv"><thead><tr><th>What</th><th>Type</th><th>Since</th></tr></thead><tbody class="clkbox">${w.pending_approvals.map((a) =>
      `<tr class="clk" data-href="${approvalHref(a)}"><td><b>${esc(a.title)}</b></td><td>${esc(MS.label(a.kind))}</td><td>${esc(MS.when(a.since))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Nothing is waiting for you.</p>'}</div>`);
    if (w.delayed_jobs && w.delayed_jobs.length) panels.push(panel('Delayed jobs', jobTable(w.delayed_jobs), true));
    if (w.emergency_jobs && w.emergency_jobs.length) panels.push(panel('Emergency jobs', jobTable(w.emergency_jobs), true));
    if (w.due_next_48h && w.due_next_48h.length) panels.push(panel('Due in the next 48 hours', jobTable(w.due_next_48h), true));
    if (w.awaiting_customer_approval && w.awaiting_customer_approval.length) panels.push(panel('Waiting for customer approval', jobTable(w.awaiting_customer_approval), true));
    if (w.awaiting_materials && w.awaiting_materials.length) panels.push(panel('Waiting for materials', jobTable(w.awaiting_materials), true));
    if (w.in_qc && w.in_qc.length) panels.push(panel('In quality control', jobTable(w.in_qc), true));
    if (w.ready_for_delivery && w.ready_for_delivery.length) panels.push(panel('Ready for delivery', jobTable(w.ready_for_delivery), true));
    if (w.jobs_by_status) {
      const keys = Object.keys(w.jobs_by_status);
      const max = Math.max(1, ...keys.map((k) => w.jobs_by_status[k]));
      panels.push(panel('Open jobs by status', keys.length ? keys.map((k) => `<div class="bar-row"><a href="jobs/jobs.html?status=${encodeURIComponent(k)}">${esc(MS.statusLabel(k, 'jobs'))}</a><span class="bar"><i style="width:${(100 * w.jobs_by_status[k] / max).toFixed(0)}%"></i></span><span class="n">${w.jobs_by_status[k]}</span></div>`).join('') : '<p class="empty">No open jobs.</p>'));
    }
    if (w.stores && w.stores.low_items.length && MS.canAny(['INVENTORY_ISSUE', 'INVENTORY_RECEIVE', 'PO_CREATE', 'PURCHASE_REQUEST'])) {
      panels.push(panel('Low stock', `<ul class="mini-list">${w.stores.low_items.map((i) => `<li><span>${MS.lnk('stores/items.html?id=' + encodeURIComponent(i.item_id), i.item_name)}</span><span class="a">${esc(MS.num(i.available))} left · minimum ${esc(MS.num(i.minimum_level))}</span></li>`).join('')}</ul>`
        + (MS.can('PURCHASE_REQUEST') ? `<p>${MS.lnk('purchasing/purchase-requests.html?new=1&low=1', 'Ask to buy them')}</p>` : '')));
    }
    if (w.complaints) panels.push(panel('Customer complaints', `<p>${w.complaints.open} open, ${w.complaints.overdue} past their resolution date.</p>`));
    $('dashPanels').innerHTML = panels.join('');
    document.querySelectorAll('.clkbox').forEach(MS.clickable);
  }

  MS.boot({ page: 'dashboard', ref: true }).then(async () => {
    const hour = new Date().getHours();
    $('hello').textContent = (hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening') + ', ' + String(MS.user.display_name || '').split(' ')[0];
    if (MS.param('denied')) MS.setMsg('dashMsg', 'You do not have access to that page.', 'error');
    quickStart();
    MS.reload = () => MS.recall('DASHBOARD_GET').then(render).catch(() => {});
    try { render(await MS.recall('DASHBOARD_GET')); } catch (err) { MS.setMsg('dashMsg', err.message, 'error'); }
  });
})();
