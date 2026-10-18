/* Item list (stores master): search and filter items, add or change categories and items.
   Quantities and cost are shown read-only: they change only through receipts, issues and approved adjustments. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const state = { page: 1, q: '', cat: '', status: '', low: false };
  let cats = [];
  let rows = [];
  let showCost = false;

  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    try {
      const filters = { inventory_category_id: state.cat, status: state.status };
      if (state.low) filters.below_minimum = true;
      const r = await MS.call('INVENTORY_LIST', { page: state.page, page_size: 50, search: state.q, filters, sort: 'item_name', dir: 'asc' });
      cats = r.categories || [];
      rows = r.rows;
      showCost = rows.some((i) => i.average_unit_cost !== undefined);
      drawCats();
      MS.setMsg('listMsg', r.total + ' item' + (r.total === 1 ? '' : 's'));
      $('listHead').innerHTML = `<tr><th>Code</th><th>Item</th><th>Category</th><th class="num">On hand</th><th class="num">Reserved</th><th class="num">Available</th><th class="num">Minimum</th>${showCost ? '<th class="num">Avg. cost</th>' : ''}<th>Status</th></tr>`;
      const cols = showCost ? 9 : 8;
      $('listBody').innerHTML = rows.length ? rows.map((i) => `
        <tr class="clk" data-item="${esc(i.item_id)}">
          <td>${esc(i.item_code)}</td>
          <td><b>${esc(i.item_name)}</b>${i.is_critical === true ? ' <span class="pill pending">Critical</span>' : ''}${i.store_location ? `<div class="sub">${esc(i.store_location)}</div>` : ''}</td>
          <td>${esc(i.category_name)}</td>
          <td class="num">${esc(MS.num(i.quantity_on_hand))} ${esc(MS.label(i.unit).toLowerCase())}</td>
          <td class="num">${esc(MS.num(i.quantity_reserved))}</td>
          <td class="num">${i.below_minimum ? `<span class="late">${esc(MS.num(i.available))}</span>` : esc(MS.num(i.available))}</td>
          <td class="num">${esc(MS.num(i.minimum_level))}</td>
          ${showCost ? `<td class="num">${esc(MS.money(i.average_unit_cost))}</td>` : ''}
          <td>${MS.pill(i.status)}</td>
        </tr>`).join('') : `<tr><td colspan="${cols}" class="empty">${state.q || state.cat || state.status || state.low ? 'No item matches.' : 'No items yet.'}</td></tr>`;
      pager(r);
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  function pager(r) {
    const pages = Math.max(1, Math.ceil(r.total / r.page_size));
    $('pager').innerHTML = pages > 1 ? `<button type="button" id="pPrev"${state.page <= 1 ? ' disabled' : ''}>Previous</button><span>Page ${state.page} of ${pages}</span><button type="button" id="pNext"${state.page >= pages ? ' disabled' : ''}>Next</button>` : '';
    if (pages > 1) {
      $('pPrev').onclick = () => { state.page--; load(); };
      $('pNext').onclick = () => { state.page++; load(); };
    }
  }

  const catName = (id) => { const c = cats.find((x) => x.inventory_category_id === id); return c ? c.category_name : ''; };

  function drawCats() {
    const sel = $('catFilter').value;
    $('catFilter').innerHTML = MS.options(cats.map((c) => ({ value: c.inventory_category_id, label: c.category_name })), sel, 'All categories');
    const edit = MS.can('INVENTORY_CREATE');
    $('catList').innerHTML = cats.length ? cats.slice().sort((a, b) => (a.category_name < b.category_name ? -1 : 1)).map((c) => `
      <li><span class="code">${esc(c.category_code)}</span><span class="n">${esc(c.category_name)}${c.parent_category_id && catName(c.parent_category_id) ? ` <span class="muted small">in ${esc(catName(c.parent_category_id))}</span>` : ''}</span>
        <button type="button" class="linkbtn" data-filter="${esc(c.inventory_category_id)}">Show items</button>
        ${edit ? `<button type="button" class="linkbtn" data-cat="${esc(c.inventory_category_id)}">Edit</button>` : ''}</li>`).join('')
      : `<li class="empty">No categories yet.${edit ? ' Add one before adding items.' : ''}</li>`;
  }

  /* ---------- category ---------- */
  function categoryForm(c) {
    const f = $('catForm');
    f.reset();
    $('catError').textContent = '';
    $('catTitle').textContent = c ? 'Edit category' : 'Add category';
    $('kCode').value = c ? c.category_code : '';
    $('kName').value = c ? c.category_name : '';
    $('kParent').innerHTML = MS.options(cats.filter((x) => !c || x.inventory_category_id !== c.inventory_category_id)
      .map((x) => ({ value: x.inventory_category_id, label: x.category_name })), c ? c.parent_category_id : '', '— none —');
    $('kStatus').innerHTML = MS.options(['ACTIVE', 'INACTIVE'], c ? c.status : 'ACTIVE');
    $('kStatusLbl').hidden = !c;
    const dlg = MS.openDialog('catDialog');
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = MS.formData(f);
      if (!d.category_code || !d.category_name) { $('catError').textContent = 'Enter the code and the name.'; return; }
      d.category_code = d.category_code.toUpperCase();
      if (c) d.inventory_category_id = c.inventory_category_id; else delete d.status;
      if (c && d.status === 'INACTIVE' && c.status !== 'INACTIVE'
        && !(await MS.confirm({ title: 'Make category inactive', message: 'An inactive category is hidden from this list and cannot be chosen for new items.', confirmText: 'Make inactive' }))) return;
      MS.busy($('catSave'), true, 'Saving…');
      try { await MS.call('INVENTORY_CATEGORY_SAVE', d); dlg.close(); load(); } catch (err) { $('catError').textContent = err.message; } finally { MS.busy($('catSave'), false); }
    };
    $('catCancel').onclick = () => dlg.close();
  }

  /* ---------- item ---------- */
  function itemForm(i) {
    const edit = MS.can('INVENTORY_CREATE');
    if (!i && !cats.length) { MS.alert('Add a category first.', 'No categories yet'); return; }
    const f = $('itemForm');
    f.reset();
    $('itemError').textContent = '';
    $('itemTitle').textContent = !i ? 'Add item' : edit ? 'Edit item · ' + i.item_code : i.item_name;
    $('itemInfo').textContent = !i ? 'Quantities start at zero and change through receipts and issues.'
      : 'Quantities and cost are read-only: they change through receipts, issues and approved adjustments.';
    const catOpts = cats.map((c) => ({ value: c.inventory_category_id, label: c.category_name }));
    if (i && !cats.some((c) => c.inventory_category_id === i.inventory_category_id)) catOpts.push({ value: i.inventory_category_id, label: (i.category_name || 'Inactive category') + ' (inactive)' });
    $('iCat').innerHTML = MS.options(catOpts, i ? i.inventory_category_id : (state.cat || ''), '— choose —');
    $('iUnit').innerHTML = MS.options(MS.enumOf('inventory_items.unit'), i ? i.unit : 'PCS');
    $('iStatus').innerHTML = MS.options(['ACTIVE', 'INACTIVE', 'DISCONTINUED'], i ? i.status : 'ACTIVE');
    $('iCode').value = i ? i.item_code : '';
    $('iName').value = i ? i.item_name : '';
    $('iMin').value = i ? i.minimum_level : 0;
    $('iReorder').value = i ? i.reorder_quantity : 0;
    $('iLoc').value = i ? i.store_location || '' : '';
    $('iCritical').checked = !!(i && i.is_critical === true);
    $('iStock').hidden = !i;
    if (i) {
      $('iOnHand').value = MS.num(i.quantity_on_hand) + ' ' + MS.label(i.unit).toLowerCase();
      $('iReserved').value = MS.num(i.quantity_reserved);
      $('iCostLbl').hidden = i.average_unit_cost === undefined;
      $('iCost').value = i.average_unit_cost === undefined ? '' : MS.money(i.average_unit_cost);
    }
    f.querySelectorAll('[name]').forEach((el) => { el.disabled = !edit; });
    $('itemSave').hidden = !edit;
    $('iReasonLbl').hidden = !edit;
    $('itemCancel').textContent = edit ? 'Cancel' : 'Close';
    const dlg = MS.openDialog('itemDialog');
    f.onsubmit = async (e) => {
      e.preventDefault();
      if (!edit) return;
      const d = MS.formData(f);
      if (!d.item_code || !d.item_name) { $('itemError').textContent = 'Enter the item code and the name.'; return; }
      if (!d.inventory_category_id) { $('itemError').textContent = 'Choose the category.'; return; }
      if (d.minimum_level === '') d.minimum_level = 0;
      if (d.reorder_quantity === '') d.reorder_quantity = 0;
      if (d.minimum_level < 0 || d.reorder_quantity < 0) { $('itemError').textContent = 'Levels cannot be below zero.'; return; }
      d.item_code = d.item_code.toUpperCase();
      if (i) { d.item_id = i.item_id; if (!d.reason) delete d.reason; } else { delete d.status; delete d.reason; }
      MS.busy($('itemSave'), true, 'Saving…');
      try { await MS.call('INVENTORY_ITEM_SAVE', d); dlg.close(); load(); } catch (err) { $('itemError').textContent = err.message; } finally { MS.busy($('itemSave'), false); }
    };
    $('itemCancel').onclick = () => dlg.close();
  }

  MS.boot({ page: 'items', any: ['INVENTORY_VIEW'], ref: true }).then(() => {
    const canEdit = MS.can('INVENTORY_CREATE');
    $('addCatBtn').hidden = $('addItemBtn').hidden = $('addCatLink').hidden = !canEdit;
    $('statusFilter').innerHTML = MS.options(['ACTIVE', 'INACTIVE', 'DISCONTINUED'], '', 'Any status');
    $('addCatBtn').addEventListener('click', () => categoryForm(null));
    $('addCatLink').addEventListener('click', () => categoryForm(null));
    $('addItemBtn').addEventListener('click', () => itemForm(null));
    $('search').addEventListener('input', MS.debounce(() => { state.q = $('search').value.trim(); state.page = 1; load(); }, 300));
    $('catFilter').addEventListener('change', () => { state.cat = $('catFilter').value; state.page = 1; load(); });
    $('statusFilter').addEventListener('change', () => { state.status = $('statusFilter').value; state.page = 1; load(); });
    $('lowOnly').addEventListener('change', () => { state.low = $('lowOnly').checked; state.page = 1; load(); });
    $('reloadBtn').addEventListener('click', load);
    $('listBody').addEventListener('click', (e) => {
      const tr = e.target.closest('[data-item]');
      const i = tr && rows.find((x) => x.item_id === tr.dataset.item);
      if (i) itemForm(i);
    });
    $('catList').addEventListener('click', (e) => {
      const ed = e.target.closest('[data-cat]');
      if (ed) { categoryForm(cats.find((c) => c.inventory_category_id === ed.dataset.cat)); return; }
      const fl = e.target.closest('[data-filter]');
      if (fl) { state.cat = fl.dataset.filter; $('catFilter').value = state.cat; state.page = 1; load(); window.scrollTo(0, 0); }
    });
    load();
  });
})();
