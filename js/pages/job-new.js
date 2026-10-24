/* Create job: only the General Manager. Pick an approved proforma invoice (?quotation_id= preselects it); the customer, items and price
   come from it. Tick the sections in the order the job goes through them: the order number shows, the arrows reorder, unticking removes.
   The General Manager never picks subsections: a section forwards to its own when the job reaches it.
   Artwork: "We design it" or "Customer provides the file" (job_file_source); the customer's files are uploaded one by one after the job is saved. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  let proformas = [];
  let route = [];   // section ids, in the order of work
  let picked = [];  // the customer's files chosen on this form

  const sections = () => ((MS.refCache && MS.refCache.sections) || []).filter((s) => s.is_selectable === true).sort((a, b) => a.sequence_no - b.sequence_no);
  const nameOf = (id) => { const s = sections().find((x) => x.section_id === id); return s ? s.section_name : ''; };
  const subsOf = (id) => ((MS.refCache && MS.refCache.subsections) || []).filter((x) => x.section_id === id);

  function drawRoute() {
    $('fAvail').innerHTML = sections().map((s) => `<label class="loc"><input type="checkbox" value="${esc(s.section_id)}"${route.indexOf(s.section_id) >= 0 ? ' checked' : ''}> ${esc(s.section_name)}${subsOf(s.section_id).length ? `<small>has ${subsOf(s.section_id).length} subsections</small>` : ''}</label>`).join('')
      || '<p class="empty">No sections are set up yet.</p>';
    $('fRoute').innerHTML = route.map((id, i) => `<li data-i="${i}"><span class="no">${i + 1}</span><span class="nm">${esc(nameOf(id))}</span>
      <button type="button" data-mv="-1" title="Earlier"${i === 0 ? ' disabled' : ''}>↑</button><button type="button" data-mv="1" title="Later"${i === route.length - 1 ? ' disabled' : ''}>↓</button>
      <button type="button" data-rm="1" title="Remove">✕</button></li>`).join('');
    $('fRouteHint').textContent = route.length ? route.length + ' section' + (route.length === 1 ? '' : 's') + '. Then the Production Department.' : 'Nothing ticked yet.';
  }

  function drawQuote() {
    const box = $('quoteBox');
    const id = $('fQuote').value;
    const q = proformas.find((x) => x.quotation_id === id);
    if (!id || !q) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = 'Loading…';
    MS.call('QUOTATION_GET', { quotation_id: id }).then((d) => {
      if ($('fQuote').value !== id) return;
      box.innerHTML = `<b>${esc(d.customer_name || '')}</b> · ${esc(d.quotation_number)} · ${esc(MS.money(d.total_amount))}
        <div class="tablewrap"><table class="inv"><thead><tr><th>#</th><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th>Specification for the sections (optional)</th></tr></thead><tbody>
        ${(d.items || []).map((it) => `<tr><td>${it.line_no}</td><td class="wrap">${esc(it.description)}</td><td class="num">${esc(MS.num(it.quantity))}</td><td class="num">${esc(MS.money(it.line_total))}</td>
          <td class="specs"><input type="text" data-spec="${it.line_no}" maxlength="500" placeholder="size, colours, material"></td></tr>`).join('')}</tbody></table></div>`;
      const nm = $('fName');
      if (!nm.value.trim() || nm.dataset.auto === '1') {
        nm.value = (d.customer_name || '') + (d.items && d.items[0] ? ' – ' + d.items[0].description : '');
        nm.value = nm.value.slice(0, 160);
        nm.dataset.auto = '1';
      }
    }).catch((e) => { box.textContent = e.message; });
  }

  async function save(e) {
    e.preventDefault();
    const f = $('jobForm');
    const d = MS.formData(f);
    $('fErr').textContent = '';
    if (!d.quotation_id) { $('fErr').textContent = 'Choose the approved proforma invoice.'; return; }
    if (!d.job_name) { $('fErr').textContent = 'Give the job a name.'; return; }
    if (!d.customer_deadline) { $('fErr').textContent = 'Set the customer deadline.'; return; }
    if (!route.length) { $('fErr').textContent = 'Tick at least one section.'; return; }
    const specs = {};
    document.querySelectorAll('[data-spec]').forEach((el) => { if (el.value.trim()) specs[el.dataset.spec] = el.value.trim(); });
    const src = (document.querySelector('input[name=job_file_source]:checked') || {}).value || '';
    if (picked.length && src !== 'CUSTOMER_PROVIDES') { $('fErr').textContent = 'You chose files: tick "Customer provides the file", or clear the files.'; return; }
    const body = { job_file_source: src, quotation_id: d.quotation_id, job_name: d.job_name, customer_deadline: d.customer_deadline, section_ids: route.slice(), notes: d.notes, specifications: specs };
    MS.busy($('fSave'), true, 'Creating…');
    try {
      const j = await MS.call('JOB_CREATE', body);
      const failed = [];
      if (picked.length) {
        const prog = $('fProg'), bar = prog.querySelector('progress'), txt = prog.querySelector('span');
        prog.hidden = false;
        for (let i = 0; i < picked.length; i++) {
          const f = picked[i];
          txt.textContent = 'Uploading ' + (f.name || 'photo') + ' (' + (i + 1) + ' of ' + picked.length + ')';
          bar.value = 0;
          try { await MS.jobFiles.upload(j.job_id, 'CUSTOMER_FILE', f, '', (x) => { bar.value = x; }); } catch (er) { failed.push((f.name || 'photo') + ': ' + er.message); }
        }
      }
      if (failed.length) await MS.alert('The job was created, but these files were not uploaded. Add them on the job page.\n\n' + failed.join('\n'), 'Some files were not uploaded');
      location.replace('jobs/job.html?id=' + encodeURIComponent(j.job_id));
    } catch (err) { $('fErr').textContent = err.message; MS.busy($('fSave'), false); }
  }

  MS.boot({ page: 'job-new', any: ['JOB_CREATE'], ref: true }).then(async () => {
    try {
      const r = await MS.call('QUOTATION_LIST', { awaiting_job: true, page_size: 100, sort: 'quotation_number', dir: 'desc' });
      proformas = r.rows;
    } catch (err) { MS.setMsg('pMsg', err.message, 'error'); return; }
    if (!proformas.length) { $('noProforma').hidden = false; return; }
    const pre = MS.param('quotation_id') || MS.param('quotation');
    $('fQuote').innerHTML = MS.options(proformas.map((q) => ({ value: q.quotation_id, label: q.quotation_number + ' · ' + (q.customer_name || '') + ' · ' + MS.money(q.total_amount) })),
      proformas.some((q) => q.quotation_id === pre) ? pre : '', '— choose the approved proforma invoice —');
    if (pre && !proformas.some((q) => q.quotation_id === pre)) MS.setMsg('pMsg', 'That proforma invoice is not waiting for a job card (it may already have one).', 'error');
    const dl = new Date(Date.now() + 7 * 864e5); dl.setHours(17, 0, 0, 0);
    $('fDeadline').value = MS.toLocalInput(dl.toISOString());
    $('jobForm').hidden = false;
    drawRoute();
    drawQuote();
    $('fQuote').addEventListener('change', drawQuote);
    $('fName').addEventListener('input', () => { $('fName').dataset.auto = '0'; });
    $('fAvail').addEventListener('change', (e) => {
      const id = e.target.value;
      const i = route.indexOf(id);
      if (e.target.checked && i < 0) route.push(id);
      if (!e.target.checked && i >= 0) route.splice(i, 1);
      drawRoute();
    });
    $('fRoute').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const i = Number(b.closest('li').dataset.i);
      if (b.dataset.rm) route.splice(i, 1);
      else { const j = i + Number(b.dataset.mv); if (j >= 0 && j < route.length) { const t = route[i]; route[i] = route[j]; route[j] = t; } }
      drawRoute();
    });
    $('jobForm').addEventListener('submit', save);
    const drawFiles = () => { $('fFileList').innerHTML = picked.map((f) => '<li>' + esc(f.name || 'photo') + ' · ' + MS.jobFiles.size(f.size) + '</li>').join(''); };
    document.querySelectorAll('input[name=job_file_source]').forEach((r) => r.addEventListener('change', () => { $('fFilesBox').hidden = r.value !== 'CUSTOMER_PROVIDES' || !r.checked; }));
    $('fFiles').addEventListener('change', () => { picked = Array.from($('fFiles').files); drawFiles(); });
    $('fPhoto').addEventListener('click', () => $('fCam').click());
    $('fCam').addEventListener('change', () => { picked = picked.concat(Array.from($('fCam').files)); $('fCam').value = ''; drawFiles(); });
  });
})();
