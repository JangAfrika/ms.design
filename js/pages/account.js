/* My account: who I am, my phone and address, and my password. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;

  function about(me) {
    $('aboutMe').innerHTML = MS.kv([['Name', me.display_name], ['Username', me.username], ['Employee no.', me.employee_number],
      ['Position', me.position], ['Department', me.department],
      ['Roles', (me.roles || []).map((r) => `<span class="pill off">${esc(MS.label(r))}</span>`).join(' '), true]]);
  }

  // ---------- fingerprint sign-in: turn it on for this device, see and remove the ones I have ----------
  function fingerprints() {
    const P = MS.passkeys;
    const rows = $('fpRows');
    async function list() {
      try {
        const r = await MS.call('PASSKEY_LIST', {});
        rows.innerHTML = r.rows.length ? r.rows.map((k) => `<tr><td>${esc(k.device_label)}</td><td>${esc(MS.when(k.created_at))}</td><td>${esc(k.last_used_at ? MS.when(k.last_used_at) : 'not yet')}</td><td><div class="acts"><button type="button" data-remove="${esc(k.passkey_id)}" data-name="${esc(k.device_label)}">Remove</button></div></td></tr>`).join('')
          : '<tr><td colspan="4" class="empty">No fingerprint is turned on yet.</td></tr>';
        $('fpAdd').disabled = r.rows.length >= 5 || $('fpAdd').dataset.off === '1';
        if (r.rows.length >= 5) $('fpMsg').textContent = 'You have 5 fingerprints turned on, which is the most. Remove one to add another.';
      } catch (err) { rows.innerHTML = `<tr><td colspan="4" class="empty">${esc(err.message)}</td></tr>`; }
    }
    function off(text) { $('fpOff').hidden = false; $('fpOff').textContent = text; $('fpOn').hidden = true; $('fpAdd').dataset.off = '1'; }
    if (!P || !P.supported()) off('This browser cannot use fingerprint sign-in. Try Chrome, Safari or Edge on a phone or computer with a fingerprint, face or screen lock.');
    else P.available().then((yes) => { if (!yes) off('This device has no fingerprint, face or screen lock that the browser can use, so fingerprint sign-in cannot be turned on here. You can still turn it on from another phone or computer.'); });
    $('fpLabel').value = P ? P.guessLabel() : '';
    $('fpAdd').addEventListener('click', async () => {
      $('fpError').textContent = '';
      MS.setMsg('fpMsg', '');
      MS.busy($('fpAdd'), true, 'Waiting for your fingerprint…');
      try {
        await P.register($('fpLabel').value);
        MS.setMsg('fpMsg', 'Done. Next time, choose "Sign in with fingerprint" on the sign-in page.', 'ok');
        await list();
      } catch (err) { $('fpError').textContent = P.friendly(err, 'register'); } finally { MS.busy($('fpAdd'), false); }
    });
    rows.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-remove]');
      if (!b) return;
      if (!(await MS.confirm({ title: 'Remove fingerprint', message: 'Remove "' + b.dataset.name + '"? That device will need your password to sign in until you turn it on again.', confirmText: 'Remove', danger: true }))) return;
      try {
        await MS.call('PASSKEY_REVOKE', { passkey_id: b.dataset.remove });
        if (!rows.querySelector('[data-remove]:not([data-remove="' + b.dataset.remove + '"])')) try { localStorage.removeItem('ms.fingerprint'); } catch (x) { /* fine */ }
        MS.setMsg('fpMsg', 'Removed.', 'ok');
        list();
      } catch (err) { $('fpError').textContent = err.message; }
    });
    list();
    if (location.hash === '#fingerprint') setTimeout(() => $('fingerprint').scrollIntoView({ block: 'start' }), 300);
  }

  MS.boot({ page: 'account' }).then(async () => {
    MS.notifyReady.then(() => { if (MS.notify) MS.notify.mount($('notifyBox2')); });
    const me = MS.user;
    about(me);
    $('pwUser').value = me.username || '';
    MS.call('AUTH_ME').then((fresh) => about(Object.assign({}, me, fresh))).catch(() => {});

    const canSelf = MS.can('EMPLOYEE_PROFILE_SELF');
    if (!me.employee_id || !canSelf) {
      $('contactBox').hidden = true;
      $('noEmployee').hidden = false;
      if (me.employee_id && !canSelf) $('noEmployee').textContent = 'Ask the System Administrator to change your contact details.';
    } else {
      MS.busy($('contactSave'), true, 'Loading…');
      MS.call('EMPLOYEE_GET', { employee_id: me.employee_id }).then((e) => {
        $('aPhone').value = e.phone || '';
        $('aAddress').value = e.address || '';
      }).catch((err) => { $('contactError').textContent = err.message; }).finally(() => MS.busy($('contactSave'), false));
      $('contactForm').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        $('contactError').textContent = '';
        MS.setMsg('contactMsg', '');
        MS.busy($('contactSave'), true, 'Saving…');
        try {
          await MS.call('USER_UPDATE_PROFILE', { phone: $('aPhone').value.trim(), address: $('aAddress').value.trim() });
          MS.setMsg('contactMsg', 'Saved.', 'ok');
        } catch (err) { $('contactError').textContent = err.message; } finally { MS.busy($('contactSave'), false); }
      });
    }

    fingerprints();

    if (!canSelf) { $('pwSave').disabled = true; $('pwError').textContent = 'Your account cannot change its own password here. Ask the System Administrator.'; }
    $('pwForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      $('pwError').textContent = '';
      MS.setMsg('pwMsg', '');
      const cur = $('pwCur').value, np = $('pwNew').value;
      if (!cur || !np) { $('pwError').textContent = 'Enter your current password and the new one.'; return; }
      if (np.length < 6) { $('pwError').textContent = 'The new password must have at least 6 characters.'; return; }
      if (np !== $('pwNew2').value) { $('pwError').textContent = 'The two new passwords are not the same.'; return; }
      MS.busy($('pwSave'), true, 'Changing…');
      try {
        await MS.call('AUTH_CHANGE_PASSWORD', { current_password: cur, new_password: np });
        $('pwForm').reset();
        $('pwUser').value = me.username || '';
        MS.setMsg('pwMsg', 'Password changed. Any other place you were signed in has been signed out.', 'ok');
      } catch (err) { $('pwError').textContent = err.message; } finally { MS.busy($('pwSave'), false); }
    });
  });
})();
