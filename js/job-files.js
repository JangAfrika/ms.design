/* Files on the job card: the panel (upload with progress, camera, versions, open / download, delete, proof history) and the dialogs that go with it:
   Verified / Not OK for a customer's own file, Send to customer for approval, the General Manager's override, who makes the artwork.
   Every button comes from the server (`files_panel.can`, `work`): this file only draws what the server says may be done.
   Files are never opened as pages: "Download" saves them; only plain images and PDFs open in a new tab, from a blob of their real type. */
(function () {
  const MS = window.MS;
  const esc = (s) => MS.esc(s);
  const jf = (MS.jobFiles = {});
  const ask = (o) => MS.sc.ask(o);
  const val = (id) => MS.dc.val(id);
  const CAT = { CUSTOMER_FILE: 'Customer file', DESIGN: 'Design', PROOF: 'Proof', OTHER: 'Other' };
  const SOURCE = { CUSTOMER_PROVIDES: 'Customer provides the file', WE_DESIGN: 'We design it' };
  const size = (n) => (n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1) + ' MB');
  jf.size = size;
  jf.CAT = CAT;

  /* ---------- the bytes ---------- */
  const bytesOf = (r) => { const bin = atob(r.base64), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return arr; };

  /** Saves the file to the device (a download, never shown as a page). */
  jf.save = async (id) => {
    const r = await MS.call('JOB_FILE_GET', { job_file_id: id });
    if (r.too_large) return MS.alert(r.message, 'File too large to download here');
    const url = URL.createObjectURL(new Blob([bytesOf(r)], { type: 'application/octet-stream' }));
    const a = document.createElement('a');
    a.href = url; a.download = r.file_name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 20000);
  };

  /** Opens a picture or PDF in a new tab (a blob of its real type). Anything else is saved instead. */
  jf.open = async (id, kind) => {
    if (kind !== 'image' && kind !== 'pdf') return jf.save(id);
    const w = window.open('', '_blank');
    try {
      const r = await MS.call('JOB_FILE_GET', { job_file_id: id });
      if (r.too_large) { if (w) w.close(); return MS.alert(r.message, 'File too large to download here'); }
      const url = URL.createObjectURL(new Blob([bytesOf(r)], { type: r.mime_type }));
      if (w) { w.location.href = url; } else { const a = document.createElement('a'); a.href = url; a.download = r.file_name; document.body.appendChild(a); a.click(); a.remove(); }
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    } catch (err) { if (w) w.close(); MS.alert(err.message); }
  };

  /** One file to the server with a progress callback (0..1). Resolves to the new panel. */
  jf.upload = (jobId, category, file, note, onProgress) => new Promise((resolve, reject) => {
    const cfg = window.APP_CONFIG || {};
    const s = MS.store.read();
    MS.blobToBase64(file).then((base64) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', cfg.SCRIPT_URL);
      xhr.setRequestHeader('Content-Type', 'text/plain;charset=utf-8');
      xhr.timeout = 600000;
      xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
      xhr.onerror = () => reject(new Error(navigator.onLine ? 'Could not reach the server. Check your connection and try again.' : 'You are offline. Connect to the internet to continue.'));
      xhr.ontimeout = () => reject(new Error('The upload took too long. Try a smaller file or a better connection.'));
      xhr.onload = () => {
        let out;
        try { out = JSON.parse(xhr.responseText); } catch (e) { return reject(new Error('Unexpected reply from the server.')); }
        if (out.success) { MS.store.dropCache(); return resolve(out.data); }
        reject(new Error(out.message || 'The file could not be uploaded.'));
      };
      xhr.send(JSON.stringify({ action: 'JOB_FILE_UPLOAD', token: s ? s.token : '', request_id: 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2),
        payload: { job_id: jobId, category, file_name: file.name || ('photo-' + Date.now() + '.jpg'), mime_type: file.type || '', base64, note: note || '' } }));
    }, () => reject(new Error('The file could not be read.')));
  });

  /* ---------- the panel ---------- */
  const banner = (cls, html) => `<div class="notice-bar ${cls}">${html}</div>`;

  function gates(j, p) {
    const out = [];
    const v = p.verification, pr = p.proof, c = p.can;
    if (v.applies) {
      if (v.verified_at) out.push(banner('ok', `<b>The customer's file was verified</b> by ${esc(v.verified_by_name)} on ${esc(MS.when(v.verified_at))}.`));
      else if (v.graphic_now) {
        out.push(banner('', `<b>Check the customer's file.</b> Open it, and click <b>Verified</b> if it is good to print, or <b>Not OK</b> to send the job back to the General Manager with the reason.` +
          `<div class="gate-btns">${c.verify ? '<button type="button" class="primary" data-jf="verify">Verified</button>' : ''}${c.reject ? '<button type="button" class="danger" data-jf="notok">Not OK – send back to GM</button>' : ''}</div>` +
          (c.verify_blocked ? `<div class="sub">${esc(c.verify_blocked)}</div>` : '')));
      } else out.push(banner('info', `The customer provides the file. The Graphic Section checks it when the job reaches it.`));
    }
    if (pr.applies) {
      if (pr.approved) out.push(banner('ok', `<b>The customer approved the design.</b> ${p.proofs.filter((x) => x.status === 'APPROVED').slice(0, 1).map((x) => esc(x.respondent_name) + ', ' + esc(MS.when(x.responded_at))).join('')}`));
      else if (pr.override) out.push(banner('', `<b>The General Manager allowed the Graphic Section to finish without the customer's approval</b> (${esc(pr.override.by_name)}, ${esc(MS.when(pr.override.at))}): ${esc(pr.override.reason)}`));
      else if (pr.graphic_now) {
        const last = p.proofs[0];
        out.push(banner('', `<b>Waiting for the customer's approval.</b> ${last ? (last.status === 'SENT' ? 'Proof ' + last.proof_no + ' was sent ' + esc(MS.when(last.sent_at)) + ' to ' + esc(last.sent_to) + '.' : last.status === 'CHANGES_REQUESTED' ? 'The customer asked for changes to proof ' + last.proof_no + '. Upload the new version and send it again.' : last.status === 'EXPIRED' ? 'The link of proof ' + last.proof_no + ' expired. Send it again.' : '') : 'Upload the design, then send it to the customer.'} The Graphic Section can be completed only after they approve.` +
          `<div class="gate-btns">${c.send_proof ? '<button type="button" class="primary" data-jf="proof">Send to customer for approval</button>' : ''}${c.override ? '<button type="button" data-jf="override">Override (General Manager)…</button>' : ''}</div>` +
          (!c.send_proof && c.send_proof_blocked ? `<div class="sub">${esc(c.send_proof_blocked)}</div>` : '')));
      } else out.push(banner('info', 'We design this job. The Graphic Section sends the design to the customer, who approves it before the section can be completed.'));
    }
    return out.join('');
  }

  function uploadBox(j, p) {
    const cats = p.can.categories;
    if (!cats.length) {
      const why = MS.can('JOB_FILE_UPLOAD') ? (p.can.upload_blocks.DESIGN || p.can.upload_blocks.OTHER) : '';
      return why ? `<p class="hint">${esc(why)}</p>` : '';
    }
    return `<form class="jf-upload" id="jfForm" novalidate>
      <label>Type <select id="jfCat">${cats.map((c) => `<option value="${c}"${c === (cats.indexOf('CUSTOMER_FILE') >= 0 && p.source === 'CUSTOMER_PROVIDES' ? 'CUSTOMER_FILE' : cats.indexOf('DESIGN') >= 0 ? 'DESIGN' : cats[0]) ? ' selected' : ''}>${CAT[c]}</option>`).join('')}</select></label>
      <label class="grow">Note (optional) <input id="jfNote" type="text" maxlength="300" placeholder="For example: final colours"></label>
      <div class="jf-pick"><input id="jfFile" type="file" multiple aria-label="Choose files"><button type="button" data-jf="photo">Take a photo</button><input id="jfCam" type="file" accept="image/*" capture="environment" hidden></div>
      <button type="submit" class="primary" id="jfGo">Upload</button>
      <div class="jf-prog" id="jfProg" hidden><progress max="1" value="0"></progress><span></span></div>
      <p class="hint">Any file up to ${p.limits.max_mb} MB. Programs, scripts and web pages are not accepted. Uploading the same name again makes version 2; the old one is kept.</p>
    </form>`;
  }

  function fileRows(j, p) {
    if (!p.files.length) return '<p class="empty">No files yet.</p>';
    return `<div class="tablewrap"><table class="inv jf-table"><thead><tr><th>File</th><th>Type</th><th>Ver.</th><th class="num">Size</th><th>Uploaded</th><th></th></tr></thead><tbody>${p.files.map((f) =>
      `<tr class="${f.is_latest ? '' : 'old'}"><td class="wrap"><b>${esc(f.file_name)}</b>${f.approved_at ? ` <span class="pill good">Approved by ${esc(f.approved_by_name)}</span>` : ''}${f.note ? `<div class="sub">${esc(f.note)}</div>` : ''}</td>
        <td>${esc(CAT[f.category] || f.category)}</td><td>v${f.version_no}${f.is_latest ? '' : ' <span class="sub">(older)</span>'}</td><td class="num">${size(f.size_bytes)}</td>
        <td class="wrap">${esc(f.uploaded_by_name)}<div class="sub">${esc(MS.when(f.uploaded_at))}</div></td>
        <td class="jf-act">${f.kind === 'image' || f.kind === 'pdf' ? `<button type="button" data-jf="open" data-id="${esc(f.job_file_id)}" data-kind="${f.kind}">Open</button>` : ''}<button type="button" data-jf="save" data-id="${esc(f.job_file_id)}">Download</button>${f.can_delete ? `<button type="button" class="danger" data-jf="del" data-id="${esc(f.job_file_id)}" data-name="${esc(f.file_name)}">Delete</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function proofRows(p) {
    if (!p.proofs.length) return '';
    const label = { SENT: 'Waiting for the customer', APPROVED: 'Approved', CHANGES_REQUESTED: 'Changes requested', SUPERSEDED: 'Replaced by a newer proof', EXPIRED: 'Link expired' };
    return `<h4>Sent to the customer</h4><div class="tablewrap"><table class="inv jf-table"><thead><tr><th>Proof</th><th>Sent</th><th>Files</th><th>Answer</th></tr></thead><tbody>${p.proofs.map((x) =>
      `<tr><td><b>#${x.proof_no}</b></td><td class="wrap">${esc(MS.when(x.sent_at))}<div class="sub">${esc(x.sent_by_name)} to ${esc(x.sent_to)}${x.views ? ' · opened ' + x.views + ' time' + (x.views === 1 ? '' : 's') : ''}</div></td>
        <td class="wrap">${x.files.map((f) => esc(f.file_name) + ' v' + f.version_no).join('<br>')}</td>
        <td class="wrap">${MS.pill(x.status === 'SENT' ? 'PENDING' : x.status === 'APPROVED' ? 'APPROVED' : x.status === 'CHANGES_REQUESTED' ? 'RETURNED' : 'CLOSED', label[x.status] || x.status)}
          ${x.responded_at ? `<div class="sub">${esc(x.respondent_name)} · ${esc(MS.when(x.responded_at))}</div>` : ''}${x.comment ? `<div class="cm">${esc(x.comment)}</div>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
  }

  /** The Files panel of the job card as html. */
  jf.panel = (j) => {
    const p = j.files_panel;
    if (!p) return '';
    return `<div class="dpanel wide files-panel" id="jfPanel"><h3>Files</h3>
      <div class="jf-source">Artwork: <b>${esc(p.source_label)}</b>${p.can.set_source ? ' <button type="button" data-jf="source">Change</button>' : ''}</div>
      ${gates(j, p)}${uploadBox(j, p)}${fileRows(j, p)}${proofRows(p)}</div>`;
  };

  /* ---------- dialogs ---------- */
  const fileButtons = (files) => `<div class="jf-pick-list">${files.map((f) => `<div><b>${esc(f.file_name)}</b> <span class="sub">v${f.version_no} · ${size(f.size_bytes)}</span>
    ${f.kind === 'image' || f.kind === 'pdf' ? `<button type="button" data-jfx="open" data-id="${esc(f.job_file_id)}" data-kind="${f.kind}">Open</button>` : ''}<button type="button" data-jfx="save" data-id="${esc(f.job_file_id)}">Download</button></div>`).join('')}</div>`;
  function wireDialogFiles() {
    const box = MS.$('noteExtra');
    box.onclick = (e) => {
      const b = e.target.closest('[data-jfx]');
      if (!b) return;
      (b.dataset.jfx === 'open' ? jf.open(b.dataset.id, b.dataset.kind) : jf.save(b.dataset.id)).catch((err) => MS.alert(err.message));
    };
  }

  jf.verify = async (j) => {
    const p = await MS.call('JOB_FILE_LIST', { job_id: j.job_id });
    const files = p.files.filter((f) => f.category === 'CUSTOMER_FILE' && f.is_latest);
    const r = ask({ title: 'Verified', info: `${j.job_number} · ${j.job_name}. Look at the customer's file. If it is good to print, click Verified: this section is then complete and the job goes to the next section.`,
      extra: files.length ? fileButtons(files) : '<p class="empty">There is no customer file on this job yet.</p>', label: 'Comment (optional)', button: 'Verified',
      run: (t) => MS.call('JOB_FILE_VERIFY', { job_id: j.job_id, comment: t }) });
    wireDialogFiles();
    return r;
  };

  jf.notOk = async (j) => {
    const p = await MS.call('JOB_FILE_LIST', { job_id: j.job_id });
    const files = p.files.filter((f) => f.category === 'CUSTOMER_FILE' && f.is_latest);
    const r = ask({ title: 'Not OK – send back to the General Manager', info: `${j.job_number} will be put on hold and the General Manager is told. Say what is wrong with the customer's file.`,
      extra: files.length ? fileButtons(files) : '', label: 'What is wrong', required: true, danger: true, button: 'Send back',
      run: (t) => MS.call('JOB_FILE_REJECT', { job_id: j.job_id, reason: t }) });
    wireDialogFiles();
    return r;
  };

  jf.sendProof = async (j) => {
    const d = await MS.call('JOB_PROOF_PREPARE', { job_id: j.job_id });
    let result = null;
    const ok = await ask({ title: 'Send to customer for approval', wide: true,
      info: `${d.job_number} · ${d.customer_name}. The customer gets an email with a private link, looks at the design with no sign-in, and approves it or asks for changes. It goes out as "${d.sender_name}" and replies come to ${d.reply_to || 'you'}.${d.email_enabled ? '' : ' Email is switched off in the system settings: you will get the link to pass on yourself.'}`,
      extra: `<div class="jf-send"><label class="req">Customer's email <input id="pTo" type="email" value="${esc(d.to)}" maxlength="200" placeholder="customer@example.com"></label>
        <label>Copy to (optional) <input id="pCc" type="text" maxlength="200"></label>
        <label>Subject <input id="pSub" type="text" maxlength="200" value="${esc(d.subject)}"></label>
        <fieldset><legend>Files the customer will see</legend>${d.files.map((f) => `<label class="chk"><input type="checkbox" class="pfile" value="${esc(f.job_file_id)}"${f.selected ? ' checked' : ''}${f.too_large ? ' data-big="1"' : ''}> ${esc(f.file_name)} <span class="sub">v${f.version_no} · ${size(f.size_bytes)}${f.too_large ? ' · too big to show on the customer page (over ' + d.public_max_mb + ' MB)' : ''}</span></label>`).join('') || '<p class="empty">No design files yet.</p>'}</fieldset>
        <label class="req">Message <textarea id="pMsg2" rows="7" maxlength="3000">${esc(d.message)}</textarea></label></div>`,
      noText: true, button: 'Send to customer',
      run: async () => {
        const ids = Array.from(document.querySelectorAll('.pfile:checked')).map((x) => x.value);
        if (!ids.length) throw new Error('Tick at least one file.');
        if (!val('pTo')) throw new Error('Type the customer\'s email address.');
        result = await MS.call('JOB_PROOF_SEND', { job_id: j.job_id, job_file_ids: ids, to: val('pTo'), cc: val('pCc'), subject: val('pSub'), message: MS.$('pMsg2').value });
      } });
    if (ok && result && result.send_result && result.send_result.delivery === 'NOT_SENT') {
      await MS.alert('The design proof is saved, but it was not emailed because email is switched off.', 'Not emailed');
    }
    return ok;
  };

  jf.override = (j) => ask({ title: 'Override the customer\'s approval', danger: true, button: 'Override',
    info: `${j.job_number}: the Graphic Section will be able to finish without the customer approving the design. The reason is kept on the job and in the audit log.`,
    label: 'Reason', required: true, run: (t) => MS.call('JOB_PROOF_OVERRIDE', { job_id: j.job_id, reason: t }) });

  jf.source = (j) => ask({ title: 'Who makes the artwork?', info: j.job_number + ' · ' + j.job_name,
    extra: `<label>Artwork <select id="srcSel">${Object.keys(SOURCE).map((k) => `<option value="${k}"${(j.job_file_source || '') === k ? ' selected' : ''}>${SOURCE[k]}</option>`).join('')}</select></label>`,
    label: 'Reason (optional)', button: 'Save', run: (t) => MS.call('JOB_FILE_SOURCE_SET', { job_id: j.job_id, job_file_source: val('srcSel'), reason: t }) });

  /* ---------- clicks, upload ---------- */
  /** box: an element that contains the panel (the job body). find() gives the current job; after() redraws the page. */
  jf.wire = (box, find, after) => {
    box.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-jf]');
      if (!b || !box.contains(b)) return;
      const j = find();
      const a = b.dataset.jf;
      try {
        let changed = false;
        if (a === 'save') await jf.save(b.dataset.id);
        else if (a === 'open') await jf.open(b.dataset.id, b.dataset.kind);
        else if (a === 'photo') { MS.$('jfCam').click(); }
        else if (a === 'verify') changed = await jf.verify(j);
        else if (a === 'notok') changed = await jf.notOk(j);
        else if (a === 'proof') changed = await jf.sendProof(j);
        else if (a === 'override') changed = await jf.override(j);
        else if (a === 'source') changed = await jf.source(j);
        else if (a === 'del') {
          changed = await ask({ title: 'Delete the file', info: b.dataset.name + ' is hidden from the job. A copy is kept in Google Drive.', label: 'Reason (needed if it is not your own upload)', danger: true, button: 'Delete',
            run: (t) => MS.call('JOB_FILE_DELETE', { job_file_id: b.dataset.id, reason: t }) });
        }
        if (changed) after();
      } catch (err) { MS.alert(err.message); }
    });
    box.addEventListener('change', (e) => {
      if (e.target.id === 'jfCam' && e.target.files.length) { const dt = new DataTransfer(); Array.from(MS.$('jfFile').files).concat(Array.from(e.target.files)).forEach((f) => dt.items.add(f)); MS.$('jfFile').files = dt.files; }
    });
    box.addEventListener('submit', async (e) => {
      if (e.target.id !== 'jfForm') return;
      e.preventDefault();
      const j = find();
      const files = Array.from(MS.$('jfFile').files);
      if (!files.length) return MS.alert('Choose a file first, or take a photo.', 'No file chosen');
      const prog = MS.$('jfProg'), bar = prog.querySelector('progress'), txt = prog.querySelector('span');
      prog.hidden = false;
      MS.busy(MS.$('jfGo'), true, 'Uploading…');
      let done = 0;
      const failed = [];
      for (const f of files) {
        txt.textContent = `Uploading ${f.name || 'photo'} (${done + 1} of ${files.length}) · ${size(f.size)}`;
        bar.value = 0;
        try { await jf.upload(j.job_id, val('jfCat'), f, val('jfNote'), (x) => { bar.value = x; if (x >= 1) txt.textContent = `Saving ${f.name || 'photo'} to Google Drive…`; }); done++; } catch (err) { failed.push(f.name + ': ' + err.message); }
      }
      MS.busy(MS.$('jfGo'), false);
      if (failed.length) await MS.alert(failed.join('\n'), done ? 'Some files were not uploaded' : 'The file was not uploaded');
      if (done) after();
      else prog.hidden = true;
    });
  };
})();
