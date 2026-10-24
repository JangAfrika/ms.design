/* My KPIs: the KPIs I am accountable for with their colour, my own attendance, training and actions, and my performance reviews. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const mg = MS.mg, hr = MS.hr, sc = MS.sc, dc = MS.dc;
  const state = { month: hr.monthNow() };
  let reviews = [];

  MS.reload = () => load();
  async function load() {
    MS.setMsg('msg', 'Loading…');
    try {
      const r = await MS.recall('KPI_MINE_GET', { month: state.month });
      reviews = r.reviews;
      const f = r.figures;
      $('cards').innerHTML = f ? `<div class="card ${f.attendance_pct !== null && f.attendance_pct < f.attendance_target ? 'red' : 'green'}"><div class="k">My attendance</div><div class="v">${esc(hr.pct(f.attendance_pct))}</div><div class="s">target ${esc(f.attendance_target)} %</div></div>
        <div class="card ${f.punctuality_pct !== null && f.punctuality_pct < f.attendance_target ? 'red' : 'green'}"><div class="k">On time</div><div class="v">${esc(hr.pct(f.punctuality_pct))}</div><div class="s">days arrived by the start time</div></div>
        <div class="card ${f.training_overdue ? 'red' : ''}"><div class="k">Required training</div><div class="v">${esc(hr.pct(f.training_pct))}</div><div class="s">${esc(f.training_overdue)} overdue</div></div>
        <div class="card ${f.actions_overdue ? 'red' : ''}"><div class="k">My actions</div><div class="v">${esc(f.actions_open)} open</div><div class="s">${esc(f.actions_overdue)} past their date</div></div>
        <div class="card"><div class="k">My latest score</div><div class="v">${r.score ? esc(MS.num(r.score.total_score)) + ' / 100' : '–'}</div><div class="s">${r.score ? mg.rag(r.score.rating) + ' ' + esc(mg.monthLabel(r.score.review_period)) : 'no review yet'}</div></div>` : '';
      MS.setMsg('msg', r.no_staff_record ? 'Your login is not linked to a staff record, so attendance and reviews do not apply to you.' : '');
      $('kpiBody').innerHTML = r.kpis.length ? r.kpis.map((k) => `<tr><td><b>${esc(k.kpi_name)}</b><div class="sub">${esc(k.category_name)}</div></td><td>${esc(k.target_text || 'Set by management')}</td>
        <td class="num">${esc(mg.val(k.actual, k.unit))}</td><td>${mg.rag(k.rating, k.has_target)}</td><td>${mg.trend(k.trend)}</td><td>${k.status ? MS.pill(k.status) : '<span class="muted">no figure yet</span>'}</td></tr>`).join('')
        : '<tr><td colspan="6" class="empty">No KPI is assigned to you yet. Management assigns KPIs on the Definitions page.</td></tr>';
      $('revBody').innerHTML = reviews.length ? reviews.map((v) => `<tr><td>${esc(MS.label(v.review_type))}</td><td>${esc(mg.monthLabel(v.review_period))}</td><td class="num">${esc(MS.num(v.total_score))}</td><td>${mg.rag(v.rating)}</td>
        <td>${MS.pill(v.status)}</td><td>${esc(v.reviewer_name)}</td><td class="acts"><button type="button" data-open="${esc(v.performance_review_id)}">Open</button>${v.can_acknowledge ? `<button type="button" class="primary" data-ack="${esc(v.performance_review_id)}">Read and acknowledge</button>` : ''}</td></tr>`).join('')
        : '<tr><td colspan="7" class="empty">No performance review has been shared with you yet.</td></tr>';
    } catch (err) { MS.setMsg('msg', err.message, 'error'); }
  }

  function view(v) {
    sc.view(async () => v, (x) => ({
      html: `<h3>${esc(MS.label(x.review_type))} review · ${esc(mg.monthLabel(x.review_period))}</h3>
        ${MS.kv([['Reviewer', x.reviewer_name], ['Status', MS.pill(x.status), true], ['Total score', MS.num(x.total_score) + ' / 100'], ['Rating', mg.rag(x.rating), true]])}
        <div class="tablewrap"><table class="inv"><thead><tr><th>Part</th><th class="num">Weight</th><th class="num">Score</th><th>Evidence</th></tr></thead><tbody>${x.scores.map((s) => `<tr><td>${esc(s.label)}</td><td class="num">${esc(s.weight_pct)} %</td><td class="num">${s.score_pct === null ? '–' : esc(s.score_pct)}</td><td>${esc(s.evidence)}</td></tr>`).join('')}</tbody></table></div>
        ${x.strengths ? `<h3 class="sub-h">Strengths</h3><div class="mg-pre">${esc(x.strengths)}</div>` : ''}${x.improvement_areas ? `<h3 class="sub-h">To improve</h3><div class="mg-pre">${esc(x.improvement_areas)}</div>` : ''}${x.training_needs ? `<h3 class="sub-h">Training needs</h3><div class="mg-pre">${esc(x.training_needs)}</div>` : ''}
        ${x.employee_comment ? `<h3 class="sub-h">Your comment</h3><div class="mg-pre">${esc(x.employee_comment)}</div>` : ''}`,
      buttons: [x.can_acknowledge ? ['vAck', 'Acknowledge', 'primary', () => { sc.closeView(); ack(x); }] : null]
    }));
  }
  function ack(v) {
    sc.ask({ title: 'Acknowledge your review', label: 'Your comment (optional)', button: 'I have read it', info: 'This tells your reviewer you have read it. You may add one comment.',
      run: async (t) => { await MS.call('PERF_ACKNOWLEDGE', dc.clean({ performance_review_id: v.performance_review_id, comment: t })); await load(); } });
  }

  MS.boot({ page: 'kpi-mine', any: ['KPI_VIEW'] }).then(() => {
    hr.monthBar('monthBar', state, load);
    $('revBody').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const v = reviews.find((x) => x.performance_review_id === (b.dataset.open || b.dataset.ack));
      if (b.dataset.open) view(v); else if (b.dataset.ack) ack(v);
    });
    load();
  });
})();
