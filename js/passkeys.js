(function () {
  const MS = window.MS;
  const FLAG = 'ms.fingerprint';
  const SKIP = 'ms.fingerprint.skip';

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {  } },
    del(k) { try { localStorage.removeItem(k); } catch (e) {  } }
  };

  const toBytes = (s) => {
    const b = atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(s).length + 3) % 4));
    const out = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
    return out.buffer;
  };
  const toB64u = (buf) => {
    if (buf === null || buf === undefined) return undefined;
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  const supported = () => !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.create && navigator.credentials.get);

  async function available() {
    try {
      if (!supported() || !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return false;
      return !!(await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
    } catch (e) { return false; }
  }

  function friendly(err, doing) {
    if (err && err.friendly) return err.message;
    const name = err && err.name;
    if (name === 'NotAllowedError') return doing === 'register' ? 'It was cancelled or timed out, so nothing was changed. You can try again.'
      : 'It was cancelled or timed out. Touch the sensor when asked, or sign in with your password.';
    if (name === 'InvalidStateError') return 'This device is already turned on for fingerprint sign-in.';
    if (name === 'SecurityError') return 'Fingerprint sign-in only works from the official secure (https) website address. Open the site from the address the office gave you and try again.';
    if (name === 'NotSupportedError') return 'This phone or browser cannot use fingerprint sign-in. Use your password instead.';
    if (name === 'AbortError') return 'It was stopped. You can try again.';
    if (err && err.code && err.message) return err.message;
    return 'Fingerprint sign-in did not work. Please try again, or use your password.';
  }

  function guessLabel() {
    const ua = navigator.userAgent || '';
    if (/iPhone/i.test(ua)) return 'My iPhone';
    if (/iPad/i.test(ua)) return 'My iPad';
    if (/Android/i.test(ua)) return 'My phone';
    if (/Windows/i.test(ua)) return 'My Windows computer';
    if (/Mac/i.test(ua)) return 'My Mac';
    return 'This device';
  }

  async function register(label) {
    if (!supported()) throw Object.assign(new Error('This phone or browser cannot use fingerprint sign-in. Use your password instead.'), { name: 'NotSupportedError' });
    const opt = (await MS.call('PASSKEY_REGISTER_OPTIONS', {})).publicKey;
    const publicKey = Object.assign({}, opt, {
      challenge: toBytes(opt.challenge),
      user: Object.assign({}, opt.user, { id: toBytes(opt.user.id) }),
      excludeCredentials: (opt.excludeCredentials || []).map((c) => Object.assign({}, c, { id: toBytes(c.id) }))
    });
    let cred;
    try { cred = await navigator.credentials.create({ publicKey }); } catch (e) { throw Object.assign(new Error(friendly(e, 'register')), { name: e && e.name, friendly: true }); }
    if (!cred) throw new Error('The device did not make a fingerprint key. Please try again.');
    const r = cred.response;
    const row = await MS.call('PASSKEY_REGISTER', {
      credential: { id: cred.id, type: cred.type, response: {
        clientDataJSON: toB64u(r.clientDataJSON), attestationObject: toB64u(r.attestationObject),
        transports: r.getTransports ? r.getTransports() : [] } },
      device_label: String(label || '').trim() || guessLabel(), client_info: navigator.userAgent.slice(0, 200)
    });
    store.set(FLAG, '1');
    return row;
  }

  async function signIn() {
    if (!supported()) throw Object.assign(new Error('This phone or browser cannot use fingerprint sign-in. Use your password instead.'), { name: 'NotSupportedError' });
    const o = await MS.call('PASSKEY_LOGIN_OPTIONS', {});
    const publicKey = Object.assign({}, o.publicKey, { challenge: toBytes(o.publicKey.challenge), allowCredentials: [] });
    let cred;
    try { cred = await navigator.credentials.get({ publicKey }); } catch (e) { throw Object.assign(new Error(friendly(e, 'login')), { name: e && e.name, friendly: true }); }
    if (!cred) throw new Error('The device did not answer. Please try again.');
    const r = cred.response;
    try {
      const out = await MS.call('PASSKEY_LOGIN', {
        ceremony_id: o.ceremony_id, client_info: navigator.userAgent.slice(0, 200),
        credential: { id: cred.id, type: cred.type, response: {
          clientDataJSON: toB64u(r.clientDataJSON), authenticatorData: toB64u(r.authenticatorData),
          signature: toB64u(r.signature), userHandle: toB64u(r.userHandle) } }
      });
      store.set(FLAG, '1');
      return out;
    } catch (e) {
      if (e && e.code === 'PASSKEY_NOT_RECOGNISED') store.del(FLAG);
      throw e;
    }
  }

  async function offer(box) {
    if (!box || store.get(FLAG) || store.get(SKIP) || !MS.can || !MS.can('EMPLOYEE_PROFILE_SELF')) return;
    if (!(await available())) return;
    const div = document.createElement('div');
    div.className = 'fp-offer';
    div.setAttribute('role', 'note');
    div.innerHTML = '<span><b>Sign in with one touch.</b> Turn on fingerprint sign-in on this device.</span>' +
      '<span class="fp-offer-acts"><a class="btn primary" href="account.html#fingerprint">Turn on</a><button type="button" class="linkbtn">Not now</button></span>';
    div.querySelector('button').addEventListener('click', () => { store.set(SKIP, '1'); div.remove(); });
    box.parentNode.insertBefore(div, box);
  }

  MS.passkeys = { supported, available, register, signIn, friendly, guessLabel, enabledHere: () => !!store.get(FLAG), offer };
})();
