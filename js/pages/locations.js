/* Where are the jobs: every open job with its section (and subsection), who holds it, days there, deadline and progress.
   Section chips filter the list (?section=ID). For the CEO, the Administrator, the General Manager, the Production Manager and the Finance Director. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const SIZE = 50;
  const state = { page: 1, q: '', section: MS.param('section'), f: '' };

  function query() {
    const p = { page: state.page, page_size: SIZE, search: state.q };
    if (state.section) p.section_id = state.section;
    if (state.f === 'overdue') p.overdue_only = true;
    if (state.f === 'hold') p.on_hold = true;
    return p;
  }

  function chipsHtml(r) {
    const all = `<button type="button" data-s="" class="${state.section ? '' : 'active'}"><b>${r.open_total}</b><span>All sections</span></button>`;
    return all + r.sections.map((s) => `<button type="button" data-s="${esc(s.section_id)}" class="${state.section === s.section_id ? 'active' : ''}"><b>${s.count}</b><span>${esc(s.section_name)}</span>${s.overdue ? `<small>${s.overdue} late</small>` : ''}</button>`).join('');
  }

  MS.reload = () => load();
  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    try {
      const r = await MS.recall('JOB_LOCATION_LIST', query());
      $('secChips').innerHTML = chipsHtml(r);
      $('sectionFilter').innerHTML = MS.options(r.sections.map((s) => ({ value: s.section_id, label: s.section_name + ' (' + s.count + ')' })), state.section, 'Any section');
      const late = r.sections.reduce((n, s) => n + s.overdue, 0);
      $('whereSum').textContent = r.open_total + ' open job' + (r.open_total === 1 ? '' : 's') + (late ? ' · ' + late + ' past the deadline' : '') + '.';
      MS.setMsg('listMsg', r.total + ' shown');
      $('listBody').innerHTML = r.rows.length ? r.rows.map((j) => `
        <tr class="clk" data-href="jobs/job.html?id=${encodeURIComponent(j.job_id)}">
          <td><b>${MS.lnk('jobs/job.html?id=' + encodeURIComponent(j.job_id), j.job_number)}</b><div class="sub">${esc(j.job_name)}</div></td>
          <td>${esc(j.customer_name || '')}</td>
          <td class="wrap">${esc(MS.jobWhere(j))}</td>
          <td class="wrap">${esc(j.holders || '')}</td>
          <td class="num">${j.days_here}</td>
          <td class="${j.overdue ? 'late' : ''}">${esc(MS.when(j.customer_deadline))}</td>
          <td>${MS.jobProg(j)}</td>
        </tr>`).join('') : '<tr><td colspan="7" class="empty">No job matches.</td></tr>';
      const pages = Math.max(1, Math.ceil(r.total / (r.page_size || SIZE)));
      $('pager').innerHTML = pages > 1 ? `<button type="button" id="pPrev"${state.page <= 1 ? ' disabled' : ''}>Previous</button><span>Page ${state.page} of ${pages}</span><button type="button" id="pNext"${state.page >= pages ? ' disabled' : ''}>Next</button>` : '';
      if (pages > 1) { $('pPrev').onclick = () => { state.page--; load(); }; $('pNext').onclick = () => { state.page++; load(); }; }
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  const setSection = (id) => { state.section = id; state.page = 1; history.replaceState(null, '', 'jobs/locations.html' + (id ? '?section=' + encodeURIComponent(id) : '')); load(); };

  MS.boot({ page: 'locations', any: ['JOB_LOCATION_VIEW'], ref: true }).then(() => {
    $('search').addEventListener('input', MS.debounce(() => { state.q = $('search').value.trim(); state.page = 1; load(); }, 300));
    $('sectionFilter').addEventListener('change', () => setSection($('sectionFilter').value));
    $('secChips').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setSection(b.dataset.s); });
    $('quick').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      state.f = b.dataset.f; state.page = 1;
      document.querySelectorAll('#quick button').forEach((x) => x.classList.toggle('active', x === b));
      load();
    });
    $('reloadBtn').addEventListener('click', load);
    MS.clickable($('listBody'));
    load();
  });
})();
