/* Sign-in page, and the forced password change after a temporary password. */
(function () {
  const MS = window.MS;
  const { $ } = MS;
  const cfg = window.APP_CONFIG || {};

  MS.theme.floatingButton();
  document.querySelectorAll('[data-app-name]').forEach((el) => { el.textContent = cfg.APP_NAME || 'MS Designs & Printing'; });
  document.querySelectorAll('[data-app-sub]').forEach((el) => { el.textContent = cfg.APP_SUB || 'Business Management System'; });
  document.querySelectorAll('[data-app-logo]').forEach((el) => { if (cfg.APP_LOGO) el.src = cfg.APP_LOGO; else el.remove(); });
  document.querySelectorAll('[data-app-mark]').forEach((el) => { if (cfg.APP_LOGO) el.remove(); });

  function home() {
    const next = MS.param('next');
    location.replace(next && /^(?:[\w-]+\/)?[\w-]+\.html(\?[^#]*)?$/.test(next) ? next : 'dashboard.html');
  }

  function showChange(current) {
    $('loginForm').hidden = true;
    $('changeForm').hidden = false;
    if (current) $('chCur').value = current;
    $('chNew').focus();
  }

  const FORMS = ['loginForm', 'changeForm', 'forgotForm', 'resetForm'];
  function show(id, focus) {
    FORMS.forEach((f) => { $(f).hidden = f !== id; });
    if (focus) $(focus).focus();
  }
  function backToSignIn(text) {
    show('loginForm', 'loginUser');
    $('loginError').classList.toggle('ok', !!text);
    $('loginError').textContent = text || '';
  }

  // the link from a "reset your password" email: index.html?reset=<code>
  const resetCode = MS.param('reset');
  if (resetCode) {
    history.replaceState(null, '', 'index.html'); // keep the code out of the address bar and history
    MS.store.clear();
    show('resetForm', 'rsNew');
  }

  const existing = resetCode ? null : MS.store.read();
  if (existing && existing.token && existing.user) {
    if (MS.param('change') || existing.user.must_change_password) showChange('');
    else { home(); return; }
  }
  const msg = MS.param('msg');
  if (msg) $('loginError').textContent = msg;
  if ($('loginForm').hidden === false) $('loginUser').focus();

  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = $('loginUser').value.trim();
    const password = $('loginPass').value;
    if (!username || !password) { $('loginError').textContent = 'Enter your username and password.'; return; }
    const btn = $('loginBtn');
    MS.busy(btn, true, 'Signing in…');
    $('loginError').textContent = '';
    try {
      const out = await MS.call('AUTH_LOGIN', { username, password, client_info: navigator.userAgent.slice(0, 200) });
      const user = Object.assign({}, out.user, { must_change_password: !!out.must_change_password });
      MS.store.save({ token: out.token, user, expires_at: out.expires_at }, $('loginKeep').checked);
      MS.store.dropRef();
      if (out.must_change_password) { MS.busy(btn, false); showChange(password); return; }
      home();
    } catch (err) {
      $('loginError').textContent = err.message;
      $('loginPass').value = '';
      $('loginPass').focus();
      MS.busy(btn, false);
    }
  });

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
      $('changeForm').hidden = true;
      $('loginForm').hidden = false;
      $('loginError').classList.add('ok');
      $('loginError').textContent = 'Password changed. Sign in with your new password.';
      $('loginUser').focus();
    } catch (err) { $('changeError').textContent = err.message; } finally { MS.busy(btn, false); }
  });

  $('forgotOpen').addEventListener('click', () => {
    $('forgotUser').value = $('loginUser').value.trim();
    $('forgotError').textContent = '';
    $('forgotError').classList.remove('ok');
    show('forgotForm', 'forgotUser');
  });
  $('forgotBack').addEventListener('click', () => backToSignIn(''));
  $('resetBack').addEventListener('click', () => backToSignIn(''));

  $('forgotForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const login = $('forgotUser').value.trim();
    if (!login) { $('forgotError').textContent = 'Enter your username or email address.'; return; }
    const btn = $('forgotBtn');
    MS.busy(btn, true, 'Sending…');
    $('forgotError').classList.remove('ok');
    $('forgotError').textContent = '';
    try {
      const r = await MS.call('AUTH_FORGOT_PASSWORD', { login });
      $('forgotError').classList.add('ok');
      $('forgotError').textContent = 'If that account has an email address, a reset link is on its way. Check your inbox (and spam folder). The link works for ' +
        ((r && r.minutes) || 60) + ' minutes.';
    } catch (err) { $('forgotError').textContent = err.message; } finally { MS.busy(btn, false); }
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

  $('changeCancel').addEventListener('click', () => { MS.store.clear(); location.replace('index.html'); });
})();
