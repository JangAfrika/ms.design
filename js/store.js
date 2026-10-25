/* What the browser remembers: the sign-in (token, user), reference lists and copies of recent lists.
   Storage can be blocked (private mode), so every access is wrapped and the app still works without it. */
(function () {
  const MS = (window.MS = window.MS || {});
  const KEY = 'ms_session';

  function get(store, k) { try { return store.getItem(k); } catch (e) { return null; } }
  function set(store, k, v) { try { store.setItem(k, v); return true; } catch (e) { return false; } }
  function del(store, k) { try { store.removeItem(k); } catch (e) { /* ignore */ } }

  MS.store = {
    read() {
      const raw = get(sessionStorage, KEY) || get(localStorage, KEY);
      try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
    },
    kept() { return !!get(localStorage, KEY); },
    save(sess, keep) {
      del(sessionStorage, KEY); del(localStorage, KEY);
      set(keep ? localStorage : sessionStorage, KEY, JSON.stringify(sess));
    },
    update(patch) {
      const cur = MS.store.read();
      if (!cur) return;
      MS.store.save(Object.assign(cur, patch), MS.store.kept());
    },
    clear() {
      del(sessionStorage, KEY); del(localStorage, KEY);
      del(sessionStorage, 'ms_ref');
      MS.store.dropCache();
    },
    // copies of recent lists, so a page can show them at once (sessionStorage: gone when the tab closes or on sign-out)
    readCache(k) { try { const v = get(sessionStorage, 'ms_c:' + k); return v === null ? null : JSON.parse(v); } catch (e) { return null; } },
    saveCache(k, v) {
      const raw = JSON.stringify(v);
      if (raw.length > 400000) return;
      if (!set(sessionStorage, 'ms_c:' + k, raw)) { MS.store.dropCache(); set(sessionStorage, 'ms_c:' + k, raw); }
    },
    dropCache() {
      try { Object.keys(sessionStorage).filter((k) => k.indexOf('ms_c:') === 0).forEach((k) => del(sessionStorage, k)); } catch (e) { /* ignore */ }
    },
    readRef() { try { return JSON.parse(get(sessionStorage, 'ms_ref') || 'null'); } catch (e) { return null; } },
    saveRef(ref) { if (!set(sessionStorage, 'ms_ref', JSON.stringify(ref))) del(sessionStorage, 'ms_ref'); },
    dropRef() { del(sessionStorage, 'ms_ref'); }
  };
})();
