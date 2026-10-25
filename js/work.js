/* Productivity score helpers (the server side is WorkScore.gs). Loaded by MS.boot on every signed-in page, never blocks it.
   - tells the server, quietly, that I opened a job step or (managers) looked at the system, so response speed can be scored;
   - draws the "Your score" chip on Overview and keeps it live after I finish something;
   - MS.work.ring() is the score ring used on My KPIs. */
(function () {
  const MS = window.MS;
  const W = (MS.work = MS.work || {});
  const day = () => new Date().toISOString().slice(0, 10);
  const lget = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lset = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* the server de-duplicates anyway */ } };
  const quiet = (action, payload) => MS.call(action, payload, { noRetry: true }).catch(() => null);

  /** I opened this job (its page, or its card on My section): once per job every 10 minutes from this browser; the server keeps one record per step. */
  W.seen = function (jobId) {
    if (!jobId || !MS.can('SECTION_WORK') && !MS.can('JOB_LOCATION_VIEW')) return;
    const k = 'ms.seen.' + jobId, t = Number(lget(k) || 0);
    if (Date.now() - t < 10 * 60000) return;
    lset(k, String(Date.now()));
    quiet('WORK_SEEN', { job_id: jobId });
  };
  /** A manager looked at Overview / Where are the jobs / Jobs: once a day. */
  W.ping = function (page) {
    if (!MS.can('JOB_LOCATION_VIEW')) return;
    const k = 'ms.ping.' + (MS.user && MS.user.user_id), d = day();
    if (lget(k) === d) return;
    lset(k, d);
    quiet('WORK_PING', { page });
  };

  const LEVEL_WORD = { GOOD: 'Good', OK: 'Fair', LOW: 'Needs work' };
  W.levelWord = (l) => LEVEL_WORD[l] || '';
  /** A ring (SVG) with the score inside; no score is drawn as an empty ring with a dash. */
  W.ring = function (score, level, size, goodAt, okAt) {
    size = size || 56;
    const r = 15.9155, has = score !== null && score !== undefined && score !== '';
    const v = has ? Math.max(0, Math.min(100, Number(score))) : 0;
    return `<svg class="wk-ring ${has ? (level || '') : 'none'}" viewBox="0 0 36 36" width="${size}" height="${size}" role="img" aria-label="${has ? 'Score ' + Math.round(v) + ' out of 100' : 'No score yet'}">
      <circle class="trk" cx="18" cy="18" r="${r}" fill="none" stroke-width="3.4"/>
      <circle class="arc" cx="18" cy="18" r="${r}" fill="none" stroke-width="3.4" stroke-linecap="round" stroke-dasharray="${v.toFixed(1)} 100" transform="rotate(-90 18 18)"/>
      <text x="18" y="21.6" text-anchor="middle" class="num">${has ? Math.round(v) : '–'}</text></svg>`;
  };
  W.trend = function (t) {
    if (t === null || t === undefined) return '';
    if (Math.abs(t) < 0.5) return '<span class="wk-trend flat" title="Same as a week ago">' + MS.icon('trend') + '0</span>';
    return `<span class="wk-trend ${t > 0 ? 'up' : 'down'}" title="Compared with the same 30 days a week ago">${t > 0 ? '▲' : '▼'} ${Math.abs(Math.round(t * 10) / 10)}</span>`;
  };

  /* ---------- the Overview chip ---------- */
  let chipBox = null, chipTimer = 0, chipBusy = false;
  function chipHtml(w) {
    if (!w) return '';
    const has = w.score !== null && w.score !== undefined;
    const lvl = has ? w.level : 'none';
    return `<a class="wk-chip ${lvl}" href="management/my-kpis.html#work" title="${MS.esc(w.headline || 'Your productivity score: how quickly you respond, start and finish work. Open for the detail.')}">${W.ring(has ? w.score : null, w.level, 26)}
      <span class="wk-chip-t"><b>${has ? 'Your score' : 'No work yet'}</b><small>${has ? MS.esc(W.levelWord(w.level)) : 'your score starts with your first job step'}</small></span>${has ? W.trend(w.trend) : ''}</a>`;
  }
  W.chip = function (box, w) {
    chipBox = box;
    box.innerHTML = chipHtml(w);
    if (!chipTimer) {
      chipTimer = 1;
      const go = () => { if (!document.hidden) W.chipRefresh(); };
      setInterval(go, 2 * 60000);
      document.addEventListener('visibilitychange', go);
    }
  };
  /** Asks the server for the saved score; if it is old, works it out first (one small write), then redraws the chip. */
  W.chipRefresh = async function () {
    if (!chipBox || chipBusy) return;
    chipBusy = true;
    try {
      let r = await MS.call('WORK_SCORE_GET', {});
      if (r && r.enabled && r.stale) r = await MS.call('WORK_SCORE_REFRESH', {});
      if (!r || !r.enabled) { chipBox.innerHTML = ''; return; }
      const x = r.roll;
      chipBox.innerHTML = chipHtml(x ? { state: x.state, score: x.score, trend: x.trend, level: x.level, headline: x.headline } : { state: 'NO_WORK', score: null });
    } catch (e) { /* the chip keeps what it shows */ } finally { chipBusy = false; }
  };
  // after I save anything (finish a step, send a proof, clock in...) the server has already moved my score: show it
  let wroteTimer = 0;
  document.addEventListener('ms:wrote', (e) => {
    if (!chipBox || (e.detail && /^WORK_/.test(e.detail.action))) return;
    clearTimeout(wroteTimer);
    wroteTimer = setTimeout(() => W.chipRefresh(), 900);
  });

  /* ---------- automatic records on the job pages ---------- */
  const path = location.pathname;
  const onJobPage = /\/jobs\/job\.html$/.test(path);
  const onMySection = /\/jobs\/my-section\.html$/.test(path);
  if (onJobPage && MS.param && MS.param('id')) W.seen(MS.param('id'));
  if (onMySection) {
    if (MS.param && MS.param('job')) W.seen(MS.param('job'));
    document.addEventListener('click', (e) => { const c = e.target.closest && e.target.closest('.mycard'); if (c && c.dataset.id) W.seen(c.dataset.id); });
  }
  if (/\/(dashboard|jobs\/locations|jobs\/jobs)\.html$/.test(path)) W.ping(MS.page || 'page');
})();
