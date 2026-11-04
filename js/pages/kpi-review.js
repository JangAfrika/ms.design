(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const mg = MS.mg, hr = MS.hr, sc = MS.sc, dc = MS.dc;
  const state = { month: /^\d{4}-\d{2}$/.test(MS.param('month')) ? MS.param('month') : MS.hr.shiftMonth(MS.hr.monthNow(), -1) };
  let r = null;

  MS.reload = () => load();
  async function load() {
    MS.setMsg('msg', 'Loading…');
    try {
      r = await MS.recall('KPI_REVIEW_GET', { period: state.month });
      const next = r.steps.findIndex((s) => !s.done);
      const rv = r.review || {};
      const stepActs = {
        1: [r.can.dept_submit ? ['sub', 'Submit my department\'s report', 'primary'] : null],
        2: [r.can.finance ? ['fin', 'Close Accounts verification', 'primary'] : null, MS.can('KPI_VERIFY') && r.figures_waiting > r.figures_waiting_mine ? ['ver', 'Verify the figures', ''] : null],
        3: [r.can.consolidate ? ['con', 'Consolidate and lock the month', 'primary'] : null],
        4: [r.can.record ? ['rec', 'Record the review meeting', 'primary'] : null],
        5: [],
        6: [r.can.targets ? ['tgt', 'Targets are set: finish the review', 'primary'] : null, MS.can('KPI_CREATE') ? ['defs', 'Open KPI targets', ''] : null]
      };
      const detail = {
        1: r.departments.map((d) => `<span class="sub">${esc(d.department_name)}: ${d.review ? 'submitted by ' + esc(d.review.submitted_by_name) : '<b class="late">not yet</b>'}</span>`).join('<br>'),
        2: `${r.figures_waiting ? `<span class="late">${esc(r.figures_waiting)} financial figure${r.figures_waiting === 1 ? '' : 's'} waiting to be verified</span>` : '<span class="sub">No financial figure is waiting.</span>'}${rv.finance_verified_by_name ? `<br><span class="sub">Verified by ${esc(rv.finance_verified_by_name)}</span>` : ''}`,
        3: rv.consolidated_by_name ? `<span class="sub">Consolidated by ${esc(rv.consolidated_by_name)}. Figures are final.</span>` : '',
        4: rv.what_went_well || rv.what_failed ? `<div class="mg-pre"><b>Went well:</b> ${esc(rv.what_went_well)}\n<b>Failed:</b> ${esc(rv.what_failed)}\n<b>Why:</b> ${esc(rv.why_failed)}</div>${rv.meeting_title ? `<span class="sub">Meeting: ${esc(rv.meeting_title)}</span>` : ''}` : '',
        5: r.reds.length ? `<ul class="mg-list">${r.reds.map((x) => `<li><span><b>${esc(x.kpi_name)}</b> <span class="sub">${esc(mg.val(x.actual, x.unit))} against ${esc(x.target_text)}</span></span>${MS.can('ISSUE_REPORT') ? `<button type="button" data-issue="${esc(x.kpi_measurement_id)}" data-name="${esc(x.kpi_name)}">Raise as an issue</button>` : ''}</li>`).join('')}</ul>${MS.can('MEETING_MANAGE') ? `<p>${MS.lnk('management/meetings.html', 'Give actions in the review meeting')}</p>` : ''}` : '<span class="sub">No Red items this month.</span>',
        6: ''
      };
      $('steps').innerHTML = r.steps.map((s, i) => `<li class="${s.done ? 'done' : i === next ? 'next' : ''}"><span class="n">${s.done ? '&#10003;' : s.n}</span><div class="body"><b>${esc(s.name)}</b><div>${detail[s.n] || ''}</div>
        <div class="acts">${(stepActs[s.n] || []).filter(Boolean).map((a) => `<button type="button" class="${a[2]}" data-step="${a[0]}">${esc(a[1])}</button>`).join('')}</div></li>`).join('');
      MS.setMsg('msg', r.label + ' · ' + (r.status ? MS.label(r.status) : 'not started') + (r.locked ? ' · figures are final' : ''));
    } catch (err) { MS.setMsg('msg', err.message, 'error'); }
  }

  function notesExtra(v) {
    return `<label>What went well <textarea id="nWell" rows="2" maxlength="4000">${esc(v.what_went_well || '')}</textarea></label>
      <label>What failed <textarea id="nFail" rows="2" maxlength="4000">${esc(v.what_failed || '')}</textarea></label>
      <label>Why it failed <textarea id="nWhy" rows="2" maxlength="4000">${esc(v.why_failed || '')}</textarea></label>`;
  }
  const notes = () => ({ what_went_well: dc.val('nWell'), what_failed: dc.val('nFail'), why_failed: dc.val('nWhy') });

  async function submitDept() {
    let dep = '';
    const picker = r.can.dept_any ? `<label class="req">Department <select id="nDep">${mg.deptOptions(r.departments, '', '— choose —')}</select></label>` : '';
    sc.ask({ title: 'Department KPI report · ' + r.label, noText: true, wide: true, button: 'Submit report',
      info: 'Your department\'s figures are already on the KPI board. Add a short note on how the month went.', extra: picker + notesExtra({}),
      run: async () => { dep = r.can.dept_any ? dc.val('nDep') : ''; if (r.can.dept_any && !dep) throw new Error('Choose the department.'); await MS.call('KPI_REVIEW_DEPT_SUBMIT', dc.clean(Object.assign({ period: r.period, department_id: dep }, notes()))); await load(); } });
  }

  async function recordForm() {
    let meetings = [];
    try { meetings = (await MS.call('MEETING_LIST', { tab: 'held', meeting_type: 'KPI_REVIEW', page_size: 30 })).rows; } catch (e) {  }
    sc.ask({ title: 'Review meeting · ' + r.label, noText: true, wide: true, button: 'Record review',
      info: r.reds.length ? r.reds.length + ' KPI' + (r.reds.length === 1 ? ' is' : 's are') + ' Red, so the reason must be written. Corrective actions are given as meeting actions.' : 'Write what went well and what did not.',
      extra: notesExtra(r.review || {}) + `<label>Meeting held <select id="nMeet">${MS.options(meetings.map((m) => ({ value: m.meeting_id, label: m.title + ' · ' + MS.shortDate(m.scheduled_at) })), '', '— none linked —')}</select></label>`,
      run: async () => { await MS.call('KPI_REVIEW_RECORD', dc.clean(Object.assign({ period: r.period, meeting_id: dc.val('nMeet') }, notes()))); await load(); } });
  }

  MS.boot({ page: 'kpi-review', any: ['KPI_VIEW'] }).then(() => {
    hr.monthBar('monthBar', state, load);
    $('steps').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.issue) {
        sc.ask({ title: 'Raise an issue · ' + b.dataset.name, label: 'What needs fixing', required: true, button: 'Report issue', info: 'The issue goes to the managers to assign. It keeps a link to this KPI figure.',
          run: async (t) => { await MS.call('ISSUE_REPORT', { title: 'Red KPI: ' + b.dataset.name + ' (' + r.label + ')', description: t, priority: 'HIGH', related_table: 'kpi_measurements', related_record_id: b.dataset.issue }); MS.setMsg('msg', 'Issue reported.', 'ok'); } });
        return;
      }
      const s = b.dataset.step;
      if (s === 'sub') submitDept();
      else if (s === 'fin') sc.ask({ title: 'Close Accounts verification', noText: true, button: 'Close verification', info: 'You confirm the financial figures of ' + r.label + ' are correct. The General Manager can then consolidate.',
        run: async () => { await MS.call('KPI_REVIEW_FINANCE', { period: r.period }); await load(); } });
      else if (s === 'ver') sc.ask({ title: 'Verify the figures', noText: true, button: 'Verify', info: 'Verifies every financial figure typed in by someone else for ' + r.label + '.',
        run: async () => { const v = await MS.call('KPI_VERIFY', { period: r.period }); MS.setMsg('msg', v.verified + ' verified.', 'ok'); await load(); } });
      else if (s === 'con') sc.ask({ title: 'Consolidate ' + r.label, noText: true, button: 'Consolidate', danger: false, info: 'The automatic figures are recalculated one last time and then every figure of the month becomes final. This cannot be undone.',
        run: async () => { await MS.call('KPI_REVIEW_CONSOLIDATE', { period: r.period }); await load(); } });
      else if (s === 'rec') recordForm();
      else if (s === 'tgt') sc.ask({ title: 'Finish the review', noText: true, button: 'Finish', info: 'You confirm the targets for next month have been looked at (and changed on the Definitions page where needed).',
        run: async () => { await MS.call('KPI_REVIEW_TARGETS', { period: r.period }); await load(); } });
      else if (s === 'defs') location.href = 'management/kpi-definitions.html';
    });
    load();
  });
})();
