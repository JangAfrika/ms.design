/* My account: who I am, my phone and address, and my password. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;

  function about(me) {
    $('aboutMe').innerHTML = MS.kv([['Name', me.display_name], ['Username', me.username], ['Employee no.', me.employee_number],
      ['Position', me.position], ['Department', me.department],
      ['Roles', (me.roles || []).map((r) => `<span class="pill off">${esc(MS.label(r))}</span>`).join(' '), true]]);
  }

  MS.boot({ page: 'account' }).then(async () => {
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
