(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const LETTER = { ALL: 'A', DEPARTMENT: 'D', OWN: 'O', LIMIT: 'L' };
  let roles = [], perms = [], tab = 'matrix';
  const filt = { q: '', module: '', role: '' };

  const myRoles = () => (MS.user.roles || []);
  const canEdit = (role) => MS.can('USER_ROLE_ASSIGN') && myRoles().indexOf(role.role_code) < 0;
  const grant = (role, code) => role.permissions.find((p) => p.permission_code === code);

  function visiblePerms() {
    const q = filt.q.toLowerCase();
    return perms.filter((p) => (!filt.module || p.module === filt.module) &&
      (!q || p.permission_code.toLowerCase().indexOf(q) >= 0 || String(p.description || '').toLowerCase().indexOf(q) >= 0));
  }

  function renderMatrix() {
    const list = visiblePerms();
    let lastModule = null;
    const body = list.map((p) => {
      const grp = p.module !== lastModule ? `<tr class="grp"><td colspan="${roles.length + 1}">${esc(MS.areaLabel(p.module))}</td></tr>` : '';
      lastModule = p.module;
      return grp + `<tr><td><b class="mono">${esc(p.permission_code)}</b>${p.is_sensitive === true ? ' <span class="pill pending">Sensitive</span>' : ''}<span class="sub">${esc(p.description || '')}</span></td>` +
        roles.map((r, i) => {
          const g = grant(r, p.permission_code);
          const cls = g ? g.scope : 'none', txt = g ? (LETTER[g.scope] || g.scope) : '·';
          const tip = r.role_name + ': ' + (g ? MS.label(g.scope) : 'not given');
          return `<td>${canEdit(r) ? `<button type="button" class="sc ${esc(cls)}" data-r="${i}" data-p="${esc(p.permission_code)}" title="${esc(tip)}">${esc(txt)}</button>` : `<span class="sc ${esc(cls)}" title="${esc(tip)}">${esc(txt)}</span>`}</td>`;
        }).join('') + '</tr>';
    }).join('');
    $('matrixView').innerHTML = `<table class="inv matrix"><thead><tr><th>Permission</th>${roles.map((r) => `<th title="${esc(r.role_name)}">${esc(r.role_name)}</th>`).join('')}</tr></thead>
      <tbody>${body || `<tr><td colspan="${roles.length + 1}" class="empty">No permission matches.</td></tr>`}</tbody></table>`;
  }

  function renderByRole() {
    const role = roles.find((r) => r.role_code === filt.role) || roles[0];
    if (!role) { $('roleView').innerHTML = '<p class="empty">No roles.</p>'; return; }
    const list = visiblePerms();
    const edit = canEdit(role);
    $('roleView').innerHTML = `<div class="dgrid"><div class="dpanel wide"><h3>${esc(role.role_name)} <span class="sub" style="font-weight:400">${role.permissions.length} permissions</span></h3>
      ${!edit && MS.can('USER_ROLE_ASSIGN') ? '<p class="hint">You hold this role, so you cannot change its permissions.</p>' : ''}
      <div class="tablewrap"><table class="inv"><thead><tr><th>Permission</th><th>Area</th><th>Scope</th>${edit ? '<th></th>' : ''}</tr></thead><tbody>
      ${list.map((p) => {
        const g = grant(role, p.permission_code);
        return `<tr><td><b class="mono">${esc(p.permission_code)}</b><span class="sub">${esc(p.description || '')}</span></td><td>${esc(MS.areaLabel(p.module))}</td>
          <td><span class="sc ${g ? esc(g.scope) : 'none'}">${g ? esc(MS.label(g.scope)) : 'Not given'}</span></td>
          ${edit ? `<td><div class="acts"><button type="button" data-r="${roles.indexOf(role)}" data-p="${esc(p.permission_code)}">Change</button></div></td>` : ''}</tr>`;
      }).join('') || '<tr><td colspan="4" class="empty">No permission matches.</td></tr>'}
      </tbody></table></div></div></div>`;
  }

  function render() {
    $('matrixView').hidden = tab !== 'matrix';
    $('roleView').hidden = tab !== 'byrole';
    $('roleFilter').hidden = tab !== 'byrole';
    if (tab === 'matrix') renderMatrix(); else renderByRole();
  }

  function changeScope(role, code) {
    const g = grant(role, code);
    const p = perms.find((x) => x.permission_code === code) || {};
    const f = $('scopeForm');
    f.reset();
    $('scopeTitle').textContent = code + ' · ' + role.role_name;
    $('scopeInfo').textContent = (p.description || '') + (p.is_sensitive === true ? ' This is a sensitive permission.' : '') + ' Changes apply at the next action of each user and are recorded in the audit log.';
    $('scopeSel').innerHTML = MS.options(['', ...MS.enumOf('role_permissions.scope')].map((s) => ({ value: s, label: s ? MS.label(s) : 'Not given (take away)' })), g ? g.scope : 'ALL');
    $('scopeError').textContent = '';
    const dlg = MS.openDialog('scopeDialog');
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      const d = MS.formData(f);
      if ((d.scope || '') === (g ? g.scope : '')) { dlg.close(); return; }
      MS.busy($('scopeSave'), true, 'Saving…');
      try {
        await MS.call('ROLE_PERMISSION_SET', { role_code: role.role_code, permission_code: code, scope: d.scope || null, reason: d.reason });
        dlg.close();
        await load(true);
      } catch (err) { $('scopeError').textContent = err.message; } finally { MS.busy($('scopeSave'), false); }
    };
    $('scopeCancel').onclick = () => dlg.close();
  }

  async function allPermissions() {
    const out = [];
    for (let page = 1; page < 10; page++) {
      const r = await MS.call('RECORDS_LIST', { table: 'permissions', page, page_size: 100, sort: 'permission_code' });
      out.push(...r.rows);
      if (page * r.page_size >= r.total) break;
    }
    return out;
  }

  async function load(keepScroll) {
    const box = $('matrixView'), top = box.scrollTop, left = box.scrollLeft;
    MS.setMsg('listMsg', 'Loading…');
    try {
      const [rl, pl] = await Promise.all([MS.call('ROLES_LIST'), perms.length ? Promise.resolve(perms) : allPermissions()]);
      roles = rl.filter((r) => r.status !== 'INACTIVE');
      const known = {};
      pl.forEach((p) => { known[p.permission_code] = true; });
      roles.forEach((r) => r.permissions.forEach((g) => { if (g.permission_code && !known[g.permission_code]) { known[g.permission_code] = true; pl.push({ permission_code: g.permission_code, module: 'OTHER', description: '' }); } }));
      perms = pl.slice().sort((a, b) => (a.module === b.module ? (a.permission_code < b.permission_code ? -1 : 1) : (a.module < b.module ? -1 : 1)));
      MS.setMsg('listMsg', MS.count(roles.length, 'role') + ', ' + MS.count(perms.length, 'permission') + (MS.can('USER_ROLE_ASSIGN') ? '. Click a box to change it.' : ''));
      const mods = [...new Set(perms.map((p) => p.module))];
      $('moduleFilter').innerHTML = MS.options(mods.map((m) => ({ value: m, label: MS.areaLabel(m) })), filt.module, 'Every area');
      $('roleFilter').innerHTML = MS.options(roles.map((r) => ({ value: r.role_code, label: r.role_name })), filt.role || (roles[0] && roles[0].role_code));
      render();
      if (keepScroll) { box.scrollTop = top; box.scrollLeft = left; }
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  MS.boot({ page: 'roles', any: ['USER_VIEW'], ref: true }).then(() => {
    $('tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (!b) return;
      tab = b.dataset.tab;
      $('tabs').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      render();
    });
    $('search').addEventListener('input', MS.debounce(() => { filt.q = $('search').value.trim(); render(); }, 200));
    $('moduleFilter').addEventListener('change', () => { filt.module = $('moduleFilter').value; render(); });
    $('roleFilter').addEventListener('change', () => { filt.role = $('roleFilter').value; render(); });
    $('reloadBtn').addEventListener('click', () => load(true));
    document.querySelector('main').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-r][data-p]');
      if (b) changeScope(roles[Number(b.dataset.r)], b.dataset.p);
    });
    load();
  });
})();
