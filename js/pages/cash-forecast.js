(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const fin = MS.fin;
  const CATS = ['CUSTOMER_RECEIPT', 'LOAN', 'OWNER_FUNDS', 'SUPPLIER', 'PAYROLL', 'RENT', 'UTILITIES', 'TAX', 'LOAN_REPAYMENT', 'CAPEX', 'OTHER'];
  const st = { f: null, open: {}, items: [] };
  const day = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const range = (a, b) => day(a) + ' – ' + day(b);
  const amt = (n) => (Number(n) ? MS.money(n) : '–');
  const catLabel = (c) => { const e = MS.enumOf('cash_forecast_items.category').find((x) => (x.value || x) === c); return e && e.label ? e.label : MS.label(c); };
  const FLAG = { OVERDUE: ['failed', 'Overdue — chase'], PAST_DATE: ['pending', 'Date has passed'], ESTIMATE: ['off', 'Estimate'] };

  function itemLink(it) {
    if (it.source === 'invoices') return MS.lnk('finance/invoice.html?id=' + encodeURIComponent(it.source_id), it.description);
    if (it.source === 'expenses') return MS.lnk('finance/expenses.html', it.description);
    if (it.source === 'payroll_runs' || it.source === 'payroll') return MS.lnk('people/payroll.html', it.description);
    return esc(it.description);
  }

  function itemRows(w) {
    if (!w.items.length) return '<tr class="plan-sub"><td colspan="6" class="fin-note">Nothing expected this week.</td></tr>';
    return w.items.map((it) => {
      const flag = it.flag && FLAG[it.flag] ? `<span class="pill ${FLAG[it.flag][0]}">${esc(FLAG[it.flag][1])}</span>` : '';
      const was = it.original_date ? ` <span class="qhint">was due ${esc(MS.shortDate(it.original_date))}</span>` : '';
      const manual = it.forecast_item_id && st.f.can_edit ? `<button type="button" class="mini" data-edit="${esc(it.forecast_item_id)}">Edit</button>` : '';
      return `<tr class="plan-sub"><td>${esc(day(it.date))}</td><td colspan="2" class="wrap">${itemLink(it)} ${it.recurring ? '<span class="pill off">Monthly</span>' : ''} ${flag}${was}<div class="qhint">${esc(catLabel(it.category))}</div></td>
        <td class="num">${it.direction === 'IN' ? '<span class="plan-in">+ ' + esc(MS.money(it.amount)) + '</span>' : ''}</td>
        <td class="num">${it.direction === 'OUT' ? '<span class="plan-out">− ' + esc(MS.money(it.amount)) + '</span>' : ''}</td><td>${manual}</td></tr>`;
    }).join('');
  }

  function draw() {
    const f = st.f;
    const low = f.lowest;
    const below = f.weeks_below_minimum.length;
    $('fCards').innerHTML = `
      <div class="card"><div class="k">Cash now</div><div class="v${f.opening.total < 0 ? ' neg' : ''}">${fin.amt(f.opening.total)}</div><div class="s" title="${esc(f.opening.accounts.map((a) => a.account_code + ' ' + a.account_name + ': ' + MS.money(a.balance)).join('\n'))}">${esc(f.opening.accounts.filter((a) => a.balance).map((a) => a.account_name + ' ' + MS.money(a.balance)).join(' · ') || 'tills, banks and mobile money')}</div></div>
      <div class="card"><div class="k">Expected in</div><div class="v">${MS.money(f.totals.in)}</div><div class="s">next 13 weeks</div></div>
      <div class="card"><div class="k">Expected out</div><div class="v">${MS.money(f.totals.out)}</div><div class="s">next 13 weeks</div></div>
      <div class="card${below ? ' red' : ''}"><div class="k">Lowest point</div><div class="v">${low ? fin.amt(low.closing) : '–'}</div><div class="s">${low ? 'end of week ' + low.week_no + ' (' + esc(day(low.start)) + ')' : ''}${below ? ' · ' + below + ' week' + (below === 1 ? '' : 's') + ' below the minimum of ' + esc(MS.money(f.minimum)) : ' · minimum ' + esc(MS.money(f.minimum))}</div></div>`;
    $('fAssume').innerHTML = '<b>How this is worked out.</b> ' + f.assumptions.map(esc).join(' ') +
      ' Customer invoices are expected on their due date; approved expenses as soon as possible.' +
      (f.later.count ? ` <span class="qhint">After the 13 weeks: ${f.later.count} more item(s), ${esc(MS.money(f.later.in))} in and ${esc(MS.money(f.later.out))} out.</span>` : '');
    const max = Math.max(1, ...f.weeks.map((w) => Math.abs(w.closing)), Math.abs(f.minimum));
    $('fChart').innerHTML = f.weeks.map((w) => `<div class="bar-row plan-bar-w${w.below_minimum ? ' low' : ''}${w.closing < 0 ? ' minus' : ''}">
        <span>Wk ${w.week_no} · ${esc(day(w.start))}</span>
        <span class="bar" title="${esc(MS.money(w.closing))}"><i style="width:${(100 * Math.abs(w.closing) / max).toFixed(1)}%"></i>${f.minimum > 0 ? `<b class="min" style="left:${(100 * f.minimum / max).toFixed(1)}%" title="Minimum ${esc(MS.money(f.minimum))}"></b>` : ''}</span>
        <span class="n${w.closing < 0 ? ' neg' : ''}">${esc(fin.amt(w.closing))}</span></div>`).join('') +
      (f.minimum > 0 ? '<p class="fin-note">The thin line is the minimum cash balance. Red bars: the week ends below it.</p>' : '<p class="fin-note">Red bars: the week ends below the minimum cash balance (now ' + esc(MS.money(f.minimum)) + ').</p>');
    $('fWeeks').innerHTML = f.weeks.map((w) => {
      const open = st.open[w.week_no];
      return `<tr class="clk plan-week${w.below_minimum ? ' low' : ''}" data-week="${w.week_no}" aria-expanded="${open ? 'true' : 'false'}">
        <td><span class="plan-caret">${open ? '▾' : '▸'}</span> <b>Week ${w.week_no}</b> <span class="qhint inline">${esc(range(w.start, w.end))}</span></td>
        <td class="num">${esc(fin.amt(w.opening))}</td><td class="num">${amt(w.in)}</td><td class="num">${amt(w.out)}</td>
        <td class="num${w.closing < 0 ? ' neg' : ''}"><b>${esc(fin.amt(w.closing))}</b></td>
        <td>${w.below_minimum ? '<span class="pill failed">Below minimum</span>' : ''} <span class="qhint inline">${w.items.length} item${w.items.length === 1 ? '' : 's'}</span></td></tr>${open ? itemRows(w) : ''}`;
    }).join('');
    $('fActual').innerHTML = f.actual_weeks.map((w) => `<tr><td>${esc(range(w.start, w.end))}</td><td class="num">${esc(fin.amt(w.opening))}</td>
      <td class="num">${amt(w.in)}</td><td class="num">${amt(w.out)}</td><td class="num${w.closing < 0 ? ' neg' : ''}"><b>${esc(fin.amt(w.closing))}</b></td></tr>`).join('');
  }

  async function load() {
    MS.setMsg('fMsg', 'Working it out…');
    try {
      st.f = await MS.call('CASH_FORECAST_GET', {});
      MS.setMsg('fMsg', 'From ' + MS.shortDate(st.f.start) + ' (Monday of this week) to ' + MS.shortDate(st.f.end) + '.');
      $('addBtn').hidden = !st.f.can_edit;
      $('minBtn').hidden = !st.f.can_set_minimum;
      draw();
    } catch (err) { MS.setMsg('fMsg', err.message, 'error'); }
    loadItems();
  }

  async function loadItems() {
    try {
      const r = await MS.call('CASH_FORECAST_ITEM_LIST', { status: $('itemStatus').value, page_size: 100 });
      st.items = r.rows;
      const edit = st.f && st.f.can_edit;
      $('fItems').innerHTML = r.rows.length ? r.rows.map((m) => `<tr>
        <td>${esc(MS.shortDate(m.expected_date))}</td><td>${m.direction === 'IN' ? '<span class="plan-in">In</span>' : '<span class="plan-out">Out</span>'}</td>
        <td>${esc(catLabel(m.category))}</td><td class="wrap">${esc(m.description)}</td><td>${m.is_recurring_monthly ? 'Every month' : 'Once'}</td>
        <td class="num">${esc(MS.money(m.amount))}</td><td>${MS.pill(m.status, MS.label(m.status))}</td>
        <td class="acts">${edit && m.status === 'EXPECTED' ? `<button type="button" class="mini" data-edit="${esc(m.forecast_item_id)}">Edit</button>
          <button type="button" class="mini" data-done="${esc(m.forecast_item_id)}">${m.is_recurring_monthly ? 'Paid this month' : 'Done'}</button>
          <button type="button" class="mini danger" data-cancel="${esc(m.forecast_item_id)}">${m.is_recurring_monthly ? 'Stop' : 'Cancel'}</button>` : ''}</td></tr>`).join('')
        : '<tr><td colspan="8" class="empty">No items here.' + (edit ? ' Use <b>Add expected money in or out</b> for rent, utilities, loans.' : '') + '</td></tr>';
    } catch (err) { $('fItems').innerHTML = `<tr><td colspan="8" class="err">${esc(err.message)}</td></tr>`; }
  }

  function openItem(m) {
    const f = $('itemForm');
    f.reset();
    $('itemTitle').textContent = m ? 'Change expected item' : 'Expected money in or out';
    const cats = MS.enumOf('cash_forecast_items.category');
    $('iCat').innerHTML = MS.options(cats.length ? cats : CATS.map((c) => ({ value: c, label: MS.label(c) })), m ? m.category : 'RENT');
    $('iDir').value = m ? m.direction : 'OUT';
    $('iDesc').value = m ? m.description : '';
    $('iDate').value = m ? m.expected_date : MS.todayISO();
    $('iAmt').value = m ? m.amount : '';
    $('iRec').checked = m ? m.is_recurring_monthly === true : false;
    $('itemError').textContent = '';
    const dlg = MS.openDialog('itemDialog');
    f.onsubmit = async (e) => {
      e.preventDefault();
      const p = { direction: $('iDir').value, category: $('iCat').value, description: $('iDesc').value.trim(), expected_date: $('iDate').value,
        amount: $('iAmt').value, is_recurring_monthly: $('iRec').checked };
      if (!p.description || !p.expected_date || !(Number(p.amount) > 0)) { $('itemError').textContent = 'Fill in the description, the date and an amount above 0.'; return; }
      if (m) p.forecast_item_id = m.forecast_item_id;
      MS.busy($('itemSave'), true, 'Saving…');
      try { await MS.call('CASH_FORECAST_ITEM_SAVE', p); dlg.close(); await load(); MS.setMsg('fMsg', '"' + p.description + '" saved.', 'ok'); }
      catch (err) { $('itemError').textContent = err.message; } finally { MS.busy($('itemSave'), false); }
    };
    $('itemCancel').onclick = () => dlg.close();
  }

  async function findItem(id) {
    let m = st.items.find((x) => x.forecast_item_id === id);
    if (!m) { const r = await MS.call('CASH_FORECAST_ITEM_LIST', { page_size: 100 }); m = r.rows.find((x) => x.forecast_item_id === id); }
    return m;
  }

  async function setStatus(id, status) {
    const m = await findItem(id);
    if (!m) return;
    const msg = status === 'DONE'
      ? (m.is_recurring_monthly ? 'Mark "' + m.description + '" as paid / received for this month? It moves on to next month.' : 'Mark "' + m.description + '" as done? It leaves the forecast.')
      : (m.is_recurring_monthly ? 'Stop "' + m.description + '"? It will no longer repeat in the forecast.' : 'Cancel "' + m.description + '"? It leaves the forecast.');
    const yes = await MS.confirm({ title: status === 'DONE' ? 'Done' : 'Cancel item', message: msg, confirmText: status === 'DONE' ? 'Yes, done' : 'Yes, remove it', danger: status !== 'DONE' });
    if (!yes) return;
    try {
      const r = await MS.call('CASH_FORECAST_ITEM_STATUS', { forecast_item_id: id, status });
      await load();
      MS.setMsg('fMsg', r.moved_to ? '"' + m.description + '" moved on to ' + MS.shortDate(r.moved_to) + '.' : '"' + m.description + '" updated.', 'ok');
    } catch (err) { MS.alert(err.message); }
  }

  MS.boot({ page: 'cash-forecast', any: ['FINANCE_VIEW'], ref: true }).then(() => {
    $('fWeeks').addEventListener('click', async (e) => {
      const ed = e.target.closest('[data-edit]');
      if (ed) { e.stopPropagation(); const m = await findItem(ed.dataset.edit); if (m) openItem(m); return; }
      if (e.target.closest('a')) return;
      const tr = e.target.closest('tr[data-week]');
      if (!tr) return;
      const n = Number(tr.dataset.week);
      st.open[n] = !st.open[n];
      draw();
    });
    $('fItems').addEventListener('click', async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.edit) { const m = await findItem(b.dataset.edit); if (m) openItem(m); }
      if (b.dataset.done) setStatus(b.dataset.done, 'DONE');
      if (b.dataset.cancel) setStatus(b.dataset.cancel, 'CANCELLED');
    });
    $('itemStatus').onchange = loadItems;
    $('addBtn').onclick = () => openItem(null);
    $('printBtn').onclick = () => { st.f && st.f.weeks.forEach((w) => { st.open[w.week_no] = true; }); if (st.f) draw(); window.print(); };
    $('minBtn').onclick = () => {
      $('minAmt').value = st.f ? st.f.minimum : 0;
      $('minError').textContent = '';
      const dlg = MS.openDialog('minDialog');
      $('minForm').onsubmit = async (e) => {
        e.preventDefault();
        if ($('minAmt').value === '' || Number($('minAmt').value) < 0) { $('minError').textContent = 'Enter 0 or more.'; return; }
        MS.busy($('minSave'), true, 'Saving…');
        try { await MS.call('CASH_MINIMUM_SET', { amount: $('minAmt').value }); dlg.close(); load(); }
        catch (err) { $('minError').textContent = err.message; } finally { MS.busy($('minSave'), false); }
      };
      $('minCancel').onclick = () => dlg.close();
    };
    load();
  });
})();
