/* The one-page monthly dashboard: key figures, every active KPI with its colour, the review and the month's report. Printed from the browser. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const mg = MS.mg, hr = MS.hr;
  const state = { month: /^\d{4}-\d{2}$/.test(MS.param('month')) ? MS.param('month') : hr.monthNow() };

  const pct = (v) => (v === null || v === undefined ? '–' : MS.num(v) + ' %');
  MS.reload = () => load();
  async function load() {
    MS.setMsg('msg', 'Loading…');
    try {
      const d = await MS.recall('MGMT_DASHBOARD_GET', { month: state.month });
      const f = d.figures, c = f.kpis ? f.kpis.counts : null;
      MS.setMsg('msg', '');
      $('sheet').innerHTML = `<h1 style="margin:0">${esc((window.APP_CONFIG && window.APP_CONFIG.APP_NAME) || 'MS Designs & Printing')}: ${esc(d.label)}</h1>
        <p class="muted">Monthly management dashboard · prepared by ${esc(d.generated_by)} on ${esc(MS.when(d.generated_at))}</p>
        <div class="cards">
          <div class="card"><div class="k">Jobs done</div><div class="v">${esc(f.jobs.done)}</div><div class="s">${esc(f.jobs.done_on_time)} on time · ${esc(f.jobs.delayed)} delayed now</div></div>
          <div class="card"><div class="k">Attendance</div><div class="v">${esc(pct(f.staff.attendance_pct))}</div><div class="s">${esc(d.headcount)} staff</div></div>
          ${f.finance ? `<div class="card"><div class="k">Revenue</div><div class="v">${esc(MS.money(f.finance.revenue))}</div><div class="s">margin ${esc(pct(f.finance.gross_margin_pct))}</div></div><div class="card ${f.finance.net_profit < 0 ? 'red' : 'green'}"><div class="k">Net profit</div><div class="v">${esc(MS.money(f.finance.net_profit))}</div><div class="s">revenue less costs</div></div>` : ''}
          <div class="card ${f.issues.overdue ? 'red' : ''}"><div class="k">Issues</div><div class="v">${esc(f.issues.open)} open</div><div class="s">${esc(f.issues.opened)} new · ${esc(f.issues.resolved)} resolved · ${esc(f.issues.overdue)} past date</div></div>
          <div class="card ${f.actions.overdue_open ? 'red' : ''}"><div class="k">Meeting actions</div><div class="v">${esc(f.actions.done_on_time)} / ${esc(f.actions.due)}</div><div class="s">done on time · ${esc(f.actions.overdue_open)} overdue now</div></div>
          ${c ? `<div class="card"><div class="k">KPI colours</div><div class="v">${esc(c.GREEN)} / ${esc(c.AMBER)} / ${esc(c.RED)}</div><div class="s">Green / Amber / Red · ${esc(c.no_target)} without target</div></div>` : ''}
        </div>
        <h2>Key performance indicators</h2>
        <div class="tablewrap"><table class="inv"><thead><tr><th>KPI</th><th>Target</th><th class="num">Actual</th><th class="num">Before</th><th>Colour</th></tr></thead><tbody>${d.kpis.length ? d.kpis.map((k) => `<tr><td>${esc(k.kpi_name)}<span class="sub">${esc(k.category_name)}</span></td><td>${esc(k.target_text || 'Set by management')}</td><td class="num">${esc(mg.val(k.actual, k.unit))}</td><td class="num">${esc(mg.val(k.previous, k.unit))}</td><td>${mg.rag(k.rating, k.has_target)} ${mg.trend(k.trend)}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">No KPI figures.</td></tr>'}</tbody></table></div>
        <h2>Monthly review</h2>${d.review ? `<p>Status: <b>${esc(MS.label(d.review.status))}</b></p>${d.review.what_went_well ? `<p><b>Went well:</b> ${esc(d.review.what_went_well)}</p>` : ''}${d.review.what_failed ? `<p><b>Failed:</b> ${esc(d.review.what_failed)}</p><p><b>Why:</b> ${esc(d.review.why_failed)}</p>` : ''}` : '<p class="muted">The review of this month has not started.</p>'}
        <p>General Manager's monthly report: ${d.monthly_report ? '<b>' + esc(MS.label(d.monthly_report.status)) + '</b>' + (d.monthly_report.submitted_at ? (d.monthly_report.on_time ? ' (on time)' : ' (late)') : '') : '<span class="muted">not written yet</span>'}</p>`;
    } catch (err) { MS.setMsg('msg', err.message, 'error'); }
  }

  MS.boot({ page: 'monthly-dashboard', any: ['MGMT_REPORT_SUBMIT', 'KPI_REVIEW', 'KPI_VERIFY'] }).then(() => {
    hr.monthBar('monthBar', state, load);
    $('printBtn').onclick = mg.print;
    load();
  });
})();
