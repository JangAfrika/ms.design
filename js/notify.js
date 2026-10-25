/* Pop-up alerts on this device (in-app + the browser's Notification API; NOT server push).
   While the app is open in a tab or installed on the phone/computer, it asks the server for the unread counts now and then (the same
   AUTH_ME answer that lights the bell), and when something new arrived it shows a system notification through the service worker.
   Tapping it opens the right page. Each person turns it on or off on this device only (kept in this browser, nothing on the server).
   When the app is fully closed nothing can be shown: that needs a push service (see DEPLOY.md). */
(function () {
  'use strict';
  const MS = window.MS;
  if (!MS || MS.notify) return;
  const POLL_MS = 60 * 1000;
  const supported = 'Notification' in window;
  let timer = null, busy = false, tick = 0;

  // ---- this device's choice, kept per person in this browser ----
  const uid = () => (MS.user && MS.user.user_id) || '';
  const key = (k) => 'ms_notify_' + k + '_' + uid();
  const get = (k) => { try { return localStorage.getItem(key(k)); } catch (e) { return null; } };
  const set = (k, v) => { try { localStorage.setItem(key(k), v); } catch (e) { /* private window: the choice lasts until the tab closes */ } };
  const perm = () => (supported ? Notification.permission : 'unsupported');
  const isOn = () => supported && perm() === 'granted' && get('on') === '1';

  /** The page a notification opens (from the site root). */
  function pathFor(n) {
    if (n.kind === 'message') return 'management/messages.html';
    if (n.related_table && /^(jobs|quotations|messages|role_requests|users)$/.test(n.related_table)) return MS.recordHref(n.related_table, n.related_record_id);
    return 'notifications.html';
  }

  async function show(n) {
    const url = new URL(pathFor(n), MS.root()).href;
    const opts = { body: n.body || '', tag: n.tag, icon: new URL('icons/icon-192.png', MS.root()).href, badge: new URL('icons/icon-192.png', MS.root()).href, data: { url } };
    // the app is on screen: a quiet in-app note is enough; a system notification only when the person is elsewhere
    if (document.visibilityState === 'visible' && document.hasFocus()) { if (MS.toast) MS.toast(n.title); return; }
    try {
      const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.ready : null;
      if (reg && reg.showNotification) { await reg.showNotification(n.title, opts); return; }
    } catch (e) { /* fall back to a plain notification */ }
    try {
      const x = new Notification(n.title, opts);
      x.onclick = () => { window.focus(); location.href = url; x.close(); };
    } catch (e) { /* some phones only allow notifications through the service worker */ }
  }

  function badge(n) {
    try { if (navigator.setAppBadge) { if (n > 0) navigator.setAppBadge(n); else navigator.clearAppBadge(); } } catch (e) { /* not available */ }
  }

  /** One look at the server. Quiet when nothing is new. */
  async function check(first) {
    if (busy || !isOn() || !MS.user) return;
    busy = true; tick++;
    try {
      const me = await MS.refreshMe(false);
      if (!me) return;
      const unread = me.unread_notifications || 0, msgs = me.unread_messages || 0;
      if (MS.$('bellDot')) MS.$('bellDot').hidden = !unread;
      if (MS.setMessageDot) MS.setMessageDot(msgs);
      badge(unread + msgs);
      const lastN = get('n'), lastM = Number(get('m') || 0);
      set('m', String(msgs));
      let seen = get('last') || '';
      // the list is read only when the count moved (or every fifth look, in case one was read and another arrived)
      if (unread > 0 && (first || lastN === null || Number(lastN) !== unread || tick % 5 === 0)) {
        const r = await MS.call('NOTIFICATION_LIST', { page: 1, page_size: 10, unread_only: true, sort: 'created_at', dir: 'desc' });
        const fresh = (r.rows || []).filter((x) => !x.read_at && String(x.created_at) > seen).reverse();
        if (seen === '') fresh.length = 0;   // the first look only sets the starting point: old alerts are not replayed
        const newest = (r.rows || [])[0];
        if (newest && String(newest.created_at) > seen) seen = String(newest.created_at);
        set('last', seen);
        if (fresh.length > 3) {
          await show({ title: fresh.length + ' new alerts', body: fresh[fresh.length - 1].title, tag: 'ms-bms-many', related_table: '' });
        } else {
          for (const x of fresh) await show({ title: x.title, body: x.body, tag: x.notification_id, related_table: x.related_table, related_record_id: x.related_record_id });
        }
      } else if (unread === 0 && seen === '') set('last', new Date().toISOString());
      set('n', String(unread));
      if (msgs > lastM && lastN !== null) await show({ title: msgs === 1 ? 'You have a new message' : 'You have ' + msgs + ' unread messages', body: '', tag: 'ms-bms-messages', kind: 'message' });
    } catch (e) { /* offline or signed out: try again at the next look */ } finally { busy = false; }
  }

  function start() {
    stop();
    if (!isOn()) return;
    check(true);
    timer = setInterval(check, POLL_MS);
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  /** Turn on (asks the browser once), or off. Resolves to a short sentence for the person. */
  async function enable() {
    if (!supported) return 'This browser cannot show pop-up alerts.';
    if (perm() === 'denied') return 'Alerts are blocked for this site in the browser settings. Allow them there, then try again.';
    let p = perm();
    if (p !== 'granted') { try { p = await Notification.requestPermission(); } catch (e) { p = 'denied'; } }
    if (p !== 'granted') return 'Not turned on: the browser did not allow it.';
    set('on', '1');
    set('last', new Date().toISOString());   // only what arrives from now on
    start();
    return 'Pop-up alerts are on for this device.';
  }
  function disable() { set('on', '0'); stop(); return 'Pop-up alerts are off for this device.'; }

  function status() {
    if (!supported) return 'Not available in this browser.';
    if (perm() === 'denied') return 'Blocked in the browser settings.';
    return isOn() ? 'On for this device' : 'Off';
  }

  /** A small on/off control for the account page and the notifications page. */
  function mount(el) {
    if (!el) return;
    const draw = (note) => {
      el.innerHTML = '<span class="nt-state">Pop-up alerts: <b>' + MS.esc(status()) + '</b></span> ' +
        (supported && perm() !== 'denied' ? '<button type="button" class="nt-btn">' + (isOn() ? 'Turn off' : 'Turn on') + '</button>' : '') +
        (note ? ' <span class="nt-note">' + MS.esc(note) + '</span>' : '');
      const b = el.querySelector('.nt-btn');
      if (b) b.onclick = async () => { b.disabled = true; draw(isOn() ? disable() : await enable()); };
    };
    draw('');
  }

  // ---- the one-time friendly prompt ----
  function offer() {
    if (!supported || perm() !== 'default' || get('on') !== null) return;
    const later = Number(get('later') || 0);
    if (later && Date.now() < later) return;
    if (document.getElementById('notifyBox')) return;
    const box = document.createElement('div');
    box.id = 'notifyBox'; box.className = 'install-pop'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Turn on notifications');
    box.innerHTML = '<div class="ip-text"><strong>Turn on notifications?</strong><span>Get a pop-up when a job arrives, a customer answers or a message comes in, while the app is open or installed. You can switch it off any time in My account.</span></div>' +
      '<div class="ip-btns"><button type="button" class="ip-go">Turn on</button><button type="button" class="ip-later">Not now</button></div>';
    document.body.appendChild(box);
    box.querySelector('.ip-go').onclick = async () => { const m = await enable(); box.remove(); if (MS.toast) MS.toast(m); };
    box.querySelector('.ip-later').onclick = () => { set('later', String(Date.now() + 14 * 864e5)); box.remove(); };
  }

  MS.notify = { supported, isOn, enable, disable, status, mount, check, pathFor };

  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  start();
  // ask once, a little after the page has settled, and only on the Overview so it never interrupts a form
  if (MS.page === 'dashboard') setTimeout(offer, 6000);
})();
