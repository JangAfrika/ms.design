(function () {
  'use strict';
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(function () {});
  var KEY = 'ms_install_later';
  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function set(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  if (standalone) return;
  var later = Number(get() || 0);
  if (later && Date.now() < later) return;
  var ua = navigator.userAgent || '';
  var ios = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var deferred = null, box = null;

  function close(days) { if (box) { box.remove(); box = null; } if (days) set(String(Date.now() + days * 864e5)); }
  function show(steps) {
    if (box || document.getElementById('installBox')) return;
    box = document.createElement('div');
    box.id = 'installBox'; box.className = 'install-pop'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Install the app');
    box.innerHTML = '<img src="icons/icon-192.png" alt="" width="44" height="44"><div class="ip-text"><strong>Install MS BMS</strong>' +
      '<span>' + (steps || 'Open it from your home screen or desktop, like any other app.') + '</span></div>' +
      '<div class="ip-btns">' + (steps ? '' : '<button type="button" class="ip-go">Install</button>') + '<button type="button" class="ip-later">' + (steps ? 'Got it' : 'Not now') + '</button></div>';
    document.body.appendChild(box);
    var go = box.querySelector('.ip-go');
    if (go) go.addEventListener('click', function () {
      if (!deferred) return close(0);
      deferred.prompt();
      deferred.userChoice.then(function (r) { deferred = null; close(r && r.outcome === 'accepted' ? 3650 : 14); });
    });
    box.querySelector('.ip-later').addEventListener('click', function () { close(14); });
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferred = e;
    setTimeout(function () { if (deferred) show(); }, 4000);
  });
  window.addEventListener('appinstalled', function () { deferred = null; close(3650); });
  if (ios && /safari/i.test(ua) && !/crios|fxios/i.test(ua)) {
    setTimeout(function () { show('Tap the Share button, then “Add to Home Screen”.'); }, 4000);
  }
})();
