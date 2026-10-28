(function () {
  const MS = window.MS;
  const esc = (s) => MS.esc(s);
  const mg = (MS.mg = {});

  mg.RAG = { GREEN: 'Green', AMBER: 'Amber', RED: 'Red' };
  mg.rag = (rating, hasTarget) => (rating ? `<span class="kpi-rag ${esc(rating)}">${esc(mg.RAG[rating])}</span>` : `<span class="kpi-rag none">${hasTarget === false ? 'No target' : '–'}</span>`);
  mg.val = (v, unit) => {
    if (v === null || v === undefined || v === '') return '–';
    if (unit === 'PCT') return MS.num(v) + ' %';
    if (unit === 'GMD') return MS.money(v);
    if (unit === 'DAYS') return MS.num(v) + ' days';
    if (unit === 'HOURS') return MS.num(v) + ' h';
    return MS.num(v);
  };
  mg.trend = (t) => (t === 'BETTER' ? '<span class="kpi-trend BETTER" title="Better than last period">&#9650; better</span>' : t === 'WORSE' ? '<span class="kpi-trend WORSE" title="Worse than last period">&#9660; worse</span>' : t === 'SAME' ? '<span class="muted">same</span>' : '');
  mg.monthLabel = (m) => (/Q/.test(m) ? m.slice(5) + ' ' + m.slice(0, 4) : MS.hr.monthName(m));
  mg.val_ = (id) => MS.dc.val(id);

  mg.chart = (rows, unit) => {
    const pts = rows.filter((r) => r.actual_value !== null && r.actual_value !== undefined);
    if (!pts.length) return '<p class="empty">No figures yet.</p>';
    const W = 640, H = 280, L = 56, R = 16, T = 22, B = 44;
    const vals = rows.flatMap((r) => [r.actual_value, r.target_value]).filter((v) => v !== null && v !== undefined && v !== '').map(Number);
    let lo = Math.min(0, ...vals), hi = Math.max(...vals);
    if (hi === lo) hi = lo + 1;
    const pad = (hi - lo) * 0.1; hi += pad;
    const x = (i) => L + (rows.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (rows.length - 1));
    const y = (v) => T + (H - T - B) * (1 - (Number(v) - lo) / (hi - lo));
    const ticks = 4, grid = [];
    for (let i = 0; i <= ticks; i++) { const v = lo + ((hi - lo) * i) / ticks; grid.push(`<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${esc(MS.num(Math.round(v * 10) / 10))}</text>`); }
    const labels = rows.map((r, i) => `<text class="axis" x="${x(i)}" y="${H - B + 16}" text-anchor="middle">${esc(r.short || r.label.replace(/ \d{4}$/, '').slice(0, 3) + " '" + String(r.review_period).slice(2, 4))}</text>`).join('');
    const line = pts.map((r) => `${x(rows.indexOf(r)).toFixed(1)},${y(r.actual_value).toFixed(1)}`).join(' ');
    const tg = rows.filter((r) => r.target_value !== null && r.target_value !== undefined && r.target_value !== '');
    const target = tg.length ? `<polyline class="target" fill="none" points="${tg.map((r) => `${x(rows.indexOf(r)).toFixed(1)},${y(r.target_value).toFixed(1)}`).join(' ')}"><title>Target</title></polyline>` : '';
    const dots = pts.map((r) => `<circle class="dot ${r.rating || 'none'}" cx="${x(rows.indexOf(r)).toFixed(1)}" cy="${y(r.actual_value).toFixed(1)}" r="5"><title>${esc(r.label)}: ${esc(mg.val(r.actual_value, unit))}${r.rating ? ' · ' + esc(mg.RAG[r.rating]) : ''}</title></circle>`).join('');
    const nums = rows.length <= 8 ? pts.map((r) => `<text class="val" x="${x(rows.indexOf(r)).toFixed(1)}" y="${(y(r.actual_value) - 10).toFixed(1)}">${esc(MS.num(r.actual_value))}</text>`).join('') : '';
    return `<svg class="kpi-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="History of the figure">${grid.join('')}${labels}${target}<polyline class="line" points="${line}"/>${dots}${nums}</svg>`
      + (tg.length ? '<p class="hint">The dashed line is the target.</p>' : '<p class="hint">No target is set for these months, so the dots have no colour.</p>');
  };

  mg.deptOptions = (list, selected, blank) => MS.options(list.map((d) => ({ value: d.department_id, label: d.department_name })), selected, blank);
  mg.personOptions = (list, selected, blank) => MS.options(list.map((p) => ({ value: p.employee_id, label: p.name + (p.department_name ? ' (' + p.department_name + ')' : '') })), selected, blank);
  mg.peopleChecks = (boxId, list, ticked) => `<div class="mg-checks" id="${boxId}">${list.map((p) => `<label><input type="checkbox" value="${esc(p.employee_id)}"${(ticked || []).indexOf(p.employee_id) >= 0 ? ' checked' : ''}> ${esc(p.name)}${p.department_name ? ` <span class="muted">${esc(p.department_name)}</span>` : ''}</label>`).join('')}</div>`;
  mg.checked = (boxId) => Array.from(MS.$(boxId).querySelectorAll('input:checked')).map((i) => i.value);
  mg.print = () => window.print();
  mg.statusText = (s) => MS.statusLabel(s);
  mg.list = (items, empty) => (items && items.length ? `<ul class="mg-list">${items.map((i) => `<li>${i}</li>`).join('')}</ul>` : `<p class="empty">${esc(empty || 'None.')}</p>`);
})();
