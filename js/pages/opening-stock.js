/* Opening stock: the Stores Officer enters what was on the shelves on the opening date (many lines, or a pasted / uploaded
   list of item code, quantity, unit cost); the Finance Manager (FINANCE_APPROVE, never the person who entered it) checks it
   and posts it: OPENING stock movements and one journal, Dr 1200 Inventory / Cr 3010 Owner's capital, dated the opening date. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const sc = MS.sc;
  const count = (n, word, plural) => MS.num(n) + ' ' + (Number(n) === 1 ? word : (plural || word + 's'));
  const state = { page: 1, q: '', status: '', tab: 'all' };
  let items = [];          // items that can still get opening stock (for the Stores Officer)
  let editing = null;      // the batch being changed, or null for a new one

  MS.reload = () => load();

  // ---------- list ----------
  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    const p = { page: state.page, page_size: 50, search: state.q, filters: { status: state.status } };
    if (state.tab === 'post') p.to_post = true;
    if (state.tab === 'mine') p.mine = true;
    try {
      const r = await MS.call('OPENING_STOCK_LIST', p);
      if (r.items) items = r.items;
      const cost = r.rows.some((b) => b.total_value !== undefined) || !r.rows.length;
      $('valHead').hidden = !cost;
      MS.setMsg('listMsg', count(r.total, 'batch', 'batches') + (MS.can('INVENTORY_RECEIVE') ? ' · ' + count(items.length, 'item') + ' still without stock' : ''));
      $('listBody').innerHTML = r.rows.length ? r.rows.map((b) => `
        <tr class="clk${b.status === 'CANCELLED' ? ' void' : ''}" data-id="${esc(b.opening_batch_id)}">
          <td><a class="lnk" href="stores/opening-stock.html?id=${encodeURIComponent(b.opening_batch_id)}" data-id="${esc(b.opening_batch_id)}">${esc(MS.shortDate(b.opening_date))}</a></td>
          <td class="num">${esc(MS.num(b.line_count))}</td>
          ${cost ? `<td class="num">${b.total_value === undefined ? '' : MS.money(b.total_value)}</td>` : ''}
          <td class="wrap">${esc(b.notes || '')}${b.status === 'REJECTED' && b.status_reason ? `<span class="sub">Sent back: ${esc(b.status_reason)}</span>` : ''}</td>
          <td>${esc(b.entered_by_name)}</td>
          <td>${MS.pill(b.status, MS.statusLabel(b.status, 'opening_stock_batches'))}</td>
          <td>${esc(b.posted_by_name || '')}</td>
        </tr>`).join('') : `<tr><td colspan="7" class="empty">${state.tab === 'post' ? 'Nothing is waiting for you to check.' : 'No opening stock entered yet.'}</td></tr>`;
      sc.pager('pager', r, state, load);
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  // ---------- one batch ----------
  function view(id) {
    return sc.view(() => MS.call('OPENING_STOCK_GET', { opening_batch_id: id }), (b) => {
      const refresh = () => { view(id); load(); };
      const cost = b.total_value !== undefined;
      const lines = `<div class="tablewrap"><table class="inv"><thead><tr><th>Item</th><th class="num">Quantity</th>${cost ? '<th class="num">Unit cost</th><th class="num">Value</th>' : ''}<th>Note</th></tr></thead><tbody>
        ${b.lines.map((l) => `<tr><td><b>${esc(l.item_name)}</b> <span class="sub">${esc(l.item_code)}</span>${l.has_movements ? '<span class="sub os-blocked">Already has stock movements: will be refused</span>' : ''}</td>
          <td class="num">${esc(MS.num(l.quantity))}${sc.unit(l.unit)}</td>${cost ? `<td class="num">${MS.money(l.unit_cost)}</td><td class="num">${MS.money(l.line_value)}</td>` : ''}<td class="wrap">${esc(l.notes || '')}</td></tr>`).join('')}
        </tbody>${cost ? `<tfoot><tr><td colspan="3"><b>Total</b></td><td class="num"><b>${MS.money(b.total_value)}</b></td><td></td></tr></tfoot>` : ''}</table></div>`;
      const html = `<h3>Opening stock of ${esc(MS.shortDate(b.opening_date))} ${MS.pill(b.status, MS.statusLabel(b.status, 'opening_stock_batches'))}</h3>
        <div class="dgrid" style="margin-top:8px">
          <div class="dpanel">${MS.kv([['Opening date', MS.shortDate(b.opening_date)], ['Items', MS.num(b.line_count)], ['Value', cost ? MS.money(b.total_value) : ''],
            ['Note', b.notes], ['Entered by', b.entered_by_name], ['Sent to Finance', MS.when(b.submitted_at)], ['Posted by', b.posted_by_name], ['Posted', MS.when(b.posted_at)],
            [b.status === 'CANCELLED' ? 'Why cancelled' : 'Sent back because', b.status_reason]])}</div>
          ${b.blocked ? `<div class="dpanel"><p class="os-blocked">${esc(count(b.blocked, 'item'))} already got stock another way. Posting is refused until ${b.blocked === 1 ? 'it is' : 'they are'} taken off this list (send it back to Stores).</p></div>` : ''}
          <div class="dpanel wide"><h3>Items</h3>${lines}</div>
          ${(b.movements || []).length ? `<div class="dpanel wide"><h3>Stock movements</h3>${sc.movements(b.movements, { item: true })}</div>` : ''}
          ${sc.history(b.history)}
          ${sc.journals(b.journal_entries)}
        </div>`;
      return {
        html,
        buttons: [
          b.can_cancel && ['vCancelB', 'Cancel it', 'danger', () => sc.ask({ title: 'Cancel this opening stock', label: 'Reason', required: true, danger: true, button: 'Cancel it',
            run: (t) => MS.call('OPENING_STOCK_CANCEL', { opening_batch_id: b.opening_batch_id, reason: t }) }).then((ok) => ok && refresh())],
          b.can_edit && ['vEdit', 'Change', '', () => { sc.closeView(); openEditor(b); }],
          b.can_submit && ['vSubmit', 'Send to Finance', 'primary', () => sc.ask({ title: 'Send to Finance', info: 'The Finance Manager checks the ' + count(b.line_count, 'item') + ' and posts them. You cannot change them while they are with Finance.',
            noText: true, button: 'Send', run: () => MS.call('OPENING_STOCK_SUBMIT', { opening_batch_id: b.opening_batch_id }) }).then((ok) => ok && refresh())],
          b.can_reject && ['vReject', 'Send back', 'danger', () => sc.ask({ title: 'Send back to Stores', label: 'What needs correcting', required: true, danger: true, button: 'Send back',
            run: (t) => MS.call('OPENING_STOCK_REJECT', { opening_batch_id: b.opening_batch_id, reason: t }) }).then((ok) => ok && refresh())],
          b.can_post && ['vPost', 'Post', 'primary', () => sc.ask({ title: 'Post the opening stock',
            info: count(b.line_count, 'item') + ' go into stock on ' + MS.shortDate(b.opening_date) + (cost ? ', and ' + MS.money(b.total_value) + ' is recorded in the books: Inventory (1200) against Owner\'s capital (3010).' : '.') + ' This cannot be undone; later corrections are stock adjustments.',
            label: 'Comment (optional)', button: 'Post', run: (t) => MS.call('OPENING_STOCK_POST', { opening_batch_id: b.opening_batch_id, comment: t }) }).then((ok) => ok && refresh())]
        ]
      };
    });
  }

  // ---------- entry screen ----------
  const itemLabel = (i) => i.item_name + ' (' + i.item_code + ')';
  function itemOptions(selected, used) {
    const list = items.filter((i) => i.item_id === selected || !used[i.item_id]);
    return MS.options(list.map((i) => ({ value: i.item_id, label: itemLabel(i) })), selected || '', '— choose the item —');
  }
  function usedIds(except) {
    const u = {};
    $('linesBody').querySelectorAll('select[data-f=item_id]').forEach((s) => { if (s !== except && s.value) u[s.value] = 1; });
    return u;
  }
  function addRow(l) {
    l = l || {};
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="item"><select data-f="item_id" aria-label="Item">${itemOptions(l.item_id, usedIds())}</select></td>
      <td class="num"><input data-f="quantity" type="number" min="0" step="any" inputmode="decimal" aria-label="Quantity on hand" value="${esc(l.quantity == null ? '' : l.quantity)}"></td>
      <td class="num"><input data-f="unit_cost" type="number" min="0" step="0.01" inputmode="decimal" aria-label="Unit cost" value="${esc(l.unit_cost == null ? '' : l.unit_cost)}"></td>
      <td class="num val"></td>
      <td><input data-f="notes" type="text" maxlength="300" aria-label="Note" value="${esc(l.notes || '')}"></td>
      <td><button type="button" class="x" title="Remove line" aria-label="Remove line">×</button></td>`;
    tr.querySelector('.x').addEventListener('click', () => { tr.remove(); if (!$('linesBody').children.length) addRow(); totals(); });
    $('linesBody').appendChild(tr);
    return tr;
  }
  function readLines() {
    return Array.from($('linesBody').querySelectorAll('tr')).map((tr) => {
      const v = (f) => tr.querySelector('[data-f=' + f + ']').value.trim();
      return { tr, item_id: v('item_id'), quantity: v('quantity'), unit_cost: v('unit_cost'), notes: v('notes') };
    }).filter((l) => l.item_id || l.quantity !== '' || l.unit_cost !== '');
  }
  function totals() {
    let sum = 0, n = 0;
    $('linesBody').querySelectorAll('tr').forEach((tr) => {
      const q = Number(tr.querySelector('[data-f=quantity]').value), c = Number(tr.querySelector('[data-f=unit_cost]').value);
      const v = q > 0 && c >= 0 ? Math.round(q * c * 100) / 100 : 0;
      tr.querySelector('.val').textContent = v ? MS.money(v) : '';
      if (tr.querySelector('[data-f=item_id]').value) n++;
      sum += v;
    });
    $('linesTotal').textContent = count(n, 'item') + ' · ' + MS.money(Math.round(sum * 100) / 100);
  }
  function refreshSelects() {
    $('linesBody').querySelectorAll('select[data-f=item_id]').forEach((s) => { const v = s.value; s.innerHTML = itemOptions(v, usedIds(s)); s.value = v; });
  }

  async function openEditor(b) {
    editing = b || null;
    MS.setMsg('csvMsg', '');
    $('editError').textContent = '';
    try {
      const r = await MS.call('OPENING_STOCK_LIST', { page_size: 1, opening_batch_id: b ? b.opening_batch_id : undefined });
      items = r.items || [];
    } catch (err) { $('editError').textContent = err.message; }
    $('listView').hidden = true;
    $('editView').hidden = false;
    $('editTitle').textContent = b ? 'Change the opening stock of ' + MS.shortDate(b.opening_date) : 'Enter opening stock';
    $('editCrumb').textContent = b ? MS.shortDate(b.opening_date) : 'New';
    $('editReason').hidden = !(b && b.status === 'REJECTED' && b.status_reason);
    $('editReason').textContent = b && b.status_reason ? 'Finance sent it back: ' + b.status_reason : '';
    $('oDate').value = b ? b.opening_date : new Date().toISOString().slice(0, 10);
    $('oDate').max = new Date().toISOString().slice(0, 10);
    $('oNotes').value = b ? b.notes || '' : '';
    $('csvText').value = '';
    $('linesBody').innerHTML = '';
    (b && b.lines && b.lines.length ? b.lines : [{}]).forEach(addRow);
    totals();
    window.scrollTo(0, 0);
    if (!items.length && !b) $('editError').textContent = 'Every active item already has stock or is on another opening stock list. Add new items under Items & stock first.';
  }
  function closeEditor() {
    $('editView').hidden = true;
    $('listView').hidden = false;
    history.replaceState(null, '', 'stores/opening-stock.html');
    return load();
  }

  async function save(send) {
    const lines = readLines();
    $('linesBody').querySelectorAll('tr').forEach((tr) => tr.classList.remove('bad'));
    const missing = lines.filter((l) => !l.item_id || !(Number(l.quantity) > 0) || l.unit_cost === '' || Number(l.unit_cost) < 0);
    if (!$('oDate').value) { $('editError').textContent = 'Enter the opening date.'; return; }
    if (!lines.length) { $('editError').textContent = 'Add at least one item with its quantity and unit cost.'; return; }
    if (missing.length) {
      missing.forEach((l) => l.tr.classList.add('bad'));
      $('editError').textContent = count(missing.length, 'line') + ' need the item, a quantity above 0 and the unit cost (marked in red).';
      return;
    }
    const btn = send ? $('saveSend') : $('saveDraft');
    MS.busy(btn, true, 'Saving…');
    $('editError').textContent = '';
    try {
      const out = await MS.call('OPENING_STOCK_SAVE', { opening_batch_id: editing ? editing.opening_batch_id : undefined, opening_date: $('oDate').value, notes: $('oNotes').value.trim(), submit: send,
        lines: lines.map((l) => ({ item_id: l.item_id, quantity: Number(l.quantity), unit_cost: Number(l.unit_cost), notes: l.notes })) });
      await closeEditor();
      MS.setMsg('listMsg', send ? 'Sent to Finance to check and post.' : 'Draft saved. Send it to Finance when it is complete.', 'ok');
      view(out.opening_batch_id);
    } catch (err) {
      $('editError').textContent = err.message;
      (err.details && err.details.errors ? err.details.errors : []).forEach((t) => { const m = /^Line (\d+):/.exec(t); const tr = m && lines[Number(m[1]) - 1]; if (tr) tr.tr.classList.add('bad'); });
    } finally { MS.busy(btn, false); }
  }

  // a pasted or uploaded list: item code, quantity, unit cost (comma, semicolon or tab between them; quotes allowed)
  function splitRow(line) {
    const sep = line.indexOf('\t') >= 0 ? '\t' : line.indexOf(';') >= 0 ? ';' : ',';
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; } else if (ch === sep && !q) { out.push(cur.trim()); cur = ''; } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  }
  const toNum = (s) => { const t = String(s || '').replace(/\s|GMD/gi, ''); return t === '' ? NaN : Number(t.replace(/,(?=\d{3}\b)/g, '').replace(',', '.')); };
  function addFromText(text) {
    const byCode = {};
    items.forEach((i) => { byCode[String(i.item_code).toUpperCase()] = i; });
    const problems = []; let added = 0;
    const rows = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    rows.forEach((raw, k) => {
      const f = splitRow(raw);
      const qty = toNum(f[1]), cost = toNum(f[2]);
      if (k === 0 && isNaN(qty)) return; // column names
      const it = byCode[String(f[0] || '').toUpperCase()];
      if (!it) { problems.push('line ' + (k + 1) + ': no item with the code "' + (f[0] || '') + '" waiting for opening stock'); return; }
      if (usedIds()[it.item_id]) { problems.push('line ' + (k + 1) + ': ' + it.item_code + ' is already in the list'); return; }
      if (!(qty > 0) || isNaN(cost) || cost < 0) { problems.push('line ' + (k + 1) + ': ' + it.item_code + ' needs a quantity above 0 and a unit cost'); return; }
      // fill an empty row first
      const empty = Array.from($('linesBody').querySelectorAll('tr')).find((tr) => !tr.querySelector('[data-f=item_id]').value && !tr.querySelector('[data-f=quantity]').value);
      if (empty) empty.remove();
      addRow({ item_id: it.item_id, quantity: qty, unit_cost: cost, notes: f.slice(3).join(' ').slice(0, 300) });
      added++;
    });
    refreshSelects();
    totals();
    MS.setMsg('csvMsg', count(added, 'line') + ' added' + (problems.length ? '. Not added: ' + problems.slice(0, 6).join('; ') + (problems.length > 6 ? ' … and ' + (problems.length - 6) + ' more' : '') : '.'), problems.length ? 'error' : 'ok');
    if (added && !problems.length) $('csvText').value = '';
  }
  function downloadTemplate() {
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const csv = 'item_code,quantity,unit_cost,item_name\r\n' + items.map((i) => [q(i.item_code), '', '', q(i.item_name)].join(',')).join('\r\n') + '\r\n';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'opening-stock-items.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  MS.boot({ page: 'opening-stock', any: ['INVENTORY_RECEIVE', 'FINANCE_APPROVE'], ref: true }).then(() => {
    $('statusFilter').innerHTML = MS.options(['DRAFT', 'SUBMITTED', 'POSTED', 'REJECTED', 'CANCELLED'].map((s) => ({ value: s, label: MS.statusLabel(s, 'opening_stock_batches') })), '', 'Any status');
    const enter = MS.can('INVENTORY_RECEIVE');
    $('newBtn').hidden = !enter;
    $('tabPost').hidden = !MS.can('FINANCE_APPROVE');
    $('tabMine').hidden = !enter;
    $('newBtn').addEventListener('click', () => openEditor(null));
    sc.tabs('tabs', state, load);
    $('search').addEventListener('input', MS.debounce(() => { state.q = $('search').value.trim(); state.page = 1; load(); }, 300));
    $('statusFilter').addEventListener('change', () => { state.status = $('statusFilter').value; state.page = 1; load(); });
    $('reloadBtn').addEventListener('click', load);
    $('listBody').addEventListener('click', (e) => {
      const el = e.target.closest('[data-id]');
      if (!el) return;
      e.preventDefault();
      view(el.dataset.id);
    });
    // entry screen
    $('linesBody').addEventListener('input', totals);
    $('linesBody').addEventListener('change', (e) => { if (e.target.dataset.f === 'item_id') refreshSelects(); totals(); });
    $('addLine').addEventListener('click', () => { addRow().querySelector('select').focus(); });
    $('addAll').addEventListener('click', () => {
      const used = usedIds();
      $('linesBody').querySelectorAll('tr').forEach((tr) => { if (!tr.querySelector('[data-f=item_id]').value) tr.remove(); });
      items.filter((i) => !used[i.item_id]).forEach((i) => addRow({ item_id: i.item_id }));
      if (!$('linesBody').children.length) addRow();
      refreshSelects();
      totals();
    });
    $('csvAdd').addEventListener('click', () => addFromText($('csvText').value));
    $('csvFile').addEventListener('change', () => {
      const f = $('csvFile').files[0];
      if (!f) return;
      if (f.size > 2e6) { MS.setMsg('csvMsg', 'That file is too big for a list of items (2 MB at most).', 'error'); return; }
      const rd = new FileReader();
      rd.onload = () => { $('csvText').value = String(rd.result || ''); addFromText($('csvText').value); $('csvFile').value = ''; };
      rd.onerror = () => MS.setMsg('csvMsg', 'Could not read that file.', 'error');
      rd.readAsText(f);
    });
    $('templateBtn').addEventListener('click', downloadTemplate);
    $('editForm').addEventListener('submit', (e) => { e.preventDefault(); save(false); });
    $('saveSend').addEventListener('click', () => save(true));
    $('editCancel').addEventListener('click', closeEditor);
    $('editBack').addEventListener('click', (e) => { e.preventDefault(); closeEditor(); });
    if (MS.can('FINANCE_APPROVE') && !enter) sc.setTab('tabs', 'post', state);
    load();
    if (MS.param('new') && enter) openEditor(null);
    if (MS.param('id')) view(MS.param('id'));
  });
})();
