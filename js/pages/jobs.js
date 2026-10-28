(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const SIZE = 50;
  const STATUSES = ['IN_SECTIONS', 'IN_PRODUCTION_DEPT', 'ON_HOLD', 'DONE', 'CANCELLED'];
  const state = { page: 1, q: '', status: MS.param('status'), section: MS.param('section'), f: MS.param('f') };

  function syncUrl() {
    const u = new URLSearchParams();
    if (state.status) u.set('status', state.status);
    if (state.section) u.set('section', state.section);
    if (state.f) u.set('f', state.f);
    const qs = u.toString();
    history.replaceState(null, '', 'jobs/jobs.html' + (qs ? '?' + qs : ''));
  }

  function query(page, size) {
    const p = { page, page_size: size, search: state.q };
    if (state.f === 'pay') { p.status = 'DONE'; } else if (state.status === '*') {  } else if (state.status) p.status = state.status;
    else { p.open_only = true; p.include_done = true; }
    if (state.f === 'pay') p.awaiting_payment = true;
    if (state.section) p.section_id = state.section;
    if (state.f === 'overdue') p.overdue_only = true;
    return p;
  }

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
      const what = state.f === 'overdue' ? ' past the deadline' : state.f === 'due' ? ' due in the next 48 hours' : state.f === 'pay' ? ' finished and waiting for payment' : '';
      MS.setMsg('listMsg', r.total + ' job' + (r.total === 1 ? '' : 's') + what);
      $('listBody').innerHTML = r.rows.length ? r.rows.map((j) => `
        <tr class="clk" data-href="jobs/job.html?id=${encodeURIComponent(j.job_id)}">
          <td><b>${MS.lnk('jobs/job.html?id=' + encodeURIComponent(j.job_id), j.job_number)}</b></td>
          <td class="wrap">${esc(j.job_name)}</td>
          <td>${esc(j.customer_name || '')}</td>
          <td class="wrap">${esc(MS.jobWhere(j))}</td>
          <td>${MS.jobProg(j)}</td>
          <td>${MS.pill(j.status, MS.statusLabel(j.status, 'jobs'))} ${MS.payChip(j)}</td>
          <td class="${j.overdue ? 'late' : ''}">${esc(MS.when(j.customer_deadline))}</td>
        </tr>`).join('') : `<tr><td colspan="7" class="empty">${state.f === 'pay' ? 'No finished job is waiting for payment.' : state.q || state.f || state.status || state.section ? 'No job matches.' : 'No open jobs.'}</td></tr>`;
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

  const showPay = () => MS.canAny(['FINANCE_VIEW', 'JOB_DELIVER', 'JOB_HISTORY_VIEW']);
  MS.boot({ page: state.f === 'pay' ? 'jobs-pay' : 'jobs', any: ['JOB_VIEW'], ref: true }).then(() => {
    if (state.f !== 'overdue' && state.f !== 'due' && !(state.f === 'pay' && showPay())) state.f = '';
    const opts = [{ value: '', label: 'All open jobs' }]
      .concat(STATUSES.map((s) => ({ value: s, label: MS.statusLabel(s, 'jobs') })))
      .concat([{ value: '*', label: 'Every job (delivered ones are in Job History)' }]);
    $('statusFilter').innerHTML = MS.options(opts, state.status);
    const secs = ((MS.refCache && MS.refCache.sections) || []);
    $('sectionFilter').innerHTML = MS.options(secs.map((s) => ({ value: s.section_id, label: s.section_name })), state.section, 'Any section');
    $('addBtn').hidden = !MS.can('JOB_CREATE');
    $('payChip').hidden = !showPay();
    chips();
    $('search').addEventListener('input', MS.debounce(() => { state.q = $('search').value.trim(); state.page = 1; load(); }, 300));
    $('statusFilter').addEventListener('change', () => { state.status = $('statusFilter').value; state.page = 1; load(); });
    $('sectionFilter').addEventListener('change', () => { state.section = $('sectionFilter').value; state.page = 1; load(); });
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
