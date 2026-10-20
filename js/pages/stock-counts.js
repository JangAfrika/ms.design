/* Stock counts: start a count (the system quantity is noted), enter what is found with a reason for each difference,
   hand in; a second person checks it and the differences become stock adjustments for approval. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const sc = MS.sc;
  const state = { page: 1, tab: 'all' };
  let cats = null;

  MS.reload = () => load();
  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    const p = { page: state.page, page_size: 50 };
    if (state.tab === 'verify') p.to_verify = true;
    try {
      const r = await MS.recall('STOCK_COUNT_LIST', p);
      const cost = r.rows.some((c) => c.variance_value !== undefined);
      $('valHead').hidden = !cost;
      MS.setMsg('listMsg', r.total + ' count' + (r.total === 1 ? '' : 's'));
      $('listBody').innerHTML = r.rows.length ? r.rows.map((c) => `
        <tr class="clk" data-id="${esc(c.stock_count_id)}">
          <td><b><a class="lnk" href="#" data-id="${esc(c.stock_count_id)}">${esc(MS.shortDate(c.count_date))}</a></b></td>
          <td>${esc(MS.label(c.count_type))}</td>
          <td>${esc(c.counted_by_name)}</td>
          <td class="num">${esc(c.counted_lines)} of ${esc(c.line_count)}</td>
          <td class="num">${c.variance_lines ? `<span class="late">${esc(c.variance_lines)}</span>` : '0'}</td>
          ${cost ? `<td class="num">${MS.money(c.variance_value)}</td>` : ''}
          <td class="num">${c.accuracy_pct === '' || c.accuracy_pct == null ? '' : esc(c.accuracy_pct) + '%'}</td>
          <td>${MS.pill(c.status, MS.statusLabel(c.status, 'stock_counts'))}</td>
        </tr>`).join('') : `<tr><td colspan="8" class="empty">${state.tab === 'verify' ? 'No count waiting for you to check.' : 'No stock counts yet.'}</td></tr>`;
      sc.pager('pager', r, state, load);
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  async function startForm() {
    const f = $('startForm');
    f.reset();
    $('startError').textContent = '';
    $('sDate').value = MS.todayISO();
    if (!cats) { try { cats = (await MS.call('INVENTORY_LIST', { page_size: 1 })).categories || []; } catch (e) { cats = []; } }
    $('sCat').innerHTML = MS.options(cats.map((c) => ({ value: c.inventory_category_id, label: 'Only ' + c.category_name })), '', 'Every active item (full count)');
    const dlg = MS.openDialog('startDialog');
    $('startCancel').onclick = () => dlg.close();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = MS.formData(f);
      MS.busy($('startSave'), true, 'Starting…');
      try { const c = await MS.call('STOCK_COUNT_START', d); dlg.close(); load(); view(c.stock_count_id); }
      catch (err) { $('startError').textContent = err.message; } finally { MS.busy($('startSave'), false); }
    };
  }

  function linesOf() {
    return Array.from(document.querySelectorAll('#countLines tr[data-line]')).map((tr) => {
      const q = tr.querySelector('[data-f=q]').value;
      return { stock_count_line_id: tr.dataset.line, counted_quantity: q === '' ? '' : Number(q), explanation: tr.querySelector('[data-f=why]').value.trim() };
    });
  }

  function view(id) {
    return sc.view(() => MS.call('STOCK_COUNT_GET', { stock_count_id: id }), (c) => {
      const refresh = () => { view(id); load(); };
      const editing = c.status === 'IN_PROGRESS' && c.counted_by === MS.user.user_id;
      const cost = (c.lines || []).some((l) => l.variance_value !== undefined);
      const rows = (c.lines || []).map((l) => {
        const v = Number(l.variance_quantity) || 0;
        return `<tr data-line="${esc(l.stock_count_line_id)}" data-sys="${esc(l.system_quantity)}">
          <td>${esc(l.item_name)} <span class="sub">${esc(l.item_code)}${l.store_location ? ' · ' + esc(l.store_location) : ''}</span></td>
          <td class="num">${esc(MS.num(l.system_quantity))}${sc.unit(l.unit)}</td>
          <td class="q">${editing ? `<input data-f="q" type="number" min="0" step="any" value="${esc(l.counted_quantity == null ? '' : l.counted_quantity)}" aria-label="Counted">` : esc(MS.num(l.counted_quantity))}</td>
          <td class="num" data-f="var">${l.counted_quantity === '' || l.counted_quantity == null ? '' : v ? `<span class="late">${v > 0 ? '+' : ''}${esc(MS.num(v))}</span>` : '0'}</td>
          ${cost ? `<td class="num">${l.variance_value === '' ? '' : MS.money(l.variance_value)}</td>` : ''}
          <td class="d">${editing ? `<input data-f="why" type="text" maxlength="300" value="${esc(l.explanation || '')}" placeholder="Why is it different?" aria-label="Explanation">` : esc(l.explanation || '')}</td></tr>`;
      }).join('');
      const html = `<h3>Stock count ${esc(MS.shortDate(c.count_date))} ${MS.pill(c.status, MS.statusLabel(c.status, 'stock_counts'))}</h3>
        <div class="dgrid" style="margin-top:8px">
          <div class="dpanel">${MS.kv([['Type', MS.label(c.count_type)], ['Counted by', c.counted_by_name], ['Checked by', c.verified_by_name],
            ['Items counted', c.counted_lines + ' of ' + c.line_count], ['Accuracy', c.accuracy_pct === '' || c.accuracy_pct == null ? '' : c.accuracy_pct + '%']])}</div>
          <div class="dpanel wide"><div class="tablewrap"><table class="inv lines"><thead><tr><th>Item</th><th class="num">System says</th><th class="num">Counted</th><th class="num">Difference</th>${cost ? '<th class="num">Value</th>' : ''}<th>Explanation</th></tr></thead>
            <tbody id="countLines">${rows}</tbody></table></div></div>
          ${(c.adjustments || []).length ? `<div class="dpanel wide"><h3>Adjustments from this count</h3><ul class="mini-list">${c.adjustments.map((a) =>
            `<li><span>${MS.lnk('stores/adjustments.html?id=' + encodeURIComponent(a.adjustment_id), a.item_name + ' ' + (a.quantity_change > 0 ? '+' : '') + MS.num(a.quantity_change))}</span><span class="n">${MS.pill(a.status)}</span></li>`).join('')}</ul></div>` : ''}
          ${sc.history(c.history)}
        </div>`;
      return {
        html,
        after: () => {
          if (!editing) return;
          $('countLines').addEventListener('input', (e) => {
            const tr = e.target.closest('tr[data-line]');
            if (!tr || e.target.dataset.f !== 'q') return;
            const q = e.target.value;
            const v = q === '' ? null : Math.round((Number(q) - Number(tr.dataset.sys)) * 10000) / 10000;
            tr.querySelector('[data-f=var]').innerHTML = v === null ? '' : v ? `<span class="late">${v > 0 ? '+' : ''}${esc(MS.num(v))}</span>` : '0';
          });
        },
        buttons: [
          editing && ['vSave', 'Save counts', '', async (btn) => {
            MS.busy(btn, true, 'Saving…');
            try { await MS.call('STOCK_COUNT_SAVE', { stock_count_id: c.stock_count_id, lines: linesOf() }); refresh(); } catch (err) { MS.busy(btn, false); sc.viewError(err.message); }
          }],
          editing && ['vSubmit', 'Hand in for checking', 'primary', async (btn) => {
            MS.busy(btn, true, 'Handing in…');
            try { await MS.call('STOCK_COUNT_SUBMIT', { stock_count_id: c.stock_count_id, lines: linesOf() }); refresh(); } catch (err) { MS.busy(btn, false); sc.viewError(err.message); }
          }],
          c.can_verify && ['vReturn', 'Send back', 'danger', () => sc.ask({ title: 'Send the count back', label: 'What needs to be counted again?', required: true, danger: true, button: 'Send back',
            run: (t) => MS.call('STOCK_COUNT_VERIFY', { stock_count_id: c.stock_count_id, decision: 'RETURN', reason: t }) }).then((ok) => ok && refresh())],
          c.can_verify && ['vVerify', 'Confirm count', 'primary', () => sc.ask({ title: 'Confirm the count of ' + MS.shortDate(c.count_date),
            info: c.variance_lines ? c.variance_lines + ' difference(s) become stock adjustments, approved within limits before the stock changes.' : 'No differences: nothing to adjust.',
            label: 'Comment (optional)', button: 'Confirm',
            run: (t) => MS.call('STOCK_COUNT_VERIFY', { stock_count_id: c.stock_count_id, decision: 'VERIFY', reason: t }) }).then((ok) => ok && refresh())]
        ]
      };
    });
  }

  MS.boot({ page: 'stock-counts', any: ['STOCK_COUNT'], ref: true }).then(() => {
    $('newBtn').hidden = !MS.can('STOCK_COUNT');
    $('newBtn').addEventListener('click', startForm);
    sc.tabs('tabs', state, load);
    $('listBody').addEventListener('click', (e) => {
      const el = e.target.closest('[data-id]');
      if (!el) return;
      e.preventDefault();
      view(el.dataset.id);
    });
    if (MS.param('tab') === 'verify') sc.setTab('tabs', 'verify', state);
    load();
    if (MS.param('id')) view(MS.param('id'));
  });
})();
