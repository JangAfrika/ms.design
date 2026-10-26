(function () {
  'use strict';
  const MS = window.MS;
  if (!MS || MS.notify) return;
  const supported = 'Notification' in window;
  let busy = false, tick = 0;

  const uid = () => (MS.user && MS.user.user_id) || '';
  const key = (k) => 'ms_notify_' + k + '_' + uid();
  const get = (k) => { try { return localStorage.getItem(key(k)); } catch (e) { return null; } };
  const set = (k, v) => { try { localStorage.setItem(key(k), v); } catch (e) {  } };
  const perm = () => (supported ? Notification.permission : 'unsupported');
  const isOn = () => supported && perm() === 'granted' && get('on') === '1';

  function pathFor(n) {
    if (n.kind === 'message') return 'management/messages.html';
    if (n.related_table && /^(jobs|quotations|messages|role_requests|users)$/.test(n.related_table)) return MS.recordHref(n.related_table, n.related_record_id);
    return 'notifications.html';
  }

  async function show(n) {
    if (MS.push && MS.push.isOn()) return;
    const url = new URL(pathFor(n), MS.root()).href;
    const opts = { body: n.body || '', tag: n.tag, icon: new URL('icons/icon-192.png', MS.root()).href, badge: new URL('icons/icon-192.png', MS.root()).href, data: { url } };
    if (document.visibilityState === 'visible' && document.hasFocus()) { if (MS.toast) MS.toast(n.title); return; }
    try {
      const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.ready : null;
      if (reg && reg.showNotification) { await reg.showNotification(n.title, opts); return; }
    } catch (e) {  }
    try {
      const x = new Notification(n.title, opts);
      x.onclick = () => { window.focus(); location.href = url; x.close(); };
    } catch (e) {  }
  }

  function badge(n) {
    try { if (navigator.setAppBadge) { if (n > 0) navigator.setAppBadge(n); else navigator.clearAppBadge(); } } catch (e) {  }
  }

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
      if (unread > 0 && (first || lastN === null || Number(lastN) !== unread || tick % 5 === 0)) {
        const r = await MS.call('NOTIFICATION_LIST', { page: 1, page_size: 10, unread_only: true, sort: 'created_at', dir: 'desc' }, { quiet: true });
        const fresh = (r.rows || []).filter((x) => !x.read_at && String(x.created_at) > seen).reverse();
        if (seen === '') fresh.length = 0;
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
    } catch (e) {  } finally { busy = false; }
  }

  function start() { if (isOn()) check(true); }
  function stop() {  }

  async function enable() {
    if (!supported) return 'This browser cannot show pop-up alerts.';
    if (perm() === 'denied') return 'Alerts are blocked for this site in the browser settings. Allow them there, then try again.';
    let p = perm();
    if (p !== 'granted') { try { p = await Notification.requestPermission(); } catch (e) { p = 'denied'; } }
    if (p !== 'granted') return 'Not turned on: the browser did not allow it.';
    set('on', '1');
    set('last', new Date().toISOString());
    start();
    return 'Pop-up alerts are on for this device.';
  }
  function disable() { set('on', '0'); stop(); return 'Pop-up alerts are off for this device.'; }

  function status() {
    if (!supported) return 'Not available in this browser.';
    if (perm() === 'denied') return 'Blocked in the browser settings.';
    return isOn() ? 'On for this device' : 'Off';
  }

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

  function offer() {
    if (!supported || perm() !== 'default' || get('on') !== null || (MS.push && MS.push.available())) return;
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

  start();
  if (MS.page === 'dashboard') setTimeout(offer, 6000);
})();
