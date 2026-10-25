/* One job: where it is now, the route through the sections (with subsections), the Production Department steps, the history of
   every move, the items and comments. Buttons come from the server: j.can (General Manager, CEO, System Administrator) and j.work (staff of the
   section or subsection that holds the job). The Files panel (uploads, verification, customer proofs) is MS.jobFiles. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const id = MS.param('id');
  let job = null;

  const ask = (o) => MS.sc.ask(o);
  const val = (i) => MS.dc.val(i);

  function holders(j) {
    const h = (j.holders || []).map((x) => x.display_name + (x.is_lead ? ' (lead)' : ''));
    return h.length ? h.slice(0, 5).join(', ') + (h.length > 5 ? ' +' + (h.length - 5) : '') : 'nobody in the team yet';
  }

  function routePanel(j) {
    return `<div class="dpanel"><h3>Route</h3><ol class="route">${(j.sections || []).map((s) => `<li class="${esc(s.status)}"><span class="no">${s.sequence_no}</span>
      <b>${esc(s.section_name)}</b> ${MS.pill(s.status, s.status === 'PENDING' ? 'Waiting' : s.status === 'ACTIVE' ? 'Working now' : 'Completed')}
      <div class="sub">${s.status === 'COMPLETE' ? 'Completed ' + esc(MS.when(s.completed_at)) + (s.completed_by_name ? ' by ' + esc(s.completed_by_name) : '') : s.status === 'ACTIVE' ? 'Received ' + esc(MS.when(s.activated_at)) : ''}</div>
      ${(s.subsections || []).length ? `<ul>${s.subsections.map((x) => `<li>› ${esc(x.subsection_name)} ${MS.pill(x.status, x.status === 'ACTIVE' ? 'Working' : 'Completed')} <span class="sub">${x.status === 'ACTIVE' ? 'forwarded ' + esc(MS.when(x.forwarded_at)) + (x.forwarded_by_name ? ' by ' + esc(x.forwarded_by_name) : '') : 'completed ' + esc(MS.when(x.completed_at))}${x.note ? ' · ' + esc(x.note) : ''}</span></li>`).join('')}</ul>` : ''}
      </li>`).join('')}
      <li class="${j.status === 'IN_PRODUCTION_DEPT' ? 'ACTIVE' : j.status === 'DONE' ? 'COMPLETE' : 'PENDING'}"><span class="no">${(j.sections || []).length + 1}</span><b>Production Department</b> <span class="sub">Cutting, Numbering, Finishing</span></li>
      </ol></div>`;
  }

  /** The teams of the section holding the job (for the people who work there): its staff and each subsection with who is in it. */
  function teamPanel(j) {
    const t = j.section_team;
    if (!t) return '';
    const names = (m) => m.map((x) => esc(x.display_name) + (x.is_lead ? ' (lead)' : '')).join(', ');
    return `<div class="dpanel"><h3>${esc(t.section_name)}: teams</h3><p class="sub">Section staff: ${t.staff.length ? names(t.staff) : 'nobody yet'}</p>
      ${t.subsections.length ? `<ul class="mini-list">${t.subsections.map((x) => `<li><b>${esc(x.subsection_name)}</b> <span class="sub">${x.members.length ? names(x.members) : 'nobody is assigned yet'}</span></li>`).join('')}</ul>` : '<p class="sub">This section has no subsections.</p>'}</div>`;
  }

  function pdPanel(j) {
    const steps = j.pd_steps || [];
    if (!steps.length && j.status !== 'IN_PRODUCTION_DEPT') return '';
    return `<div class="dpanel"><h3>Production Department</h3><ul class="pd-steps">${steps.length ? steps.map((s) => `<li><span class="nm">${esc(s.step_name)}</span>${MS.pill(s.status, s.status === 'NOT_NEEDED' ? 'Not needed' : s.status === 'DONE' ? 'Done' : 'To do')}
      ${s.status === 'PENDING' && j.work && j.work.role === 'PD' ? `<button type="button" data-step="${esc(s.step_code)}">Mark done</button>` : ''}<span class="sub">${s.completed_at ? esc(MS.when(s.completed_at)) + (s.completed_by_name ? ' · ' + esc(s.completed_by_name) : '') : ''}</span></li>`).join('') : '<li class="empty">The department has not ticked its steps yet.</li>'}</ul></div>`;
  }

  function historyPanel(j) {
    const mv = j.movements || [];
    return `<div class="dpanel wide"><h3>History</h3>${mv.length ? `<ul class="hist">${mv.map((m) => `<li><span class="mv">${esc(MS.label(m.action))}</span> ${m.from_location || m.to_location ? '· ' + esc(m.from_location || '') + (m.from_location && m.to_location ? ' → ' : '') + esc(m.to_location || '') : ''}
      <div class="sub">${esc(MS.when(m.moved_at))} · ${esc(m.moved_by_name || '')}${m.note ? ' · ' + esc(m.note) : ''}</div></li>`).join('')}</ul>` : '<p class="empty">Nothing yet.</p>'}</div>`;
  }

  function render(j) {
    job = j;
    document.title = 'Job ' + j.job_number + ' · MS BMS';
    $('jTitle').innerHTML = esc(j.job_number) + ' · ' + esc(j.job_name) + ' ' + MS.pill(j.status, MS.statusLabel(j.status, 'jobs'));
    $('jCrumbs').innerHTML = `<a href="jobs/jobs.html">Jobs</a> › ${esc(j.job_number)}`;
    const c = j.can || {};
    const more = [c.reassign && '<button type="button" data-a="reassign">Move to another section</button>', c.sections && '<button type="button" data-a="sections">Change the sections</button>',
      c.cancel && '<button type="button" data-a="cancel">Cancel the job</button>', c.delete && '<button type="button" data-a="delete">Delete the job…</button>'].filter(Boolean);
    $('jActions').innerHTML = [
      c.edit && '<button type="button" data-a="edit">Edit details</button>',
      c.hold && '<button type="button" data-a="hold">Put on hold</button>',
      c.resume && '<button type="button" class="primary" data-a="resume">Resume</button>',
      j.quotation && MS.can('QUOTATION_VIEW') && `<a class="btn" href="customers/quotation.html?id=${encodeURIComponent(j.quotation.quotation_id)}">Proforma invoice ${esc(j.quotation.quotation_number)}</a>`,
      more.length && `<details class="jmenu"><summary class="btn">More ▾</summary><div class="jmenu-list">${more.join('')}</div></details>`
    ].filter(Boolean).join('');

    const notices = [];
    if (j.status === 'ON_HOLD') notices.push(`<div class="notice-bar danger"><b>On hold.</b> ${esc(j.hold_reason || '')}${c.resume ? ' Use Resume when it can go on.' : ' The General Manager or the CEO starts it again.'}</div>`);
    if (j.status === 'CANCELLED') notices.push(`<div class="notice-bar danger"><b>Cancelled.</b> ${esc(j.hold_reason || '')}</div>`);
    const w = j.work || {};
    const workBar = w.role ? `<div class="work-bar"><span class="k">Your work: ${esc(w.label || 'this job')}</span>${MS.jobAct.buttons(j)}</div>` : '';
    const where = `<div class="where-bar"><span><span class="k">Where it is</span><br><b>${esc(MS.jobWhere(j))}</b></span>
      <span><span class="k">Held by</span><br>${esc(holders(j))}</span><span><span class="k">Days there</span><br>${j.days_here}</span>
      <span><span class="k">Deadline</span><br><span class="${j.overdue ? 'late' : ''}">${esc(MS.when(j.customer_deadline))}</span></span><span class="grow"></span>${MS.jobProg(j)}</div>`;

    const money = j.costs !== undefined ? MS.kv([['Selling price', MS.money(j.selling_price)], ['Costs so far', MS.money((j.costs || []).reduce((t, x) => t + (x.status === 'REVERSED' ? 0 : Number(x.amount) || 0), 0))]]) +
      (MS.can('JOB_COST_VIEW') ? `<p>${MS.lnk('finance/job-profit.html?search=' + encodeURIComponent(j.job_number), 'Cost and profit of this job')}</p>` : '') : '';
    const details = `<div class="dpanel"><h3>Details</h3>${MS.kv([['Customer', j.customer ? `<a class="lnk" href="customers/customer.html?id=${encodeURIComponent(j.customer.customer_id)}">${esc(j.customer.customer_name)}</a>` : '', true],
      ['Phone', j.customer ? j.customer.phone : ''], ['Job date', MS.shortDate(j.job_date)], ['Deadline', MS.when(j.customer_deadline)], ['Notes', j.notes], ['Finished', MS.when(j.completed_at)]])}${money}</div>`;
    const items = `<div class="dpanel"><h3>Items</h3><div class="tablewrap"><table class="inv"><thead><tr><th>#</th><th>Item</th><th class="num">Qty</th><th>Specification</th></tr></thead><tbody>${(j.items || []).map((i) =>
      `<tr><td>${i.line_no}</td><td class="wrap">${esc(i.description)}</td><td class="num">${esc(MS.num(i.quantity))}</td><td class="wrap">${esc(i.specifications || '')}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">No items.</td></tr>'}</tbody></table></div></div>`;
    const files = MS.jobFiles.panel(j);
    const comments = `<div class="dpanel wide"><h3>Comments</h3><ul class="jcomments">${(j.comments || []).map((x) => `<li><span class="sub">${esc(x.author_name || '')} · ${esc(MS.when(x.created_at))}</span><p>${esc(x.body)}</p></li>`).join('') || '<li class="empty">No comments yet.</li>'}</ul>
      <form class="comment-form" id="commentForm"><textarea id="commentText" rows="2" maxlength="2000" placeholder="Write a comment for the team" aria-label="Comment"></textarea><button type="submit" class="primary">Add</button></form></div>`;
    $('jBody').innerHTML = notices.join('') + where + workBar + `<div class="dgrid">${routePanel(j)}${details}${teamPanel(j)}${pdPanel(j)}${items}${files}${historyPanel(j)}${comments}</div>`;
    $('commentForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const t = $('commentText').value.trim();
      if (!t) return;
      try { await MS.call('JOB_COMMENT_ADD', { job_id: j.job_id, body: t }); load(); } catch (err) { MS.alert(err.message); }
    });
  }

  // ---------- General Manager / CEO / administrator actions ----------
  const A = {
    edit: () => ask({ title: 'Edit the job', info: job.job_number,
      extra: `<label>Job name <input id="eName" type="text" maxlength="160" value="${esc(job.job_name)}"></label>
        <label>Customer deadline <input id="eDeadline" type="datetime-local" value="${esc(MS.toLocalInput(job.customer_deadline))}"></label>
        <label>Notes <textarea id="eNotes" rows="3" maxlength="2000">${esc(job.notes || '')}</textarea></label>`,
      noText: true, button: 'Save',
      run: () => MS.call('JOB_UPDATE', { job_id: job.job_id, job_name: val('eName'), customer_deadline: MS.dc.iso('eDeadline'), notes: val('eNotes') }) }),
    hold: () => ask({ title: 'Put the job on hold', info: job.job_number + ' stops where it is until you resume it.', label: 'Reason', required: true, danger: true, button: 'Put on hold',
      run: (t) => MS.call('JOB_HOLD', { job_id: job.job_id, reason: t }) }),
    resume: () => ask({ title: 'Resume the job', info: 'It goes back to ' + (job.location || 'where it was') + '.', label: 'Note (optional)', button: 'Resume',
      run: (t) => MS.call('JOB_RESUME', { job_id: job.job_id, reason: t }) }),
    cancel: () => ask({ title: 'Cancel the job', info: job.job_number + ' will be cancelled. Its proforma invoice can get a new job card.', label: 'Reason', required: true, danger: true, button: 'Cancel the job',
      run: (t) => MS.call('JOB_CANCEL', { job_id: job.job_id, reason: t }) }),
    reassign: () => {
      const cur = job.current_section_id;
      const opts = (job.sections || []).filter((s) => s.section_id !== cur);
      if (!opts.length) return MS.alert('There is no other section on this job.', 'Nothing to choose');
      return ask({ title: 'Move to another section', info: 'Use this to send the job back (or on). The section that has it now stops; the one you choose receives it and its team is told.',
        extra: `<label>Section <select id="rSection">${opts.map((s) => `<option value="${esc(s.section_id)}">${s.sequence_no}. ${esc(s.section_name)}</option>`).join('')}</select></label>`,
        label: 'Reason', required: true, button: 'Move the job',
        run: (t) => MS.call('JOB_REASSIGN', { job_id: job.job_id, section_id: val('rSection'), reason: t }) });
    },
    sections: () => {
      const locked = (job.sections || []).filter((s) => s.status !== 'PENDING');
      let ids = (job.sections || []).filter((s) => s.status === 'PENDING').map((s) => s.section_id);
      const all = ((MS.refCache && MS.refCache.sections) || []).filter((s) => s.is_selectable === true);
      const nameOf = (i) => { const s = all.find((x) => x.section_id === i); return s ? s.section_name : ''; };
      const draw = () => {
        const free = all.filter((s) => ids.indexOf(s.section_id) < 0 && !locked.some((l) => l.section_id === s.section_id));
        MS.$('noteExtra').innerHTML = `<ol class="route-list">${locked.map((s, i) => `<li><span class="no">${i + 1}</span><span class="nm">${esc(s.section_name)} <span class="sub">(${s.status === 'ACTIVE' ? 'working now' : 'done'}, fixed)</span></span></li>`).join('')}
          ${ids.map((i, k) => `<li data-k="${k}"><span class="no">${locked.length + k + 1}</span><span class="nm">${esc(nameOf(i))}</span><button type="button" data-mv="-1"${k === 0 ? ' disabled' : ''}>↑</button><button type="button" data-mv="1"${k === ids.length - 1 ? ' disabled' : ''}>↓</button><button type="button" data-rm="1">✕</button></li>`).join('')}</ol>
          ${free.length ? `<label>Add a section <select id="rAdd"><option value="">— choose —</option>${free.map((s) => `<option value="${esc(s.section_id)}">${esc(s.section_name)}</option>`).join('')}</select></label>` : ''}`;
      };
      const p = ask({ title: 'Change the sections', info: 'Sections still waiting can be reordered, removed or added. The one working now and those already done stay first.', noText: true, button: 'Save', wide: true,
        run: () => MS.call('JOB_SECTIONS_SET', { job_id: job.job_id, section_ids: locked.map((s) => s.section_id).concat(ids) }) });
      draw();
      const box = MS.$('noteExtra');
      box.onclick = (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        const k = Number(b.closest('li').dataset.k);
        if (b.dataset.rm) ids.splice(k, 1);
        else { const m = k + Number(b.dataset.mv); if (m >= 0 && m < ids.length) { const t = ids[k]; ids[k] = ids[m]; ids[m] = t; } }
        draw();
      };
      box.onchange = (e) => { if (e.target.id === 'rAdd' && e.target.value) { ids.push(e.target.value); draw(); } };
      return p;
    },
    delete: async () => {
      let pv;
      try { pv = await MS.call('JOB_DELETE_PREVIEW', { job_id: job.job_id }); } catch (err) { return MS.alert(err.message); }
      if (!pv.can_delete) return MS.alert(pv.message || 'This job has records that block deleting it.', 'This job cannot be deleted');
      return ask({ title: 'Delete job ' + job.job_number, info: 'This permanently removes the job and everything below it. A snapshot is kept, files are archived (not deleted), and the action is audited.',
        extra: `<label class="req">Type the job number to confirm <input id="dConfirm" type="text" placeholder="${esc(job.job_number)}"></label>`, label: 'Reason', required: true, danger: true, button: 'Delete the job',
        run: async (t) => {
          if (val('dConfirm') !== job.job_number) throw new Error('Type the job number exactly to confirm.');
          await MS.call('JOB_DELETE', { job_id: job.job_id, reason: t, confirm_job_number: val('dConfirm') });
          location.replace('jobs/jobs.html');
        } });
    }
  };

  async function load() {
    try { render(await MS.call('JOB_GET', { job_id: id })); MS.setMsg('jMsg', ''); } catch (err) { MS.setMsg('jMsg', err.message, 'error'); $('jBody').innerHTML = '<p><a class="lnk" href="jobs/jobs.html">Back to the jobs</a></p>'; }
  }

  MS.boot({ page: 'jobs', any: ['JOB_VIEW'], ref: true }).then(() => {
    if (!id) { MS.setMsg('jMsg', 'No job chosen.', 'error'); return; }
    $('jActions').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      const d = b.closest('details'); if (d) d.open = false;
      try { if (await A[b.dataset.a]()) load(); } catch (err) { MS.alert(err.message); }
    });
    MS.jobAct.wire($('jBody'), () => job, load);
    MS.jobFiles.wire($('jBody'), () => job, load);
    load();
  });
})();
