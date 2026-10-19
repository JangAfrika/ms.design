/* Design queue: every design task you may see, with filters for status, designer and overdue work. Each row opens the design page. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const STATUSES = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'INTERNAL_REVIEW', 'SENT_TO_CUSTOMER', 'CUSTOMER_REVISION', 'CUSTOMER_APPROVED', 'COMPLETED', 'REJECTED'];
  const OPEN = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'INTERNAL_REVIEW', 'SENT_TO_CUSTOMER', 'CUSTOMER_REVISION'];
  const state = { page: 1, q: '', status: MS.param('status'), designer: '', open: !MS.param('status') || OPEN.indexOf(MS.param('status')) >= 0, late: MS.param('f') === 'overdue' };

  function query(extra) {
    const filters = { status: state.status, designer_id: state.designer };
    if (state.late) filters.overdue = true;
    return Object.assign({ page: state.page, page_size: 50, search: state.q, filters, sort: 'due_at', dir: 'asc', open_only: state.open }, extra || {});
  }

  MS.reload = () => load();
  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    try {
      const r = await MS.recall('DESIGN_LIST', query());
      MS.setMsg('listMsg', r.total + ' design task' + (r.total === 1 ? '' : 's'));
      $('listBody').innerHTML = r.rows.length ? r.rows.map((t) => {
        const href = 'jobs/design.html?task=' + encodeURIComponent(t.design_task_id);
        return `<tr class="clk" data-href="${esc(href)}">
          <td><b>${MS.lnk(href, t.job_number)}</b></td>
          <td>${esc(t.job_name)}</td>
          <td>${t.designer_name ? esc(t.designer_name) : '<span class="muted">not assigned</span>'}</td>
          <td>${MS.pill(t.status)}</td>
          <td class="num">${esc(t.revision_count || 0)}</td>
          <td>${t.overdue ? `<span class="late">${esc(MS.when(t.due_at))} · overdue</span>` : esc(MS.when(t.due_at))}</td>
        </tr>`;
      }).join('') : `<tr><td colspan="6" class="empty">${state.q || state.status || state.designer || state.late ? 'No design task matches.' : state.open ? 'No open design tasks.' : 'No design tasks yet.'}</td></tr>`;
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

  // the figures on top: each one sets the filters below
  const CARDS = [
    { key: 'open', k: 'Open tasks', s: 'Not yet approved by the customer', set: { open: true, late: false, status: '' } },
    { key: 'late', k: 'Overdue', s: 'Past the design due time', set: { open: true, late: true, status: '' }, tone: 'red' },
    { key: 'review', k: 'Waiting for review', s: 'Internal review by the Head of Graphic Design', set: { open: true, late: false, status: 'INTERNAL_REVIEW' } },
    { key: 'release', k: 'Ready to release', s: 'Customer approved, not yet in production', set: { open: false, late: false, status: 'CUSTOMER_APPROVED' } }
  ];

  async function cards() {
    const one = (extra) => MS.call('DESIGN_LIST', Object.assign({ page: 1, page_size: 1 }, extra)).then((r) => r.total).catch(() => '');
    const n = await Promise.all([
      one({ open_only: true }), one({ open_only: true, filters: { overdue: true } }),
      one({ filters: { status: 'INTERNAL_REVIEW' } }), one({ filters: { status: 'CUSTOMER_APPROVED' } })
    ]);
    $('dCards').innerHTML = CARDS.map((c, i) => `<a class="card${c.tone && n[i] > 0 ? ' ' + c.tone : ''}" href="#" data-card="${i}"><div class="k">${esc(c.k)}</div><div class="v">${esc(n[i])}</div><div class="s">${esc(c.s)}</div></a>`).join('');
  }

  function syncInputs() {
    $('statusFilter').value = state.status;
    $('openOnly').checked = state.open;
    $('lateOnly').checked = state.late;
  }

  MS.boot({ page: 'designs', any: ['DESIGN_VIEW'], ref: true }).then(() => {
    $('statusFilter').innerHTML = MS.options(STATUSES.map((s) => ({ value: s, label: MS.statusLabel(s, 'design_tasks') })), state.status, 'Any status');
    const mine = MS.user.employee_id ? `<option value="${esc(MS.user.employee_id)}">My tasks</option>` : '';
    $('designerFilter').innerHTML = MS.employeesIn(['GRAPHIC_DESIGNER', 'HEAD_OF_GRAPHIC_DESIGN'], '', 'Any designer').replace('</option>', '</option>' + mine);
    syncInputs();
    $('search').addEventListener('input', MS.debounce(() => { state.q = $('search').value.trim(); state.page = 1; load(); }, 300));
    $('statusFilter').addEventListener('change', () => {
      state.status = $('statusFilter').value;
      if (state.status && OPEN.indexOf(state.status) < 0) { state.open = false; syncInputs(); }
      state.page = 1; load();
    });
    $('designerFilter').addEventListener('change', () => { state.designer = $('designerFilter').value; state.page = 1; load(); });
    $('openOnly').addEventListener('change', () => { state.open = $('openOnly').checked; state.page = 1; load(); });
    $('lateOnly').addEventListener('change', () => { state.late = $('lateOnly').checked; state.page = 1; load(); });
    $('reloadBtn').addEventListener('click', () => { cards(); load(); });
    $('dCards').addEventListener('click', (e) => {
      const a = e.target.closest('[data-card]');
      if (!a) return;
      e.preventDefault();
      Object.assign(state, CARDS[Number(a.dataset.card)].set, { page: 1 });
      syncInputs();
      load();
    });
    MS.clickable($('listBody'));
    cards();
    load();
  });
})();
