/* History of one KPI over the last months as a line chart (drawn here, no outside library) with the target line and a table of the figures. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const mg = MS.mg;
  const state = { kpi: MS.param('kpi'), dep: MS.param('dep'), count: 12 };

  MS.reload = () => load();
  async function load() {
    if (!state.kpi) { $('chart').innerHTML = '<p class="empty">Choose a KPI.</p>'; $('histBody').innerHTML = ''; return; }
    MS.setMsg('msg', 'Loading…');
    try {
      const r = await MS.recall('KPI_HISTORY_GET', { kpi_id: state.kpi, department_id: state.dep || undefined, count: state.count });
      $('depSel').innerHTML = MS.options([{ value: '', label: 'Whole company' }].concat(r.departments.map((d) => ({ value: d.department_id, label: d.department_name }))), state.dep);
      const k = r.kpi;
      $('title').textContent = k.kpi_name;
      $('about').innerHTML = MS.kv([['Category', k.category_name], ['Measured', MS.label(k.frequency) + ' · ' + (k.mode === 'AUTO' ? 'calculated from live data' : 'typed in')], ['Formula', k.formula], ['Target now', k.target ? k.target.text : 'Set by management'], ['Owner', k.owners]]);
      const rows = r.rows.map((x) => Object.assign({}, x, { label: x.label }));
      $('chart').innerHTML = mg.chart(rows, k.unit);
      $('histBody').innerHTML = rows.length ? rows.slice().reverse().map((x) => `<tr><td>${esc(x.label)}</td><td class="num">${esc(mg.val(x.actual_value, k.unit))}</td><td class="num">${esc(x.target_value === null ? 'none' : mg.val(x.target_value, k.unit))}</td><td class="num">${x.achievement_pct === '' ? '–' : esc(x.achievement_pct) + ' %'}</td><td>${mg.rag(x.rating, x.target_value !== null)}</td><td>${MS.pill(x.status)}</td></tr>`).join('')
        : '<tr><td colspan="6" class="empty">No figures yet.</td></tr>';
      MS.setMsg('msg', r.department_name + ' · ' + r.total + ' figure' + (r.total === 1 ? '' : 's'));
    } catch (err) { MS.setMsg('msg', err.message, 'error'); }
  }

  MS.boot({ page: 'kpi-history', any: ['KPI_VIEW'] }).then(async () => {
    try {
      const l = await MS.recall('KPI_LIST', { page_size: 200, status: 'ACTIVE' });
      $('kpiSel').innerHTML = MS.options(l.rows.map((k) => ({ value: k.kpi_id, label: k.kpi_name })), state.kpi, '— choose a KPI —');
    } catch (err) { MS.setMsg('msg', err.message, 'error'); }
    $('kpiSel').onchange = () => { state.kpi = $('kpiSel').value; load(); };
    $('depSel').onchange = () => { state.dep = $('depSel').value; load(); };
    $('cntSel').onchange = () => { state.count = Number($('cntSel').value); load(); };
    load();
  });
})();
