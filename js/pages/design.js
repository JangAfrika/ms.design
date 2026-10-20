/* One job's design work: brief, designer, versions (files on Drive), internal review, customer decision with evidence,
   revision requests and release to production. Opened with ?task=<design_task_id> or ?job=<job_id>.
   Buttons follow the task's "can" flags from the server; the server checks every action again. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const EDITABLE = ['ASSIGNED', 'IN_PROGRESS', 'INTERNAL_REVIEW', 'SENT_TO_CUSTOMER', 'CUSTOMER_REVISION'];
  const OPEN = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'INTERNAL_REVIEW', 'SENT_TO_CUSTOMER', 'CUSTOMER_REVISION'];
  const DESIGNERS = ['GRAPHIC_DESIGNER', 'HEAD_OF_GRAPHIC_DESIGN'];
  let taskId = MS.param('task');
  const jobId = MS.param('job');
  let task = null;

  const NEXT = {
    NEW: 'No designer yet. Assign a designer to start the work.',
    ASSIGNED: 'Waiting for the designer to upload the first version.',
    IN_PROGRESS: 'The designer is working on it. Upload a version and send it for internal review.',
    INTERNAL_REVIEW: 'Waiting for internal review by the Head of Graphic Design.',
    SENT_TO_CUSTOMER: 'Sent to the customer. Record their decision with the evidence.',
    CUSTOMER_REVISION: 'Changes were asked for (see the revision requests below). Upload a new version.',
    CUSTOMER_APPROVED: 'The customer approved the design. Release the approved version to production.',
    REJECTED: 'This design task was rejected.'
  };

  const canBrief = () => MS.canAny(['DESIGN_WORK', 'JOB_EDIT']);
  const jobLink = (id, text) => MS.lnk('jobs/job.html?id=' + encodeURIComponent(id), text);

  /* ---------- files ---------- */
  async function download(documentId, btn) {
    MS.busy(btn, true, 'Opening…');
    try {
      const r = await MS.call('DOCUMENT_GET', { document_id: documentId });
      if (r.too_large) { await MS.alert(r.message, 'File too large'); return; }
      const bytes = atob(r.base64);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([arr], { type: r.mime_type }));
      const a = document.createElement('a');
      a.href = url; a.download = (r.document && r.document.file_name) || 'file';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) { MS.alert(err.message); } finally { MS.busy(btn, false); }
  }
  const fileBtn = (id, name) => `<button type="button" class="filelink" data-doc="${esc(id)}">${esc(name || 'file')}</button>`;

  /* ---------- page ---------- */
  function render(t) {
    task = t;
    taskId = t.design_task_id;
    document.title = 'Design · ' + t.job_number + ' · MS BMS';
    $('dCrumbs').innerHTML = `<a href="jobs/designs.html">Design</a> › ${jobLink(t.job_id, t.job_number)}`;
    $('dTitle').innerHTML = esc(t.job_number + ' · ' + (t.job_name || '')) + ' ' + MS.pill(t.status);
    const can = t.can || {};
    $('dActions').innerHTML = [
      can.work && EDITABLE.indexOf(t.status) >= 0 && '<button type="button" class="primary" id="uploadBtn">Upload version</button>',
      can.release && t.status === 'CUSTOMER_APPROVED' && '<button type="button" class="primary" id="releaseBtn">Release to production</button>',
      can.work && ['CUSTOMER_APPROVED', 'COMPLETED', 'SENT_TO_CUSTOMER'].indexOf(t.status) >= 0 && '<button type="button" id="revBtn">Log revision request</button>',
      can.assign && OPEN.indexOf(t.status) >= 0 && `<button type="button" id="assignBtn">${t.designer_id ? 'Reassign' : 'Assign designer'}</button>`,
      `<a class="btn" href="jobs/job.html?id=${encodeURIComponent(t.job_id)}">Open work sheet</a>`
    ].filter(Boolean).join('');

    const closedJob = ['ON_HOLD', 'CLOSED', 'CANCELLED', 'DELIVERED', 'COMPLETED', 'REJECTED'].indexOf(t.job_status) >= 0;
    const note = closedJob ? `Job ${t.job_number} is ${MS.statusLabel(t.job_status, 'jobs').toLowerCase()}; design work is not possible now.`
      : t.status === 'COMPLETED' ? 'Released to production' + (t.released_to_production_at ? ' on ' + MS.when(t.released_to_production_at) : '') + '.'
        : NEXT[t.status] || '';
    const versions = t.versions || [];
    const revisions = t.revisions || [];
    const b = t.brief;
    $('dBody').innerHTML = `
      ${note ? `<div class="notice-bar">${esc(note)}</div>` : ''}
      <div class="cards">
        <div class="card"><div class="k">Status</div><div class="v">${esc(MS.statusLabel(t.status, 'design_tasks'))}</div><div class="s">Job: ${esc(MS.statusLabel(t.job_status, 'jobs'))}</div></div>
        <div class="card${t.overdue ? ' red' : ''}"><div class="k">Design due</div><div class="v">${esc(MS.shortDate(t.due_at) || '—')}</div><div class="s">${t.overdue ? 'Overdue' : esc(MS.when(t.due_at) || 'no due time')}</div></div>
        <div class="card"><div class="k">Versions</div><div class="v">${versions.length}</div><div class="s">${versions[0] ? 'Latest: version ' + esc(versions[0].version_no) : 'none uploaded yet'}</div></div>
        <div class="card${Number(t.revision_count) > 0 ? '' : ' green'}"><div class="k">Revisions</div><div class="v">${esc(t.revision_count || 0)}</div><div class="s">${revisions.length} request${revisions.length === 1 ? '' : 's'} logged</div></div>
      </div>
      <div class="dgrid">
        <div class="dpanel"><h3>Task</h3>${MS.kv([
          ['Job', jobLink(t.job_id, t.job_number), true], ['Job name', t.job_name], ['Status', MS.pill(t.status), true],
          ['Designer', t.designer_name || 'not assigned'],
          ['Due', t.overdue ? `<span class="late">${esc(MS.when(t.due_at))} · overdue</span>` : esc(MS.when(t.due_at)), true],
          ['Customer deadline', MS.when(t.customer_deadline)], ['Started', MS.when(t.started_at)],
          ['Customer approved', MS.when(t.completed_at)],
          ['Released to production', t.released_to_production_at ? MS.when(t.released_to_production_at) : '—']])}</div>
        <div class="dpanel"><h3>Brief ${canBrief() ? `<button type="button" class="linkbtn" id="briefBtn">${b ? 'Edit brief' : 'Add brief'}</button>` : ''}</h3>
          ${b ? `<dl class="kv"><dt>Requirements</dt><dd class="pre">${esc(b.requirements)}</dd><dt>Size</dt><dd>${esc(b.dimensions || '—')}</dd><dt>Colours</dt><dd>${esc(b.colours || '—')}</dd>${b.updated_at || b.created_at ? `<dt>Last saved</dt><dd>${esc(MS.when(b.updated_at || b.created_at))}</dd>` : ''}</dl>`
            : '<p class="empty">No brief captured yet.</p>'}</div>
        <div class="dpanel wide"><h3>Versions</h3>
          ${versions.length ? `<div class="vlist" id="vList">${versions.map((v) => versionCard(t, v)).join('')}</div>` : '<p class="empty">No versions uploaded yet.</p>'}</div>
        ${revisions.length ? `<div class="dpanel wide"><h3>Revision requests</h3><div class="tablewrap"><table class="inv"><thead><tr><th>When</th><th>From</th><th>Reason</th><th>Major</th><th>Details</th></tr></thead><tbody>
          ${revisions.slice().sort((a, x) => (a.created_at < x.created_at ? 1 : -1)).map((r) => `<tr><td>${esc(MS.when(r.created_at))}</td><td>${esc(MS.label(r.requested_by))}</td><td>${esc(MS.label(r.reason_category))}</td><td>${r.is_major === true ? '<span class="pill pending">Major</span>' : ''}</td><td class="pre">${esc(r.description)}</td></tr>`).join('')}
          </tbody></table></div></div>` : ''}
        <div class="dpanel wide" id="otherTasks" hidden></div>
      </div>`;
    wire(t);
    otherTasks(t);
  }

  function versionCard(t, v) {
    const can = t.can || {};
    const acts = [];
    if (v.status === 'DRAFT' && can.work && t.status !== 'INTERNAL_REVIEW') acts.push(`<button type="button" data-act="submit" data-v="${esc(v.design_version_id)}">Submit for review</button>`);
    if (v.status === 'DRAFT' && can.review) {
      acts.push(`<button type="button" class="primary" data-act="approve" data-v="${esc(v.design_version_id)}">Approve internally</button>`);
      acts.push(`<button type="button" data-act="changes" data-v="${esc(v.design_version_id)}">Request changes</button>`);
    }
    if (v.status === 'INTERNAL_APPROVED' && can.work) acts.push(`<button type="button" class="primary" data-act="send" data-v="${esc(v.design_version_id)}">Mark as sent to customer</button>`);
    if (v.status === 'SENT' && can.record_customer) acts.push(`<button type="button" class="primary" data-act="decide" data-v="${esc(v.design_version_id)}">Record customer decision</button>`);
    const files = v.files || [];
    const apprs = (v.approvals || []).slice().sort((a, x) => (a.decided_at < x.decided_at ? -1 : 1));
    const old = ['SUPERSEDED', 'REJECTED'].indexOf(v.status) >= 0;
    return `<article class="vcard${v.status === 'CUSTOMER_APPROVED' ? ' approved' : ''}${old ? ' old' : ''}">
      <div class="vh"><h4>Version ${esc(v.version_no)}</h4>${MS.pill(v.status)}${t.approved_version_id === v.design_version_id ? ' <span class="pill ok">Approved version</span>' : ''}
        <span class="by">By ${esc(v.designer_name || '—')} · ${esc(MS.when(v.created_at))}</span></div>
      <div class="vs">${v.change_summary ? esc(v.change_summary) : '<span class="muted">No summary</span>'}</div>
      ${files.length ? `<ul class="files">${files.map((f) => `<li>${fileBtn(f.document_id, f.file_name)} <span class="muted small">${esc(MS.label(f.file_role))}</span></li>`).join('')}</ul>` : '<div class="muted small">No files</div>'}
      ${apprs.length ? `<ul class="apprs">${apprs.map((a) => `<li>${MS.pill(a.decision)} ${esc(MS.label(a.approval_kind))} · ${esc(a.approved_by_name || '')} · ${esc(MS.when(a.decided_at))}${a.evidence_document_id ? ' · ' + fileBtn(a.evidence_document_id, 'Evidence') : ''}${a.comment ? `<div class="c">${esc(a.comment)}</div>` : ''}</li>`).join('')}</ul>` : ''}
      ${acts.length ? `<div class="vacts">${acts.join('')}</div>` : ''}
    </article>`;
  }

  function wire(t) {
    const on = (id, fn) => { if ($(id)) $(id).addEventListener('click', fn); };
    on('uploadBtn', () => uploadVersion(t));
    on('releaseBtn', () => release(t));
    on('revBtn', () => revision(t));
    on('assignBtn', () => assign({ job_id: t.job_id, job_number: t.job_number, customer_deadline: t.customer_deadline }, t));
    on('briefBtn', () => brief({ job_id: t.job_id, job_number: t.job_number }, t.brief));
    $('dBody').querySelectorAll('[data-doc]').forEach((el) => el.addEventListener('click', () => download(el.dataset.doc, el)));
    $('dBody').querySelectorAll('[data-act]').forEach((el) => el.addEventListener('click', () => {
      const v = (t.versions || []).find((x) => x.design_version_id === el.dataset.v);
      if (!v) return;
      if (el.dataset.act === 'submit') submitReview(v, el);
      else if (el.dataset.act === 'approve') approveInternal(t, v, el);
      else if (el.dataset.act === 'changes') review(t, v, 'REVISION_REQUESTED');
      else if (el.dataset.act === 'send') send(v);
      else if (el.dataset.act === 'decide') customerDecision(v);
    }));
  }

  // other design tasks for the same job (an earlier, finished or rejected one)
  async function otherTasks(t) {
    try {
      const r = await MS.call('DESIGN_LIST', { page: 1, page_size: 50, filters: { job_id: t.job_id }, sort: 'created_at', dir: 'desc' });
      const others = r.rows.filter((x) => x.design_task_id !== t.design_task_id);
      if (!others.length || !$('otherTasks')) return;
      $('otherTasks').hidden = false;
      $('otherTasks').innerHTML = `<h3>Other design tasks for this job</h3><div class="tablewrap"><table class="inv"><thead><tr><th>Created</th><th>Designer</th><th>Status</th><th>Due</th></tr></thead><tbody id="otherRows">
        ${others.map((x) => `<tr class="clk" data-href="jobs/design.html?task=${encodeURIComponent(x.design_task_id)}"><td>${MS.lnk('jobs/design.html?task=' + encodeURIComponent(x.design_task_id), MS.when(x.created_at))}</td><td>${esc(x.designer_name || 'not assigned')}</td><td>${MS.pill(x.status)}</td><td>${esc(MS.when(x.due_at))}</td></tr>`).join('')}
        </tbody></table></div>`;
      MS.clickable($('otherRows'));
    } catch (e) { /* not important */ }
  }

  /* ---------- dialogs ---------- */
  // runs a save from a dialog: shows the error inside the dialog, reloads the page on success
  function dialogSave(dlg, errId, btnId, fn) {
    return async (e) => {
      e.preventDefault();
      $(errId).textContent = '';
      MS.busy($(btnId), true, 'Saving…');
      try {
        const res = await fn();
        if (res === false) return;
        dlg.close();
        await afterSave(res);
      } catch (err) { $(errId).textContent = err.message; } finally { MS.busy($(btnId), false); }
    };
  }

  async function afterSave(res) {
    const t = res && (res.design_task_id ? res : res.task);
    if (t && t.design_task_id && t.design_task_id !== taskId) {
      location.href = 'jobs/design.html?task=' + encodeURIComponent(t.design_task_id);
      return;
    }
    await load();
  }

  function assign(job, t) {
    const f = $('assignForm');
    f.reset();
    $('assignError').textContent = '';
    $('assignTitle').textContent = (t && t.designer_id ? 'Reassign designer' : 'Assign designer') + ' · ' + job.job_number;
    $('aDesigner').innerHTML = MS.employeesIn(DESIGNERS, t && t.designer_id);
    $('aDue').value = MS.toLocalInput(t ? t.due_at || job.customer_deadline : job.customer_deadline);
    const dlg = MS.openDialog('assignDialog');
    f.onsubmit = dialogSave(dlg, 'assignError', 'assignSave', async () => {
      const d = MS.formData(f);
      if (!d.designer_id) { $('assignError').textContent = 'Choose the designer.'; return false; }
      if (!d.due_at) { $('assignError').textContent = 'Enter the due date and time.'; return false; }
      return MS.call('DESIGN_ASSIGN', Object.assign(d, t ? { design_task_id: t.design_task_id } : { job_id: job.job_id }));
    });
    $('assignCancel').onclick = () => dlg.close();
  }

  function brief(job, current) {
    const f = $('briefForm');
    f.reset();
    $('briefError').textContent = '';
    $('briefTitle').textContent = 'Design brief · ' + job.job_number;
    $('bReq').value = (current && current.requirements) || '';
    $('bDim').value = (current && current.dimensions) || '';
    $('bCol').value = (current && current.colours) || '';
    const dlg = MS.openDialog('briefDialog');
    f.onsubmit = dialogSave(dlg, 'briefError', 'briefSave', async () => {
      const d = MS.formData(f);
      if (!d.requirements) { $('briefError').textContent = 'Write what the customer wants.'; return false; }
      return MS.call('DESIGN_BRIEF_SAVE', Object.assign(d, { job_id: job.job_id }));
    });
    $('briefCancel').onclick = () => dlg.close();
  }

  function uploadVersion(t) {
    const f = $('uploadForm');
    f.reset();
    $('uploadError').textContent = '';
    $('uRole').innerHTML = MS.options(['PROOF', 'PRINT_READY', 'SOURCE'], 'PROOF');
    $('uSubmit').checked = true;
    const dlg = MS.openDialog('uploadDialog');
    f.onsubmit = dialogSave(dlg, 'uploadError', 'uploadSave', async () => {
      const picked = Array.from($('uFiles').files || []);
      if (!picked.length) { $('uploadError').textContent = 'Choose at least one file.'; return false; }
      const role = $('uRole').value;
      const files = await Promise.all(picked.map(async (file) => Object.assign(await MS.fileForUpload(file), { file_role: role })));
      return MS.call('DESIGN_VERSION_UPLOAD', { design_task_id: t.design_task_id, change_summary: $('uSummary').value.trim(), files,
        submit_for_review: $('uSubmit').checked, customer_artwork: $('uCustomer').checked });
    });
    $('uploadCancel').onclick = () => dlg.close();
  }

  async function submitReview(v, btn) {
    MS.busy(btn, true, 'Sending…');
    try { await MS.call('DESIGN_SUBMIT_REVIEW', { design_version_id: v.design_version_id }); await load(); } catch (err) { MS.alert(err.message); MS.busy(btn, false); }
  }

  // a designer may not approve their own work; the Head of Graphic Design may, with a written reason
  function ownWork(v) { return !!(MS.user.employee_id && MS.user.employee_id === v.created_by_designer_id); }

  async function approveInternal(t, v, btn) {
    if (ownWork(v)) { review(t, v, 'APPROVED'); return; }
    MS.busy(btn, true, 'Approving…');
    try { await MS.call('DESIGN_INTERNAL_REVIEW', { design_version_id: v.design_version_id, decision: 'APPROVED' }); await load(); } catch (err) { MS.alert(err.message); MS.busy(btn, false); }
  }

  function review(t, v, decision) {
    const f = $('reviewForm');
    f.reset();
    $('reviewError').textContent = '';
    const own = ownWork(v);
    const approve = decision === 'APPROVED';
    $('reviewTitle').textContent = (approve ? 'Approve version ' : 'Request changes · version ') + v.version_no;
    $('reviewInfo').textContent = (own ? 'This is your own design. A second person should review it; if no one else can, give the reason. ' : '')
      + (approve ? 'The version can then be sent to the customer.' : 'The version goes back to the designer with your note.');
    $('rCommentText').textContent = approve ? 'Reason for reviewing your own design' : 'What must the designer change?';
    $('rChangeBox').hidden = approve;
    $('rReason').innerHTML = MS.options(MS.enumOf('design_revisions.reason_category'), 'DESIGN_ERROR');
    $('reviewSave').textContent = approve ? 'Approve' : 'Send back';
    $('reviewSave').dataset.label = $('reviewSave').textContent;
    const dlg = MS.openDialog('reviewDialog');
    f.onsubmit = dialogSave(dlg, 'reviewError', 'reviewSave', async () => {
      const comment = $('rComment').value.trim();
      if (!comment) { $('reviewError').textContent = approve ? 'You are reviewing your own design; give a reason.' : 'Say what must change.'; return false; }
      const p = { design_version_id: v.design_version_id, decision, comment };
      if (!approve) Object.assign(p, { reason_category: $('rReason').value, is_major: $('rMajor').checked });
      return MS.call('DESIGN_INTERNAL_REVIEW', p);
    });
    $('reviewCancel').onclick = () => dlg.close();
  }

  function send(v) {
    const f = $('sendForm');
    f.reset();
    $('sendError').textContent = '';
    $('sendTitle').textContent = 'Version ' + v.version_no + ' sent to customer';
    $('sChannel').innerHTML = MS.options(['WhatsApp', 'Email', 'In person', 'Phone'].map((c) => ({ value: c, label: c })), 'WhatsApp');
    const dlg = MS.openDialog('sendDialog');
    f.onsubmit = dialogSave(dlg, 'sendError', 'sendSave', () => MS.call('DESIGN_SEND', { design_version_id: v.design_version_id, channel: $('sChannel').value }));
    $('sendCancel').onclick = () => dlg.close();
  }

  function customerDecision(v) {
    const f = $('decisionForm');
    f.reset();
    $('decisionError').textContent = '';
    $('decisionTitle').textContent = 'Customer decision · version ' + v.version_no;
    $('cDecision').innerHTML = MS.options([{ value: 'APPROVED', label: 'Customer approved' }, { value: 'REVISION_REQUESTED', label: 'Customer wants changes' }, { value: 'REJECTED', label: 'Customer rejected' }], 'APPROVED');
    $('cReason').innerHTML = MS.options(MS.enumOf('design_revisions.reason_category'), 'CUSTOMER_CHANGE');
    const sync = () => {
      const ok = $('cDecision').value === 'APPROVED';
      $('cRevBox').hidden = ok;
      $('cEvidenceLbl').classList.toggle('req', ok);
      $('cCommentLbl').classList.toggle('req', !ok);
    };
    $('cDecision').onchange = sync;
    sync();
    const dlg = MS.openDialog('decisionDialog');
    f.onsubmit = dialogSave(dlg, 'decisionError', 'decisionSave', async () => {
      const decision = $('cDecision').value;
      const comment = $('cComment').value.trim();
      const file = $('cEvidence').files[0];
      if (decision === 'APPROVED' && !file) { $('decisionError').textContent = 'Attach the approval evidence: signed proof, email or WhatsApp screenshot.'; return false; }
      if (decision !== 'APPROVED' && !comment) { $('decisionError').textContent = 'Record what the customer asked for.'; return false; }
      const p = { design_version_id: v.design_version_id, decision, comment, reason_category: $('cReason').value, is_major: $('cMajor').checked };
      if (file) p.evidence = await MS.fileForUpload(file);
      return MS.call('DESIGN_APPROVE', p);
    });
    $('decisionCancel').onclick = () => dlg.close();
  }

  function revision(t) {
    const f = $('revForm');
    f.reset();
    $('revError').textContent = '';
    $('vBy').innerHTML = MS.options(MS.enumOf('design_revisions.requested_by'), 'CUSTOMER');
    $('vReason').innerHTML = MS.options(MS.enumOf('design_revisions.reason_category'), 'CUSTOMER_CHANGE');
    const dlg = MS.openDialog('revDialog');
    f.onsubmit = dialogSave(dlg, 'revError', 'revSave', async () => {
      const description = $('vDesc').value.trim();
      if (!description) { $('revError').textContent = 'Describe the change.'; return false; }
      return MS.call('DESIGN_REVISION_REQUEST', { design_task_id: t.design_task_id, requested_by: $('vBy').value, reason_category: $('vReason').value,
        description, is_major: $('vMajor').checked });
    });
    $('revCancel').onclick = () => dlg.close();
  }

  async function release(t) {
    const yes = await MS.confirm({ title: 'Release to production', message: 'Release the customer-approved version to production?',
      detail: 'The Production Manager is told that the design is ready.', confirmText: 'Release' });
    if (!yes) return;
    MS.busy($('releaseBtn'), true, 'Releasing…');
    try { await MS.call('DESIGN_RELEASE', { design_task_id: t.design_task_id }); await load(); } catch (err) { MS.alert(err.message); MS.busy($('releaseBtn'), false); }
  }

  /* ---------- a job with no design task yet ---------- */
  async function renderJob() {
    let job = { job_id: jobId, job_number: 'this job' };
    try { const j = await MS.call('JOB_GET', { job_id: jobId }); job = j; } catch (e) { /* the job page may be closed to this person; carry on */ }
    document.title = 'Design · ' + job.job_number + ' · MS BMS';
    $('dCrumbs').innerHTML = `<a href="jobs/designs.html">Design</a> › ${jobLink(jobId, job.job_number)}`;
    $('dTitle').textContent = 'Design · ' + job.job_number + (job.job_name ? ' · ' + job.job_name : '');
    $('dActions').innerHTML = [
      MS.can('DESIGN_ASSIGN') && '<button type="button" class="primary" id="assignBtn">Assign designer</button>',
      canBrief() && '<button type="button" id="briefBtn">Design brief</button>',
      `<a class="btn" href="jobs/job.html?id=${encodeURIComponent(jobId)}">Open work sheet</a>`
    ].filter(Boolean).join('');
    $('dBody').innerHTML = `<div class="notice-bar">This job has no open design task yet. ${MS.can('DESIGN_ASSIGN') ? 'Assign a designer' : canBrief() ? 'Save the design brief' : 'The Head of Graphic Design assigns a designer'} to start one.</div>
      <div class="dgrid"><div class="dpanel"><h3>Job</h3>${MS.kv([['Job', jobLink(jobId, job.job_number), true], ['Job name', job.job_name],
        ['Customer', job.customer ? job.customer.customer_name : job.customer_name], ['Status', job.status ? MS.pill(job.status) : '', true],
        ['Customer deadline', MS.when(job.customer_deadline)], ['Designer', job.people ? job.people.responsible_designer_id : '']])}</div></div>`;
    if ($('assignBtn')) $('assignBtn').addEventListener('click', () => assign(job, null));
    if ($('briefBtn')) $('briefBtn').addEventListener('click', () => brief(job, null));
  }

  async function load() {
    MS.setMsg('dStatus', 'Loading…');
    try {
      if (!taskId && jobId) {
        const r = await MS.call('DESIGN_LIST', { page: 1, page_size: 50, filters: { job_id: jobId }, sort: 'created_at', dir: 'desc' });
        const pick = r.rows.find((x) => OPEN.indexOf(x.status) >= 0) || r.rows.find((x) => x.status !== 'REJECTED') || r.rows[0];
        if (!pick) { MS.setMsg('dStatus', ''); await renderJob(); return; }
        taskId = pick.design_task_id;
        history.replaceState(null, '', 'jobs/design.html?task=' + encodeURIComponent(taskId));
      }
      if (!taskId) throw new Error('No design task was chosen. Open one from the design list.');
      const t = await MS.call('DESIGN_GET', { design_task_id: taskId });
      MS.setMsg('dStatus', '');
      render(t);
    } catch (err) {
      MS.setMsg('dStatus', err.message, 'error');
      $('dBody').innerHTML = '<p><a class="lnk" href="jobs/designs.html">Back to the design list</a></p>';
    }
  }

  MS.boot({ page: 'designs', any: ['DESIGN_VIEW'], ref: true }).then(load);
})();
