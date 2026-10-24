/* Overview: what needs attention today, filtered by the person's role and access. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const hr = MS.hr;

  const jobTable = (list) => `<div class="tablewrap"><table class="inv"><thead><tr><th>Job</th><th>Name</th><th>Customer</th><th>Where</th><th>Deadline</th></tr></thead><tbody class="clkbox">
    ${list.length ? list.map((j) => `<tr class="clk" data-href="jobs/job.html?id=${encodeURIComponent(j.job_id)}"><td><b>${MS.lnk('jobs/job.html?id=' + encodeURIComponent(j.job_id), j.job_number)}</b></td><td>${esc(j.job_name)}</td><td>${esc(j.customer_name || '')}</td><td>${esc(j.location || MS.statusLabel(j.status, 'jobs'))}</td><td class="${j.overdue ? 'late' : ''}">${esc(MS.when(j.customer_deadline))}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">None.</td></tr>'}
  </tbody></table></div>`;
  const panel = (title, body, wide) => `<div class="dpanel${wide ? ' wide' : ''}"><h3>${esc(title)}</h3>${body}</div>`;
  const card = (k, v, s, href, tone, area) => ({ area: area || 'jobs', html: `<a class="card${tone ? ' ' + tone : ''}" href="${href}"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div><div class="s">${esc(s || '')}</div></a>` });

  // what each screen is for, in a few words
  const ABOUT = {
    notifications: 'Alerts and messages for you', jobs: 'Every job and where it is', 'job-new': 'Make the job card from an approved proforma invoice',
    locations: 'Where every open job is right now', 'my-section': 'The jobs waiting in your section',
    customers: 'Customer records and contacts', quotations: 'Proforma invoices: prices sent to customers',
    employees: 'Staff records and positions',
    'employment-actions': 'Notices and employment changes', users: 'Logins, resets and roles', roles: 'Who may do what',
    'section-teams': 'Who works in each section', settings: 'Numbers, limits and options', activity: 'Who changed what, and when',
    invoices: 'Bill customers and see what they owe', payments: 'Money received and receipts', expenses: 'Spending, with approval',
    'cash-forecast': 'Cash expected in and out, week by week', budget: 'This year\'s budget against what was spent',
    reports: 'Profit and loss, cash flow and the balance sheet', ageing: 'Who owes what, and how late', 'job-profit': 'Cost, profit and margin on every job',
    'cash-count': 'Count each till every day', 'bank-recon': 'Match the bank statement to the books each month', gra: 'Returns and payments owed to the GRA', close: 'Close the month and lock the books', 'monthly-report': 'The Finance Manager\'s report for the month',
    accounts: 'Chart of accounts and journal entries', payroll: 'Monthly pay run and payslips',
    'my-hr': 'Clock in, my leave, overtime and training', attendance: 'Daily register and the monthly attendance report', leave: 'Leave requests, decisions and the team calendar',
    overtime: 'Request, record and verify overtime', training: 'Required training and what is done', grievances: 'Staff concerns, answered within 7 working days',
    'kpi-mine': 'My KPIs, my score and my reviews', 'kpi-board': 'Every KPI for the month in Green, Amber or Red', 'kpi-history': 'How a KPI moved month by month',
    'kpi-review': 'The six-step monthly KPI review', 'kpi-defs': 'Switch KPIs on and set targets', performance: 'Scores out of 100 and reviews', issues: 'Report, assign and close problems',
    meetings: 'Briefings, meetings, minutes and actions', briefing: 'Today\'s one-page briefing', notices: 'Notices from management', messages: 'Messages and requests between people',
    'gm-reports': 'Daily, weekly and monthly reports', 'monthly-dashboard': 'The one-page month at a glance', backups: 'Copy data to Drive'
  };
  // the screens each job uses most come first (first pattern that matches the person's roles wins)
  const FOCUS = [
    [/SYSTEM_ADMIN/, ['users', 'roles', 'section-teams', 'employees', 'settings', 'backups', 'activity', 'locations']],
    [/CEO|GENERAL_MANAGER/, ['locations', 'kpi-board', 'kpi-review', 'gm-reports', 'issues', 'meetings', 'jobs', 'quotations', 'monthly-report', 'reports', 'job-profit', 'gra', 'cash-forecast', 'budget',  'revenue', 'customers', 'payroll', 'attendance', 'leave', 'overtime', 'employees', 'section-teams']],
    [/FINANCE_DIRECTOR/, ['locations', 'kpi-board', 'quotations', 'invoices', 'payments', 'expenses', 'ageing', 'job-profit', 'cash-forecast', 'budget', 'revenue', 'reports', 'close', 'monthly-report', 'payroll', 'gra', 'cash-count', 'bank-recon', 'jobs']],
    [/FINANCE/, ['quotations', 'kpi-board', 'invoices', 'payments', 'expenses', 'ageing', 'cash-count', 'bank-recon', 'gra', 'cash-forecast', 'close', 'monthly-report', 'payroll', 'budget', 'revenue', 'reports', 'overtime']],
    [/ADMIN_OFFICER/, ['locations', 'jobs', 'customers', 'quotations', 'invoices', 'notifications']],
    [/PRODUCTION_MANAGER/, ['locations', 'my-section', 'kpi-board', 'jobs', 'overtime', 'attendance']],
    [/PRODUCTION|MACHINE|GENERAL_STAFF|GRAPHIC|DESIGN/, ['my-section', 'jobs', 'my-hr', 'overtime']]
  ];

  // the numbers each job watches most come first; everyone starts with what waits for them
  const AREAS = [
    [/SYSTEM_ADMIN/, ['approve', 'accounts', 'locations', 'people']],
    [/CEO|GENERAL_MANAGER/, ['approve', 'create', 'locations', 'kpi', 'jobs', 'sales', 'management', 'hr', 'finance', 'people']],
    [/FINANCE_DIRECTOR/, ['approve', 'sales', 'finance', 'locations', 'kpi', 'management', 'hr', 'people', 'jobs']],
    [/FINANCE/, ['approve', 'sales', 'finance', 'kpi', 'management', 'hr', 'people', 'jobs']],
    [/ADMIN_OFFICER/, ['approve', 'locations', 'jobs', 'sales', 'management', 'hr']],
    [/PRODUCTION_MANAGER/, ['approve', 'locations', 'kpi', 'jobs', 'management', 'hr']],
    [/PRODUCTION|MACHINE|GENERAL_STAFF|GRAPHIC|DESIGN/, ['approve', 'jobs', 'hr', 'management']]
  ];
  const who = () => { const u = MS.user || {}; return [].concat(u.roles || [], u.position_code || []).join(' '); };
  const areaOrder = () => (AREAS.find(([re]) => re.test(who())) || [null, ['approve', 'hr', 'jobs']])[1];
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
      MS.can('ATTENDANCE_SELF') && tile('people/my-hr.html', 'clock', 'Clock in or out', 'My attendance for today', 'do'),
      MS.can('JOB_CREATE') && tile('jobs/job-new.html', 'plus', 'Create job', ABOUT['job-new'], 'do'),
      MS.can('QUOTATION_CREATE') && tile('customers/quotation.html?new=1', 'plus', 'New proforma invoice', 'Price a job for a customer', 'do'),
      MS.can('CUSTOMER_CREATE') && tile('customers/customers.html?add=1', 'plus', 'Add customer', 'Save a new customer', 'do'),
      MS.can('EMPLOYMENT_EDIT') && tile('people/employees.html?add=1', 'plus', 'Add employee', 'Start a staff record', 'do')
    ].filter(Boolean);
    $('dashQuick').innerHTML = actions.join('') + pages.slice(0, QUICK_MAX).map((n) => tile(n.href, n.icon, n.label, ABOUT[n.page] || '')).join('') +
      tile('account.html', 'user', 'My account', 'Password and your details');
    const role = u.position || (u.roles || []).map(MS.label).join(', ');
    $('dashWho').textContent = (role ? role + ' · ' : '') + new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + '  ·  Press / to search';
  }

  function approvalHref(a) {
    if (a.kind === 'JOB_TO_CREATE') return 'jobs/job-new.html?quotation_id=' + encodeURIComponent(a.id);
    if (a.kind === 'PROFORMA_CHANGES') return 'customers/quotation.html?id=' + encodeURIComponent(a.id);
    if (a.kind === 'INVOICE_TO_CREATE') return 'customers/quotation.html?id=' + encodeURIComponent(a.id);
    if (a.kind === 'RECEIPT_TO_SEND') return 'finance/payments.html?id=' + encodeURIComponent(a.id);
    if (a.kind === 'QUOTATION_DISCOUNT') return 'customers/quotation.html?id=' + encodeURIComponent(a.id);
    if (a.kind === 'EMPLOYMENT_ACTION') return 'people/employment-actions.html';
    if (a.kind === 'LEAVE') return 'people/leave.html';
    if (a.kind === 'OVERTIME_REQUEST') return 'people/overtime.html';
    if (a.kind === 'OVERTIME_VERIFY') return 'people/overtime.html?tab=worked';
    if (a.kind === 'GRIEVANCE') return 'people/grievances.html';
    if (a.kind === 'EXPENSE') return 'finance/expenses.html?id=' + encodeURIComponent(a.id);
    if (a.kind === 'PAYROLL') return 'people/payroll.html?id=' + encodeURIComponent(a.id);
    if (a.kind === 'BUDGET') return 'finance/budget.html?year=' + encodeURIComponent(a.year);
    if (a.kind === 'CASH_COUNT') return 'finance/cash-count.html';
    if (a.kind === 'BANK_RECON') return 'finance/bank-recon.html?bank=' + encodeURIComponent(a.bank_account_id) + '&period=' + encodeURIComponent(a.period);
    if (a.kind === 'FIN_REPORT') return 'finance/monthly-report.html?period=' + encodeURIComponent(a.id);
    if (/^ISSUE_/.test(a.kind)) return 'management/issues.html?id=' + encodeURIComponent(a.id);
    if (a.kind === 'MINUTES') return 'management/meetings.html?id=' + encodeURIComponent(a.id);
    if (a.kind === 'KPI_VERIFY') return 'management/kpi-board.html?month=' + encodeURIComponent(a.period);
    if (a.kind === 'KPI_REVIEW' || a.kind === 'KPI_SUBMIT') return 'management/kpi-review.html?month=' + encodeURIComponent(a.period);
    if (a.kind === 'PERFORMANCE_REVIEW') return 'management/performance.html';
    if (a.kind === 'MGMT_REPORT') return 'management/gm-reports.html?type=' + encodeURIComponent(a.report_type) + '&period=' + encodeURIComponent(a.period);
    if (a.kind === 'MGMT_REPORT_REVIEW') return 'management/gm-reports.html';
    if (a.kind === 'SIGNUP') return 'admin/users.html?tab=signups';
    return 'jobs/job.html?id=' + encodeURIComponent(a.job_id || a.id);
  }

  function render(d) {
    const w = d.widgets;
    const cards = [];
    if (w.jobs_to_create) {
      const n = w.jobs_to_create.length;
      cards.push(card('Job card to create', n, n ? 'approved proforma invoice' + (n === 1 ? '' : 's') + ' with no job yet' : 'nothing waiting', '#toCreate', n ? 'red' : 'green', 'create'));
    }
    if (w.open_jobs !== undefined) {
      cards.push(card('Open jobs', w.open_jobs, 'in sections or the Production Department', 'jobs/jobs.html'));
      cards.push(card('Delayed', w.delayed_jobs.length, 'past their deadline', 'jobs/jobs.html?f=overdue', w.delayed_jobs.length ? 'red' : ''));
      cards.push(card('Due in 48 hours', w.due_next_48h.length, 'finish soon', 'jobs/jobs.html?f=due', ''));
      if (w.on_hold_jobs && w.on_hold_jobs.length) cards.push(card('On hold', w.on_hold_jobs.length, 'waiting for a decision', 'jobs/jobs.html?status=ON_HOLD', 'red'));
    }
    if (w.locations) {
      const l = w.locations;
      cards.push(card('Where are the jobs', l.open, (l.overdue ? l.overdue + ' late · ' : '') + (l.on_hold ? l.on_hold + ' on hold' : 'all moving'), 'jobs/locations.html', l.overdue ? 'red' : '', 'locations'));
    }
    if (w.proformas) {
      const q = w.proformas;
      cards.push(card('Proforma invoices', q.sent + ' sent', q.draft + ' draft · ' + q.approved + ' approved' + (q.awaiting_job ? ' · ' + q.awaiting_job + ' without a job' : ''), 'customers/quotations.html', '', 'sales'));
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
      if (f.budget && f.budget.status) {
        const b = f.budget, over = b.used_pct !== null && b.used_pct > 100 + b.tolerance_pct;
        cards.push(card('Budget used', b.used_pct === null ? 'No figures' : b.used_pct + ' %', MS.money(b.to_date_spent) + ' spent of ' + MS.money(b.to_date_budget) + ' budgeted to date' + (b.status !== 'APPROVED' ? ' (budget ' + MS.label(b.status).toLowerCase() + ')' : ''),
          'finance/budget.html?year=' + encodeURIComponent(b.fiscal_year), over ? 'red' : '', 'finance'));
      }
      cards.push(card('Profit this month', MS.money(f.month_profit), 'on sales of ' + MS.money(f.month_revenue), 'finance/reports.html', f.month_profit < 0 ? 'red' : 'green', 'finance'));
    }
    if (w.treasury) {
      const t = w.treasury, g = t.gra;
      cards.push(card('GRA tracker', g.overdue ? g.overdue + ' overdue' : g.open ? g.open + ' open' : 'All clear',
        g.overdue || g.due_soon ? (g.due_soon ? g.due_soon + ' due in 14 days' : 'submit or pay now') : g.next ? 'next: ' + MS.label(g.next.obligation_type) + ' ' + MS.shortDate(g.next.due_date) : 'nothing owed to the GRA', 'finance/gra.html', g.overdue || g.due_soon ? 'red' : '', 'finance'));
      if (t.cash_count.tills) cards.push(card('Cash count today', t.cash_count.missing_today ? t.cash_count.missing_today + ' till' + (t.cash_count.missing_today === 1 ? '' : 's') + ' to count' : 'Done',
        t.cash_count.waiting_check ? t.cash_count.waiting_check + ' waiting for a check' : 'every till counted', 'finance/cash-count.html', t.cash_count.missing_today || t.cash_count.waiting_check ? 'red' : 'green', 'finance'));
      if (t.bank_recon.missing) cards.push(card('Bank reconciliation', t.bank_recon.missing + ' to do', 'for the month of ' + MS.shortDate(t.bank_recon.period + '-01').replace(/^1 /, ''), 'finance/bank-recon.html', 'red', 'finance'));
    }
    if (w.people) {
      cards.push(card('Active staff', w.people.active_staff, 'on the payroll list', 'people/employees.html', '', 'people'));
      if (w.people.payroll) cards.push(card('Payroll ' + w.people.payroll.period, MS.label(w.people.payroll.status), 'this month\'s pay run', 'people/payroll.html', w.people.payroll.status === 'SUBMITTED' ? 'red' : w.people.payroll.status === 'PAID' ? 'green' : '', 'people'));
    }
    if (w.hr) {
      const h = w.hr, hc = (k, v, sub, href, tone) => cards.push(card(k, v, sub, href, tone, 'hr'));
      if (h.me) {
        const m = h.me;
        hc('My day', m.on_leave ? 'On leave' : m.clock_out ? 'Done for today' : m.clock_in ? 'In at ' + m.clock_in : m.can_clock_in ? 'Not clocked in' : 'Nothing to clock',
          m.annual_leave_left !== undefined ? m.annual_leave_left + ' days annual leave left' : 'open My HR', 'people/my-hr.html', m.can_clock_in ? 'red' : m.status === 'PRESENT' || m.status === 'LATE' ? 'green' : '');
      }
      if (h.attendance) {
        const a = h.attendance;
        hc('Present today', a.present + ' of ' + a.staff, a.working_day ? a.not_recorded + ' not recorded · ' + a.on_leave + ' on leave' : 'rest day or holiday', 'people/attendance.html', a.working_day && a.not_recorded ? 'red' : '');
        hc('Attendance this month', a.month.attendance_pct === null ? '–' : a.month.attendance_pct + ' %', 'on time ' + (a.month.punctuality_pct === null ? '–' : a.month.punctuality_pct + ' %') + ' · target ' + a.month.target + ' %', 'people/attendance.html?tab=month',
          (a.month.attendance_pct !== null && a.month.attendance_pct < a.month.target) || (a.month.punctuality_pct !== null && a.month.punctuality_pct < a.month.target) ? 'red' : 'green');
      }
      if (h.leave_waiting !== undefined) hc('Leave to decide', h.leave_waiting, h.away_today + ' away today', 'people/leave.html', h.leave_waiting ? 'red' : '');
      if (h.overtime) {
        const o = h.overtime, todo = (o.to_approve || 0) + (o.to_verify || 0) + (o.to_record || 0);
        hc('Overtime this month', MS.num(o.hours_month) + ' h', (todo ? todo + ' to act on · ' : '') + o.unauthorised_month + ' unauthorised' + (o.authorised_pct === null ? '' : ' · ' + o.authorised_pct + ' % authorised'), 'people/overtime.html', todo || o.unauthorised_month ? 'red' : '');
      }
      if (h.training) hc('Required training', h.training.pct === null ? '–' : h.training.pct + ' % done', h.training.overdue + ' overdue · ' + h.training.due_soon + ' due soon', 'people/training.html', h.training.overdue ? 'red' : '');
      if (h.grievances) hc('Staff concerns', h.grievances.open + ' open', h.grievances.overdue ? h.grievances.overdue + ' overdue' : h.grievances.unassigned + ' not taken yet', 'people/grievances.html', h.grievances.overdue ? 'red' : '');
    }
    if (w.kpi) {
      const k = w.kpi;
      if (k.counts) {
        cards.push(card('KPIs this month', k.counts.GREEN + ' / ' + k.counts.AMBER + ' / ' + k.counts.RED, 'Green / Amber / Red · ' + k.counts.no_target + ' without a target', 'management/kpi-board.html', k.counts.RED ? 'red' : '', 'kpi'));
        if (k.counts.RED && k.reds.length) cards.push(card('Red KPIs', k.reds.length, k.reds.map((x) => x.kpi_name).slice(0, 2).join(', '), 'management/kpi-board.html', 'red', 'kpi'));
        if (k.review && k.review.due) cards.push(card('Monthly KPI review', MS.label(k.review.status), 'for ' + hr.monthName(k.review.period), 'management/kpi-review.html?month=' + encodeURIComponent(k.review.period), 'red', 'kpi'));
      }
      if (k.my_score) cards.push(card('My latest score', MS.num(k.my_score.total_score) + ' / 100', MS.label(k.my_score.rating) + ' · ' + hr.monthName(k.my_score.review_period), 'management/my-kpis.html', k.my_score.rating === 'RED' ? 'red' : k.my_score.rating === 'GREEN' ? 'green' : '', 'kpi'));
    }
    if (w.issues) cards.push(card('Issues', w.issues.open + ' open', (w.issues.unassigned ? w.issues.unassigned + ' to assign · ' : '') + (w.issues.to_check ? w.issues.to_check + ' to check · ' : '') + w.issues.overdue + ' past their date', 'management/issues.html', w.issues.overdue || w.issues.critical || w.issues.unassigned ? 'red' : '', 'management'));
    if (w.meetings) {
      const m = w.meetings;
      if (m.briefing_held !== undefined && m.working_day) cards.push(card('Daily briefing', m.briefing_held ? 'Held' : 'Not held yet', 'a KPI: briefings held on working days', 'management/briefing.html', m.briefing_held ? 'green' : 'red', 'management'));
      if (m.today || m.minutes_missing) cards.push(card('Meetings today', m.today, m.minutes_missing ? m.minutes_missing + ' without minutes' : 'scheduled for today', 'management/meetings.html', m.minutes_missing ? 'red' : '', 'management'));
      if (m.my_actions) cards.push(card('My meeting actions', m.my_actions, m.my_actions_overdue ? m.my_actions_overdue + ' past their date' : 'open', 'management/meetings.html?tab=actions', m.my_actions_overdue ? 'red' : '', 'management'));
    }
    if (w.comms) {
      const c = w.comms;
      if (c.notices_to_ack) cards.push(card('Notices to confirm', c.notices_to_ack, 'read and confirm', 'management/notices.html?tab=unread', 'red', 'management'));
      if (c.unread_messages) cards.push(card('Unread messages', c.unread_messages, 'in your inbox', 'management/messages.html', '', 'management'));
      if (c.requests_in) cards.push(card('Requests to answer', c.requests_in, c.requests_late ? c.requests_late + ' past their date' : 'from other departments', 'management/messages.html?tab=req-incoming', c.requests_late ? 'red' : '', 'management'));
    }
    if (w.mgmt_reports && (w.mgmt_reports.to_write || w.mgmt_reports.waiting_review)) {
      const g = w.mgmt_reports;
      cards.push(card('GM reports', g.can_submit ? g.to_write + ' to write' : g.waiting_review + ' to review', (g.overdue ? g.overdue + ' overdue · ' : '') + g.waiting_review + ' waiting for review', 'management/gm-reports.html', g.overdue ? 'red' : '', 'management'));
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
        `<tr class="clk" data-href="${t.issue_id ? 'management/issues.html?id=' + encodeURIComponent(t.issue_id) : t.kind === 'MEETING_ACTION' ? 'management/meetings.html?tab=actions' : t.kind === 'NOTICE' ? 'management/notices.html' : t.kind === 'REQUEST' ? 'management/messages.html?tab=req-incoming' : t.kind === 'TRAINING' || t.kind === 'OVERTIME' ? 'people/my-hr.html' : t.kind === 'SECTION_JOB' ? 'jobs/my-section.html?job=' + encodeURIComponent(t.job_id) : 'jobs/job.html?id=' + encodeURIComponent(t.job_id)}"><td><b>${esc(t.job_number || (t.kind ? MS.label(t.kind) : ''))}</b></td><td>${esc(t.title)}</td><td>${MS.pill(t.status)}</td><td>${esc(MS.when(t.due))}</td></tr>`).join('')}</tbody></table></div>`, true));
    }
    panels.push(`<div class="dpanel wide" id="approvals"><h3>Waiting for my approval</h3>${w.pending_approvals.length ? `<div class="tablewrap"><table class="inv"><thead><tr><th>What</th><th>Type</th><th>Since</th></tr></thead><tbody class="clkbox">${w.pending_approvals.map((a) =>
      `<tr class="clk" data-href="${approvalHref(a)}"><td><b>${esc(a.title)}</b></td><td>${esc(MS.label(a.kind))}</td><td>${esc(MS.when(a.since))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Nothing is waiting for you.</p>'}</div>`);
    if (w.jobs_to_create && w.jobs_to_create.length) {
      panels.unshift(`<div class="dpanel wide" id="toCreate"><h3>Job card to create</h3><div class="tablewrap"><table class="inv"><thead><tr><th>Proforma invoice</th><th>Customer</th><th class="num">Total</th><th>Approved</th><th></th></tr></thead><tbody>${w.jobs_to_create.map((x) =>
        `<tr><td><b>${MS.lnk('customers/quotation.html?id=' + encodeURIComponent(x.quotation_id), x.quotation_number)}</b></td><td>${esc(x.customer_name)}</td><td class="num">${esc(MS.money(x.total_amount))}</td><td>${esc(MS.when(x.approved_at))}</td>
        <td>${MS.can('JOB_CREATE') ? `<a class="btn primary small" href="jobs/job-new.html?quotation_id=${encodeURIComponent(x.quotation_id)}">Create job card</a>` : ''}</td></tr>`).join('')}</tbody></table></div></div>`);
    }
    if (w.locations) {
      const l = w.locations, max = Math.max(1, ...l.sections.map((x) => x.count));
      panels.push(`<div class="dpanel wide" id="whereJobs"><h3>Where are the jobs</h3>
        ${l.sections.map((x) => `<div class="bar-row"><a href="jobs/locations.html?section=${encodeURIComponent(x.section_id)}">${esc(x.section_name)}</a><span class="bar"><i style="width:${(100 * x.count / max).toFixed(0)}%"></i></span><span class="n">${x.count}${x.overdue ? ' <span class="late">(' + x.overdue + ' late)</span>' : ''}</span></div>`).join('')}
        ${l.longest.length ? `<h4>Longest in one place</h4><div class="tablewrap"><table class="inv"><thead><tr><th>Job</th><th>Customer</th><th>Where</th><th class="num">Days there</th><th>Deadline</th></tr></thead><tbody class="clkbox">${l.longest.map((j) =>
          `<tr class="clk" data-href="jobs/job.html?id=${encodeURIComponent(j.job_id)}"><td><b>${esc(j.job_number)}</b> ${esc(j.job_name)}</td><td>${esc(j.customer_name)}</td><td>${esc(j.location)}</td><td class="num">${j.days_here}</td><td class="${j.overdue ? 'late' : ''}">${esc(MS.when(j.customer_deadline))}</td></tr>`).join('')}</tbody></table></div>` : ''}
        <p>${MS.lnk('jobs/locations.html', 'Open the full list')}</p></div>`);
    }
    if (w.delayed_jobs && w.delayed_jobs.length) panels.push(panel('Delayed jobs', jobTable(w.delayed_jobs), true));
    if (w.due_next_48h && w.due_next_48h.length) panels.push(panel('Due in the next 48 hours', jobTable(w.due_next_48h), true));
    if (w.jobs_by_status) {
      const keys = Object.keys(w.jobs_by_status);
      const max = Math.max(1, ...keys.map((k) => w.jobs_by_status[k]));
      panels.push(panel('Open jobs by status', keys.length ? keys.map((k) => `<div class="bar-row"><a href="jobs/jobs.html?status=${encodeURIComponent(k)}">${esc(MS.statusLabel(k, 'jobs'))}</a><span class="bar"><i style="width:${(100 * w.jobs_by_status[k] / max).toFixed(0)}%"></i></span><span class="n">${w.jobs_by_status[k]}</span></div>`).join('') : '<p class="empty">No open jobs.</p>'));
    }
    if (w.complaints) panels.push(panel('Customer complaints', `<p>${w.complaints.open} open, ${w.complaints.overdue} past their resolution date.</p>`));
    $('dashPanels').innerHTML = panels.join('');
    document.querySelectorAll('.clkbox').forEach(MS.clickable);
  }

  MS.boot({ page: 'dashboard' }).then(async () => {
    MS.ref().then(() => { if (MS.reload) MS.reload(); }).catch(() => {});
    const hour = new Date().getHours();
    $('hello').textContent = (hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening') + ', ' + String(MS.user.display_name || '').split(' ')[0];
    if (MS.param('denied')) MS.setMsg('dashMsg', 'You do not have access to that page.', 'error');
    quickStart();
    if (MS.passkeys) MS.passkeys.offer($('dashMsg'));
    MS.reload = () => MS.recall('DASHBOARD_GET').then(render).catch(() => {});
    try { render(await MS.recall('DASHBOARD_GET')); } catch (err) { MS.setMsg('dashMsg', err.message, 'error'); }
  });
})();
