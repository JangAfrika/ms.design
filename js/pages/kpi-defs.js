(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const mg = MS.mg, sc = MS.sc, dc = MS.dc, hr = MS.hr;
  const state = { page: 1, tab: 'active', q: '', cat: '' };
  let rows = [], page = null;
  const UNITS = [['PCT', 'Percent'], ['GMD', 'Money (GMD)'], ['COUNT', 'Count'], ['DAYS', 'Days'], ['HOURS', 'Hours'], ['RATIO', 'Ratio']];
  const DIRS = [['HIGHER_BETTER', 'Higher is better'], ['LOWER_BETTER', 'Lower is better'], ['TREND_REDUCTION', 'Should fall over time'], ['TREND_INCREASE', 'Should rise over time']];
  const FREQ = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'];
  const opt = (pairs, sel) => MS.options(pairs.map((p) => ({ value: p[0], label: p[1] })), sel);

  MS.reload = () => load();
  async function load() {
    MS.setMsg('msg', 'Loading…');
    try {
      const r = (page = await MS.recall('KPI_LIST', { page: state.page, page_size: 50, q: state.q || undefined, kpi_category_id: state.cat || undefined,
        status: state.tab === 'active' ? 'ACTIVE' : state.tab === 'off' ? 'INACTIVE' : undefined, core: state.tab === 'core' || undefined }));
      rows = r.rows;
      const c = r.counts;
      $('cards').innerHTML = `<div class="card"><div class="k">Switched on</div><div class="v">${esc(c.active)}</div><div class="s">of ${esc(c.total)} in the library</div></div>
        <div class="card"><div class="k">First-three-months set</div><div class="v">${esc(c.core)}</div><div class="s">the KPI document's core list</div></div>
        <div class="card ${c.without_target ? 'red' : 'green'}"><div class="k">On, no target yet</div><div class="v">${esc(c.without_target)}</div><div class="s">management has not given one</div></div>`;
      $('catSel').innerHTML = MS.options(r.categories.map((x) => ({ value: x.kpi_category_id, label: x.category_name })), state.cat, 'All categories');
      MS.setMsg('msg', r.total + ' KPI' + (r.total === 1 ? '' : 's'));
      const can = r.can.create && MS.can('KPI_CREATE');
      $('newBtn').hidden = !can;
      $('defBody').innerHTML = rows.length ? rows.map((k) => `<tr><td><b>${esc(k.kpi_name)}</b>${k.is_core ? ' <span class="pill ok">core</span>' : ''}<div class="sub">${esc(k.kpi_code)} · ${esc(k.category_name)}</div></td>
        <td>${esc(MS.label(k.frequency))}<div class="sub">${k.mode === 'AUTO' ? 'calculated' : k.mode === 'HYBRID' ? 'from reviews' : 'typed in'}</div></td>
        <td>${k.target ? esc(k.target.text) + `<div class="sub">from ${esc(k.target.effective_from)}</div>` : '<span class="late">Set by management</span>'}</td><td>${esc(k.owners)}</td><td>${MS.pill(k.status)}</td>
        <td class="acts">${can ? `<button type="button" data-edit="${esc(k.kpi_id)}">Edit</button><button type="button" data-tgt="${esc(k.kpi_id)}">Target</button><button type="button" data-own="${esc(k.kpi_id)}">Owners</button><button type="button" data-tog="${esc(k.kpi_id)}">${k.status === 'ACTIVE' ? 'Switch off' : 'Switch on'}</button>` : ''}<a class="btn" href="management/kpi-history.html?kpi=${encodeURIComponent(k.kpi_id)}">History</a></td></tr>`).join('')
        : '<tr><td colspan="6" class="empty">No KPI matches.</td></tr>';
      sc.pager('pager', r, state, load);
    } catch (err) { MS.setMsg('msg', err.message, 'error'); }
  }

  function editForm(k) {
    const isNew = !k;
    k = k || { frequency: 'MONTHLY', unit: 'PCT', direction: 'HIGHER_BETTER', status: 'ACTIVE' };
    sc.ask({ title: isNew ? 'New KPI' : 'Edit ' + k.kpi_name, wide: true, noText: true, button: 'Save',
      info: isNew ? 'A new KPI is typed in by hand each period. The system can calculate only the KPIs it was built with.' : 'The code and category of an existing KPI do not change.',
      extra: `${isNew ? `<div class="two"><label class="req">Code <input id="dCode" maxlength="41" placeholder="SAL_QUOTES"></label><label class="req">Category <select id="dCat">${MS.options(page.categories.map((x) => ({ value: x.kpi_category_id, label: x.category_name })), '', '— choose —')}</select></label></div>` : ''}
        <label class="req">Name <input id="dName" maxlength="150" value="${esc(k.kpi_name || '')}"></label>
        <label>Description <input id="dDesc" maxlength="2000" value="${esc(k.description || '')}"></label>
        <div class="two"><label class="req">Formula <input id="dForm" maxlength="300" value="${esc(k.formula || '')}"></label><label class="req">Where the data comes from <input id="dSrc" maxlength="300" value="${esc(k.data_source || '')}"></label></div>
        <div class="two"><label>Unit <select id="dUnit">${opt(UNITS, k.unit)}</select></label><label>Direction <select id="dDir">${opt(DIRS, k.direction)}</select></label></div>
        <div class="two"><label>Measured <select id="dFreq">${MS.options(FREQ.map((f) => ({ value: f, label: MS.label(f) })), k.frequency)}</select></label><label>Status <select id="dStat"><option value="ACTIVE"${k.status === 'ACTIVE' ? ' selected' : ''}>Switched on</option><option value="INACTIVE"${k.status === 'INACTIVE' ? ' selected' : ''}>Switched off</option></select></label></div>
        <label><input type="checkbox" id="dCore" style="width:auto;margin:0 6px 0 0"${k.is_core ? ' checked' : ''}> Part of the first-three-months core list</label>`,
      run: async () => {
        const body = { kpi_name: dc.val('dName'), description: dc.val('dDesc'), formula: dc.val('dForm'), data_source: dc.val('dSrc'), unit: dc.val('dUnit'), direction: dc.val('dDir'),
          frequency: dc.val('dFreq'), status: dc.val('dStat'), is_core: MS.$('dCore').checked };
        if (isNew) Object.assign(body, { kpi_code: dc.val('dCode'), kpi_category_id: dc.val('dCat') }); else body.kpi_id = k.kpi_id;
        await MS.call('KPI_SAVE', body);
        await load();
      } });
  }

  function targetForm(k) {
    const t = k.target || {};
    sc.ask({ title: 'Target · ' + k.kpi_name, label: 'Why (optional)', button: 'Save target', wide: true,
      info: 'The target counts from the month you choose; the earlier one stops the month before. Without a target the KPI is measured but has no colour. Currently: ' + (k.target ? k.target.text : 'none') + '.',
      extra: `<div class="two"><label class="req">Rule <select id="tOp"><option value="GTE">At least</option><option value="LTE">At most</option><option value="EQ">Exactly</option><option value="RANGE">Range (lower to upper)</option></select></label>
        <label class="req">Target ${k.unit === 'PCT' ? '(%)' : k.unit === 'GMD' ? '(GMD)' : ''} <input id="tVal" type="number" step="any" value="${esc(t.target_value === undefined ? '' : t.target_value)}"></label></div>
        <div class="two"><label>Upper limit (range only) <input id="tMax" type="number" step="any" value="${esc(t.target_value_max || '')}"></label><label class="req">From month <input id="tFrom" type="month" value="${esc(hr.monthNow())}"></label></div>
        <label>Applies to <select id="tScope"><option value="">Whole company</option>${page.departments.map((d) => `<option value="${esc(d.department_id)}">${esc(d.department_name)} only</option>`).join('')}</select></label>`,
      run: async (why) => {
        if (dc.val('tVal') === '') throw new Error('Enter the target.');
        const dep = dc.val('tScope');
        await MS.call('KPI_TARGET_SAVE', dc.clean({ kpi_id: k.kpi_id, target_operator: dc.val('tOp'), target_value: dc.num('tVal'), target_value_max: dc.num('tMax'), effective_from: dc.val('tFrom'),
          scope_type: dep ? 'DEPARTMENT' : 'COMPANY', scope_id: dep, reason: why }));
        await load();
      } });
    if (t.target_operator) MS.$('tOp').value = t.target_operator;
  }

  async function ownersForm(k) {
    await MS.ref();
    const draw = () => `<p class="hint">Who is accountable. Without a row here, the owner named in the KPI document (${esc(k.data_source)}) applies.</p>
      <ul class="mg-list">${k.assignments.length ? k.assignments.map((a) => `<li><span>${esc(a.name)} <span class="sub">${esc(MS.label(a.field))}</span></span><button type="button" data-rm="${esc(a.field)}|${esc(a.id)}">Remove</button></li>`).join('') : '<li><span class="muted">None set.</span></li>'}</ul>
      <div class="two"><label>Add a position <select id="oPos">${MS.options(page.positions.map((x) => ({ value: x.position_id, label: x.position_title })), '', '— none —')}</select></label>
      <label>Add a department <select id="oDep">${mg.deptOptions(page.departments, '', '— none —')}</select></label></div>
      <label>Add a person <select id="oEmp">${MS.employeeOptions('', '— none —')}</select></label>`;
    sc.view(async () => k, (x) => ({ html: `<h3>Owners · ${esc(x.kpi_name)}</h3><div id="ownBox">${draw()}</div>`,
      buttons: [['oAdd', 'Add', 'primary', async () => {
        const f = [['position_id', 'oPos'], ['department_id', 'oDep'], ['employee_id', 'oEmp']].filter((p) => dc.val(p[1]))[0];
        if (!f) return sc.viewError('Choose a position, a department or a person.');
        try { await MS.call('KPI_ASSIGN_SET', { kpi_id: k.kpi_id, [f[0]]: dc.val(f[1]) }); sc.closeView(); await load(); ownersForm(rows.find((r) => r.kpi_id === k.kpi_id)); } catch (err) { sc.viewError(err.message); }
      }]],
      after: () => { $('ownBox').onclick = async (e) => {
        const b = e.target.closest('[data-rm]');
        if (!b) return;
        const [field, id] = b.dataset.rm.split('|');
        try { await MS.call('KPI_ASSIGN_SET', { kpi_id: k.kpi_id, [field]: id, active: false }); sc.closeView(); await load(); ownersForm(rows.find((r) => r.kpi_id === k.kpi_id)); } catch (err) { sc.viewError(err.message); }
      }; } }));
  }

  MS.boot({ page: 'kpi-defs', any: ['KPI_CREATE', 'KPI_VIEW'] }).then(() => {
    sc.tabs('tabs', state, load);
    $('newBtn').onclick = () => editForm(null);
    $('catSel').onchange = () => { state.cat = $('catSel').value; state.page = 1; load(); };
    $('q').addEventListener('input', MS.debounce(() => { state.q = $('q').value.trim(); state.page = 1; load(); }));
    $('defBody').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const id = b.dataset.edit || b.dataset.tgt || b.dataset.own || b.dataset.tog, k = rows.find((x) => x.kpi_id === id);
      if (b.dataset.edit) editForm(k); else if (b.dataset.tgt) targetForm(k); else if (b.dataset.own) ownersForm(k);
      else if (b.dataset.tog) MS.call('KPI_SAVE', { kpi_id: id, status: k.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }).then(load).catch((err) => MS.setMsg('msg', err.message, 'error'));
    });
    load();
  });
})();
