/* Small inline-SVG charts for the Finance pages (no library, prints cleanly, works at phone width).
   MS.charts.bars({ labels, series:[{ name, values, cls }], title, fmt })  grouped bars, one group per label.
   MS.charts.lines({ labels, series:[{ name, values, cls }], title, fmt }) lines with dots.
   `cls` is one of s1 s2 s3 (colours are set in css/planning.css, light and dark). Every value is also in the table next to the chart:
   the chart has role="img" and a text summary for screen readers. */
(function () {
  const MS = window.MS;
  const esc = (s) => MS.esc(s);
  const ch = (MS.charts = {});
  const W = 720, H = 240, L = 54, R = 10, T = 12, B = 30;

  function nice(max) {
    if (!(max > 0)) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(max)));
    const f = max / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }
  const short = (n) => { const a = Math.abs(n); const s = a >= 1e6 ? (a / 1e6).toFixed(a % 1e6 ? 1 : 0) + 'M' : a >= 1e3 ? (a / 1e3).toFixed(a % 1e3 ? 1 : 0) + 'k' : String(Math.round(a)); return (n < 0 ? '−' : '') + s; };

  function frame(o, draw) {
    const all = [].concat.apply([], o.series.map((s) => s.values.map(Number)));
    const max = nice(Math.max.apply(null, all.concat([0])));
    const min = Math.min.apply(null, all.concat([0]));
    const lo = min < 0 ? -nice(-min) : 0;
    const y = (v) => T + (H - T - B) * (1 - (v - lo) / (max - lo));
    const grid = [0, 1, 2, 3, 4].map((i) => { const v = lo + (max - lo) * i / 4; return `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="ch-grid"/><text x="${L - 6}" y="${y(v) + 4}" class="ch-ax" text-anchor="end">${esc(short(v))}</text>`; }).join('');
    const legend = o.series.map((s) => `<span class="ch-key"><i class="${esc(s.cls)}"></i>${esc(s.name)}</span>`).join('');
    const summary = (o.title || 'Chart') + '. ' + o.series.map((s) => s.name + ': ' + s.values.map((v, i) => o.labels[i] + ' ' + (o.fmt ? o.fmt(v) : v)).join(', ')).join('. ');
    return `<figure class="chart"><figcaption>${esc(o.title || '')}<span class="ch-legend">${legend}</span></figcaption>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(summary)}" preserveAspectRatio="xMidYMid meet">${grid}${draw(y, lo)}</svg></figure>`;
  }

  ch.bars = (o) => frame(o, (y, lo) => {
    const n = o.labels.length, gw = (W - L - R) / n, k = o.series.length, bw = Math.min(26, (gw - 8) / k);
    const zero = y(0);
    return o.labels.map((lb, i) => {
      const x0 = L + gw * i + (gw - bw * k) / 2;
      const bars = o.series.map((s, j) => { const v = Number(s.values[i]) || 0, yy = y(v);
        return `<rect x="${x0 + bw * j}" y="${Math.min(yy, zero)}" width="${bw - 1}" height="${Math.max(Math.abs(zero - yy), v ? 1 : 0)}" class="ch-bar ${esc(s.cls)}"><title>${esc(s.name + ' · ' + lb + ': ' + (o.fmt ? o.fmt(v) : v))}</title></rect>`; }).join('');
      return bars + `<text x="${L + gw * i + gw / 2}" y="${H - 10}" class="ch-ax" text-anchor="middle">${esc(lb)}</text>`;
    }).join('') + `<line x1="${L}" x2="${W - R}" y1="${zero}" y2="${zero}" class="ch-zero"/>`;
  });

  ch.lines = (o) => frame(o, (y) => {
    const n = o.labels.length, gw = (W - L - R) / n;
    const px = (i) => L + gw * i + gw / 2;
    return o.labels.map((lb, i) => `<text x="${px(i)}" y="${H - 10}" class="ch-ax" text-anchor="middle">${esc(lb)}</text>`).join('') + o.series.map((s) =>
      `<polyline class="ch-line ${esc(s.cls)}" fill="none" points="${s.values.map((v, i) => px(i) + ',' + y(Number(v) || 0)).join(' ')}"/>` +
      s.values.map((v, i) => `<circle cx="${px(i)}" cy="${y(Number(v) || 0)}" r="3.2" class="ch-dot ${esc(s.cls)}"><title>${esc(s.name + ' · ' + o.labels[i] + ': ' + (o.fmt ? o.fmt(v) : v))}</title></circle>`).join('')).join('');
  });
})();
