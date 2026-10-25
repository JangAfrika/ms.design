/* My KPIs: the KPIs I am accountable for with their colour, my own attendance, training and actions, and my performance reviews. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const mg = MS.mg, hr = MS.hr, sc = MS.sc, dc = MS.dc;
  const state = { month: hr.monthNow() };
  let reviews = [];

  MS.reload = () => load();

  /* ---------- Your productivity (WorkScore.gs): saved figures first, worked out again only when they are old ---------- */
  const wk = { period: 'roll', data: null };
  const lvlOf = (v, d) => v === null || v === undefined ? 'none' : v >= d.good ? 'GOOD' : v >= d.ok ? 'OK' : 'LOW';
  function drawWork() {
    const box = $('workPanel'), d = wk.data;
    if (!d || !d.enabled) { box.hidden = true; return; }
    const cur = wk.period === 'roll' ? d.roll : d.current_month;
    const label = wk.period === 'roll' ? 'the last 30 days' : d.month_label;
    const has = cur && cur.score !== null && cur.score !== undefined;
    const lvl = has ? cur.level : 'none';
    const tabs = `<div class="wk-tabs"><button type="button" data-p="roll" class="${wk.period === 'roll' ? 'on' : ''}">Last 30 days</button><button type="button" data-p="month" class="${wk.period === 'month' ? 'on' : ''}">${esc(d.month_label)}</button></div>`;
    const parts = cur && cur.parts ? cur.parts : [];
    const totalW = parts.reduce((t, p) => t + (p.applies ? p.weight : 0), 0) || 1;
    const partsHtml = parts.map((p) => {
      const on = p.applies, pl = lvlOf(on ? p.score : null, d);
      return `<div class="wk-part${on ? '' : ' off'}"><div class="wk-part-h">${MS.icon(p.icon)}<b>${esc(p.label)}</b><span class="share">${on ? Math.round(100 * p.weight / totalW) + ' % of score' : ''}</span><span class="sc">${on ? Math.round(p.score) : '–'}</span></div>
        <div class="wk-bar ${pl}"><i style="width:${on ? Math.max(0, Math.min(100, p.score)) : 0}%"></i></div>
        <p class="why">${on ? esc(p.why) : '<span class="muted">' + esc(p.why || 'Nothing to measure yet.') + '</span>'}</p>
        ${on && p.score < 100 && p.tip ? `<p class="tip">${MS.icon('target')}<span>${esc(p.tip)}</span></p>` : ''}</div>`;
    }).join('');
    const gap = has && d.target ? ` · target ${esc(d.target)}` : '';
    box.hidden = false;
    box.innerHTML = `<div class="wk-top"><div class="wk-big">${MS.work.ring(has ? cur.score : null, lvl, 64)}
      <div class="wk-sum"><b>${has ? esc(MS.work.levelWord(lvl)) + ' · ' + esc(Math.round(cur.score)) + ' / 100' : 'No work yet'} ${has && wk.period === 'roll' ? MS.work.trend(cur.trend) : ''}</b>
      <span class="muted">${has ? esc(cur.headline || '') : 'Your score starts with your first job step. Nothing is counted against you until then.'}${gap}</span></div></div>${tabs}</div>
      ${has ? `<div class="wk-bar ${lvl}" title="Good from ${esc(d.good)}, fair from ${esc(d.ok)}"><i style="width:${Math.max(0, Math.min(100, cur.score))}%"></i><u style="left:${esc(d.ok)}%"></u><u style="left:${esc(d.good)}%"></u></div>` : ''}
      <div class="wk-parts">${partsHtml}</div>
      <p class="hint" style="margin:8px 0 0">Your productivity over ${esc(label)}: how quickly you respond, start early, finish on time, how much you complete and how well. It rises as you do. Updated ${cur && cur.computed_at ? esc(MS.ago(cur.computed_at)) : 'when you next open work'}.</p>`;
  }
  async function loadWork() {
    try {
      let d = await MS.call('WORK_SCORE_GET', {});
      if (d && d.enabled && d.stale) { try { d = await MS.call('WORK_SCORE_REFRESH', {}); } catch (e) { /* show what is saved */ } }
      wk.data = d;
      drawWork();
    } catch (e) { $('workPanel').hidden = true; }
  }

  /* ---------- the team (managers only; the server limits it to their scope) ---------- */
  const team = { data: null };
  function drawTeam() {
    const d = team.data;
    if (!d || !d.enabled) { $('teamPanel').hidden = true; return; }
    $('teamPanel').hidden = false;
    const dep = $('teamDept'), keep = dep.value;
    dep.innerHTML = '<option value="">' + (d.scope === 'DEPARTMENT' ? 'My department' : 'All departments') + '</option>' + d.departments.map((x) => `<option value="${esc(x.department_id)}">${esc(x.department_name)}</option>`).join('');
    dep.value = keep; dep.hidden = d.departments.length < 2;
    const rows = d.rows.filter((r) => !dep.value || r.department_id === dep.value);
    const me = MS.user && MS.user.user_id;
    $('teamSum').textContent = d.scored ? `average ${Math.round(d.average)} · ${d.scored} scored, ${d.no_work} with no work yet` : 'nobody has work to score yet';
    $('teamBody').innerHTML = rows.length ? rows.map((r) => {
      const has = r.score !== null;
      return `<tr class="${r.user_id === me ? 'me' : ''}"><td><b>${esc(r.name)}</b><div class="sub">${esc(r.position_title)}${r.sections.length ? ' · ' + esc(r.sections.join(', ')) : ''}</div></td><td>${esc(r.department_name || '')}</td>
        <td>${has ? `<div style="display:flex;align-items:center;gap:8px;min-width:130px"><b style="width:26px">${Math.round(r.score)}</b><div class="wk-bar ${r.level}" style="flex:1;margin:0"><i style="width:${Math.max(0, Math.min(100, r.score))}%"></i></div></div>` : '<span class="muted">no work yet</span>'}</td>
        <td>${has ? MS.work.trend(r.trend) : ''}</td>
        <td><span class="wk-mini" title="${esc(r.headline)}">${r.parts.filter((p) => p.applies).map((p) => `<span class="wk-dot ${lvlOf(p.score, d)}" title="${esc(p.label)} ${Math.round(p.score)}"></span>`).join('')}</span></td>
        <td class="num">${esc(r.items_done)} / ${esc(r.items_total)}</td></tr>`;
    }).join('') : '<tr><td colspan="6" class="empty">Nobody in this list.</td></tr>';
  }
  async function loadTeam() {
    if (!MS.user || !MS.user.permissions || !MS.user.permissions.KPI_VIEW || MS.user.permissions.KPI_VIEW === 'OWN') { $('teamPanel').hidden = true; return; }
    try { team.data = await MS.call('WORK_TEAM_GET', {}); drawTeam(); } catch (e) { $('teamPanel').hidden = true; }
  }

  async function load() {
    MS.setMsg('msg', 'Loading…');
    try {
      const r = await MS.recall('KPI_MINE_GET', { month: state.month });
      reviews = r.reviews;
      if (!wk.data) { loadWork(); loadTeam(); }
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
    $('workPanel').addEventListener('click', (e) => { const b = e.target.closest('.wk-tabs button'); if (b) { wk.period = b.dataset.p; drawWork(); } });
    $('teamRefresh').innerHTML = MS.icon('refresh') + '<span>Refresh</span>';
    $('teamRefresh').addEventListener('click', async () => {
      const b = $('teamRefresh'); b.disabled = true;
      try { team.data = await MS.call('WORK_TEAM_REFRESH', {}); drawTeam(); loadWork(); } catch (err) { MS.setMsg('msg', err.message, 'error'); } finally { b.disabled = false; }
    });
    $('teamDept').addEventListener('change', drawTeam);
    // my own score moves as soon as I save something on another tab of the app, or come back to this one
    document.addEventListener('visibilitychange', () => { if (!document.hidden && wk.data) loadWork(); });
    $('revBody').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const v = reviews.find((x) => x.performance_review_id === (b.dataset.open || b.dataset.ack));
      if (b.dataset.open) view(v); else if (b.dataset.ack) ack(v);
    });
    load();
  });
})();
