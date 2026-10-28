(function (root) {
  'use strict';

  const core = (function () {
    const DEFAULTS = { fastMs: 2000, idle1: 120000, idle2: 300000, idleDelay1: 15000, idleDelay2: 30000, hiddenDelay: 30000, errorMax: 60000, offDelay: 300000, timeout: 8000, jitter: 0.15 };

    function delay(o, cfg) {
      cfg = Object.assign({}, DEFAULTS, cfg || {});
      if (o.offline) return null;
      const base = Math.max(2, o.every || 4) * 1000;
      let ms = base;
      if (o.hidden) ms = Math.max(cfg.hiddenDelay, base);
      else if (o.idleMs >= cfg.idle2) ms = Math.max(cfg.idleDelay2, base);
      else if (o.idleMs >= cfg.idle1) ms = Math.max(cfg.idleDelay1, base);
      else if (o.fast) ms = Math.max(cfg.fastMs, Math.round(base / 2));
      if (o.errors > 0) ms = Math.min(cfg.errorMax, ms * Math.pow(2, Math.min(o.errors, 4)));
      const r = typeof o.rand === 'function' ? o.rand() : 0.5;
      return Math.round(ms * (1 + (r * 2 - 1) * cfg.jitter));
    }

    const topicValue = (res, w) => (w === '@n' ? res.n : w === '@m' ? res.m : w === '@v' ? res.v : res.t ? res.t[w] : undefined);

    function diff(prev, next, watch) {
      if (!next || next.on === false || next.limited) return { skipped: true, changed: [], n: false, m: false };
      if (!prev || prev.v === undefined) return { first: true, changed: [], n: false, m: false };
      const changed = (watch || []).filter((w) => {
        const a = topicValue(prev, w), b = topicValue(next, w);
        return a !== undefined && b !== undefined && a !== b;
      });
      return { changed, n: prev.n !== next.n, m: prev.m !== next.m, v: prev.v !== next.v };
    }

    function create(deps, cfg) {
      cfg = Object.assign({}, DEFAULTS, cfg || {});
      const s = { timer: null, inflight: false, errors: 0, prev: null, every: 4, fast: false, activeAt: deps.now(), lastTick: 0, stopped: true, off: false, ticks: 0 };

      function idleMs() { return deps.now() - s.activeAt; }
      function clear() { if (s.timer !== null) { deps.clearTimer(s.timer); s.timer = null; } }
      function schedule() {
        clear();
        if (s.stopped) return;
        const ms = s.off ? cfg.offDelay : delay({ every: s.every, hidden: deps.hidden(), offline: !deps.online(), idleMs: idleMs(), fast: s.fast, errors: s.errors, rand: deps.rand }, cfg);
        if (ms === null) return;
        s.timer = deps.setTimer(tick, ms);
      }
      async function tick() {
        s.timer = null;
        if (s.stopped) return;
        if (s.inflight) { schedule(); return; }
        if (!deps.online()) return;
        s.inflight = true; s.lastTick = deps.now(); s.ticks++;
        try {
          const watch = deps.tables();
          const res = await deps.pulse(watch.filter((w) => w.charAt(0) !== '@'));
          s.errors = 0;
          if (res && typeof res.every === 'number') s.every = Math.max(2, res.every);
          s.off = !!res && res.on === false;
          if (res && !s.off && !res.limited) {
            const d = diff(s.prev, res, watch);
            s.prev = res;
            if (!d.first && (d.changed.length || d.n || d.m)) { try { deps.onChange(d); } catch (e) {  } }
          }
        } catch (e) {
          s.errors++;
          if (deps.onError) { try { deps.onError(e); } catch (x) {  } }
        } finally { s.inflight = false; }
        schedule();
      }
      return {
        start() { if (!s.stopped) return; s.stopped = false; s.activeAt = deps.now(); clear(); s.timer = deps.setTimer(tick, 0); },
        stop() { s.stopped = true; clear(); },
        poke() {
          if (s.stopped || s.inflight || deps.now() - s.lastTick < 1000) return;
          clear(); tick();
        },
        activity() {
          const was = idleMs();
          s.activeAt = deps.now();
          if (was >= cfg.idle1 && !s.stopped) this.poke();
        },
        fast(on) { s.fast = !!on; if (!s.stopped && !s.inflight && s.timer !== null) schedule(); },
        reset() { s.prev = null; },
        state() { return { inflight: s.inflight, errors: s.errors, every: s.every, off: s.off, stopped: s.stopped, ticks: s.ticks, scheduled: s.timer !== null }; }
      };
    }
    return { DEFAULTS, delay, diff, create };
  })();

  if (typeof module === 'object' && module.exports) module.exports = core;
  if (typeof window === 'undefined' || !window.MS) return;

  const MS = window.MS;
  if (MS.live) return;

  const JOB = ['jobs', 'job_sections', 'job_subsections', 'job_pd_steps', 'job_proofs', 'job_files'];
  const PAGE_WATCH = {
    dashboard: ['@v', '@n', '@m'],
    notifications: ['@n'],
    messages: ['@m', 'internal_requests'],
    jobs: JOB.concat(['job_comments', 'job_items']),
    'my-section': JOB.concat(['@n']),
    locations: JOB,
    quotations: ['quotations', 'quotation_versions', 'proforma_responses', 'public_links', 'document_emails'],
    customers: ['customers', 'customer_contacts'],
    invoices: ['invoices', 'customer_payments', 'receipts', 'payment_allocations', 'document_emails'],
    payments: ['customer_payments', 'receipts', 'payment_allocations', 'invoices'],
    expenses: ['expenses', 'expense_items'],
    income: ['income_entries'],
    issues: ['issues', 'issue_assignments', 'issue_comments', 'issue_actions'],
    meetings: ['meetings', 'meeting_attendees', 'meeting_actions'],
    notices: ['management_notices', 'notice_acknowledgements'],
    leave: ['leave_requests'],
    overtime: ['overtime_requests'],
    attendance: ['attendance', 'leave_requests'],
    grievances: ['staff_grievances'],
    history: ['@v']
  };
  const ANY_GAP_MS = 12000;
  const TYPING_MS = 15000;

  let pulser = null, lastRefresh = 0, deferUntil = 0, deferred = false, refreshing = false, lastInput = 0;
  const watchList = () => {
    const own = PAGE_WATCH[MS.page];
    if (own) return own;
    return typeof MS.reload === 'function' ? ['@v'] : [];
  };

  function busy() {
    if (MS.liveSafe) return !!document.querySelector('dialog[open]');
    if (document.querySelector('dialog[open]') || document.querySelector('.jf-prog:not([hidden])')) return true;
    if (Array.from(document.querySelectorAll('input[type=file]')).some((f) => f.files && f.files.length)) return true;
    const a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'checkbox' && a.type !== 'radio' && a.type !== 'button') {
      if (a.tagName === 'TEXTAREA' && a.value) return true;
      if (Date.now() - lastInput < TYPING_MS) return true;
    }
    return false;
  }

  function paintCounts(me) {
    if (!me) return;
    if (MS.$('bellDot')) MS.$('bellDot').hidden = !me.unread_notifications;
    if (MS.setMessageDot) MS.setMessageDot(me.unread_messages || 0);
  }

  function unreadMoved() {
    if (MS.notify && MS.notify.isOn()) return MS.notify.check();
    return MS.refreshMe(false).then(paintCounts);
  }

  async function refreshPage() {
    if (refreshing || typeof MS.reload !== 'function') return;
    if (busy()) { deferred = true; return; }
    refreshing = true; deferred = false; lastRefresh = Date.now();
    try {
      const changed = MS.probeReads ? await MS.probeReads() : true;
      if (!changed) return;
      if (busy()) { deferred = true; return; }
      const y = window.scrollY, x = window.scrollX;
      const boxes = Array.from(document.querySelectorAll('.tablewrap')).map((b) => [b, b.scrollLeft, b.scrollTop]);
      MS.live.silent = true;
      try { await MS.reload(); } finally { MS.live.silent = false; }
      requestAnimationFrame(() => { window.scrollTo(x, y); boxes.forEach(([b, l, t]) => { if (b.isConnected) { b.scrollLeft = l; b.scrollTop = t; } }); });
    } catch (e) {  } finally { refreshing = false; }
  }

  function onChange(d) {
    if (d.n || d.m) unreadMoved();
    if (!d.changed.length) return;
    if (d.changed.every((w) => w === '@v') && Date.now() < lastRefresh + ANY_GAP_MS) { deferred = true; deferUntil = lastRefresh + ANY_GAP_MS; return; }
    refreshPage();
  }

  function callPulse(tables) {
    const action = MS.live.action;
    return MS.call(action, action === 'PULSE' ? { tables } : {}, { live: true, noRetry: true, timeout: core.DEFAULTS.timeout }).then((res) => {
      if (deferred && Date.now() >= deferUntil && !busy()) setTimeout(refreshPage, 0);
      return res;
    }, (e) => {
      if (e && e.code === 'FORBIDDEN' && action === 'PULSE') { MS.live.action = 'AUTH_PING'; return {}; }
      throw e;
    });
  }

  function build() {
    return core.create({
      now: () => Date.now(), setTimer: (f, ms) => setTimeout(f, ms), clearTimer: (id) => clearTimeout(id), rand: Math.random,
      hidden: () => document.visibilityState === 'hidden', online: () => navigator.onLine !== false,
      pulse: callPulse, tables: watchList, onChange
    });
  }

  MS.live = {
    action: 'PULSE', silent: false, core,
    start() {
      if (pulser || !MS.user) return;
      pulser = build();
      pulser.start();
      const act = () => pulser.activity();
      ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach((ev) => document.addEventListener(ev, act, { passive: true, capture: true }));
      document.addEventListener('scroll', act, { passive: true, capture: true });
      ['input', 'change'].forEach((ev) => document.addEventListener(ev, () => { lastInput = Date.now(); }, true));
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pulser.poke(); });
      window.addEventListener('focus', () => pulser.poke());
      window.addEventListener('online', () => pulser.poke());
      document.addEventListener('focusout', () => { if (deferred) setTimeout(() => { if (deferred && Date.now() >= deferUntil) refreshPage(); }, 400); }, true);
    },
    stop() { if (pulser) pulser.stop(); },
    poke() { if (pulser) pulser.poke(); },
    fast(on) { if (pulser) pulser.fast(on); },
    refresh: refreshPage,
    state() { return pulser ? pulser.state() : null; }
  };
  MS.live.start();
})(typeof window !== 'undefined' ? window : this);
