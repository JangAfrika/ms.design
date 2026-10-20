/* Sign-in page: log in (email/username + password, or "Continue with Google"), create an account, the VERIFY link from
   the sign-up email, "Waiting for approval" for a new account, forgot / reset password, and the forced password change
   after a temporary password. The server decides everything; this page only shows the right card. */
(function () {
  const MS = window.MS;
  const { $ } = MS;
  const cfg = window.APP_CONFIG || {};

  MS.theme.floatingButton();
  document.querySelectorAll('[data-app-name]').forEach((el) => { el.textContent = cfg.APP_NAME || 'MS Designs & Printing'; });
  document.querySelectorAll('[data-app-sub]').forEach((el) => { el.textContent = cfg.APP_SUB || 'Business Management System'; });
  document.querySelectorAll('[data-app-logo]').forEach((el) => { if (cfg.APP_LOGO) el.src = cfg.APP_LOGO; else el.remove(); });
  document.querySelectorAll('[data-app-mark]').forEach((el) => { if (cfg.APP_LOGO) el.remove(); });

  const approved = (u) => !u || !u.approval_status || u.approval_status === 'APPROVED';
  const clientInfo = () => navigator.userAgent.slice(0, 200);

  function home() {
    const next = MS.param('next');
    location.replace(next && /^(?:[\w-]+\/)?[\w-]+\.html(\?[^#]*)?$/.test(next) ? next : 'dashboard.html');
  }

  const CARDS = ['loginForm', 'signupForm', 'sentCard', 'waitCard', 'changeForm', 'forgotForm', 'resetForm'];
  function show(id, focus) {
    CARDS.forEach((f) => { $(f).hidden = f !== id; });
    if (googleReady) drawGoogle();
    if (focus) $(focus).focus();
  }
  let googleReady = false;
  // draw each Google button once, while its card is on screen (a hidden card has no width to draw into)
  function drawGoogle() {
    document.querySelectorAll('[data-google-btn]').forEach((el) => {
      if (el.dataset.drawn || el.offsetParent === null) return;
      const w = Math.max(200, Math.min(400, Math.round(el.getBoundingClientRect().width || 340)));
      google.accounts.id.renderButton(el, { type: 'standard', theme: 'outline', size: 'large', shape: 'rectangular', text: el.dataset.googleBtn, logo_alignment: 'left', width: w });
      el.dataset.drawn = '1';
    });
  }
  function note(el, text, good) { $(el).classList.toggle('ok', !!good); $(el).textContent = text || ''; }
  function backToSignIn(text) {
    show('loginForm', 'loginUser');
    $('resendBox').hidden = true;
    note('loginError', text, !!text);
  }
  function showChange(current) {
    show('changeForm');
    if (current) $('chCur').value = current;
    $('chNew').focus();
  }

  // ---------- waiting for the System Administrator ----------
  function showWaiting(user) {
    const u = user || {};
    const rejected = u.approval_status === 'REJECTED';
    $('waitTitle').textContent = rejected ? 'Your account was not approved' : 'Waiting for approval';
    $('waitWho').textContent = (u.display_name ? 'Hello ' + String(u.display_name).split(' ')[0] + '. ' : '') + (u.email ? 'Signed in as ' + u.email + '.' : '');
    $('waitText').textContent = rejected
      ? 'The System Administrator did not approve this account' + (u.approval_note ? ': ' + u.approval_note : '') + '. If you think this is a mistake, please contact the office.'
      : 'Your email address is confirmed. The System Administrator now checks your account and gives you the right access for your job. We will email you when it is ready.';
    $('waitCheck').hidden = rejected;
    note('waitError', '');
    show('waitCard');
  }

  /** After AUTH_LOGIN or AUTH_GOOGLE: keep the session, then the dashboard, the password change or the waiting card. */
  function signedIn(out, password) {
    const user = Object.assign({}, out.user, { must_change_password: !!out.must_change_password });
    MS.store.save({ token: out.token, user, expires_at: out.expires_at, me_at: Date.now() }, $('loginKeep').checked);
    MS.store.dropRef();
    if (!approved(user)) { showWaiting(user); return; }
    if (out.must_change_password) { showChange(password); return; }
    home();
  }

  // ---------- "Continue with Google" (Google Identity Services); hidden when js/config.js has no GOOGLE_CLIENT_ID ----------
  function setupGoogle() {
    const id = String(cfg.GOOGLE_CLIENT_ID || '').trim();
    if (!id) return;
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => {
      if (!window.google || !google.accounts || !google.accounts.id) return;
      google.accounts.id.initialize({ client_id: id, callback: onGoogle, ux_mode: 'popup', auto_select: false, cancel_on_tap_outside: true });
      document.querySelectorAll('[data-google]').forEach((box) => { box.hidden = false; });
      googleReady = true;
      drawGoogle();
    };
    document.head.appendChild(s);
  }
  async function onGoogle(resp) {
    const target = $('signupForm').hidden ? 'loginError' : 'signupError';
    note(target, 'Signing in with Google…', true);
    try {
      signedIn(await MS.call('AUTH_GOOGLE', { credential: resp && resp.credential, client_info: clientInfo() }));
    } catch (err) { note(target, err.message); }
  }

  // ---------- "Sign in with fingerprint" (WebAuthn); shown only when this device can check a fingerprint, face or screen lock ----------
  function setupFingerprint() {
    const P = MS.passkeys;
    if (!P || !P.supported()) return;
    P.available().then((yes) => {
      if (!yes) return;
      $('fpBox').hidden = false;
      $('fpBtn').classList.toggle('here', P.enabledHere()); // remembered on this device: make it the main button
    });
    $('fpBtn').addEventListener('click', async () => {
      const btn = $('fpBtn'), label = btn.querySelector('span');
      note('fpError', '');
      note('loginError', '');
      btn.disabled = true;
      label.textContent = 'Waiting for your fingerprint…';
      try {
        signedIn(await P.signIn());
      } catch (err) {
        note('fpError', P.friendly(err, 'login'));
        btn.classList.toggle('here', P.enabledHere());
      } finally { btn.disabled = false; label.textContent = 'Sign in with fingerprint'; }
    });
  }

  // ---------- what the address bar asks for ----------
  const resetCode = MS.param('reset');
  const verifyCode = MS.param('verify');
  if (resetCode || verifyCode) {
    history.replaceState(null, '', 'index.html'); // keep the code out of the address bar and history
    MS.store.clear();
  }
  setupGoogle();
  setupFingerprint();

  if (resetCode) show('resetForm', 'rsNew');
  else if (verifyCode) {
    show('loginForm');
    note('loginError', 'Checking your link…', true);
    MS.call('AUTH_VERIFY_EMAIL', { token: verifyCode }).then((r) => {
      $('loginUser').value = (r && r.email) || '';
      backToSignIn('Thank you, your email address is confirmed. Log in now' + (r && r.pending ? '; you will see your work once the System Administrator has approved your account.' : '.'));
      if ($('loginUser').value) $('loginPass').focus();
    }).catch((err) => { backToSignIn(''); note('loginError', err.message); });
  } else {
    const existing = MS.store.read();
    if (existing && existing.token && existing.user) {
      if (!approved(existing.user)) {
        showWaiting(existing.user);
        // the account may have been approved meanwhile
        MS.call('AUTH_ME').then((me) => {
          const user = Object.assign({}, existing.user, me);
          MS.store.update({ user, me_at: Date.now() });
          if (approved(user)) home(); else showWaiting(user);
        }).catch(() => {});
        return;
      }
      if (MS.param('change') || existing.user.must_change_password) showChange('');
      else { home(); return; }
    }
    const msg = MS.param('msg');
    if (msg) $('loginError').textContent = msg;
    if (MS.param('signup')) show('signupForm', 'suName');
    else if ($('loginForm').hidden === false) $('loginUser').focus();
  }

  // ---------- log in ----------
  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = $('loginUser').value.trim();
    const password = $('loginPass').value;
    $('resendBox').hidden = true;
    if (!username || !password) { note('loginError', 'Enter your email (or username) and password.'); return; }
    const btn = $('loginBtn');
    MS.busy(btn, true, 'Logging in…');
    note('loginError', '');
    try {
      signedIn(await MS.call('AUTH_LOGIN', { username, password, client_info: clientInfo() }), password);
    } catch (err) {
      note('loginError', err.message);
      if (err.code === 'EMAIL_NOT_VERIFIED') $('resendBox').hidden = false;
      $('loginPass').value = '';
      $('loginPass').focus();
    } finally { MS.busy(btn, false); }
  });

  async function resend(email, msgEl, btn) {
    MS.busy(btn, true, 'Sending…');
    try {
      const r = await MS.call('AUTH_RESEND_VERIFICATION', { email });
      note(msgEl, 'If that account still needs it, a new VERIFY link is on its way (it works for ' + ((r && r.hours) || 24) + ' hours). Check your inbox and spam folder.', true);
    } catch (err) { note(msgEl, err.message); } finally { MS.busy(btn, false); }
  }
  $('resendBtn').addEventListener('click', () => resend($('loginUser').value.trim(), 'loginError', $('resendBtn')));

  // ---------- create an account ----------
  let sentTo = '';
  $('signupOpen').addEventListener('click', () => {
    if ($('loginUser').value.indexOf('@') > 0) $('suEmail').value = $('loginUser').value.trim();
    note('signupError', '');
    show('signupForm', 'suName');
  });
  $('signupBack').addEventListener('click', () => backToSignIn(''));
  $('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = { full_name: $('suName').value.trim(), email: $('suEmail').value.trim(), phone: $('suPhone').value.trim(), password: $('suPass').value, password_confirm: $('suPass2').value };
    if (!d.full_name || !d.email || !d.password) { note('signupError', 'Enter your full name, email address and a password.'); return; }
    if (d.password !== d.password_confirm) { note('signupError', 'The two passwords do not match.'); return; }
    const btn = $('signupBtn');
    MS.busy(btn, true, 'Creating…');
    note('signupError', '');
    try {
      const r = await MS.call('AUTH_SIGNUP', d);
      sentTo = (r && r.email) || d.email;
      $('suPass').value = ''; $('suPass2').value = '';
      $('sentText').textContent = 'We sent a VERIFY link to ' + sentTo + '.';
      note('sentError', '');
      show('sentCard');
    } catch (err) { note('signupError', err.message); } finally { MS.busy(btn, false); }
  });
  $('sentResend').addEventListener('click', () => resend(sentTo, 'sentError', $('sentResend')));
  $('sentBack').addEventListener('click', () => { $('loginUser').value = sentTo; backToSignIn(''); });

  // ---------- waiting for approval ----------
  $('waitCheck').addEventListener('click', async () => {
    MS.busy($('waitCheck'), true, 'Checking…');
    try {
      const me = await MS.call('AUTH_ME');
      const s = MS.store.read();
      const user = Object.assign({}, s ? s.user : {}, me);
      MS.store.update({ user, me_at: Date.now() });
      if (approved(user)) { home(); return; }
      showWaiting(user);
      note('waitError', 'Not approved yet. We will email you when it is ready.');
    } catch (err) { note('waitError', err.message); } finally { MS.busy($('waitCheck'), false); }
  });
  $('waitOut').addEventListener('click', () => MS.signOut(''));

  // ---------- forced password change ----------
  $('changeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const np = $('chNew').value, np2 = $('chNew2').value;
    if (np !== np2) { $('changeError').textContent = 'The new passwords do not match.'; return; }
    const btn = $('changeBtn');
    MS.busy(btn, true, 'Saving…');
    $('changeError').textContent = '';
    try {
      await MS.call('AUTH_CHANGE_PASSWORD', { current_password: $('chCur').value, new_password: np });
      MS.store.clear();
      backToSignIn('Password changed. Sign in with your new password.');
    } catch (err) { $('changeError').textContent = err.message; } finally { MS.busy(btn, false); }
  });
  $('changeCancel').addEventListener('click', () => { MS.store.clear(); location.replace('index.html'); });

  // ---------- forgot / reset password ----------
  $('forgotOpen').addEventListener('click', () => {
    $('forgotUser').value = $('loginUser').value.trim();
    note('forgotError', '');
    show('forgotForm', 'forgotUser');
  });
  $('forgotBack').addEventListener('click', () => backToSignIn(''));
  $('resetBack').addEventListener('click', () => backToSignIn(''));

  $('forgotForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const login = $('forgotUser').value.trim();
    if (!login) { note('forgotError', 'Enter your username or email address.'); return; }
    const btn = $('forgotBtn');
    MS.busy(btn, true, 'Sending…');
    note('forgotError', '');
    try {
      const r = await MS.call('AUTH_FORGOT_PASSWORD', { login });
      note('forgotError', 'If that account has an email address, a reset link is on its way. Check your inbox (and spam folder). The link works for ' +
        ((r && r.minutes) || 60) + ' minutes.', true);
    } catch (err) { note('forgotError', err.message); } finally { MS.busy(btn, false); }
  });

  $('resetForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const np = $('rsNew').value, np2 = $('rsNew2').value;
    if (np !== np2) { $('resetError').textContent = 'The new passwords do not match.'; return; }
    const btn = $('resetBtn');
    MS.busy(btn, true, 'Saving…');
    $('resetError').textContent = '';
    try {
      const r = await MS.call('AUTH_RESET_PASSWORD', { token: resetCode, new_password: np });
      $('loginUser').value = (r && r.username) || '';
      backToSignIn('Password changed. Sign in with your new password.');
      if ($('loginUser').value) $('loginPass').focus();
    } catch (err) { $('resetError').textContent = err.message; } finally { MS.busy(btn, false); }
  });
})();
