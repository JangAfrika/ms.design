(function () {
  const MS = (window.MS = window.MS || {});
  const esc = (s) => MS.esc(s);
  const ic = (n) => MS.icon(n);

  const NAV = [
    { group: '', items: [
      { page: 'dashboard', href: 'dashboard.html', label: 'Overview', icon: 'dashboard' },
      { page: 'notifications', href: 'notifications.html', label: 'Notifications', icon: 'bell' },
      { page: 'history', href: 'history.html', label: 'History', icon: 'clock' }
    ] },
    { group: 'Jobs', items: [
      { page: 'jobs', href: 'jobs/jobs.html', label: 'Jobs', icon: 'clipboard', any: ['JOB_VIEW'] },
      { page: 'job-new', href: 'jobs/job-new.html', label: 'Create job', icon: 'plus', any: ['JOB_CREATE'] },
      { page: 'locations', href: 'jobs/locations.html', label: 'Where are the jobs', icon: 'map', any: ['JOB_LOCATION_VIEW'] },
      { page: 'my-section', href: 'jobs/my-section.html', label: 'My section', icon: 'factory', any: ['SECTION_WORK'] },
      { page: 'job-history', href: 'jobs/job-history.html', label: 'Job History', icon: 'filecheck', any: ['JOB_HISTORY_VIEW'] }
    ] },
    { group: 'Customers', items: [
      { page: 'customers', href: 'customers/customers.html', label: 'Customers', icon: 'customers', any: ['CUSTOMER_VIEW'] },
      { page: 'quotations', href: 'customers/quotations.html', label: 'Proforma invoices', icon: 'invoice', any: ['QUOTATION_VIEW'] },
      { page: 'to-sign', href: 'customers/to-sign.html', label: 'Waiting for my signature', icon: 'key', any: ['DOC_SIGN'] }
    ] },
    { group: 'Finance', items: [
      { page: 'jobs-pay', href: 'jobs/jobs.html?f=pay', label: 'Awaiting payment', icon: 'clock', any: ['FINANCE_VIEW'] },
      { page: 'invoices', href: 'finance/invoices.html', label: 'Invoices', icon: 'invoice', any: ['FINANCE_VIEW', 'INVOICE_CREATE'] },
      { page: 'payments', href: 'finance/payments.html', label: 'Payments received', icon: 'receipt', any: ['FINANCE_VIEW', 'PAYMENT_RECORD'] },
      { page: 'income', href: 'finance/income.html', label: 'Other income', icon: 'wallet', any: ['FINANCE_VIEW', 'PAYMENT_RECORD'] },
      { page: 'expenses', href: 'finance/expenses.html', label: 'Expenses', icon: 'wallet', any: ['FINANCE_VIEW', 'EXPENSE_CREATE', 'EXPENSE_APPROVE'] },
      { page: 'ageing', href: 'finance/ageing.html', label: 'Receivables ageing', icon: 'clock', any: ['FINANCE_VIEW', 'INVOICE_CREATE', 'PAYMENT_RECORD'] },
      { page: 'job-profit', href: 'finance/job-profit.html', label: 'Job profitability', icon: 'target', any: ['JOB_COST_VIEW'] },
      { page: 'cash-forecast', href: 'finance/cash-forecast.html', label: 'Cash-flow forecast', icon: 'trend', any: ['FINANCE_VIEW'] },
      { page: 'budget', href: 'finance/budget.html', label: 'Budget & revenue', icon: 'target', any: ['FINANCE_VIEW', 'BUDGET_MANAGE', 'BUDGET_APPROVE'] },
      { page: 'revenue', href: 'finance/revenue.html', label: 'Revenue', icon: 'trend', any: ['FINANCE_VIEW', 'BUDGET_MANAGE', 'BUDGET_APPROVE'] },
      { page: 'reports', href: 'finance/reports.html', label: 'Financial reports', icon: 'chart', any: ['FINANCE_VIEW'] },
      { page: 'cash-count', href: 'finance/cash-count.html', label: 'Daily cash count', icon: 'wallet', any: ['FINANCE_VIEW'] },
      { page: 'bank-recon', href: 'finance/bank-recon.html', label: 'Bank reconciliation', icon: 'check', any: ['FINANCE_VIEW'] },
      { page: 'gra', href: 'finance/gra.html', label: 'GRA tracker', icon: 'flag', any: ['FINANCE_VIEW'] },
      { page: 'close', href: 'finance/close.html', label: 'Month-end close', icon: 'lock', any: ['PERIOD_CLOSE', 'FINANCE_VIEW'] },
      { page: 'monthly-report', href: 'finance/monthly-report.html', label: 'Monthly financial report', icon: 'file', any: ['FIN_REPORT_SUBMIT', 'FIN_REPORT_REVIEW'] },
      { page: 'accounts', href: 'finance/accounts.html', label: 'Accounts & journal', icon: 'list', any: ['FINANCE_VIEW'] }
    ] },
    { group: 'People', items: [
      { page: 'my-hr', href: 'people/my-hr.html', label: 'My HR', icon: 'user', any: ['ATTENDANCE_SELF', 'LEAVE_REQUEST', 'GRIEVANCE_RAISE'] },
      { page: 'attendance', href: 'people/attendance.html', label: 'Attendance', icon: 'clock', any: ['ATTENDANCE_RECORD', 'LEAVE_APPROVE'] },
      { page: 'leave', href: 'people/leave.html', label: 'Leave', icon: 'calendar', any: ['LEAVE_APPROVE'] },
      { page: 'overtime', href: 'people/overtime.html', label: 'Overtime', icon: 'clock', any: ['OVERTIME_REQUEST', 'OVERTIME_APPROVE', 'OVERTIME_RECORD'] },
      { page: 'training', href: 'people/training.html', label: 'Training', icon: 'check', any: ['TRAINING_MANAGE'] },
      { page: 'grievances', href: 'people/grievances.html', label: 'Staff concerns', icon: 'shield', any: ['GRIEVANCE_MANAGE'] },
      { page: 'employees', href: 'people/employees.html', label: 'Employees', icon: 'team', any: ['EMPLOYEE_VIEW'] },
      { page: 'employment-actions', href: 'people/employment-actions.html', label: 'Employment actions', icon: 'flag', any: ['EMPLOYMENT_ACTION_REQUEST', 'USER_DEACTIVATE'] },
      { page: 'payroll', href: 'people/payroll.html', label: 'Payroll', icon: 'money', any: ['PAYROLL_PREPARE', 'PAYROLL_APPROVE', 'FINANCE_PAYROLL_VIEW'] }
    ] },
    { group: 'KPIs & performance', items: [
      { page: 'kpi-mine', href: 'management/my-kpis.html', label: 'My KPIs', icon: 'target', any: ['KPI_VIEW'] },
      { page: 'kpi-board', href: 'management/kpi-board.html', label: 'KPI board', icon: 'chart', any: ['KPI_RECORD', 'KPI_VERIFY', 'KPI_REVIEW', 'KPI_CREATE'] },
      { page: 'kpi-history', href: 'management/kpi-history.html', label: 'KPI history', icon: 'trend', any: ['KPI_RECORD', 'KPI_VERIFY', 'KPI_REVIEW', 'KPI_CREATE'] },
      { page: 'kpi-review', href: 'management/kpi-review.html', label: 'Monthly KPI review', icon: 'check', any: ['KPI_RECORD', 'KPI_VERIFY', 'KPI_REVIEW'] },
      { page: 'kpi-defs', href: 'management/kpi-definitions.html', label: 'KPI definitions & targets', icon: 'list', any: ['KPI_CREATE'] },
      { page: 'performance', href: 'management/performance.html', label: 'Performance reviews', icon: 'profile', any: ['PERFORMANCE_REVIEW'] }
    ] },
    { group: 'Management', items: [
      { page: 'issues', href: 'management/issues.html', label: 'Issues', icon: 'flag', any: ['ISSUE_REPORT'] },
      { page: 'meetings', href: 'management/meetings.html', label: 'Meetings', icon: 'calendar', any: ['KPI_VIEW'] },
      { page: 'briefing', href: 'management/briefing.html', label: 'Daily briefing', icon: 'clipboard', any: ['MEETING_MANAGE'] },
      { page: 'notices', href: 'management/notices.html', label: 'Notices', icon: 'megaphone', any: ['KPI_VIEW'] },
      { page: 'messages', href: 'management/messages.html', label: 'Messages & requests', icon: 'mail', any: ['MESSAGE_USE'] },
      { page: 'gm-reports', href: 'management/gm-reports.html', label: 'GM reports', icon: 'file', any: ['MGMT_REPORT_SUBMIT', 'KPI_REVIEW', 'KPI_VERIFY'] },
      { page: 'monthly-dashboard', href: 'management/monthly-dashboard.html', label: 'Monthly dashboard', icon: 'printer', any: ['MGMT_REPORT_SUBMIT', 'KPI_REVIEW', 'KPI_VERIFY'] }
    ] },
    { group: 'Administration', items: [
      { page: 'users', href: 'admin/users.html', label: 'User accounts', icon: 'key', any: ['USER_VIEW'] },
      { page: 'section-teams', href: 'admin/section-teams.html', label: 'Section teams', icon: 'team', any: ['SECTION_TEAM_MANAGE'] },
      { page: 'roles', href: 'admin/roles.html', label: 'Roles & permissions', icon: 'shield', any: ['USER_VIEW'] },
      { page: 'settings', href: 'admin/settings.html', label: 'System settings', icon: 'settings', any: ['SYSTEM_CONFIG'] },
      { page: 'activity', href: 'admin/activity.html', label: 'Activity (audit)', icon: 'activity', any: ['AUDIT_VIEW'] },
      { page: 'errors', href: 'admin/errors.html', label: 'Errors', icon: 'flag', any: ['AUDIT_VIEW'] },
      { page: 'backups', href: 'management/backups.html', label: 'Backups & exports', icon: 'database', any: ['BACKUP_RUN'] }
    ] }
  ];

  MS.NAV = NAV;

  MS.setMessageDot = function (n) {
    const dot = MS.$('msgDot'), ico = MS.$('msgIcon');
    if (!dot || !ico) return;
    dot.hidden = !n;
    ico.title = n ? 'Messages: ' + n + ' unread' : 'Messages';
    ico.setAttribute('aria-label', n ? 'Messages, ' + n + ' unread' : 'Messages');
  };

  const allowed = (n) => !n.any || MS.canAny(n.any);

  const NAV_KEY = 'ms.nav.v1';
  const navState = () => { try { return JSON.parse(localStorage.getItem(NAV_KEY) || '{}') || {}; } catch (e) { return {}; } };
  const navSave = (o) => { try { localStorage.setItem(NAV_KEY, JSON.stringify(o)); } catch (e) {  } };
  const ADMINISH = /SYSTEM_ADMIN|\bCEO\b|ADMIN_MD|GENERAL_MANAGER/;
  const DAILY = [[/FINANCE/, ['Customers', 'Finance']], [/\bCRO\b/, ['Customers', 'Jobs']], [/PRODUCTION|GRAPHIC/, ['Jobs']], [/STORES_OFFICER|PROCUREMENT_OFFICER/, []]];
  function groupOpen(g, hasActive) {
    if (hasActive || !g.group) return true;
    const saved = navState()[g.group];
    if (saved !== undefined) return !!saved;
    const roles = ((MS.user || {}).roles || []).join(' ');
    if (ADMINISH.test(roles)) return ['KPIs & performance', 'Management'].indexOf(g.group) < 0;
    return ((DAILY.find(([re]) => re.test(roles)) || [null, ['Jobs']])[1]).indexOf(g.group) >= 0;
  }

  function sideHtml(page) {
    const groups = NAV.map((g, gi) => {
      const list = g.items.filter(allowed);
      const items = list.map((n) =>
        `<a href="${n.href}" class="${n.page === page ? 'active' : ''}"${n.page === page ? ' aria-current="page"' : ''}>${ic(n.icon)}<span>${n.label}</span></a>`).join('');
      if (!items) return '';
      if (!g.group) return items;
      return `<div class="side-h">${esc(g.group)}</div>${items}`;
    }).join('');
    const cfg = window.APP_CONFIG || {};
    const quick = [
      MS.can('JOB_CREATE') && `<a href="jobs/job-new.html">${ic('clipboard')} Create job</a>`,
      MS.can('SECTION_WORK') && `<a href="jobs/my-section.html">${ic('factory')} My section</a>`,
      MS.can('JOB_LOCATION_VIEW') && `<a href="jobs/locations.html">${ic('map')} Where are the jobs</a>`,
      MS.can('CUSTOMER_CREATE') && `<a href="customers/customers.html?add=1">${ic('customers')} Add customer</a>`,
      MS.can('QUOTATION_CREATE') && `<a href="customers/quotation.html?new=1">${ic('invoice')} New proforma invoice</a>`,
      MS.can('ISSUE_REPORT') && `<a href="management/issues.html?new=1">${ic('flag')} Report an issue</a>`,
      MS.can('MEETING_MANAGE') && `<a href="management/briefing.html">${ic('clipboard')} Daily briefing</a>`,
      MS.can('ATTENDANCE_SELF') && `<a href="people/my-hr.html">${ic('clock')} Clock in or out</a>`,
      MS.can('LEAVE_REQUEST') && `<a href="people/my-hr.html?leave=1">${ic('calendar')} Request leave</a>`,
      MS.can('EMPLOYMENT_EDIT') && `<a href="people/employees.html?add=1">${ic('user')} Add employee</a>`,
      MS.can('ROLE_REQUEST') && `<a href="management/messages.html?role=1">${ic('key')} Request a role</a>`
    ].filter(Boolean).join('');
    return `
      <a class="side-brand" href="dashboard.html" title="${esc(cfg.APP_NAME)}">
        ${cfg.APP_LOGO ? `<span class="side-logo"><img src="${esc(cfg.APP_LOGO)}" alt=""></span>` : '<span class="side-mark">MS</span>'}
        <span class="side-name">${esc(cfg.APP_NAME || 'MS Designs & Printing')}</span>
      </a>
      ${quick ? `<div class="side-actions">
        <button type="button" class="act-btn" id="actBtn" aria-haspopup="true" aria-expanded="false">Actions ${ic('chevron')}</button>
        <div class="act-menu" id="actMenu" hidden>${quick}</div>
      </div>` : ''}
      <nav class="side-nav" aria-label="Main">${groups}
        <div class="side-sep"></div>
        ${MS.can('PAYSLIP_VIEW_OWN') ? `<a href="payslips.html" class="${page === 'payslips' ? 'active' : ''}">${ic('receipt')}<span>My payslips</span></a>` : ''}
        <a href="account.html" class="${page === 'account' ? 'active' : ''}">${ic('user')}<span>My account</span></a>
      </nav>`;
  }

  function barHtml() {
    const u = MS.user || {};
    const cfg = window.APP_CONFIG || {};
    return `
      <button type="button" class="iconbtn menu-btn" id="menuBtn" aria-label="Menu">${ic('menu')}</button>
      ${cfg.APP_LOGO ? `<a class="bar-logo" href="dashboard.html" title="${esc(cfg.APP_NAME)}"><img src="${esc(cfg.APP_LOGO)}" alt=""></a>` : ''}
      ${MS.page === 'dashboard' ? '' : `<button type="button" class="iconbtn back-btn" id="backBtn" title="Go back" aria-label="Go back">${ic('back')}<span>Back</span></button>`}
      <form class="appsearch" id="appSearch" role="search">
        ${ic('search')}<input id="appSearchInput" type="search" placeholder="Search jobs, customers, proforma invoices, people" aria-label="Search">
      </form>
      <div class="appbar-right">
        <div class="whois"><b id="topUser">${esc(u.display_name || u.username || '')}</b><span>${esc(u.position || (u.roles || []).map(MS.label).join(', '))}</span></div>
        <a class="topicon" href="notifications.html" title="Notifications">${ic('bell')}<span>Alerts</span><i class="bell-dot" id="bellDot" hidden></i></a>
        ${MS.can('MESSAGE_USE') ? `<a class="topicon" href="management/messages.html" title="Messages" aria-label="Messages" id="msgIcon">${ic('mail')}<span>Messages</span><i class="bell-dot" id="msgDot" hidden></i></a>` : ''}
        <button type="button" class="topicon" id="themeBtn" title="Light / dark scheme"></button>
        ${MS.can('SYSTEM_CONFIG') ? `<a class="topicon" href="admin/settings.html" title="System settings">${ic('settings')}<span>Settings</span></a>` : ''}
        <button type="button" class="topicon" id="logoutBtn" title="Sign out">${ic('logout')}<span>Sign out</span></button>
      </div>`;
  }

  function wire() {
    const side = MS.$('side');
    MS.$('menuBtn').addEventListener('click', () => document.body.classList.toggle('side-open'));
    side.querySelectorAll('button.side-h').forEach((b) => b.addEventListener('click', () => {
      const open = b.getAttribute('aria-expanded') !== 'true';
      b.setAttribute('aria-expanded', String(open));
      const box = MS.$(b.getAttribute('aria-controls'));
      if (box) box.hidden = !open;
      const st = navState(); st[b.dataset.grp] = open; navSave(st);
    }));
    document.addEventListener('click', (e) => {
      if (document.body.classList.contains('side-open') && !side.contains(e.target) && !MS.$('menuBtn').contains(e.target)) document.body.classList.remove('side-open');
      const menu = MS.$('actMenu');
      if (menu && !menu.hidden && !e.target.closest('.side-actions')) { menu.hidden = true; MS.$('actBtn').setAttribute('aria-expanded', 'false'); }
    });
    if (MS.$('actBtn')) {
      MS.$('actBtn').addEventListener('click', () => {
        const menu = MS.$('actMenu');
        menu.hidden = !menu.hidden;
        MS.$('actBtn').setAttribute('aria-expanded', String(!menu.hidden));
      });
    }
    MS.$('appSearch').addEventListener('submit', (e) => {
      e.preventDefault();
      const q = MS.$('appSearchInput').value.trim();
      if (q) location.href = 'search.html?q=' + encodeURIComponent(q);
    });
    MS.$('logoutBtn').addEventListener('click', () => MS.signOut(''));
    MS.$('themeBtn').addEventListener('click', MS.theme.toggle);
    MS.theme.apply(MS.theme.get());
    document.addEventListener('keydown', (e) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
      e.preventDefault();
      MS.$('appSearchInput').focus();
    });
    const bb = MS.$('backBtn');
    if (bb) bb.addEventListener('click', () => MS.goBack('dashboard.html'));
  }

  const TAB_KEY = 'ms.tabs.v1';
  const tabStore = {
    read() { try { return JSON.parse(localStorage.getItem(TAB_KEY) || '{}') || {}; } catch (e) { return {}; } },
    write(o) { try { localStorage.setItem(TAB_KEY, JSON.stringify(o)); } catch (e) {  } }
  };
  const tabGroups = () => Array.from(document.querySelectorAll('.tabs')).filter((g) => g.querySelector('[data-tab]'));
  const groupId = (g, i) => g.id || 'g' + i;
  const hashKey = (i, id) => (i === 0 ? 'tab' : 'tab-' + id);
  function hashParams() { return new URLSearchParams(location.hash.replace(/^#/, '')); }
  function rememberTab(g, i, tab) {
    const id = groupId(g, i), all = tabStore.read();
    const k = location.pathname + '|' + id;
    if (all[k] !== tab) { all[k] = tab; tabStore.write(all); }
    const hp = hashParams();
    hp.set(hashKey(i, id), tab);
    const url = location.pathname + location.search + '#' + hp.toString();
    try { history.replaceState(history.state, '', url); } catch (e) {  }
  }
  function visible(b) { return !!b && !b.hidden && b.getClientRects().length > 0; }
  function initTabs() {
    const touched = {};
    document.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('.tabs [data-tab]');
      if (!b) return;
      const groups = tabGroups(), g = b.closest('.tabs'), i = groups.indexOf(g);
      if (i < 0) return;
      touched[groupId(g, i)] = true;
      const tab = b.dataset.tab;
      setTimeout(() => rememberTab(g, i, tab), 0);
    }, true);
    let tries = 0;
    const done = {};
    const timer = setInterval(() => {
      tries++;
      const groups = tabGroups();
      const hp = hashParams(), saved = tabStore.read();
      groups.forEach((g, i) => {
        const id = groupId(g, i);
        if (done[id] || touched[id]) { done[id] = true; return; }
        const fromHash = hp.get(hashKey(i, id));
        const fromLink = i === 0 ? MS.param('tab') : '';
        const want = fromHash || fromLink || saved[location.pathname + '|' + id];
        const btns = Array.from(g.querySelectorAll('[data-tab]'));
        const target = want && btns.find((b) => b.dataset.tab === want && visible(b));
        if (!target) { if (tries > 12) done[id] = true; return; }
        if (target.classList.contains('on')) { if (tries > 3) done[id] = true; return; }
        target.click();
        if (tries > 12) done[id] = true;
      });
      if (tries >= 24 || (groups.length && groups.every((g, i) => done[groupId(g, i)]))) clearInterval(timer);
    }, 250);
  }

  function ensureShell() {
    let shell = document.querySelector('.shell');
    if (shell) return shell;
    shell = document.createElement('div');
    shell.className = 'shell';
    shell.innerHTML = '<aside class="side" id="side"></aside><div class="main"><header class="appbar"></header></div>';
    const main = shell.querySelector('.main');
    Array.from(document.body.children).forEach((el) => { if (el.tagName !== 'SCRIPT') main.appendChild(el); });
    document.body.insertBefore(shell, document.body.firstChild);
    return shell;
  }

  function trail(page) {
    const main = document.querySelector('main.page');
    if (!main || page === 'dashboard' || main.querySelector('.trail')) return;
    let grp = null, item = null;
    NAV.forEach((g) => g.items.forEach((n) => { if (n.page === page) { grp = g; item = n; } }));
    const t = document.createElement('nav');
    t.className = 'crumbs trail no-print';
    t.setAttribute('aria-label', 'You are here');
    t.innerHTML = '<a href="dashboard.html">Overview</a>' + (grp && grp.group ? `<span class="grp"> › ${esc(grp.group)}</span>` : '') +
      `<span class="here"> › ${item ? `<a href="${item.href}">${esc(item.label)}</a>` : esc(document.title.split(' · ')[0])}</span>`;
    const own = main.querySelector('.crumbs');
    if (own) { t.insertAdjacentHTML('beforeend', '<span class="sep"> › </span>'); t.appendChild(own); }
    main.insertBefore(t, main.firstChild);
  }

  function draw(page) {
    MS.$('side').innerHTML = sideHtml(page);
    document.querySelector('header.appbar').innerHTML = barHtml();
    wire();
  }

  const BTN_ICONS = [
    [/sign in|log in|login/i, 'login'], [/sign out|log out/i, 'logout'], [/send|email|forward|submit|share/i, 'send'], [/upload|attach|choose file/i, 'upload'],
    [/download|export|save as|pdf/i, 'download'], [/print/i, 'printer'], [/search|find|look up/i, 'search'], [/refresh|reload|try again/i, 'refresh'],
    [/delete|remove|discard|clear/i, 'x'], [/cancel|close|back|not now|no thanks|dismiss/i, 'x'], [/reject|decline|not ok|refuse/i, 'x'], [/hold|pause|stop|problem|return/i, 'pause'],
    [/approve|accept|verified|confirm|complete|finish|done|mark|save|apply|ok\b|yes|submit|record|post|pay/i, 'check'], [/edit|change|rename|update|reset/i, 'edit'],
    [/add|new|create|start|open a|request/i, 'plus'], [/view|open|show|details|see/i, 'eye'], [/copy/i, 'file'], [/next|continue|go on/i, 'arrow'], [/clock/i, 'clock'], [/pick|choose|select|tick/i, 'list']
  ];
  const iconFor = (text) => { const t = String(text || '').trim(); const hit = BTN_ICONS.find(([re]) => re.test(t)); return hit ? hit[1] : ''; };
  MS.decorateButtons = function (root) {
    (root || document).querySelectorAll('button, a.btn, a.big-btn, a.primary').forEach((b) => {
      if (b.dataset.noicon || b.querySelector('svg, img') || b.classList.contains('iconbtn') || b.classList.contains('topicon') || b.classList.contains('linkbtn') || b.closest('.side, .tabs, .chips, .viewtoggle, .sg-tabs, .sg-ink, .install-pop')) return;
      const text = (b.textContent || '').trim();
      if (!text || text.length > 48) return;
      const name = iconFor(text) || (b.classList.contains('primary') ? 'check' : '');
      if (!name) return;
      b.insertAdjacentHTML('afterbegin', ic(name));
      b.classList.add('has-ic');
    });
  };
  function watchButtons() {
    if (MS._btnWatch || !window.MutationObserver) return;
    MS._btnWatch = true;
    let queued = false;
    new MutationObserver(() => { if (queued) return; queued = true; setTimeout(() => { queued = false; MS.decorateButtons(document.body); }, 60); })
      .observe(document.body, { childList: true, subtree: true });
    MS.decorateButtons(document.body);
  }

  const ACCESS_FLAG = 'ms.access.updated';
  MS.accessChanged = function () {
    try {
      if (MS.page && MS.opts && MS.opts.any && !MS.canAny(MS.opts.any)) { location.replace('dashboard.html?denied=1'); return; }
      if (MS.$('side')) draw(MS.page);
      if (MS.user && MS.user.must_change_password) { location.replace('index.html?change=1'); return; }
      const typing = !!document.querySelector('dialog[open]:not(.imdlg)') || (document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && document.activeElement.value);
      if (typing) { MS.toast && MS.toast('Your access was updated. Finish what you are doing, then press F5 to see everything.', 'ok'); return; }
      try { sessionStorage.setItem(ACCESS_FLAG, '1'); } catch (e) {  }
      location.reload();
    } catch (e) { location.reload(); }
  };
  function startLive() {
    if (MS._live) return;
    MS._live = true;
    const sc = document.createElement('script');
    sc.src = 'js/live.js'; sc.async = true; sc.dataset.live = '1';
    document.body.appendChild(sc);
  }

  MS.boot = async function (opts) {
    opts = opts || {};
    const s = MS.store.read();
    const stop = () => new Promise(() => {});
    if (!s || !s.token || !s.user) {
      const here = MS.here();
      location.replace('index.html?next=' + encodeURIComponent(here));
      return stop();
    }
    MS.session = s;
    MS.user = s.user;
    if (s.user.must_change_password) { location.replace('index.html?change=1'); return stop(); }
    if (s.user.approval_status && s.user.approval_status !== 'APPROVED') { location.replace('index.html'); return stop(); }
    if (opts.any && !MS.canAny(opts.any)) { location.replace('dashboard.html?denied=1'); return stop(); }
    MS.page = opts.page;
    MS.opts = opts;
    ensureShell();
    document.body.classList.add('app');
    draw(opts.page);
    trail(opts.page);
    initTabs();
    watchButtons();
    startLive();
    try {
      if (sessionStorage.getItem(ACCESS_FLAG)) { sessionStorage.removeItem(ACCESS_FLAG); setTimeout(() => MS.toast && MS.toast('Your access was updated', 'ok'), 400); }
    } catch (e) {  }
    if (opts.page !== 'dashboard' && MS.param('q') && MS.$('appSearchInput') && opts.page === 'search') MS.$('appSearchInput').value = MS.param('q');
    document.body.classList.remove('booting');
    if (opts.ref && !MS.refCache && !MS.store.readRef()) document.body.classList.add('refwait');
    if (opts.ref) { try { await MS.ref(); } catch (e) {  } }
    document.body.classList.remove('refwait');
    if (s.unread && MS.$('bellDot')) MS.$('bellDot').hidden = false;
    MS.setMessageDot(s.unread_messages || 0);
    if (!s.me_at || Date.now() - s.me_at > 5 * 60 * 1000) {
      MS.refreshMe(true).then((me) => {
        if (!me) return;
        if (MS.$('bellDot')) MS.$('bellDot').hidden = !me.unread_notifications;
        MS.setMessageDot(me.unread_messages || 0);
      });
    }
    MS.notifyReady = new Promise((ok) => {
      if (document.querySelector('script[data-notify]')) { ok(); return; }
      const sc = document.createElement('script');
      sc.src = 'js/notify.js'; sc.async = true; sc.dataset.notify = '1';
      sc.onload = () => ok(); sc.onerror = () => ok();
      document.body.appendChild(sc);
    });
    MS.pushReady = new Promise((ok) => {
      if (document.querySelector('script[data-push]')) { ok(); return; }
      const sc = document.createElement('script');
      sc.src = 'js/push.js'; sc.async = true; sc.dataset.push = '1';
      sc.onload = () => ok(); sc.onerror = () => ok();
      document.body.appendChild(sc);
    });
    MS.workReady = new Promise((ok) => {
      if (document.querySelector('script[data-work]')) { ok(); return; }
      const sc = document.createElement('script');
      sc.src = 'js/work.js'; sc.async = true; sc.dataset.work = '1';
      sc.onload = () => ok(); sc.onerror = () => ok();
      document.body.appendChild(sc);
    });
    return s;
  };
})();
