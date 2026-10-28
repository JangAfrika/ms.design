(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const mg = MS.mg, hr = MS.hr, sc = MS.sc, dc = MS.dc;
  const state = { month: hr.monthNow(), dep: '' };
  let data = null;

  MS.reload = () => load();
  async function load() {
    MS.setMsg('msg', 'Loading…');
    try {
      const r = (data = await MS.recall('KPI_BOARD_GET', { month: state.month, department_id: state.dep || undefined }));
      const c = r.counts;
      $('depSel').innerHTML = MS.options([{ value: '', label: 'Whole company' }].concat(r.departments.map((d) => ({ value: d.department_id, label: d.department_name }))), state.dep);
      $('cards').innerHTML = `<div class="card green"><div class="k">Green</div><div class="v">${esc(c.GREEN)}</div><div class="s">90 to 100 % of target</div></div>
        <div class="card"><div class="k">Amber</div><div class="v">${esc(c.AMBER)}</div><div class="s">70 to 89 %</div></div>
        <div class="card ${c.RED ? 'red' : ''}"><div class="k">Red</div><div class="v">${esc(c.RED)}</div><div class="s">below 70 %: corrective action</div></div>
        <div class="card"><div class="k">No target yet</div><div class="v">${esc(c.no_target)}</div><div class="s">measured, shown without a colour</div></div>
        <div class="card"><div class="k">No figure yet</div><div class="v">${esc(c.no_figure)}</div><div class="s">${r.locked ? 'month is locked' : 'waiting for data'}</div></div>
        <div class="card"><div class="k">Monthly review</div><div class="v">${r.review_status ? esc(MS.label(r.review_status)) : 'Not started'}</div><div class="s">${MS.lnk('management/kpi-review.html?month=' + encodeURIComponent(state.month), 'open the review')}</div></div>`;
      $('snapBtn').hidden = !r.can.snapshot || r.locked;
      const waiting = r.rows.filter((x) => x.can_verify).length;
      $('verBtn').hidden = !r.can.verify || !waiting;
      $('verBtn').textContent = 'Verify ' + waiting + ' financial figure' + (waiting === 1 ? '' : 's');
      MS.setMsg('msg', r.department_name + ' · ' + r.month_label + ' · ' + r.total + ' KPI' + (r.total === 1 ? '' : 's') + (r.locked ? ' · figures are final' : ''));
      let last = null, html = '';
      r.rows.forEach((k) => {
        if (k.category_name !== last) { html += `<tr class="kpi-cat"><td colspan="9">${esc(k.category_name)}</td></tr>`; last = k.category_name; }
        const acts = [`<a class="btn" href="management/kpi-history.html?kpi=${encodeURIComponent(k.kpi_id)}&dep=${encodeURIComponent(state.dep)}">History</a>`];
        if (k.can_record) acts.push(`<button type="button" data-rec="${esc(k.kpi_id)}">${k.actual === null ? 'Enter figure' : 'Change'}</button>`);
        if (k.can_verify) acts.push(`<button type="button" class="primary" data-ver="${esc(k.kpi_measurement_id)}">Verify</button>`);
        html += `<tr><td><b>${esc(k.kpi_name)}</b>${k.is_core ? '' : ''}<div class="sub">${esc(k.owners)}</div></td><td>${esc(k.target_text || 'Set by management')}</td>
          <td class="num">${esc(mg.val(k.actual, k.unit))}</td><td class="num muted">${esc(mg.val(k.previous, k.unit))}</td><td>${mg.rag(k.rating, k.has_target)}</td><td>${mg.trend(k.trend)}</td>
          <td>${k.status ? MS.pill(k.status) : ''}${k.needs_verify ? '<div class="sub">waiting for Accounts</div>' : ''}${k.mode === 'AUTO' ? '<div class="sub">calculated</div>' : ''}</td>
          <td class="sub">${esc(k.note || '')}${k.entered_by_name && k.mode === 'MANUAL' ? 'entered by ' + esc(k.entered_by_name) : ''}${k.verified_by_name ? ' · verified by ' + esc(k.verified_by_name) : ''}</td><td class="acts">${acts.join('')}</td></tr>`;
      });
      $('boardBody').innerHTML = html || '<tr><td colspan="9" class="empty">No KPI to show here.</td></tr>';
    } catch (err) { MS.setMsg('msg', err.message, 'error'); }
  }

  function recordForm(k) {
    sc.ask({ title: 'Enter figure · ' + k.kpi_name, label: 'Note (optional)', button: 'Save figure', wide: false,
      info: (k.financial ? 'A financial figure waits for Accounts to verify it. ' : '') + 'For ' + (data.department_name || 'the company') + ', ' + mg.monthLabel(k.period) + '. Target: ' + (k.target_text || 'not set yet') + '.',
      extra: `<label class="req">Figure${k.unit === 'PCT' ? ' (%)' : k.unit === 'GMD' ? ' (GMD)' : ''} <input id="kVal" type="number" step="any" value="${k.actual === null ? '' : esc(k.actual)}"></label>`,
      run: async (t) => {
        if (dc.val('kVal') === '') throw new Error('Enter the figure.');
        await MS.call('KPI_RECORD', dc.clean({ kpi_id: k.kpi_id, period: k.period, department_id: state.dep, actual_value: dc.num('kVal'), comments: t }));
        await load();
      } });
  }

  MS.boot({ page: 'kpi-board', any: ['KPI_VIEW'] }).then(() => {
    state.month = /^\d{4}-\d{2}$/.test(MS.param('month')) ? MS.param('month') : state.month;
    hr.monthBar('monthBar', state, load);
    $('depSel').onchange = () => { state.dep = $('depSel').value; load(); };
    $('snapBtn').onclick = async () => {
      MS.busy($('snapBtn'), true, 'Calculating…');
      try { const r = await MS.call('KPI_SNAPSHOT_RUN', { period: state.month }); MS.setMsg('msg', 'Recalculated: ' + r.written + ' figures written, ' + r.no_data + ' without data' + (r.failed.length ? ', ' + r.failed.length + ' failed' : '') + '.', r.failed.length ? 'error' : 'ok'); await load(); }
      catch (err) { MS.setMsg('msg', err.message, 'error'); } finally { MS.busy($('snapBtn'), false); }
    };
    $('verBtn').onclick = () => sc.ask({ title: 'Verify financial figures', noText: true, button: 'Verify', info: 'You confirm the figures typed in for ' + hr.monthName(state.month) + ' by someone else. Figures you typed yourself stay waiting for another person.',
      run: async () => { const r = await MS.call('KPI_VERIFY', { period: state.month }); MS.setMsg('msg', r.verified + ' verified.' + (r.left_for_someone_else ? ' ' + r.left_for_someone_else + ' you entered yourself are left for someone else.' : ''), 'ok'); await load(); } });
    $('boardBody').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.rec) recordForm(data.rows.find((x) => x.kpi_id === b.dataset.rec));
      else if (b.dataset.ver) MS.call('KPI_VERIFY', { kpi_measurement_ids: [b.dataset.ver] }).then(load).catch((err) => MS.setMsg('msg', err.message, 'error'));
    });
    load();
  });
})();
