/* Shared by the stores and purchasing pages: list pager and tabs, the "one document" dialog, the reason/note dialog,
   history, movements and journal links. */
(function () {
  const MS = window.MS;
  const esc = (s) => MS.esc(s);
  const sc = (MS.sc = {});

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

  sc.movements = (list, opts) => {
    opts = opts || {};
    if (!(list || []).length) return `<p class="fin-note">${esc(opts.empty || 'No stock movements yet.')}</p>`;
    const cost = list.some((m) => m.unit_cost !== undefined);
    return `<div class="tablewrap"><table class="inv"><thead><tr><th>When</th>${opts.item ? '<th>Item</th>' : ''}<th>Movement</th><th>Document</th><th>Job</th><th class="num">In / out</th>${opts.balance ? '<th class="num">Balance</th>' : ''}${cost ? '<th class="num">Unit cost</th><th class="num">Value</th>' : ''}<th>By</th></tr></thead><tbody>
      ${list.map((m) => `<tr>
        <td>${esc(MS.when(m.movement_at))}</td>
        ${opts.item ? `<td>${esc(m.item_name)}</td>` : ''}
        <td>${esc(MS.label(m.movement_type))}${m.notes ? `<div class="sub">${esc(m.notes)}</div>` : ''}</td>
        <td>${m.document_href ? MS.lnk(m.document_href, m.document) : esc(m.document || '')}</td>
        <td>${m.job_id ? MS.lnk('jobs/job.html?id=' + encodeURIComponent(m.job_id), m.job_number) : ''}</td>
        <td class="num">${m.signed_quantity > 0 ? '+' : ''}${esc(MS.num(m.signed_quantity))}${sc.unit(m.unit)}</td>
        ${opts.balance ? `<td class="num">${esc(MS.num(m.balance_after))}</td>` : ''}
        ${cost ? `<td class="num">${MS.money(m.unit_cost)}</td><td class="num">${MS.money(m.total_value)}</td>` : ''}
        <td>${esc(m.by_name || '')}</td></tr>`).join('')}
      </tbody></table></div>`;
  };

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
  /** o: {title, info, extra (html), label, required, danger, button, noText, run(text) => Promise}. Resolves true when saved. */
  sc.ask = (o) => new Promise((resolve) => {
    ensureNote();
    const f = MS.$('noteForm');
    f.reset();
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

  /* reference lists for the purchasing screens (suppliers, items, expense accounts), once per visit */
  let ref = null;
  sc.ref = async (force) => { if (!ref || force) ref = MS.call('PROCUREMENT_REF_GET', {}); return ref; };
})();
