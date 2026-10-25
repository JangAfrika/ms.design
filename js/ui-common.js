/* Small helpers shared by the HR, management, admin and job pages (they used to live in the Stores and Delivery scripts):
   MS.sc = list pager and tabs, the "one document" dialog, the reason/note dialog and an editable lines table;
   MS.dc = values read from dialog inputs, empty-value clean-up, picture shrinking and file download. */
(function () {
  const MS = window.MS;
  const esc = (s) => MS.esc(s);
  const sc = (MS.sc = {});
  const dc = (MS.dc = {});

  sc.pager = (boxId, r, state, load) => {
    const box = MS.$(boxId);
    const pages = Math.max(1, Math.ceil(r.total / (r.page_size || 50)));
    box.innerHTML = pages > 1 ? `<button type="button" data-p="-1"${state.page <= 1 ? ' disabled' : ''}>Previous</button><span>Page ${state.page} of ${pages}</span><button type="button" data-p="1"${state.page >= pages ? ' disabled' : ''}>Next</button>` : '';
    box.onclick = (e) => { const b = e.target.closest('[data-p]'); if (b) { state.page += Number(b.dataset.p); load(); } };
  };

  sc.tabs = (boxId, state, load) => {
    MS.$(boxId).addEventListener('click', (e) => {
      const b = e.target.closest('button[data-tab]');
      if (!b) return;
      sc.setTab(boxId, b.dataset.tab, state);
      state.page = 1;
      load();
    });
  };
  sc.setTab = (boxId, tab, state) => {
    MS.$(boxId).querySelectorAll('button[data-tab]').forEach((x) => x.classList.toggle('on', x.dataset.tab === tab));
    state.tab = tab;
  };

  sc.history = (list) => ((list || []).length ? `<div class="dpanel wide"><h3>History</h3><ul class="mini-list">${list.map((h) =>
    `<li><span>${esc(MS.label(h.action))}${h.reason ? ' – ' + esc(h.reason) : ''}</span><span class="n">${esc(h.by)} · ${esc(MS.when(h.at))}</span></li>`).join('')}</ul></div>` : '');

  sc.journals = (list) => ((list || []).length && MS.can('FINANCE_VIEW') ? `<div class="dpanel wide"><p class="fin-note">In the books: ${list.map((e) =>
    MS.lnk('finance/accounts.html?journal=' + encodeURIComponent(e.journal_entry_id), e.entry_number)).join(', ')}</p></div>` : '');

  sc.unit = (u) => (u ? ' ' + esc(MS.label(u).toLowerCase()) : '');

  /* ---------- the "one document" dialog ---------- */
  function ensureView() {
    if (MS.$('viewDialog')) return MS.$('viewDialog');
    const d = document.createElement('dialog');
    d.id = 'viewDialog';
    d.className = 'fin-wide';
    d.innerHTML = '<div class="dlg"><div id="viewBody"></div><div class="err" id="viewError"></div><div class="btns" id="viewBtns"></div></div>';
    document.querySelector('.main').appendChild(d);
    return d;
  }
  /** Opens the dialog with "Loading…", runs get(); draws with draw(doc) => {html, buttons:[[id, label, cls, fn]]}. */
  sc.view = async function (get, draw) {
    const dlg = ensureView();
    MS.$('viewError').textContent = '';
    MS.$('viewBody').innerHTML = '<p class="fin-note">Loading…</p>';
    MS.$('viewBtns').innerHTML = '';
    if (!dlg.open) dlg.showModal();
    let doc;
    try { doc = await get(); } catch (err) {
      MS.$('viewBody').innerHTML = '';
      MS.$('viewError').textContent = err.message;
      MS.$('viewBtns').innerHTML = '<button type="button" id="vClose">Close</button>';
      MS.$('vClose').onclick = () => dlg.close();
      return null;
    }
    const out = draw(doc);
    MS.$('viewBody').innerHTML = out.html;
    const btns = [['vClose', 'Close', '', () => dlg.close()]].concat((out.buttons || []).filter(Boolean));
    MS.$('viewBtns').innerHTML = btns.map((b) => `<button type="button" id="${b[0]}"${b[2] ? ` class="${b[2]}"` : ''}>${esc(b[1])}</button>`).join('');
    btns.forEach((b) => { MS.$(b[0]).onclick = () => b[3](MS.$(b[0])); });
    if (out.after) out.after();
    return doc;
  };
  sc.viewError = (msg) => { if (MS.$('viewError')) MS.$('viewError').textContent = msg; };
  sc.closeView = () => { const d = MS.$('viewDialog'); if (d && d.open) d.close(); };

  /* ---------- reason / note dialog ---------- */
  function ensureNote() {
    if (MS.$('noteDialog')) return MS.$('noteDialog');
    const d = document.createElement('dialog');
    d.id = 'noteDialog';
    d.innerHTML = `<form class="dlg" id="noteForm" novalidate>
      <h3 id="noteTitle">Reason</h3>
      <div class="info" id="noteInfo"></div>
      <div id="noteExtra"></div>
      <label id="noteLabel">Reason <textarea id="noteText" rows="3" maxlength="300"></textarea></label>
      <div class="err" id="noteError"></div>
      <div class="btns"><button type="button" id="noteCancel">Cancel</button><button type="submit" class="primary" id="noteSave">Save</button></div>
    </form>`;
    document.querySelector('.main').appendChild(d);
    return d;
  }
  /** o: {title, info, extra (html), label, required, danger, button, noText, wide, run(text) => Promise}. Resolves true when saved. */
  sc.ask = (o) => new Promise((resolve) => {
    ensureNote();
    const f = MS.$('noteForm');
    f.reset();
    MS.$('noteDialog').classList.toggle('fin-wide', !!o.wide);
    MS.$('noteTitle').textContent = o.title;
    MS.$('noteInfo').textContent = o.info || '';
    MS.$('noteInfo').hidden = !o.info;
    MS.$('noteExtra').innerHTML = o.extra || '';
    MS.$('noteLabel').hidden = !!o.noText;
    MS.$('noteLabel').firstChild.textContent = (o.label || 'Reason') + ' ';
    MS.$('noteLabel').classList.toggle('req', !!o.required);
    MS.$('noteError').textContent = '';
    MS.$('noteSave').textContent = o.button || 'Save';
    MS.$('noteSave').className = o.danger ? 'danger-solid' : 'primary';
    const dlg = MS.openDialog('noteDialog');
    let done = false;
    f.onsubmit = async (e) => {
      e.preventDefault();
      const t = MS.$('noteText').value.trim();
      if (o.required && !o.noText && !t) { MS.$('noteError').textContent = 'Please fill this in.'; return; }
      MS.busy(MS.$('noteSave'), true, 'Saving…');
      try { await o.run(t); done = true; dlg.close(); } catch (err) { MS.$('noteError').textContent = err.message; } finally { MS.busy(MS.$('noteSave'), false); }
    };
    MS.$('noteCancel').onclick = () => dlg.close();
    dlg.addEventListener('close', () => resolve(done), { once: true });
  });

  /**
   * An editable table of lines. cols: [{f, label, type: 'select'|'number'|'text', options: (row) => html, cls, num}].
   * Returns {items()} with every row that has something filled in.
   */
  sc.lines = (box, cols, rows, onChange) => {
    box.innerHTML = `<div class="tablewrap"><table class="inv lines"><thead><tr>${cols.map((c) => `<th${c.num ? ' class="num"' : ''}>${esc(c.label)}</th>`).join('')}<th></th></tr></thead><tbody></tbody></table></div>
      <div class="lines-foot"><button type="button" class="add-line">Add line</button><span class="lines-total"></span></div>`;
    const body = box.querySelector('tbody');
    const read = (tr) => { const o = {}; cols.forEach((c) => { const el = tr.querySelector('[data-f=' + c.f + ']'); o[c.f] = c.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value.trim(); }); return o; };
    const changed = () => { if (onChange) onChange(Array.from(body.querySelectorAll('tr')).map(read), box.querySelector('.lines-total')); };
    function addRow(r) {
      r = r || {};
      const tr = document.createElement('tr');
      tr.innerHTML = cols.map((c) => `<td class="${c.cls || ''}">${c.type === 'select' ? `<select data-f="${c.f}" aria-label="${esc(c.label)}">${c.options(r)}</select>`
        : `<input data-f="${c.f}" type="${c.type === 'number' ? 'number' : 'text'}"${c.type === 'number' ? ' min="0" step="any"' : ' maxlength="300"'} value="${esc(r[c.f] == null ? '' : r[c.f])}" aria-label="${esc(c.label)}"${c.placeholder ? ` placeholder="${esc(c.placeholder)}"` : ''}>`}</td>`).join('') +
        '<td><button type="button" class="x" title="Remove line" aria-label="Remove line">×</button></td>';
      tr.querySelector('.x').addEventListener('click', () => { tr.remove(); if (!body.children.length) addRow(); changed(); });
      tr.addEventListener('input', changed);
      tr.addEventListener('change', (e) => { const c = cols.find((x) => x.f === e.target.dataset.f); if (c && c.onPick) c.onPick(tr, e.target.value); changed(); });
      body.appendChild(tr);
      changed();
    }
    (rows && rows.length ? rows : [{}]).forEach(addRow);
    box.querySelector('.add-line').addEventListener('click', () => addRow());
    return { items: () => Array.from(body.querySelectorAll('tr')).map(read).filter((o) => cols.some((c) => o[c.f] !== '' && o[c.f] != null)) };
  };

  /** A table of existing lines with one quantity box each (issue, return, approve, receive). */
  sc.qtyTable = (head, rows, cell) => `<div class="tablewrap"><table class="inv lines"><thead><tr>${head.map((h) => `<th${h[1] ? ' class="num"' : ''}>${esc(h[0])}</th>`).join('')}</tr></thead><tbody>${rows.map(cell).join('')}</tbody></table></div>`;
  sc.qtyValues = (attr) => Array.from(document.querySelectorAll('#noteExtra input[' + attr + ']')).map((el) => ({ id: el.getAttribute(attr), value: el.value === '' ? '' : Number(el.value), el }));

  /* values read from the inputs of a dialog drawn by MS.sc.ask({extra}) */
  dc.val = (id) => { const el = MS.$(id); return el ? el.value.trim() : ''; };
  dc.num = (id) => { const v = dc.val(id); return v === '' ? '' : Number(v); };
  dc.iso = (id) => MS.fromLocalInput(dc.val(id));
  dc.nowInput = () => MS.toLocalInput(new Date().toISOString());
  /* leaves out empty values so the server applies its own defaults */
  dc.clean = (o) => { Object.keys(o).forEach((k) => { if (o[k] === '' || o[k] == null) delete o[k]; }); return o; };
  dc.warn = (r, msgId) => { if (r && r.warnings && r.warnings.length && MS.$(msgId)) MS.setMsg(msgId, 'Saved. Please note: ' + r.warnings.join(' '), 'ok'); };
  /* a photo from the phone camera can be several MB: shrink pictures to 1600 px wide JPEGs before they are sent; other files go as they are */
  dc.prepFile = (file) => new Promise((resolve, reject) => {
    const plain = () => MS.fileForUpload(file).then(resolve, reject);
    if (!file || !/^image\/(jpeg|png|webp)/.test(file.type) || file.size < 400 * 1024) return plain();
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => {
        if (!b) return plain();
        MS.blobToBase64(b).then((base64) => resolve({ file_name: file.name.replace(/\.\w+$/, '') + '.jpg', mime_type: 'image/jpeg', base64 }), reject);
      }, 'image/jpeg', 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); plain(); };
    img.src = url;
  });

  /* downloads a stored document through the API (Drive is never exposed directly) */
  dc.openDocument = async (docId, msgId) => {
    if (msgId) MS.setMsg(msgId, 'Getting the file…');
    try {
      const r = await MS.call('DOCUMENT_GET', { document_id: docId });
      if (msgId) MS.setMsg(msgId, '');
      if (r.too_large) return MS.alert(r.message, 'File too large to download here');
      const bytes = atob(r.base64), arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([arr], { type: r.mime_type }));
      const a = document.createElement('a');
      a.href = url; a.download = r.document.file_name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) { if (msgId) MS.setMsg(msgId, err.message, 'error'); else MS.alert(err.message); }
  };
  dc.docLink = (doc) => (doc ? `<a class="lnk" href="#" data-doc="${esc(doc.document_id)}">${esc(doc.file_name)}</a>` : '');

  /* ---------- jobs: the progress bar and the "where it is" text used by the job lists and cards ---------- */
  MS.jobProg = (j) => `<div class="prog${j.overdue ? ' late' : ''}" title="${esc((j.sections_done || 0) + ' of ' + (j.sections_total || 0) + ' sections done')}"><span class="bar"><i style="width:${Math.max(0, Math.min(100, Number(j.progress_pct) || 0))}%"></i></span><span class="pct">${Number(j.progress_pct) || 0}%</span></div>`;
  MS.jobWhere = (j) => (j.status === 'ON_HOLD' ? 'On hold' + (j.location ? ' (' + j.location + ')' : '') : j.status === 'DONE' ? 'Done' : j.status === 'CANCELLED' ? 'Cancelled' : j.location || '');
})();
