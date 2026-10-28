(function () {
  const MS = (window.MS = window.MS || {});
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const list = (items) => '<ul>' + items.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>';
  const trash = () => MS.icon('trash');

  const REMOVED = ['Sign-in, password, fingerprints and open sessions (signed out at once)', 'Roles and places in section teams',
    'Notifications, clock-ins, leave, training and personal KPI records', 'Their name in every list and picker'];
  const STAYS = ['Their name, as text, on all old records: jobs, proformas, invoices, receipts, payslips, messages and the activity log',
    'Signed documents stay valid', 'Staff numbers are never reused', 'A backup of what is removed goes to Drive'];

  function ask(o) {
    return new Promise((resolve) => {
      const d = document.createElement('dialog');
      d.className = 'imdlg pdlg';
      d.innerHTML = `<form novalidate autocomplete="off">
        <div class="imdlg-body">
          <div class="imdlg-icon danger" aria-hidden="true">${trash()}</div>
          <div class="imdlg-text">
            <h3>${esc(o.title)}</h3>
            ${o.lead ? `<p>${esc(o.lead)}</p>` : ''}
            ${o.count ? `<p class="pd-count">${esc(o.count)}</p>` : ''}
            ${o.names ? `<p class="pd-names">${esc(o.names)}</p>` : ''}
            <div class="pd-cols"><div class="pd-box pd-gone"><b>Will be removed</b>${list(o.removed || REMOVED)}</div><div class="pd-box pd-stays"><b>Stays</b>${list(o.stays || STAYS)}</div></div>
            ${o.checkbox ? `<label class="check"><input type="checkbox" name="with_employee"> ${esc(o.checkbox)}</label>` : ''}
            <label>${esc(o.typeLabel)}<input type="text" name="confirm" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(o.placeholder || '')}"></label>
            <label>Your password<input type="password" name="password" autocomplete="current-password"></label>
            <div class="imdlg-err" role="alert"></div>
          </div>
        </div>
        <div class="imdlg-btns"><button type="button" class="pd-cancel">Cancel</button><button type="submit" class="danger-solid" disabled>${trash()} Delete permanently</button></div>
      </form>`;
      document.body.appendChild(d);
      const f = d.querySelector('form'), err = d.querySelector('.imdlg-err'), go = d.querySelector('button[type=submit]'), cancel = d.querySelector('.pd-cancel');
      let busy = false;
      const typedOk = () => {
        const t = f.elements.confirm.value.trim();
        return o.exact ? t === o.exact : (t.toLowerCase() === 'delete' || (o.name && t.toLowerCase() === String(o.name).trim().toLowerCase()));
      };
      const check = () => { go.disabled = busy || !typedOk() || !f.elements.password.value; };
      f.addEventListener('input', () => { err.textContent = ''; check(); });
      const close = (v) => { if (busy) return; d.close(); d.remove(); resolve(v); };
      cancel.addEventListener('click', () => close(null));
      d.addEventListener('cancel', (e) => { if (busy) e.preventDefault(); });
      d.addEventListener('click', (e) => { if (e.target === d) close(null); });
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (go.disabled || busy) return;
        busy = true; cancel.disabled = true; err.textContent = '';
        MS.busy(go, true, 'Deleting…');
        try {
          const r = await o.run({ password: f.elements.password.value, confirm_text: f.elements.confirm.value.trim(), with_employee: !!(f.elements.with_employee && f.elements.with_employee.checked) });
          busy = false; d.close(); d.remove(); resolve(r || {});
        } catch (x) {
          busy = false; cancel.disabled = false; MS.busy(go, false); err.textContent = x.message || 'Could not delete.'; f.elements.password.value = ''; check();
        }
      });
      d.showModal();
      f.elements.confirm.focus();
    });
  }

  const done = (r, text) => {
    try { MS.store.dropRef(); } catch (e) {  }
    if (MS.toast) MS.toast(r && r.already_deleted ? 'Already deleted.' : text);
    return r;
  };
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

  MS.peopleDelete = {
    one(o) {
      const isEmp = o.kind === 'employee';
      const name = o.name;
      return ask({
        title: 'Delete ' + name + ' permanently?',
        lead: isEmp ? 'Their employee record and login account are deleted. This cannot be undone from the system.' : 'The login account is deleted. This cannot be undone from the system.',
        name, typeLabel: 'Type ' + name + ' (or DELETE) to confirm', placeholder: name,
        checkbox: !isEmp && o.employeeLabel ? 'Also delete the employee record (' + o.employeeLabel + ')' : '',
        removed: isEmp ? REMOVED : REMOVED.filter((x, i) => i !== 2 && i !== 3).concat(['Their name in the user list']),
        run: (f) => MS.call(isEmp ? 'EMPLOYEE_DELETE' : 'USER_DELETE', Object.assign(isEmp ? { employee_id: o.id } : { user_id: o.id }, f)),
      }).then((r) => (r ? done(r, name + ' was deleted.') : null));
    },
    selected(o) {
      const n = (o.userIds || []).length + (o.employeeIds || []).length;
      const isEmp = !!(o.employeeIds || []).length;
      return ask({
        title: 'Delete ' + plural(n, isEmp ? 'employee' : 'user') + ' permanently?',
        lead: isEmp ? 'The selected employees and their login accounts are deleted.' : 'The selected login accounts are deleted.',
        count: 'This will delete ' + plural(n, isEmp ? 'employee' : 'user'),
        names: (o.names || []).slice(0, 12).join(', ') + ((o.names || []).length > 12 ? ' and ' + ((o.names || []).length - 12) + ' more' : ''),
        exact: 'DELETE', typeLabel: 'Type DELETE to confirm', placeholder: 'DELETE',
        checkbox: !isEmp ? 'Also delete their employee records' : '',
        run: (f) => MS.call('PEOPLE_DELETE_SELECTED', Object.assign({ user_ids: o.userIds || [], employee_ids: o.employeeIds || [] }, f)),
      }).then((r) => (r ? done(r, plural(r.users || r.employees || 0, isEmp ? 'employee' : 'user') + ' deleted.') : null));
    },
    async all() {
      let prev;
      try { prev = await MS.call('PEOPLE_DELETE_PREVIEW', { mode: 'all' }); } catch (x) { MS.alert(x.message); return null; }
      if (!prev.users && !prev.employees) { MS.alert('There is nobody else to delete: you are the only user and employee.', 'Nothing to delete'); return null; }
      return ask({
        title: 'Delete all users and employees?',
        lead: 'Everybody is deleted except you and your own employee record. Jobs, customers, money records and files are not touched.',
        count: 'This will delete ' + plural(prev.users, 'user') + ' and ' + plural(prev.employees, 'employee'),
        names: (prev.names || []).join(', ') + (prev.users + prev.employees > (prev.names || []).length ? ' and more' : ''),
        exact: prev.phrase || 'DELETE ALL USERS', typeLabel: 'Type DELETE ALL USERS to confirm', placeholder: 'DELETE ALL USERS',
        run: (f) => MS.call('PEOPLE_DELETE_ALL', Object.assign({ expected_users: prev.users, expected_employees: prev.employees }, f)),
      }).then((r) => (r ? done(r, plural(r.users, 'user') + ' and ' + plural(r.employees, 'employee') + ' deleted.') : null));
    },
  };

  MS.peopleSelect = function (o) {
    const sel = new Map();
    const bar = document.getElementById(o.bar);
    const render = () => {
      bar.hidden = !sel.size;
      bar.querySelector('.grow').textContent = sel.size + ' selected';
    };
    bar.innerHTML = '<span class="grow"></span><button type="button" class="danger" data-pd="delete">' + trash() + ' Delete selected</button><button type="button" data-pd="clear">Clear</button>';
    bar.addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-pd]');
      if (!b) return;
      if (b.dataset.pd === 'clear') { sel.clear(); o.sync(); render(); return; }
      const ids = Array.from(sel.keys()), names = Array.from(sel.values());
      const r = await MS.peopleDelete.selected(o.kind === 'employee' ? { employeeIds: ids, names } : { userIds: ids, names });
      if (r) { sel.clear(); render(); o.reload(); }
    });
    return {
      has: (id) => sel.has(id),
      toggle: (id, name, on) => { if (on) sel.set(id, name); else sel.delete(id); render(); },
      clear: () => { sel.clear(); render(); },
      size: () => sel.size,
    };
  };
})();
