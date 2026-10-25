/* Performance reviews: the score out of 100 (Output 25, Quality 20, Timeliness 15, Attendance 15, Teamwork 10, Accountability 10, Initiative 5).
   Attendance and Accountability are suggested from live data; the rest is the reviewer's judgement. Nobody reviews themselves, and the General
   Manager is reviewed quarterly by the CEO. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const mg = MS.mg, sc = MS.sc, dc = MS.dc, hr = MS.hr;
  const state = { type: 'MONTHLY', period: '' };
  let rows = [];

  MS.reload = () => load();
  async function load() {
    MS.setMsg('msg', 'Loading…');
    try {
      const r = await MS.recall('PERF_STAFF', state.period ? { review_type: state.type, period: state.period } : { review_type: state.type });
      state.period = r.period;
      rows = r.rows;
      $('perSel').value = r.period;
      MS.setMsg('msg', r.label + ' · ' + r.total + ' people you may review');
      $('perfBody').innerHTML = rows.length ? rows.map((s) => `<tr><td>${hr.person(s.name, s.employee_number)}</td><td>${esc(s.department_name)}<div class="sub">${esc(s.position_title)}</div></td>
        <td>${s.status ? MS.pill(s.status) : '<span class="muted">not started</span>'}</td><td class="num">${s.total_score === '' ? '' : esc(MS.num(s.total_score))}</td><td>${s.rating ? mg.rag(s.rating) : ''}</td>
        <td class="acts">${s.can_review && MS.can('PERFORMANCE_REVIEW') ? `<button type="button" class="${s.status ? '' : 'primary'}" data-rv="${esc(s.employee_id)}">${s.status === 'DRAFT' || !s.status ? 'Review' : 'Open'}</button>` : `<span class="sub">${esc(s.block_reason)}</span>`}</td></tr>`).join('')
        : '<tr><td colspan="6" class="empty">There is nobody you may review.</td></tr>';
    } catch (err) { MS.setMsg('msg', err.message, 'error'); }
  }

  async function review(employeeId) {
    await sc.view(() => MS.call('PERF_GET', { employee_id: employeeId, review_type: state.type, period: state.period }), (g) => {
      const rv = g.review || {}, by = {};
      (rv.scores || []).forEach((s) => { by[s.component] = s; });
      const editable = g.can.save;
      const rowsHtml = g.components.map((c) => {
        const have = by[c.component], sug = g.suggestions[c.component];
        const v = have && have.score_pct !== null ? have.score_pct : sug ? sug.score_pct : '';
        const ev = have ? have.evidence : sug ? sug.evidence : '';
        return `<div class="mg-score"><b>${esc(c.label)}</b><input type="number" min="0" max="100" step="any" data-c="${esc(c.component)}" data-f="s" value="${esc(v)}"${editable ? '' : ' disabled'} aria-label="${esc(c.label)} score"><span class="w">weight ${esc(c.weight_pct)} %</span>
          <input class="ev" type="text" maxlength="300" data-c="${esc(c.component)}" data-f="e" value="${esc(ev)}" placeholder="${sug ? 'suggested from live data' : 'evidence or comment'}"${editable ? '' : ' disabled'} aria-label="${esc(c.label)} evidence"></div>`;
      }).join('');
      const text = (id, label, val) => `<label>${label} <textarea id="${id}" rows="2" maxlength="3000"${editable ? '' : ' disabled'}>${esc(val || '')}</textarea></label>`;
      return {
        html: `<h3>${esc(g.person.name)} · ${esc(MS.label(g.review_type))} · ${esc(g.label)}</h3><p class="hint">${esc(g.person.position_title)}, ${esc(g.person.department_name)}${rv.status ? ' · ' + MS.statusLabel(rv.status) : ''}. ${editable ? 'Score each part from 0 to 100. The total is worked out for you.' : ''}</p>
          ${rowsHtml}<div class="mg-total" id="pTotal"></div>${text('pStr', 'Strengths', rv.strengths)}${text('pImp', 'Areas to improve', rv.improvement_areas)}${text('pTrn', 'Training needs', rv.training_needs)}
          ${rv.employee_comment ? `<h3 class="sub-h">Employee's comment</h3><div class="mg-pre">${esc(rv.employee_comment)}</div>` : ''}`,
        buttons: [editable ? ['pSave', 'Save draft', '', () => save(g, false)] : null, editable ? ['pSub', 'Submit to the employee', 'primary', () => save(g, true)] : null,
          g.can.finalise && MS.can('PERFORMANCE_REVIEW') ? ['pFin', 'Finalise', 'primary', async () => { try { await MS.call('PERF_FINALISE', { performance_review_id: rv.performance_review_id }); sc.closeView(); await load(); } catch (err) { sc.viewError(err.message); } }] : null],
        after: () => { total(g); $('viewBody').oninput = () => total(g); }
      };
    });
  }
  function scores() { return Array.from(MS.$('viewBody').querySelectorAll('input[data-f=s]')).map((i) => ({ component: i.dataset.c, score_pct: i.value, evidence: MS.$('viewBody').querySelector('input[data-f=e][data-c=' + i.dataset.c + ']').value })); }
  function total(g) {
    const s = scores(), filled = s.filter((x) => x.score_pct !== '');
    const t = g.components.reduce((a, c) => { const x = s.find((y) => y.component === c.component); return a + (x && x.score_pct !== '' ? c.weight_pct * Number(x.score_pct) / 100 : 0); }, 0);
    $('pTotal').innerHTML = filled.length === g.components.length ? 'Total ' + esc(MS.num(Math.round(t * 10) / 10)) + ' / 100 ' + mg.rag(t >= 90 ? 'GREEN' : t >= 70 ? 'AMBER' : 'RED') : '<span class="muted">Total shown when all seven parts are scored.</span>';
  }
  async function save(g, submit) {
    try {
      await MS.call('PERF_SAVE', { employee_id: g.person.employee_id, review_type: g.review_type, period: g.period, scores: scores(), strengths: dc.val('pStr'), improvement_areas: dc.val('pImp'), training_needs: dc.val('pTrn'), submit });
      sc.closeView(); await load();
    } catch (err) { sc.viewError(err.message); }
  }

  MS.boot({ page: 'performance', any: ['PERFORMANCE_REVIEW'] }).then(() => {
    $('typeSel').onchange = () => { state.type = $('typeSel').value; state.period = ''; $('perSel').value = ''; load(); };
    $('perSel').onchange = () => { state.period = $('perSel').value.trim(); load(); };
    $('perfBody').addEventListener('click', (e) => { const b = e.target.closest('[data-rv]'); if (b) review(b.dataset.rv); });
    load();
  });
})();
