/* My section: the jobs waiting in the sections and subsections I belong to (and the Production Department, if I work there).
   Buttons (from the server's `work` flags): Forward to subsection, Mark completed, Return / hold with reason;
   Production Department: tick the steps, complete each step, Mark job done. ?job= scrolls to one job. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  let jobs = [];

  function card(j) {
    const w = j.work || {};
    const steps = (j.pd_steps || []);
    return `<div class="mycard${j.overdue ? ' late' : ''}" id="job-${esc(j.job_id)}" data-id="${esc(j.job_id)}">
      <div class="mycard-head"><h3>${MS.lnk('jobs/job.html?id=' + encodeURIComponent(j.job_id), j.job_number)} · ${esc(j.job_name)}</h3>
        <span class="sub">${esc(j.customer_name || '')}</span>${MS.pill(j.status, MS.statusLabel(j.status, 'jobs'))}</div>
      <div class="meta"><span>Where: <b>${esc(MS.jobWhere(j))}</b></span><span>Here for ${j.days_here} day${j.days_here === 1 ? '' : 's'}</span>
        <span class="${j.overdue ? 'late' : ''}">Deadline ${esc(MS.when(j.customer_deadline))}</span></div>
      ${MS.jobProg(j)}
      ${(j.items || []).length ? `<ul class="items">${j.items.map((i) => `<li>${esc(i.description)} · ${esc(MS.num(i.quantity))}${i.specifications ? ' <span class="sub">(' + esc(i.specifications) + ')</span>' : ''}</li>`).join('')}</ul>` : ''}
      ${j.notes ? `<p class="hint">Notes: ${esc(j.notes)}</p>` : ''}
      ${(j.forwarded || []).length ? `<p class="hint">Forwarded to: ${j.forwarded.map((f) => esc(f.subsection_name)).join(', ')}</p>` : ''}
      ${w.role === 'PD' && steps.length ? `<ul class="pd-steps">${steps.map((s) => `<li><span class="nm">${esc(s.step_name)}</span>${MS.pill(s.status, s.status === 'NOT_NEEDED' ? 'Not needed' : MS.label(s.status))}${s.status === 'PENDING' ? `<button type="button" data-step="${esc(s.step_code)}">Mark ${esc(s.step_name.toLowerCase())} done</button>` : ''}</li>`).join('')}</ul>` : ''}
      <div class="btns">${MS.jobAct.buttons(j)}</div>
    </div>`;
  }

  MS.reload = () => load();
  async function load() {
    try {
      const r = await MS.call('MY_SECTION_GET', {});
      $('teamLine').textContent = r.teams.length ? 'You work in: ' + r.teams.map((t) => t.section_name + (t.subsection_name ? ' › ' + t.subsection_name : '') + (t.is_lead ? ' (lead)' : '')).join(', ') + '.'
        : 'You are not in a section team yet. Ask the General Manager or the System Administrator to add you under Section teams.';
      MS.setMsg('pMsg', '');
      const jobsFull = [];
      for (const j of r.jobs) {
        // the Production Department's steps come with the job card, not the summary
        if (j.work && j.work.role === 'PD') { try { const f = await MS.call('JOB_GET', { job_id: j.job_id }); j.pd_steps = f.pd_steps; } catch (e) { j.pd_steps = []; } }
        jobsFull.push(j);
      }
      jobs = jobsFull;
      $('myJobs').innerHTML = jobs.length ? jobs.map(card).join('') : '<div class="panel"><p class="empty">No job is waiting in your section right now.</p></div>';
      $('comingBox').innerHTML = r.coming.length ? `<div class="dpanel wide"><h3>Coming to your section</h3><div class="tablewrap"><table class="inv"><thead><tr><th>Job</th><th>Now in</th><th>Deadline</th></tr></thead><tbody class="clkbox">${r.coming.map((c) =>
        `<tr class="clk" data-href="jobs/job.html?id=${encodeURIComponent(c.job_id)}"><td><b>${esc(c.job_number)}</b> ${esc(c.job_name)}</td><td>${esc(c.now_in)}</td><td>${esc(MS.when(c.customer_deadline))}</td></tr>`).join('')}</tbody></table></div></div>` : '';
      document.querySelectorAll('#comingBox .clkbox').forEach(MS.clickable);
      const focus = MS.param('job');
      if (focus && $('job-' + focus)) $('job-' + focus).scrollIntoView({ block: 'start' });
    } catch (err) { MS.setMsg('pMsg', err.message, 'error'); }
  }

  MS.boot({ page: 'my-section', any: ['SECTION_WORK'], ref: false }).then(() => {
    $('reloadBtn').addEventListener('click', load);
    MS.jobAct.wire($('myJobs'), (b) => { const c = b.closest('.mycard'); return jobs.find((x) => x.job_id === c.dataset.id); }, load);
    load();
  });
})();
