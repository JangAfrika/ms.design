/* One job: the full digital Work Sheet (printable), Job Locations, work lines, people, design, materials,
   notes, status history, files, approvals, status steps (with the server's guard messages), resume and delete. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const id = MS.param('id');
  const PRE_PRODUCTION = ['APPROVED', 'DEPOSIT_PAID', 'JOB_CREATED', 'DESIGN', 'CUSTOMER_APPROVAL', 'MATERIAL_READY'];
  const LOCKED = ['READY', 'DELIVERED', 'BALANCE_PAID', 'CLOSED', 'CANCELLED'];
  // value = Drive subfolder; the document category is the same except QUALITY_CONTROL -> QC
  const FILE_KINDS = ['OTHER', 'QUOTATION', 'DESIGN', 'CUSTOMER_APPROVAL', 'PRODUCTION', 'QUALITY_CONTROL', 'DELIVERY', 'INVOICE', 'RECEIPT'];
  let job = null;

  const jobPill = (s) => MS.pill(s, MS.statusLabel(s, 'jobs'));
  // priority levels (Assessment §11): Emergency red, Confirmed deadline amber, Normal and Flexible plain
  const PRIO_TONE = { EMERGENCY: 'EMERGENCY', CONFIRMED_DEADLINE: 'PENDING' };
  const prioPill = (p) => MS.pill(PRIO_TONE[p] || 'OFF', MS.label(p));
  const sections = () => ((MS.refCache && MS.refCache.stage_types) || []).filter((s) => s.stage_kind === 'PRODUCTION_SECTION')
    .sort((a, b) => a.sequence_no - b.sequence_no);
  const enc = encodeURIComponent;
  const num = (v) => (v === '' || v == null ? '' : MS.num(v));

  /* ---------- dialogs ---------- */

  // opens <name>Dialog; onSave(data, form) may throw to show the message in the dialog; after it the page reloads
  function dialog(name, onSave) {
    const dlg = $(name + 'Dialog'), f = $(name + 'Form'), errEl = $(name + 'Error'), btn = $(name + 'Save');
    errEl.textContent = '';
    f.onsubmit = async (e) => {
      e.preventDefault();
      errEl.textContent = '';
      MS.busy(btn, true, 'Saving…');
      try {
        const msg = await onSave(MS.formData(f), f);
        dlg.close();
        if (msg !== false) await load(msg);
      } catch (err) { errEl.textContent = err.message; } finally { MS.busy(btn, false); }
    };
    f.querySelectorAll('[data-close]').forEach((b) => { b.onclick = () => dlg.close(); });
    return MS.openDialog(name + 'Dialog');
  }

  const setBtn = (btn, text, cls) => { delete btn.dataset.label; btn.textContent = text; btn.className = cls; };

  // asks for a reason (required) and runs the step; the server's message shows in the dialog when it refuses
  function askReason(o) {
    $('reasonForm').reset();
    $('reasonTitle').textContent = o.title;
    $('reasonInfo').textContent = o.info || '';
    $('reasonLabel').firstChild.textContent = (o.label || 'Reason') + ' ';
    setBtn($('reasonSave'), o.confirm || 'OK', o.danger ? 'danger-solid' : 'primary');
    dialog('reason', async (d) => {
      if (!d.reason) throw new Error('Please give a reason.');
      await o.run(d.reason);
      return o.done || 'Saved.';
    });
  }

  // a direct step from a button: shows the guard message in a pop-up when the server refuses
  async function step(btn, run, msg) {
    MS.busy(btn, true);
    try { await run(); await load(msg); } catch (err) {
      MS.busy(btn, false);
      await MS.alert(err.message, 'This step cannot be done yet');
    }
  }

  /* ---------- page ---------- */

  function render(j) {
    job = j;
    document.title = j.job_number + ' · ' + j.job_name + ' · MS BMS';
    $('dTitle').innerHTML = `${esc(j.job_number)} · ${esc(j.job_name)} ${jobPill(j.status)}`;
    $('dCrumbs').innerHTML = `<a href="jobs/jobs.html">Jobs</a> › ${esc(j.job_number)}`;
    renderActions(j);
    renderPriority(j);
    renderNotices(j);
    $('dBody').innerHTML = worksheet(j) + `<div class="dgrid no-print">
      ${detailsPanel(j)}${peoplePanel(j)}${designPanel(j)}${notesPanel(j)}${materialsPanel(j)}${historyPanel(j)}${filesPanel(j)}
    </div>`;
    wireBody(j);
  }

  function renderActions(j) {
    const next = j.allowed_next || [];
    const moves = j.status === 'ON_HOLD' ? [] : next.filter((t) => t.to_status !== 'ON_HOLD' && t.to_status !== 'CANCELLED');
    const more = [];
    if (MS.can('JOB_EDIT') && ['CLOSED', 'CANCELLED'].indexOf(j.status) < 0) more.push(['edit', 'Edit job details']);
    if (next.some((t) => t.to_status === 'ON_HOLD')) more.push(['hold', 'Put on hold']);
    if (j.status === 'ON_HOLD') more.push(['resume', 'Resume']);
    if (next.some((t) => t.to_status === 'CANCELLED')) more.push(['cancel', 'Cancel job']);
    if (j.status === 'APPROVED' || j.status === 'DEPOSIT_PAID') more.push(['waiver', 'Request deposit waiver']);
    if (j.status === 'FINISHING') more.push(['completion', 'Request completion approval']);
    if (j.can && j.can.delete) more.push(['delete', 'Delete job…']);
    more.push(['print', 'Print work sheet']);
    $('dActions').innerHTML = moves.map((t, i) => `<button type="button" class="primary" data-move="${i}">→ ${esc(MS.statusLabel(t.to_status, 'jobs'))}</button>`).join('') +
      (j.status === 'ON_HOLD' ? '<button type="button" class="primary" data-act="resume">Resume</button>' : '') +
      `<details class="jmenu"><summary class="btn">More ▾</summary><div class="jmenu-list">${more.map((m) => `<button type="button" data-act="${m[0]}">${esc(m[1])}</button>`).join('')}</div></details>`;
    $('dActions').querySelectorAll('[data-move]').forEach((b) => {
      const t = moves[Number(b.dataset.move)];
      b.addEventListener('click', () => {
        const label = MS.statusLabel(t.to_status, 'jobs');
        if (t.requires_reason) {
          return askReason({ title: 'Move to ' + label, info: 'Give a reason for this step.', confirm: 'Move',
            run: (r) => MS.call('JOB_STATUS_UPDATE', { job_id: j.job_id, to_status: t.to_status, reason: r }), done: 'Status updated.' });
        }
        step(b, () => MS.call('JOB_STATUS_UPDATE', { job_id: j.job_id, to_status: t.to_status }), 'Status updated.');
      });
    });
    $('dActions').querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
      const m = b.closest('details');
      if (m) m.open = false;
      menuAction(b.dataset.act, b);
    }));
  }

  function menuAction(act, btn) {
    const j = job;
    if (act === 'edit') return editDetails(j);
    if (act === 'hold') {
      return askReason({ title: 'Put job on hold', info: 'Production stops until the job is resumed.', confirm: 'Put on hold',
        run: (r) => MS.call('JOB_STATUS_UPDATE', { job_id: j.job_id, to_status: 'ON_HOLD', reason: r }), done: 'The job is on hold.' });
    }
    if (act === 'resume') return step(btn, () => MS.call('JOB_RESUME', { job_id: j.job_id }), 'Job resumed.');
    if (act === 'cancel') {
      return askReason({ title: 'Cancel job', info: 'Cancel ' + j.job_number + '? Issued materials must be returned to stores first.', confirm: 'Cancel job', danger: true,
        run: (r) => MS.call('JOB_STATUS_UPDATE', { job_id: j.job_id, to_status: 'CANCELLED', reason: r }), done: 'Job cancelled.' });
    }
    if (act === 'waiver') return requestApproval(j, 'DEPOSIT_WAIVER');
    if (act === 'completion') return requestApproval(j, 'PRODUCTION_COMPLETION');
    if (act === 'delete') return deleteJob(j);
    if (act === 'print') return window.print();
  }

  function renderNotices(j) {
    const out = [];
    if (j.overdue) out.push(`<div class="notice-bar danger">This job is past its customer deadline.${j.delay_cause ? ' Cause: ' + esc(MS.label(j.delay_cause)) + '.' : ' Record the delay cause (More › Edit job details).'}</div>`);
    const pending = (j.approvals || []).filter((a) => a.status === 'PENDING' && a.approval_type !== 'EMERGENCY_PRIORITY');
    (j.approvals || []).filter((a) => a.status === 'PENDING' && a.approval_type === 'EMERGENCY_PRIORITY').forEach((a) => {
      const canDecide = a.requested_by !== MS.user.user_id && MS.can('JOB_APPROVE');
      out.push(`<div class="notice-bar emergency-req" id="priority">
        <div class="approval"><span><b>Emergency requested</b> by ${esc(a.requested_by_name || '')} · ${esc(MS.when(a.created_at))}${a.comment ? ': “' + esc(a.comment) + '”' : ''}</span>
        ${canDecide ? `<span class="acts"><button type="button" class="primary" data-em-approve="${esc(a.job_approval_id)}">Approve</button><button type="button" data-reject="${esc(a.job_approval_id)}">Reject</button></span>`
          : `<span class="sub">${a.requested_by === MS.user.user_id ? 'Sent to the CEO and General Manager' : 'Waiting for the CEO or General Manager'}</span>`}</div>
        ${a.details && a.details.delayed_jobs ? impactBlock(a.details, 'At the time of the request') : ''}
      </div>`);
    });
    if (pending.length) {
      out.push(`<div class="notice-bar">${pending.map((a) => {
        const canDecide = a.requested_by !== MS.user.user_id && (a.approval_type === 'PRODUCTION_COMPLETION' ? MS.can('PRODUCTION_COMPLETE_APPROVE') : MS.can('JOB_APPROVE'));
        return `<div class="approval"><span><b>${esc(MS.label(a.approval_type))}</b> requested by ${esc(a.requested_by_name || '')}${a.comment ? ': “' + esc(a.comment) + '”' : ''}</span>
          ${canDecide ? `<span class="acts"><button type="button" class="primary" data-approve="${esc(a.job_approval_id)}">Approve</button><button type="button" data-reject="${esc(a.job_approval_id)}">Reject</button></span>` : '<span class="sub">Waiting for a decision</span>'}</div>`;
      }).join('')}</div>`);
    }
    $('dNotices').innerHTML = out.join('');
    $('dNotices').querySelectorAll('[data-approve]').forEach((b) => b.addEventListener('click', () =>
      step(b, () => MS.call('JOB_APPROVAL_DECIDE', { job_approval_id: b.dataset.approve, decision: 'APPROVE' }), 'Approved.')));
    $('dNotices').querySelectorAll('[data-em-approve]').forEach((b) => b.addEventListener('click', async () => {
      const a = (j.approvals || []).find((x) => x.job_approval_id === b.dataset.emApprove) || {};
      const n = a.details && a.details.delayed_jobs ? (a.details.delayed_total || a.details.delayed_jobs.length) : 0;
      const yes = await MS.confirm({ title: 'Make ' + j.job_number + ' an Emergency?', confirmText: 'Approve Emergency',
        message: n ? n + ' other job' + (n === 1 ? '' : 's') + ' may be pushed back. The Production Manager and the people on those jobs are told.' : 'No other open job is pushed back. The Production Manager is told.' });
      if (yes) step(b, () => MS.call('JOB_APPROVAL_DECIDE', { job_approval_id: a.job_approval_id, decision: 'APPROVE' }), 'Emergency approved.');
    }));
    $('dNotices').querySelectorAll('[data-reject]').forEach((b) => b.addEventListener('click', () =>
      askReason({ title: 'Reject request', info: 'Say why.', confirm: 'Reject', danger: true,
        run: (r) => MS.call('JOB_APPROVAL_DECIDE', { job_approval_id: b.dataset.reject, decision: 'REJECT', comment: r }), done: 'Rejected.' })));
  }

  /* ---------- priority: Emergency only with management approval ---------- */

  function impactBlock(imp, when) {
    const rows = imp.delayed_jobs || [];
    const total = imp.delayed_total || rows.length;
    const head = total ? total + ' other job' + (total === 1 ? '' : 's') + ' may be pushed back' : 'No other open job is pushed back';
    return `<div class="impact"><p class="impact-head"><b>${esc(head)}</b> <span class="sub">${esc((when ? when + ' · ' : '') + (imp.rule || ''))}</span></p>
      ${rows.length ? `<div class="tablewrap"><table class="inv"><thead><tr><th>Job</th><th>Name</th><th>Customer</th><th>Deadline</th><th>Priority</th><th>Same Job Locations</th></tr></thead><tbody>
        ${rows.map((d) => `<tr><td><b>${MS.lnk('jobs/job.html?id=' + enc(d.job_id), d.job_number)}</b></td><td class="wrap">${esc(d.job_name)}</td><td>${esc(d.customer_name || '')}</td>
          <td>${esc(MS.when(d.customer_deadline))}</td><td>${prioPill(d.priority)}</td><td class="wrap">${esc((d.shared_locations || []).join(', '))}</td></tr>`).join('')}
      </tbody></table></div>` : ''}</div>`;
  }

  function renderPriority(j) {
    const c = j.can || {};
    const btns = [];
    if (c.request_emergency) btns.push('<button type="button" id="askEmergency">Request emergency</button>');
    if (c.remove_emergency) btns.push('<button type="button" id="dropEmergency">Remove emergency</button>');
    const note = j.priority === 'EMERGENCY' ? 'Goes first at every Job Location it uses.' : j.emergency_requested ? 'Emergency requested, waiting for approval.' : '';
    $('dPriority').innerHTML = `<span class="k">Priority</span>${prioPill(j.priority)}${j.emergency_requested ? MS.pill('SUBMITTED', 'Emergency requested') : ''}
      ${note ? `<span class="sub">${esc(note)}</span>` : ''}<span class="grow"></span>${btns.join('')}`;
    $('dPriority').hidden = false;
    if ($('askEmergency')) $('askEmergency').addEventListener('click', () => requestEmergency(j));
    if ($('dropEmergency')) $('dropEmergency').addEventListener('click', () => removeEmergency(j));
  }

  async function requestEmergency(j) {
    $('emergencyForm').reset();
    $('emergencyImpact').innerHTML = '<p class="sub">Checking which jobs would be pushed back…</p>';
    dialog('emergency', async (d) => {
      if (!d.reason) throw new Error('Say why this job is an emergency.');
      await MS.call('JOB_EMERGENCY_REQUEST', { job_id: j.job_id, reason: d.reason });
      return 'Emergency requested. The CEO and General Manager have been told.';
    });
    try { $('emergencyImpact').innerHTML = impactBlock(await MS.call('JOB_PRIORITY_IMPACT', { job_id: j.job_id }), 'Right now'); }
    catch (err) { $('emergencyImpact').innerHTML = ''; $('emergencyError').textContent = err.message; }
  }

  function removeEmergency(j) {
    $('prioForm').reset();
    $('prioLevel').innerHTML = MS.options(MS.enumOf('jobs.priority').filter((p) => p !== 'EMERGENCY'), 'CONFIRMED_DEADLINE');
    dialog('prio', async (d) => {
      if (!d.reason) throw new Error('Say why Emergency is no longer needed.');
      await MS.call('JOB_EMERGENCY_REMOVE', { job_id: j.job_id, priority: d.priority, reason: d.reason });
      return 'Priority changed to ' + MS.label(d.priority) + '.';
    });
  }

  /* ---------- the Work Sheet Report: same layout as the paper form ---------- */

  const wsField = (k, v, raw) => `<div class="ws-field"><span class="k">${esc(k)}</span><span class="v">${raw ? v : esc(v || '')}</span></div>`;

  function worksheet(j) {
    const byCode = {};
    (j.stages || []).forEach((s) => { if (s.stage_kind === 'PRODUCTION_SECTION') byCode[s.stage_code] = s; });
    const inProd = ['IN_PRODUCTION', 'QUALITY_CONTROL'].indexOf(j.status) >= 0;
    const locked = LOCKED.indexOf(j.status) >= 0;
    const can = j.can || {};
    const people = j.people || {};

    const locs = sections().map((st) => {
      const s = byCode[st.stage_code];
      const on = s && s.status !== 'SKIPPED';
      const state = !on ? '' : s.status === 'COMPLETE' ? '<strong class="ok">Job complete</strong>' : s.status === 'PENDING' ? 'Job pending' : MS.pill(s.status);
      let acts = '';
      if (on && can.worksheet && inProd) {
        acts += (s.allowed_next || []).filter((x) => ['IN_PROGRESS', 'COMPLETE', 'ON_HOLD'].indexOf(x) >= 0)
          .map((to) => `<button type="button" data-stage="${esc(s.job_stage_id)}" data-to="${to}">${to === 'IN_PROGRESS' ? 'Start' : to === 'COMPLETE' ? 'Complete' : 'Hold'}</button>`).join('');
      }
      if (on && can.assign && !locked && s.status !== 'COMPLETE') acts += `<button type="button" data-stage-assign="${esc(s.job_stage_id)}">${s.assigned_user_id ? 'Reassign' : 'Assign'}</button>`;
      return `<div class="ws-loc${on ? ' on' : ''}">
        <span class="ws-tick" aria-label="${on ? 'ticked' : 'not ticked'}">${on ? '✔' : ''}</span>
        <span class="ws-loc-name">${esc(st.stage_name)}</span>
        <span class="ws-loc-state">${state}</span>
        ${on && s.assigned_user_name ? `<small class="ws-who">${esc(s.assigned_user_name)}</small>` : ''}
        ${acts ? `<span class="ws-acts no-print">${acts}</span>` : ''}
      </div>`;
    }).join('');

    const canLines = can.worksheet && !locked;
    const lines = j.worksheet_lines || [];
    const items = (j.items || []).length ? `<div class="ws-items"><strong>Ordered: </strong>${esc((j.items || []).map((i) => i.quantity + ' × ' + i.description).join(' · '))}</div>` : '';
    return `<section class="worksheet" id="worksheet">
      <div class="ws-head">
        <div class="ws-title"><span class="ws-company">MS DESIGNS &amp; PRINTING</span><span class="ws-name">WORK SHEET REPORT</span><span class="ws-no">${esc(j.job_number)}</span></div>
        <div class="ws-fields">
          ${wsField('Customer name', j.customer ? j.customer.customer_name : j.customer_name)}${wsField('Job name', j.job_name)}
          ${wsField('Date', MS.shortDate(j.job_date))}${wsField('Work start date', MS.shortDate(j.work_start_date))}
          ${wsField('Work finish date', MS.shortDate(j.work_finish_date))}${wsField('Customer deadline', MS.when(j.customer_deadline))}
          ${wsField('Status', jobPill(j.status), true)}${wsField('Priority', MS.label(j.priority))}
        </div>
      </div>
      ${items}
      <div class="ws-section-head"><h3>JOB LOCATION</h3>${can.worksheet && !locked ? '<button type="button" class="no-print" id="editLocs">Edit Job Locations</button>' : ''}</div>
      <div class="ws-locations">${locs || '<p class="empty">No Job Locations are set up yet.</p>'}</div>
      <div class="ws-section-head"><h3>WORK</h3>${canLines ? '<button type="button" class="no-print" id="addLine">+ Work line</button>' : ''}</div>
      <div class="tablewrap ws-tablewrap"><table class="inv ws-lines"><thead><tr><th class="num">QTY</th><th>Work description</th><th>Materials used for the work</th><th class="num">Qty used</th><th>Responsible</th><th>Start</th><th>End</th><th>Notes</th></tr></thead>
        <tbody id="lineRows">${lines.length ? lines.map((l, i) => `<tr${canLines ? ` class="clk" data-line="${i}" title="Edit this line"` : ''}>
          <td class="num">${esc(num(l.quantity))}</td><td class="wrap">${esc(l.work_description)}</td>
          <td class="wrap">${esc(l.material_item_name || l.material_description || '')}</td>
          <td class="num">${l.quantity_used ? esc(num(l.quantity_used) + ' ' + (l.unit || '')) : ''}</td>
          <td>${esc(l.responsible_person_name || '')}</td><td>${esc(MS.when(l.start_time))}</td><td>${esc(MS.when(l.end_time))}</td>
          <td class="wrap">${esc(l.notes || '')}</td></tr>`).join('') : '<tr><td colspan="8" class="empty">No work lines yet.</td></tr>'}</tbody>
      </table></div>
      <div class="ws-sign">
        ${wsField('Designer', people.responsible_designer_id || '—')}${wsField('Production Manager', people.production_manager_id || '—')}
        ${wsField('Senior Production Officer', people.senior_production_officer_id || '—')}${wsField('Sales', people.sales_officer_id || '—')}
        <div class="ws-sig">Checked by (QC): ____________________</div>
        <div class="ws-sig">Production Manager sign-off: ____________________</div>
      </div>
    </section>`;
  }

  /* ---------- panels below the work sheet (not printed) ---------- */

  function detailsPanel(j) {
    const c = j.customer || {};
    const rows = [
      ['Customer', c.customer_id && MS.can('CUSTOMER_VIEW') ? MS.lnk('customers/customer.html?id=' + enc(c.customer_id), c.customer_name) : esc(j.customer_name || ''), true],
      ['Customer phone', c.phone],
      ['Quotation', j.quotation && MS.can('QUOTATION_VIEW') ? MS.lnk('customers/quotation.html?id=' + enc(j.quotation.quotation_id), j.quotation.quotation_number) : (j.quotation ? esc(j.quotation.quotation_number) : ''), true],
      ['Job type', j.job_type ? MS.label(j.job_type) : ''],
      ['Priority', MS.label(j.priority)],
      ['Customer deadline', MS.when(j.customer_deadline)],
      ['Cause of delay', j.delay_cause ? MS.label(j.delay_cause) : '']
    ];
    if (j.can && j.can.costs) {
      rows.push(['Selling price', MS.money(j.selling_price)]);
      if (j.quotation && j.quotation.deposit_required_pct !== '' && j.quotation.deposit_required_pct != null) rows.push(['Deposit required', j.quotation.deposit_required_pct + '%']);
      rows.push(['Deposit paid', MS.money(j.deposit_paid)]);
      if (j.total_cost !== '' && j.total_cost != null) rows.push(['Total cost', MS.money(j.total_cost)]);
    }
    return `<div class="dpanel"><h3>Details</h3>${MS.kv(rows)}</div>`;
  }

  function peoplePanel(j) {
    const list = j.assignments || [];
    const canAssign = j.can && j.can.assign;
    return `<div class="dpanel"><h3>People on this job ${canAssign ? '<button type="button" class="linkbtn" id="addPerson">Assign</button>' : ''}</h3>
      <div class="tablewrap"><table class="inv"><thead><tr><th>Person</th><th>Role on job</th>${canAssign ? '<th></th>' : ''}</tr></thead><tbody>
      ${list.length ? list.map((a, i) => `<tr><td>${esc(a.employee_name)}</td><td>${esc(MS.label(a.assignment_role))}</td>${canAssign ? `<td class="num"><button type="button" class="linkbtn" data-unassign="${i}">Remove</button></td>` : ''}</tr>`).join('')
        : `<tr><td colspan="${canAssign ? 3 : 2}" class="empty">Nobody assigned yet.</td></tr>`}
      </tbody></table></div></div>`;
  }

  function designPanel(j) {
    const tasks = j.design_tasks || [];
    const link = 'jobs/design.html?job=' + enc(j.job_id);
    const acts = [
      MS.can('DESIGN_ASSIGN') && `<a class="lnk" href="${link}">${tasks.length ? 'Reassign' : 'Assign designer'}</a>`,
      MS.canAny(['DESIGN_WORK', 'JOB_EDIT']) && `<a class="lnk" href="${link}">Design brief</a>`,
      MS.can('DESIGN_VIEW') && `<a class="lnk" href="${link}">Open design</a>`
    ].filter(Boolean).join(' · ');
    return `<div class="dpanel"><h3>Design <span class="h3-acts">${acts}</span></h3>
      ${tasks.length ? `<div class="tablewrap"><table class="inv"><thead><tr><th>Designer</th><th>Status</th><th class="num">Versions</th><th>Due</th></tr></thead><tbody id="designRows">
        ${tasks.map((t) => `<tr${MS.can('DESIGN_VIEW') ? ` class="clk" data-href="jobs/design.html?task=${enc(t.design_task_id)}"` : ''}><td>${esc(t.designer_name || '—')}</td><td>${MS.pill(t.status)}</td><td class="num">${(t.versions || []).length}</td><td>${esc(MS.when(t.due_at))}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">No design task yet.</p>'}</div>`;
  }

  function canPlan(j) { return j.can && j.can.worksheet && MS.canAny(['PRODUCTION_CREATE', 'PRODUCTION_TASK_ASSIGN']); }

  function materialsPanel(j) {
    const rows = j.materials || [];
    const plan = canPlan(j);
    const toRequest = MS.can('REQUISITION_CREATE') && rows.some((m) => m.allocation_type === 'STOCK' && Number(m.quantity_required) > Number(m.quantity_issued || 0));
    return `<div class="dpanel wide"><h3>Materials for this job ${plan ? '<button type="button" class="linkbtn" id="addMaterial">Add material</button>' : ''}
      ${toRequest ? ' <button type="button" class="linkbtn" id="requestStores">Request from stores</button>' : ''}
      ${MS.canAny(['REQUISITION_CREATE', 'REQUISITION_APPROVE', 'INVENTORY_ISSUE']) ? ' ' + MS.lnk('stores/requisitions.html?tab=all&job=' + encodeURIComponent(j.job_id), 'Requisitions') : ''}</h3>
      <div class="tablewrap"><table class="inv"><thead><tr><th>Item</th><th>Source</th><th class="num">Required</th><th class="num">Reserved</th><th class="num">Issued</th><th class="num">Used</th><th>Status</th><th></th></tr></thead><tbody>
      ${rows.length ? rows.map((m, i) => `<tr><td>${esc(m.item_name)}</td><td>${esc(MS.label(m.allocation_type))}</td>
        <td class="num">${esc(num(m.quantity_required) + ' ' + (m.unit || ''))}</td><td class="num">${esc(num(m.quantity_reserved || 0))}</td>
        <td class="num">${esc(num(m.quantity_issued || 0))}</td><td class="num">${esc(num(m.quantity_used || 0))}</td><td>${MS.pill(m.status)}</td>
        <td class="num">${plan && m.allocation_type !== 'STOCK' && m.status === 'PLANNED' ? `<button type="button" data-onsite="${i}">Confirm on site</button>` : ''}</td></tr>`).join('')
        : '<tr><td colspan="8" class="empty">No materials recorded yet.</td></tr>'}
      </tbody></table></div></div>`;
  }

  function notesPanel(j) {
    const list = j.comments || [];
    return `<div class="dpanel"><h3>Notes</h3>
      <ul class="jcomments">${list.length ? list.map((c) => `<li><div><b>${esc(c.author_name || '')}</b> <span class="sub">${esc(MS.when(c.created_at))}</span></div><p>${esc(c.body)}</p></li>`).join('') : '<li class="empty">No notes yet.</li>'}</ul>
      <form class="comment-form" id="commentForm"><textarea name="body" rows="2" maxlength="4000" placeholder="Add a note for the team…" aria-label="Note"></textarea><button type="submit" id="commentSave">Post</button></form>
      <div class="err" id="commentError"></div></div>`;
  }

  function historyPanel(j) {
    const rows = (j.history || []).slice().reverse();
    return `<div class="dpanel wide"><h3>Status history</h3><div class="tablewrap"><table class="inv"><thead><tr><th>When</th><th>From</th><th>To</th><th>By</th><th>Reason</th></tr></thead><tbody>
      ${rows.length ? rows.map((x) => `<tr><td>${esc(MS.when(x.changed_at))}</td><td>${esc(x.from_status ? MS.statusLabel(x.from_status, 'jobs') : '—')}</td><td>${jobPill(x.to_status)}</td><td>${esc(x.changed_by_name || '')}</td><td class="wrap">${esc(x.reason || '')}</td></tr>`).join('')
        : '<tr><td colspan="5" class="empty">No changes yet.</td></tr>'}
      </tbody></table></div></div>`;
  }

  function filesPanel(j) {
    const docs = j.documents || [];
    return `<div class="dpanel wide"><h3>Files <span class="sub">saved in the job folder on Google Drive</span></h3>
      <div class="tablewrap"><table class="inv"><thead><tr><th>File</th><th>Type</th><th>Uploaded</th><th>Status</th></tr></thead><tbody id="docRows">
      ${docs.length ? docs.map((d) => `<tr class="clk" data-doc="${esc(d.document_id)}" title="Download"><td><b class="lnk">${esc(d.file_name)}</b></td><td>${esc(MS.label(d.document_category))}</td><td>${esc(MS.when(d.upload_date))}</td><td>${MS.pill(d.status)}</td></tr>`).join('')
        : '<tr><td colspan="4" class="empty">No files yet.</td></tr>'}
      </tbody></table></div>
      ${MS.can('DOCUMENT_UPLOAD') ? `<form class="toolbar upload-form" id="uploadForm"><input type="file" id="upFile" aria-label="File"><select id="upKind" aria-label="Kind of file">${MS.options(FILE_KINDS, 'OTHER')}</select><button type="submit" id="upSave">Upload</button></form>
      <div class="err" id="upError"></div>` : ''}</div>`;
  }

  /* ---------- wiring ---------- */

  function wireBody(j) {
    const body = $('dBody');
    body.querySelectorAll('[data-stage]').forEach((b) => b.addEventListener('click', () => {
      const to = b.dataset.to, sid = b.dataset.stage;
      const s = (j.stages || []).find((x) => x.job_stage_id === sid) || {};
      if (to === 'ON_HOLD') {
        return askReason({ title: 'Hold ' + (s.stage_name || 'Job Location'), info: 'Why is this section on hold?', confirm: 'Hold',
          run: (r) => MS.call('JOB_STAGE_UPDATE', { job_stage_id: sid, to_status: to, reason: r }), done: 'Job Location on hold.' });
      }
      step(b, () => MS.call('JOB_STAGE_UPDATE', { job_stage_id: sid, to_status: to }), 'Job Location updated.');
    }));
    body.querySelectorAll('[data-stage-assign]').forEach((b) => b.addEventListener('click', () => stageAssign(j, b.dataset.stageAssign)));
    if ($('editLocs')) $('editLocs').addEventListener('click', () => editLocations(j));
    if ($('addLine')) $('addLine').addEventListener('click', () => lineForm(j, null));
    $('lineRows').addEventListener('click', (e) => {
      const tr = e.target.closest('tr[data-line]');
      if (tr) lineForm(j, j.worksheet_lines[Number(tr.dataset.line)]);
    });
    if ($('addPerson')) $('addPerson').addEventListener('click', () => assignPerson(j));
    body.querySelectorAll('[data-unassign]').forEach((b) => b.addEventListener('click', () => {
      const a = j.assignments[Number(b.dataset.unassign)];
      askReason({ title: 'Remove from job', info: 'Remove ' + a.employee_name + ' (' + MS.label(a.assignment_role) + ') from this job?', confirm: 'Remove', danger: true,
        run: (r) => MS.call('JOB_ASSIGN', { job_id: j.job_id, employee_id: a.employee_id, assignment_role: a.assignment_role, remove: true, reason: r }), done: 'Removed from the job.' });
    }));
    if ($('designRows')) MS.clickable($('designRows'));
    if ($('addMaterial')) $('addMaterial').addEventListener('click', () => materialForm(j));
    if ($('requestStores')) $('requestStores').addEventListener('click', (e) => step(e.currentTarget, () => MS.call('REQUISITION_CREATE', { job_id: j.job_id }), 'Requisition sent for approval. Stores issues the material once it is approved.'));
    body.querySelectorAll('[data-onsite]').forEach((b) => b.addEventListener('click', () => {
      const m = j.materials[Number(b.dataset.onsite)];
      step(b, () => MS.call('MATERIAL_REQUIREMENT_SAVE', { job_id: j.job_id, item_id: m.item_id, allocation_type: m.allocation_type, quantity_required: m.quantity_required, confirmed_on_site: true }), 'Confirmed on site.');
    }));
    $('commentForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = e.target.elements.body.value.trim();
      if (!text) return;
      MS.busy($('commentSave'), true, 'Posting…');
      try { await MS.call('JOB_COMMENT_ADD', { job_id: j.job_id, body: text }); await load('Note posted.'); } catch (err) { $('commentError').textContent = err.message; MS.busy($('commentSave'), false); }
    });
    $('docRows').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-doc]'); if (tr) openDocument(tr.dataset.doc); });
    if ($('uploadForm')) $('uploadForm').addEventListener('submit', (e) => upload(e, j));
  }

  function editDetails(j) {
    const f = $('editForm');
    f.reset();
    const pre = PRE_PRODUCTION.indexOf(j.status) >= 0;
    const canDeadline = pre || MS.can('JOB_APPROVE') || MS.can('PRODUCTION_CREATE');
    $('editInfo').textContent = pre ? 'Changes to the people on the job update their assignments and notify them.'
      : 'Production has started: only the deadline, priority, cause of delay and Senior Production Officer can change' + (canDeadline ? '.' : ' (deadline and priority by the GM or Production Manager).');
    // Emergency is asked for with "Request emergency" and taken off with "Remove emergency", not here
    const isEm = j.priority === 'EMERGENCY';
    $('eaPriority').innerHTML = MS.options(MS.enumOf('jobs.priority').filter((p) => isEm || p !== 'EMERGENCY'), j.priority);
    $('eaPM').innerHTML = MS.employeesIn(['PRODUCTION_MANAGER'], j.production_manager_id, '— none —');
    $('eaSPO').innerHTML = MS.employeesIn(['SENIOR_PRODUCTION_OFFICER'], j.senior_production_officer_id, '— later —');
    $('eaDesigner').innerHTML = MS.employeesIn(['GRAPHIC_DESIGNER', 'HEAD_OF_GRAPHIC_DESIGN'], j.responsible_designer_id, '— later / no design —');
    $('eaSales').innerHTML = MS.employeesIn(['SALES_OFFICER'], j.sales_officer_id, '— none —');
    $('eaDelay').innerHTML = MS.options(MS.enumOf('jobs.delay_cause'), j.delay_cause, '— none —');
    const el = f.elements;
    el.job_name.value = j.job_name || '';
    el.customer_deadline.value = MS.toLocalInput(j.customer_deadline);
    ['job_name', 'production_manager_id', 'responsible_designer_id', 'sales_officer_id'].forEach((k) => { el[k].disabled = !pre; });
    el.customer_deadline.disabled = !canDeadline;
    el.priority.disabled = !canDeadline || isEm;
    dialog('edit', async () => {
      const changes = {};
      const pick = (k, v, old) => { if (!el[k].disabled && String(v) !== String(old == null ? '' : old)) changes[k] = v; };
      pick('job_name', el.job_name.value.trim(), j.job_name);
      if (!el.customer_deadline.disabled && el.customer_deadline.value !== MS.toLocalInput(j.customer_deadline)) {
        if (!el.customer_deadline.value) throw new Error('Enter the customer deadline.');
        changes.customer_deadline = MS.fromLocalInput(el.customer_deadline.value);
      }
      ['priority', 'production_manager_id', 'senior_production_officer_id', 'responsible_designer_id', 'sales_officer_id', 'delay_cause'].forEach((k) => pick(k, el[k].value, j[k]));
      if ('job_name' in changes && !changes.job_name) throw new Error('Enter the job name.');
      if (!Object.keys(changes).length) { $('editDialog').close(); return false; }
      await MS.call('JOB_UPDATE', Object.assign({ job_id: j.job_id, reason: el.reason.value.trim() }, changes));
      return 'Job details saved.';
    });
  }

  function editLocations(j) {
    const on = {};
    (j.stages || []).forEach((s) => { if (s.stage_kind === 'PRODUCTION_SECTION' && s.status !== 'SKIPPED') on[s.stage_code] = true; });
    $('locBoxes').innerHTML = sections().map((st) => `<label class="loc check"><input type="checkbox" value="${esc(st.stage_code)}"${on[st.stage_code] ? ' checked' : ''}> ${esc(st.stage_name)}</label>`).join('');
    dialog('loc', async (d, f) => {
      const codes = Array.from(f.querySelectorAll('#locBoxes input:checked')).map((i) => i.value);
      await MS.call('JOB_SECTIONS_SET', { job_id: j.job_id, stage_codes: codes, reason: 'Work sheet updated' });
      return 'Job Locations saved.';
    });
  }

  async function stageAssign(j, stageId) {
    const s = (j.stages || []).find((x) => x.job_stage_id === stageId) || {};
    $('stageAssignTitle').textContent = 'Assign ' + (s.stage_name || 'Job Location');
    $('saUser').innerHTML = '<option value="">Loading…</option>';
    dialog('stageAssign', async (d) => {
      if (!d.user_id) throw new Error('Choose the person.');
      await MS.call('JOB_STAGE_ASSIGN', { job_stage_id: stageId, user_id: d.user_id });
      return 'Job Location assigned.';
    });
    try {
      const r = await MS.call('EMPLOYEE_LIST', { page_size: 100, filters: { status: 'ACTIVE' } });
      const people = r.rows.filter((e) => e.user_id && e.account_status === 'ACTIVE')
        .map((e) => ({ value: e.user_id, label: e.first_name + ' ' + e.last_name + (e.position_title ? ' · ' + e.position_title : '') }));
      $('saUser').innerHTML = MS.options(people, s.assigned_user_id, people.length ? '— choose —' : 'Nobody with a user account in your area');
    } catch (err) { $('saUser').innerHTML = ''; $('stageAssignError').textContent = err.message; }
  }

  function lineForm(j, l) {
    l = l || {};
    const f = $('lineForm');
    f.reset();
    $('lineTitle').textContent = l.worksheet_line_id ? 'Edit work line' : 'Add work line';
    $('lnStage').innerHTML = MS.options((j.stages || []).filter((s) => s.stage_kind === 'PRODUCTION_SECTION' && s.status !== 'SKIPPED')
      .map((s) => ({ value: s.job_stage_id, label: s.stage_name })), l.job_stage_id, '— whole job —');
    $('lnMaterial').innerHTML = MS.options((j.materials || []).filter((m) => m.allocation_type === 'STOCK')
      .map((m) => ({ value: m.item_id, label: m.item_name + ' (issued ' + (m.quantity_issued || 0) + ')' })), l.material_item_id, '— not from stores —');
    $('lnPerson').innerHTML = MS.employeeOptions(l.responsible_person_id, '— me —');
    const el = f.elements;
    ['quantity', 'work_description', 'material_description', 'quantity_used', 'unit', 'notes'].forEach((k) => { el[k].value = l[k] == null ? '' : l[k]; });
    el.start_time.value = MS.toLocalInput(l.start_time);
    el.end_time.value = MS.toLocalInput(l.end_time);
    dialog('line', async (d) => {
      if (!d.work_description) throw new Error('Describe the work.');
      if (d.start_time && d.end_time && d.end_time < d.start_time) throw new Error('End time is before start time.');
      await MS.call('WORKSHEET_LINE_SAVE', Object.assign(d, { job_id: j.job_id }, l.worksheet_line_id ? { worksheet_line_id: l.worksheet_line_id } : {}));
      return 'Work line saved.';
    });
  }

  function assignPerson(j) {
    $('assignForm').reset();
    $('asPerson').innerHTML = MS.employeeOptions('', '— choose —');
    $('asRole').innerHTML = MS.options(MS.enumOf('job_assignments.assignment_role'), 'MACHINE_EXPERT');
    dialog('assign', async (d) => {
      if (!d.employee_id) throw new Error('Choose the person.');
      await MS.call('JOB_ASSIGN', Object.assign(d, { job_id: j.job_id }));
      return 'Assigned to the job.';
    });
  }

  async function materialForm(j) {
    let r;
    try { r = await MS.call('INVENTORY_LIST', { active_only: true, page_size: 100 }); } catch (err) { return MS.alert(err.message); }
    if (!r.rows.length) return MS.alert('There are no items in the item list yet. Ask Stores to add them.', 'No items yet');
    $('materialForm').reset();
    $('mtItem').innerHTML = MS.options(r.rows.map((i) => ({ value: i.item_id, label: i.item_name + ' · available ' + i.available + ' ' + (i.unit || '') })), '', '— choose —');
    $('mtSource').innerHTML = MS.options(MS.enumOf('job_material_requirements.allocation_type'), 'STOCK');
    dialog('material', async (d) => {
      if (!d.item_id) throw new Error('Choose the item.');
      if (!(Number(d.quantity_required) > 0)) throw new Error('Quantity must be more than 0.');
      await MS.call('MATERIAL_REQUIREMENT_SAVE', Object.assign(d, { job_id: j.job_id }));
      return 'Material saved.';
    });
  }

  function requestApproval(j, type) {
    $('approvalForm').reset();
    $('approvalTitle').textContent = 'Request ' + MS.label(type).toLowerCase();
    $('approvalInfo').textContent = type === 'DEPOSIT_WAIVER' ? 'The General Manager decides whether production may start before the deposit is paid.'
      : 'The Production Manager confirms that production is complete.';
    dialog('approval', async (d) => {
      await MS.call('JOB_APPROVAL_REQUEST', { job_id: j.job_id, approval_type: type, comment: d.comment });
      return 'Request sent.';
    });
  }

  async function deleteJob(j) {
    let pv;
    try { pv = await MS.call('JOB_DELETE_PREVIEW', { job_id: j.job_id }); } catch (err) { return MS.alert(err.message); }
    const f = $('deleteForm');
    f.reset();
    $('deleteFields').hidden = !pv.can_delete;
    $('deleteSave').hidden = !pv.can_delete;
    setBtn($('deleteCancel'), pv.can_delete ? 'Cancel' : 'Close', '');
    if (!pv.can_delete) {
      $('deleteTitle').textContent = 'This job cannot be deleted';
      $('deleteInfo').textContent = pv.message;
      $('deleteList').innerHTML = (pv.blockers || []).slice(0, 10).map((b) => `<li><span class="n">${esc(MS.label(b.table))}</span><span class="a">${esc(MS.label(b.status || ''))}</span></li>`).join('');
    } else {
      $('deleteTitle').textContent = 'Delete job ' + j.job_number;
      $('deleteInfo').textContent = 'This permanently removes the job and everything below it. A snapshot is kept, files are archived (not deleted), and the action is audited.';
      $('deleteList').innerHTML = Object.keys(pv.counts || {}).map((k) => `<li><span class="n">${esc(MS.label(k))}</span><span class="a">${esc(pv.counts[k])}</span></li>`).join('');
      f.elements.confirm_job_number.placeholder = j.job_number;
    }
    dialog('delete', async (d) => {
      if (!d.reason) throw new Error('Give the reason for deleting this job.');
      if (d.confirm_job_number !== j.job_number) throw new Error('Type the job number exactly to confirm.');
      await MS.call('JOB_DELETE', { job_id: j.job_id, reason: d.reason, confirm_job_number: d.confirm_job_number });
      location.replace('jobs/jobs.html');
      return false;
    });
  }

  async function upload(e, j) {
    e.preventDefault();
    const file = $('upFile').files[0];
    $('upError').textContent = '';
    if (!file) { $('upError').textContent = 'Choose a file first.'; return; }
    const kind = $('upKind').value;
    MS.busy($('upSave'), true, 'Uploading…');
    try {
      const up = await MS.fileForUpload(file);
      await MS.call('DOCUMENT_UPLOAD', Object.assign(up, { related_table: 'jobs', related_entity_id: j.job_id,
        document_category: kind === 'QUALITY_CONTROL' ? 'QC' : kind, subfolder: kind }));
      await load('File uploaded.');
    } catch (err) { $('upError').textContent = err.message; MS.busy($('upSave'), false); }
  }

  // downloads a document through the API (Drive is never exposed directly)
  async function openDocument(docId) {
    MS.setMsg('dStatus', 'Getting the file…');
    try {
      const r = await MS.call('DOCUMENT_GET', { document_id: docId });
      MS.setMsg('dStatus', '');
      if (r.too_large) return MS.alert(r.message, 'File too large to download here');
      const bytes = atob(r.base64), arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([arr], { type: r.mime_type }));
      const a = document.createElement('a');
      a.href = url; a.download = r.document.file_name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) { MS.setMsg('dStatus', err.message, 'error'); }
  }

  async function load(msg) {
    if (!job) MS.setMsg('dStatus', 'Loading…');
    try {
      const first = !job;
      const j = await MS.call('JOB_GET', { job_id: id });
      render(j);
      // from the dashboard's "Waiting for my approval": show the Emergency request
      if (first && location.hash === '#priority' && $('priority')) $('priority').scrollIntoView({ block: 'center' });
      MS.setMsg('dStatus', msg || '', msg ? 'ok' : '');
    } catch (err) {
      MS.setMsg('dStatus', err.message, 'error');
      if (!job) $('dBody').innerHTML = '<p><a class="lnk" href="jobs/jobs.html">Back to jobs</a></p>';
    }
  }

  // close the More menu when clicking elsewhere
  document.addEventListener('click', (e) => {
    document.querySelectorAll('details.jmenu[open]').forEach((d) => { if (!d.contains(e.target)) d.open = false; });
  });

  MS.boot({ page: 'jobs', any: ['JOB_VIEW'], ref: true }).then(() => {
    if (!id) { MS.setMsg('dStatus', 'No job was chosen.', 'error'); $('dBody').innerHTML = '<p><a class="lnk" href="jobs/jobs.html">Back to jobs</a></p>'; return; }
    load();
  });
})();
