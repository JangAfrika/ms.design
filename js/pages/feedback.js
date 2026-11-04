(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const state = { page: 1, q: '' };

  MS.reload = () => load();
  async function pending() {
    try {
      const p = await MS.call('CUSTOMER_FEEDBACK_PENDING', {});
      $('pendingBox').hidden = !p.rows.length;
      $('pendingBody').innerHTML = p.rows.map((j) => `<tr>
        <td><b>${MS.lnk('jobs/job.html?id=' + encodeURIComponent(j.job_id), j.job_number)}</b> ${esc(j.job_name)}</td>
        <td>${MS.lnk('customers/customer.html?id=' + encodeURIComponent(j.customer_id), j.customer_name)}</td>
        <td>${esc(MS.shortDate(j.delivered_at))}</td>
        <td><button type="button" class="linkbtn" data-job="${esc(j.job_id)}" data-cust="${esc(j.customer_id)}" data-cname="${esc(j.customer_name)}" data-label="${esc(j.job_number)}">${MS.icon('thumb')} Record feedback</button></td></tr>`).join('');
    } catch (err) { $('pendingBox').hidden = true; }
  }

  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    try {
      const r = await MS.call('CUSTOMER_FEEDBACK_LIST', { page: state.page, page_size: 50, search: state.q });
      MS.setMsg('listMsg', r.total + ' feedback entr' + (r.total === 1 ? 'y' : 'ies'));
      $('listBody').innerHTML = r.rows.length ? r.rows.map((f) => `<tr>
        <td>${esc(MS.shortDate(f.collected_at))}</td>
        <td>${MS.lnk('customers/customer.html?id=' + encodeURIComponent(f.customer_id), f.customer_name)}</td>
        <td>${f.job_id ? MS.lnk('jobs/job.html?id=' + encodeURIComponent(f.job_id), f.job_number) : ''}</td>
        <td>${MS.stars5(f.rating)}</td><td class="wrap">${esc(f.comment || '')}</td><td>${esc(f.collected_by_name || '')}</td></tr>`).join('')
        : `<tr><td colspan="6" class="empty">${state.q ? 'No feedback matches.' : 'No feedback yet. Record it after a job is delivered.'}</td></tr>`;
      const avg = r.rows.length ? r.rows.reduce((s, f) => s + Number(f.rating), 0) / r.rows.length : 0;
      $('sumCards').innerHTML = r.rows.length ? `<div class="card"><div class="k">Average on this page</div><div class="v">${avg.toFixed(1)} / 5</div><div class="s">${MS.stars5(Math.round(avg))}</div></div>` : '';
      const pages = Math.max(1, Math.ceil(r.total / r.page_size));
      $('pager').innerHTML = pages > 1 ? `<button type="button" id="pPrev"${state.page <= 1 ? ' disabled' : ''}>Previous</button><span>Page ${state.page} of ${pages}</span><button type="button" id="pNext"${state.page >= pages ? ' disabled' : ''}>Next</button>` : '';
      if (pages > 1) { $('pPrev').onclick = () => { state.page--; load(); }; $('pNext').onclick = () => { state.page++; load(); }; }
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  MS.boot({ page: 'feedback', any: ['COMPLAINT_MANAGE'], ref: true }).then(() => {
    $('search').addEventListener('input', MS.debounce(() => { state.q = $('search').value.trim(); state.page = 1; load(); }, 300));
    $('reloadBtn').addEventListener('click', () => { pending(); load(); });
    $('pendingBody').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-job]');
      if (!b) return;
      if (await MS.feedbackForm({ customer_id: b.dataset.cust, customer_name: b.dataset.cname, job_id: b.dataset.job, job_label: b.dataset.label })) { pending(); load(); }
    });
    pending();
    load();
  });
})();
