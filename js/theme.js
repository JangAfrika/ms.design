/* Light / dark scheme, remembered on this device (one choice for every page of the app).
   Loaded first on every page so the page never flashes the wrong colours. */
(function () {
  const MS = (window.MS = window.MS || {});
  const KEY = 'ms_theme';

  // Back button: previous page of this app, else the given home page
  MS.goBack = function (home) {
    let same = false;
    try { same = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (e) { same = false; }
    if (history.length > 1 && same) history.back(); else location.href = home;
  };

  // Printing is always on white paper, whatever scheme is on screen
  let printed = null;
  window.addEventListener('beforeprint', () => {
    printed = MS.theme.get();
    if (printed === 'dark') { document.documentElement.classList.remove('dark-root'); document.body.classList.remove('dark'); document.body.classList.add('light'); }
  });
  window.addEventListener('afterprint', () => { if (printed === 'dark') MS.theme.apply('dark'); printed = null; });

  MS.theme = {
    get() {
      let t = null;
      try { t = localStorage.getItem(KEY); } catch (e) { t = null; }
      return t === 'dark' ? 'dark' : 'light';
    },
    apply(t) {
      document.documentElement.classList.toggle('dark-root', t === 'dark');
      if (document.body) {
        document.body.classList.toggle('dark', t === 'dark');
        document.body.classList.toggle('light', t !== 'dark');
      }
      const btn = document.getElementById('themeBtn');
      if (btn && MS.icon) btn.innerHTML = MS.icon(t === 'dark' ? 'sun' : 'moon');
      if (btn) btn.title = t === 'dark' ? 'Switch to the light scheme' : 'Switch to the dark scheme';
      document.dispatchEvent(new CustomEvent('ms:theme', { detail: t }));
    },
    set(t) {
      try { localStorage.setItem(KEY, t); } catch (e) { /* works without storage */ }
      MS.theme.apply(t);
    },
    toggle() { MS.theme.set(MS.theme.get() === 'dark' ? 'light' : 'dark'); },
    // a floating button for pages without a top bar (sign-in page)
    floatingButton() {
      if (document.getElementById('themeBtn')) return;
      const b = document.createElement('button');
      b.type = 'button'; b.id = 'themeBtn'; b.className = 'themebtn';
      b.addEventListener('click', MS.theme.toggle);
      document.body.appendChild(b);
      MS.theme.apply(MS.theme.get());
    }
  };
  // brand colour from config.js
  const brand = window.APP_CONFIG && window.APP_CONFIG.BRAND_COLOR;
  if (brand) document.documentElement.style.setProperty('--brand', brand);
  if (document.body) MS.theme.apply(MS.theme.get());
  else document.addEventListener('DOMContentLoaded', () => MS.theme.apply(MS.theme.get()));
})();
