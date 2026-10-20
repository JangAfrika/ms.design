/* Jobs & Work Sheets: search, status filter (?status=CODE), priority filter (?priority=CODE), order (?sort=),
   quick filters overdue / due in 48 hours (?f=overdue|due). The default order is the production queue:
   Emergency first, then Confirmed deadline, Normal, Flexible, each by the earliest deadline. Each row opens the job's Work Sheet. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const OPEN = ['APPROVED', 'DEPOSIT_PAID', 'JOB_CREATED', 'DESIGN', 'CUSTOMER_APPROVAL', 'MATERIAL_READY', 'IN_PRODUCTION', 'QUALITY_CONTROL', 'FINISHING', 'READY', 'ON_HOLD'];
  const DONE = ['DELIVERED', 'BALANCE_PAID', 'CLOSED', 'CANCELLED'];
  const SIZE = 50;
  const PRIORITIES = ['EMERGENCY', 'CONFIRMED_DEADLINE', 'NORMAL', 'FLEXIBLE'];
  const SORTS = { '': { label: 'Priority, then deadline' }, deadline: { label: 'Deadline first', sort: 'customer_deadline', dir: 'asc' },
    newest: { label: 'Newest job first', sort: 'job_number', dir: 'desc' } };
  const state = { page: 1, q: '', status: MS.param('status'), f: MS.param('f'), priority: MS.param('priority'), sort: MS.param('sort') };
  if (PRIORITIES.indexOf(state.priority) < 0) state.priority = '';
  if (!SORTS[state.sort]) state.sort = '';

  // Emergency red, Confirmed deadline amber, Flexible grey, Normal left blank so the exceptions stand out
  const priority = (j) => (j.priority === 'NORMAL' || !j.priority ? '' : MS.pill(j.priority === 'EMERGENCY' ? 'EMERGENCY' : j.priority === 'CONFIRMED_DEADLINE' ? 'PENDING' : 'OFF', MS.label(j.priority))) +
    (j.emergency_requested ? ' ' + MS.pill('SUBMITTED', 'Emergency requested') : '');

  function syncUrl() {
    const u = new URLSearchParams();
    if (state.status) u.set('status', state.status);
    if (state.f) u.set('f', state.f);
    if (state.priority) u.set('priority', state.priority);
    if (state.sort) u.set('sort', state.sort);
    const qs = u.toString();
    history.replaceState(null, '', 'jobs/jobs.html' + (qs ? '?' + qs : ''));
  }

  function query(page, size) {
    const o = SORTS[state.sort];
    const p = { page, page_size: size, search: state.q, filters: {} };
    if (o.sort) { p.sort = o.sort; p.dir = o.dir; }
    if (state.priority) p.filters.priority = state.priority;
    if (state.status === '*') { /* every job */ } else if (state.status) p.filters.status = state.status;
    else p.open_only = true;
    if (state.f === 'overdue') p.overdue_only = true;
    return p;
  }

  // "Due in 48 hours" has no server filter: read the open jobs and keep the ones due between now and 48 hours from now.
  async function dueJobs() {
    const now = new Date().toISOString();
    const until = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    let all = [], page = 1, total = 0;
    do {
      const r = await MS.call('JOB_LIST', query(page, 100));
      all = all.concat(r.rows);
      total = r.total;
      page++;
    } while (all.length < total && page <= 20);
    const rows = all.filter((j) => j.customer_deadline && j.customer_deadline >= now && j.customer_deadline <= until);
    return { rows: rows.slice((state.page - 1) * SIZE, state.page * SIZE), total: rows.length, page_size: SIZE };
  }

  MS.reload = () => load();
  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    syncUrl();
    try {
      const r = state.f === 'due' ? await dueJobs() : await MS.recall('JOB_LIST', query(state.page, SIZE));
      const what = state.f === 'overdue' ? ' past the deadline' : state.f === 'due' ? ' due in the next 48 hours' : '';
      MS.setMsg('listMsg', r.total + ' job' + (r.total === 1 ? '' : 's') + what);
      $('listBody').innerHTML = r.rows.length ? r.rows.map((j) => `
        <tr class="clk" data-href="jobs/job.html?id=${encodeURIComponent(j.job_id)}">
          <td><b>${MS.lnk('jobs/job.html?id=' + encodeURIComponent(j.job_id), j.job_number)}</b></td>
          <td class="wrap">${esc(j.job_name)}</td>
          <td>${esc(j.customer_name || '')}</td>
          <td>${priority(j)}</td>
          <td>${MS.pill(j.status, MS.statusLabel(j.status, 'jobs'))}</td>
          <td class="${j.overdue ? 'late' : ''}">${esc(MS.when(j.customer_deadline))}</td>
        </tr>`).join('') : `<tr><td colspan="6" class="empty">${state.q || state.f || state.status || state.priority ? 'No job matches.' : 'No open jobs.'}</td></tr>`;
      pager(r);
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  function pager(r) {
    const pages = Math.max(1, Math.ceil(r.total / (r.page_size || SIZE)));
    $('pager').innerHTML = pages > 1 ? `<button type="button" id="pPrev"${state.page <= 1 ? ' disabled' : ''}>Previous</button><span>Page ${state.page} of ${pages}</span><button type="button" id="pNext"${state.page >= pages ? ' disabled' : ''}>Next</button>` : '';
    if (pages > 1) {
      $('pPrev').onclick = () => { state.page--; load(); };
      $('pNext').onclick = () => { state.page++; load(); };
    }
  }

  function chips() {
    document.querySelectorAll('#quick button').forEach((b) => b.classList.toggle('active', b.dataset.f === state.f));
  }

  MS.boot({ page: 'jobs', any: ['JOB_VIEW'], ref: true }).then(() => {
    if (state.f !== 'overdue' && state.f !== 'due') state.f = '';
    const opts = [{ value: '', label: 'All open jobs' }]
      .concat(OPEN.concat(DONE).map((s) => ({ value: s, label: MS.statusLabel(s, 'jobs') })))
      .concat([{ value: '*', label: 'Every job (open and finished)' }]);
    if (state.status && !opts.some((o) => o.value === state.status)) opts.push({ value: state.status, label: MS.statusLabel(state.status, 'jobs') });
    $('statusFilter').innerHTML = MS.options(opts, state.status);
    $('prioFilter').innerHTML = MS.options([{ value: '', label: 'Any priority' }].concat(PRIORITIES.map((p) => ({ value: p, label: MS.label(p) }))), state.priority);
    $('sortBy').innerHTML = MS.options(Object.keys(SORTS).map((k) => ({ value: k, label: SORTS[k].label })), state.sort);
    $('addBtn').hidden = !MS.can('JOB_CREATE');
    chips();
    $('search').addEventListener('input', MS.debounce(() => { state.q = $('search').value.trim(); state.page = 1; load(); }, 300));
    $('statusFilter').addEventListener('change', () => { state.status = $('statusFilter').value; state.page = 1; load(); });
    $('prioFilter').addEventListener('change', () => { state.priority = $('prioFilter').value; state.page = 1; load(); });
    $('sortBy').addEventListener('change', () => { state.sort = $('sortBy').value; state.page = 1; load(); });
    $('quick').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      state.f = b.dataset.f; state.page = 1; chips(); load();
    });
    $('reloadBtn').addEventListener('click', load);
    MS.clickable($('listBody'));
    load();
  });
})();
