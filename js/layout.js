/* Every signed-in page starts with MS.boot(): checks the sign-in, draws the side menu and the top bar.
   Menus only hide what a person cannot use; the server checks every action again. */
(function () {
  const MS = (window.MS = window.MS || {});
  const esc = (s) => MS.esc(s);
  const ic = (n) => MS.icon(n);

  // the working screens, grouped like the business
  const NAV = [
    { group: '', items: [
      { page: 'dashboard', href: 'dashboard.html', label: 'Overview', icon: 'dashboard' },
      { page: 'notifications', href: 'notifications.html', label: 'Notifications', icon: 'bell' }
    ] },
    { group: 'Jobs', items: [
      { page: 'jobs', href: 'jobs/jobs.html', label: 'Jobs & Work Sheets', icon: 'clipboard', any: ['JOB_VIEW'] },
      { page: 'job-new', href: 'jobs/job-new.html', label: 'New job', icon: 'plus', any: ['JOB_CREATE'] },
      { page: 'designs', href: 'jobs/designs.html', label: 'Design', icon: 'pen', any: ['DESIGN_VIEW'] },
    ] },
    { group: 'Stores', items: [
      { page: 'items', href: 'stores/items.html', label: 'Items & stock', icon: 'box', any: ['INVENTORY_VIEW'] },
      { page: 'requisitions', href: 'stores/requisitions.html', label: 'Requisitions & issues', icon: 'clipboard', any: ['REQUISITION_CREATE', 'REQUISITION_APPROVE', 'INVENTORY_ISSUE'] },
      { page: 'stock-counts', href: 'stores/stock-counts.html', label: 'Stock counts', icon: 'list', any: ['STOCK_COUNT'] },
      { page: 'adjustments', href: 'stores/adjustments.html', label: 'Stock adjustments', icon: 'flag', any: ['INVENTORY_ADJUST', 'INVENTORY_ADJUST_APPROVE'] },
      { page: 'opening-stock', href: 'stores/opening-stock.html', label: 'Opening stock', icon: 'upload', any: ['INVENTORY_RECEIVE', 'FINANCE_APPROVE'] }
    ] },
    { group: 'Purchasing', items: [
      { page: 'purchase-requests', href: 'purchasing/purchase-requests.html', label: 'Purchase requests', icon: 'file', any: ['PURCHASE_REQUEST', 'PURCHASE_APPROVE'] },
      { page: 'purchase-orders', href: 'purchasing/purchase-orders.html', label: 'Purchase orders', icon: 'invoice', any: ['PO_CREATE', 'PURCHASE_APPROVE', 'INVENTORY_RECEIVE', 'FINANCE_VIEW'] },
      { page: 'goods-received', href: 'purchasing/goods-received.html', label: 'Goods received', icon: 'truck', any: ['INVENTORY_RECEIVE', 'PO_CREATE'] },
      { page: 'supplier-bills', href: 'purchasing/supplier-bills.html', label: 'Supplier bills & payments', icon: 'receipt', any: ['FINANCE_VIEW', 'SUPPLIER_PAYMENT_PREPARE'] },
      { page: 'suppliers', href: 'purchasing/suppliers.html', label: 'Suppliers', icon: 'briefcase', any: ['SUPPLIER_MANAGE', 'PO_CREATE', 'FINANCE_VIEW'] }
    ] },
    { group: 'Customers', items: [
      { page: 'customers', href: 'customers/customers.html', label: 'Customers', icon: 'customers', any: ['CUSTOMER_VIEW'] },
      { page: 'enquiries', href: 'customers/enquiries.html', label: 'Enquiries', icon: 'mail', any: ['ENQUIRY_MANAGE'] },
      { page: 'quotations', href: 'customers/quotations.html', label: 'Quotations', icon: 'invoice', any: ['QUOTATION_VIEW'] }
    ] },
    { group: 'Finance', items: [
      { page: 'invoices', href: 'finance/invoices.html', label: 'Invoices', icon: 'invoice', any: ['FINANCE_VIEW', 'INVOICE_CREATE'] },
      { page: 'payments', href: 'finance/payments.html', label: 'Payments received', icon: 'receipt', any: ['FINANCE_VIEW', 'PAYMENT_RECORD'] },
      { page: 'expenses', href: 'finance/expenses.html', label: 'Expenses', icon: 'wallet', any: ['FINANCE_VIEW', 'EXPENSE_CREATE', 'EXPENSE_APPROVE'] },
      { page: 'cash-forecast', href: 'finance/cash-forecast.html', label: 'Cash-flow forecast', icon: 'trend', any: ['FINANCE_VIEW'] },
      { page: 'budget', href: 'finance/budget.html', label: 'Budget vs actual', icon: 'target', any: ['FINANCE_VIEW', 'BUDGET_MANAGE', 'BUDGET_APPROVE'] },
      { page: 'reports', href: 'finance/reports.html', label: 'Profit & loss', icon: 'chart', any: ['FINANCE_VIEW'] },
      { page: 'close', href: 'finance/close.html', label: 'Month-end close', icon: 'lock', any: ['PERIOD_CLOSE', 'FINANCE_VIEW'] },
      { page: 'monthly-report', href: 'finance/monthly-report.html', label: 'Monthly financial report', icon: 'file', any: ['FIN_REPORT_SUBMIT', 'FIN_REPORT_REVIEW'] },
      { page: 'accounts', href: 'finance/accounts.html', label: 'Accounts & journal', icon: 'list', any: ['FINANCE_VIEW'] }
    ] },
    { group: 'People', items: [
      { page: 'employees', href: 'people/employees.html', label: 'Employees', icon: 'team', any: ['EMPLOYEE_VIEW'] },
      { page: 'employment-actions', href: 'people/employment-actions.html', label: 'Employment actions', icon: 'flag', any: ['EMPLOYMENT_ACTION_REQUEST', 'USER_DEACTIVATE'] },
      { page: 'payroll', href: 'people/payroll.html', label: 'Payroll', icon: 'money', any: ['PAYROLL_PREPARE', 'PAYROLL_APPROVE', 'FINANCE_PAYROLL_VIEW'] }
    ] },
    { group: 'Administration', items: [
      { page: 'users', href: 'admin/users.html', label: 'User accounts', icon: 'key', any: ['USER_VIEW'] },
      { page: 'roles', href: 'admin/roles.html', label: 'Roles & permissions', icon: 'shield', any: ['USER_VIEW'] },
      { page: 'settings', href: 'admin/settings.html', label: 'System settings', icon: 'settings', any: ['SYSTEM_CONFIG'] },
      { page: 'activity', href: 'admin/activity.html', label: 'Activity (audit)', icon: 'activity', any: ['AUDIT_VIEW'] }
    ] }
  ];

  MS.NAV = NAV;

  const allowed = (n) => !n.any || MS.canAny(n.any);

  function sideHtml(page) {
    const groups = NAV.map((g) => {
      const items = g.items.filter(allowed).map((n) =>
        `<a href="${n.href}" class="${n.page === page ? 'active' : ''}"${n.page === page ? ' aria-current="page"' : ''}>${ic(n.icon)}<span>${n.label}</span></a>`).join('');
      if (!items) return '';
      return (g.group ? `<div class="side-h">${g.group}</div>` : '') + items;
    }).join('');
    const cfg = window.APP_CONFIG || {};
    const quick = [
      MS.can('JOB_CREATE') && `<a href="jobs/job-new.html">${ic('clipboard')} New job</a>`,
      MS.can('CUSTOMER_CREATE') && `<a href="customers/customers.html?add=1">${ic('customers')} Add customer</a>`,
      MS.can('ENQUIRY_MANAGE') && `<a href="customers/enquiries.html?add=1">${ic('mail')} New enquiry</a>`,
      MS.can('QUOTATION_CREATE') && `<a href="customers/quotation.html?new=1">${ic('invoice')} New quotation</a>`,
      MS.can('EMPLOYMENT_EDIT') && `<a href="people/employees.html?add=1">${ic('user')} Add employee</a>`
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
    return `
      <button type="button" class="iconbtn menu-btn" id="menuBtn" aria-label="Menu">${ic('menu')}</button>
      ${MS.page === 'dashboard' ? '' : `<button type="button" class="iconbtn back-btn" id="backBtn" title="Go back" aria-label="Go back">${ic('back')}<span>Back</span></button>`}
      <form class="appsearch" id="appSearch" role="search">
        ${ic('search')}<input id="appSearchInput" type="search" placeholder="Search jobs, customers, quotations, people" aria-label="Search">
      </form>
      <div class="appbar-right">
        <div class="whois"><b id="topUser">${esc(u.display_name || u.username || '')}</b><span>${esc(u.position || (u.roles || []).map(MS.label).join(', '))}</span></div>
        <a class="topicon" href="notifications.html" title="Notifications">${ic('bell')}<span>Alerts</span><i class="bell-dot" id="bellDot" hidden></i></a>
        <button type="button" class="topicon" id="themeBtn" title="Light / dark scheme"></button>
        ${MS.can('SYSTEM_CONFIG') ? `<a class="topicon" href="admin/settings.html" title="System settings">${ic('settings')}<span>Settings</span></a>` : ''}
        <button type="button" class="topicon" id="logoutBtn" title="Sign out">${ic('logout')}<span>Sign out</span></button>
      </div>`;
  }

  function wire() {
    const side = MS.$('side');
    MS.$('menuBtn').addEventListener('click', () => document.body.classList.toggle('side-open'));
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

  // builds the shell around the page's <main> when the page does not have it
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

  // the same trail on every page: Overview › area › screen (a detail page's own trail replaces the screen part)
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

  /**
   * opts: { page: 'jobs', any: ['JOB_VIEW'] (only people with one of these may open it), ref: true (load reference lists first) }
   * Resolves once the page may run. Never resolves when the person is sent elsewhere.
   */
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
    // a new sign-up waiting for the System Administrator sees only the "Waiting for approval" card (the server refuses everything else too)
    if (s.user.approval_status && s.user.approval_status !== 'APPROVED') { location.replace('index.html'); return stop(); }
    if (opts.any && !MS.canAny(opts.any)) { location.replace('dashboard.html?denied=1'); return stop(); }
    MS.page = opts.page;
    ensureShell();
    document.body.classList.add('app');
    draw(opts.page);
    trail(opts.page);
    if (opts.page !== 'dashboard' && MS.param('q') && MS.$('appSearchInput') && opts.page === 'search') MS.$('appSearchInput').value = MS.param('q');
    if (opts.ref) { try { await MS.ref(); } catch (e) { /* pages show their own error */ } }
    document.body.classList.remove('booting');
    // who I am (roles may change) and the unread count: asked at most every 5 minutes, not on every page
    if (s.unread && MS.$('bellDot')) MS.$('bellDot').hidden = false;
    if (!s.me_at || Date.now() - s.me_at > 5 * 60 * 1000) {
      MS.call('AUTH_ME').then((me) => {
        const fresh = Object.assign({}, MS.user, me);
        MS.store.update({ me_at: Date.now(), unread: me.unread_notifications || 0, user: fresh });
        if (JSON.stringify(fresh.permissions) !== JSON.stringify(MS.user.permissions)) { MS.user = fresh; draw(opts.page); }
        if (MS.$('bellDot')) MS.$('bellDot').hidden = !me.unread_notifications;
      }).catch(() => {});
    }
    return s;
  };
})();
