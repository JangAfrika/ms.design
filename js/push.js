(function () {
  'use strict';
  const MS = window.MS;
  if (!MS || MS.push) return;
  const CFG = window.APP_CONFIG || {};
  const FB = CFG.FIREBASE, VAPID = CFG.VAPID_KEY;
  const web = /^https?:$/.test(location.protocol);
  const ua = navigator.userAgent || '';
  const isIos = () => /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const installed = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const listeners = [];
  const tell = () => listeners.forEach((f) => { try { f(); } catch (e) {  } });

  const uid = () => (MS.user && MS.user.user_id) || '';
  const key = (k) => 'ms_push_' + k + '_' + uid();
  const get = (k) => { try { return localStorage.getItem(key(k)) || ''; } catch (e) { return ''; } };
  const set = (k, v) => { try { if (v) localStorage.setItem(key(k), v); else localStorage.removeItem(key(k)); } catch (e) {  } };

  const browserCan = () => web && !!FB && !!VAPID && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  function state() {
    if (isIos() && !installed() && web && FB) return 'ios';
    if (!browserCan()) return '';
    if (Notification.permission === 'denied') return 'denied';
    return Notification.permission === 'granted' && get('token') ? 'on' : 'off';
  }

  function script(src) {
    return new Promise((ok, no) => {
      const s = document.createElement('script');
      s.src = new URL(src, MS.root()).href; s.onload = ok;
      s.onerror = () => no(new Error('Could not load the notification files. Check the connection and try again.'));
      document.head.appendChild(s);
    });
  }

  let ready = null;
  function messaging() {
    if (!ready) {
      ready = (window.firebase && window.firebase.messaging ? Promise.resolve() : script('firebase/firebase-app-compat.js').then(() => script('firebase/firebase-messaging-compat.js')))
        .then(() => window.firebase.messaging.isSupported())
        .then((yes) => {
          if (!yes) throw new Error('This browser cannot show background notifications.');
          if (!window.firebase.apps.length) window.firebase.initializeApp(FB);
          return window.firebase.messaging();
        });
      ready.catch(() => { ready = null; });
    }
    return ready;
  }

  function device() {
    const os = /Android/.test(ua) ? 'Android' : isIos() ? 'iPhone/iPad' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Device';
    const br = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    return os + ' · ' + br + (installed() ? ' (app)' : '');
  }

  function register() {
    return messaging().then((m) => navigator.serviceWorker.register(new URL('sw.js', MS.root()).href, { scope: MS.root() }).then(() => navigator.serviceWorker.ready)
      .then((reg) => m.getToken({ vapidKey: VAPID, serviceWorkerRegistration: reg })))
      .then((token) => {
        if (!token) throw new Error('The browser gave no notification address. Try again.');
        return MS.call('PUSH_REGISTER', { token, platform: device() }, { quiet: true, noRetry: true }).then(() => { set('token', token); set('at', String(Date.now())); tell(); return token; });
      });
  }

  function turnOn() {
    if (!browserCan()) return Promise.reject(new Error('This browser cannot show background notifications.'));
    set('off', '');
    return Promise.resolve(Notification.requestPermission()).then((p) => {
      if (p !== 'granted') { tell(); throw new Error(p === 'denied' ? 'Notifications are blocked for this site. Allow them in the browser\'s site settings, then try again.' : 'Notifications were not turned on.'); }
      return register();
    }).then(() => state());
  }

  function turnOff() {
    const token = get('token');
    set('token', ''); set('at', ''); set('off', '1');
    tell();
    const server = token ? MS.call('PUSH_UNREGISTER', { token }, { quiet: true, noRetry: true }).catch(() => null) : Promise.resolve();
    return server.then(() => messaging().then((m) => m.deleteToken()).catch(() => null)).then(() => state());
  }

  function forget() {
    const token = get('token');
    set('at', '');
    return token ? MS.call('PUSH_UNREGISTER', { token }, { quiet: true, noRetry: true }).catch(() => null) : Promise.resolve();
  }

  function keepFresh() {
    if (!browserCan() || Notification.permission !== 'granted' || get('off')) return;
    if (get('token') && Date.now() - Number(get('at') || 0) < 86400000) return;
    setTimeout(() => { register().catch(() => null); }, 2500);
  }

  const asked = () => Date.now() - Number(get('later') || 0) < 30 * 86400000;

  function mount(el, ask) {
    if (!el) return;
    let busy = false, error = '';
    const draw = () => {
      const s = state();
      if (!s || (ask && (asked() || (s !== 'off' && s !== 'ios')))) { el.innerHTML = ''; return; }
      const text = s === 'on' ? 'On for this device. New messages and notices pop up even when the app is closed, and the app icon shows the unread number where the phone allows it.'
        : s === 'ios' ? 'On an iPhone or iPad, first tap Share, then Add to Home Screen. Open the app from there and turn notifications on.'
        : s === 'denied' ? 'Blocked in this browser. Allow notifications for this site in the browser settings, then reload the page.'
        : 'Get new messages and notices on this device straight away, even when the app is closed.';
      el.innerHTML = '<div class="push-card"><span class="pc-ic">' + MS.icon('bell') + '</span><div class="pc-text"><strong>Notifications on this device</strong><span>' + MS.esc(text) + '</span>' +
        (error ? '<span class="pc-err">' + MS.esc(error) + '</span>' : '') + '</div><div class="pc-btns">' +
        (s === 'off' ? '<button type="button" class="primary" data-go' + (busy ? ' disabled' : '') + '>' + (busy ? 'Turning on…' : 'Turn on notifications') + '</button>' : '') +
        (s === 'on' ? '<button type="button" data-stop' + (busy ? ' disabled' : '') + '>Turn off here</button>' : '') +
        (ask ? '<button type="button" data-later>Not now</button>' : '') + '</div></div>';
      const go = el.querySelector('[data-go]'), stop = el.querySelector('[data-stop]'), later = el.querySelector('[data-later]');
      const run = (fn) => { busy = true; error = ''; draw(); fn().catch((e) => { error = e.message; }).then(() => { busy = false; draw(); }); };
      if (go) go.onclick = () => run(turnOn);
      if (stop) stop.onclick = () => run(turnOff);
      if (later) later.onclick = () => { set('later', String(Date.now())); draw(); };
    };
    listeners.push(draw);
    draw();
  }

  MS.push = { state, isOn: () => state() === 'on', available: () => !!state(), turnOn, turnOff, forget, keepFresh, mount };
  keepFresh();
})();
