(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const ic = (n) => MS.icon(n);
  let st = null;
  const staff = { page: 1, q: '', only: false };
  let staffRows = [];

  const card = (n, title, body) => `<section class="card" style="margin-bottom:10px"><h3 style="display:flex;gap:8px;align-items:center;margin:0 0 6px"><span class="badge">${n}</span>${esc(title)}</h3>${body}</section>`;

  function render() {
    const on = st.mode === 'FINGERPRINT';
    const s1 = `<p>Attendance is now taken <b>${on ? 'with the fingerprint machine' : 'in the app'}</b>.${on ? ' Staff cannot clock in from the app.' : ' Staff clock in and out from the app until you switch.'}</p>
      ${st.can_switch ? `<button type="button" class="${on ? '' : 'primary'}" id="switchBtn">${on ? 'Go back to the app' : 'Use the fingerprint machine'}</button>` : '<p class="muted">Only the System Administrator can change this.</p>'}`;
    const s2 = `<p>${st.key_exists ? 'A machine key exists. It cannot be shown again.' : 'No machine key yet.'} The machine (or its bridge program) sends this key with every fingerprint so only your machine can record attendance.</p>
      <button type="button" id="keyBtn">${ic('key')} ${st.key_exists ? 'Make a new key' : 'Create machine key'}</button>
      <p class="muted">Making a new key stops the old one working. Ten wrong keys in ten minutes lock the door for a while.</p>`;
    const s3 = `<p>${st.staff_without_number} of ${st.staff_total} staff have no machine number yet. Type the number the machine shows for each person.</p>
      ${st.unmatched.length ? `<p><b>Numbers seen on the machine that match nobody:</b> ${st.unmatched.map((u) => `<span class="tag">${esc(u.device_user_id)} (${u.count})</span>`).join(' ')}</p>` : ''}
      <div class="toolbar"><input id="staffQ" type="search" placeholder="Search staff or number"><label class="chk"><input type="checkbox" id="onlyMissing"> Only without a number</label></div>
      <div class="msg" id="staffMsg" role="status"></div>
      <div class="tablewrap"><table class="inv"><thead><tr><th>Name</th><th>Dept</th><th>Machine no.</th><th>Today</th><th></th></tr></thead><tbody id="staffBody"></tbody></table></div>
      <div class="pager" id="staffPager"></div>`;
    const s4 = `<p>If the machine cannot send fingerprints by itself, export its attendance file (text or CSV) and import it. Each line needs the machine number and the date and time, for example <span class="mono">17, 2026-11-02 07:58:00</span>. Repeated lines are ignored.</p>
      <input type="file" id="impFile" accept=".txt,.csv,.dat,.log,text/plain,text/csv"> <button type="button" class="primary" id="impBtn">${ic('upload')} Import file</button>
      <div class="msg" id="impMsg" role="status"></div>
      <p class="muted">Last fingerprint: ${st.last_punch_at ? esc(MS.dateTime(st.last_punch_at)) : 'none yet'}. Today: ${st.punches_today}.</p>
      <div class="tablewrap"><table class="inv"><thead><tr><th>When</th><th>No.</th><th>Staff</th><th>From</th></tr></thead><tbody>${st.recent.length ? st.recent.map((r) => `<tr><td>${esc(MS.dateTime(r.punched_at))}</td><td class="mono">${esc(r.device_user_id)}</td><td>${esc(r.name || 'Not matched')}</td><td>${esc(r.device_name || r.source)}</td></tr>`).join('') : '<tr><td colspan="4" class="empty">No fingerprints yet.</td></tr>'}</tbody></table></div>`;
    const s5 = `<p>The system closes finished working days by itself every hour. Close a day by hand if you imported late or want it done now. Working hours: ${esc(st.workday_start)} to ${esc(st.workday_end)}. The last sign-out must be at least ${st.min_out_minutes} minutes after sign-in.</p>
      <input type="date" id="closeDate" value="${esc(st.last_closed_day || '')}" max="${MS.todayISO()}"> <button type="button" id="closeBtn">${ic('check')} Close day</button>
      <div class="msg" id="closeMsg" role="status"></div>`;
    const s6 = `<p>Apps Script is not reachable by most fingerprint machines directly. The machine's own software, or a small bridge program, has to POST JSON to the same web app address this website uses. File import above always works. No machine brand is assumed.</p>
      <pre class="json">${esc(JSON.stringify(st.endpoint.example, null, 2))}</pre>`;
    $('steps').innerHTML = card(1, 'Switch on', s1) + card(2, 'Machine key', s2) + card(3, 'Match machine numbers to staff', s3) + card(4, 'Import a file and see recent fingerprints', s4) + card(5, 'Close a day', s5) + card(6, 'If the machine sends by itself', s6);
    bind();
    loadStaff();
  }

  function bind() {
    const sw = $('switchBtn');
    if (sw) sw.addEventListener('click', async () => {
      const to = st.mode === 'FINGERPRINT' ? 'APP' : 'FINGERPRINT';
      const ok = await MS.confirm(to === 'FINGERPRINT' ? 'Use the fingerprint machine?' : 'Go back to the app?',
        to === 'FINGERPRINT' ? 'Staff will no longer clock in from the app. Anyone without a fingerprint on a working day is marked absent.' : 'Staff will clock in from the app again. Fingerprints already recorded are kept.', { confirmText: 'Yes, switch' });
      if (!ok) return;
      try { await MS.call('ATTENDANCE_DEVICE_SWITCH', { mode: to }); MS.toast('Saved'); load(); } catch (e) { MS.setMsg('pageMsg', e.message, 'error'); }
    });
    $('keyBtn').addEventListener('click', async () => {
      if (st.key_exists && !(await MS.confirm('Make a new key?', 'The old key stops working at once. The machine must be given the new key.', { confirmText: 'Make new key' }))) return;
      try {
        const r = await MS.call('ATTENDANCE_DEVICE_KEY_NEW', {});
        await MS.alert('Copy this key now. It is shown only once.\n\n' + r.device_key, 'Machine key');
        load();
      } catch (e) { MS.setMsg('pageMsg', e.message, 'error'); }
    });
    let t = null;
    $('staffQ').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { staff.q = $('staffQ').value.trim(); staff.page = 1; loadStaff(); }, 300); });
    $('onlyMissing').addEventListener('change', () => { staff.only = $('onlyMissing').checked; staff.page = 1; loadStaff(); });
    $('staffBody').addEventListener('click', async (ev) => {
      const b = ev.target.closest('button[data-i]');
      if (!b) return;
      const r = staffRows[Number(b.dataset.i)];
      const v = await MS.prompt('Machine number', 'Number for ' + r.name + '. Leave empty to remove it.', { value: r.fingerprint_id, confirmText: 'Save' });
      if (v === null || v === undefined || v === false) return;
      try { await MS.call('ATTENDANCE_DEVICE_MAP', { employee_id: r.employee_id, fingerprint_id: String(v).trim() }); MS.toast('Saved'); load(); } catch (e) { MS.setMsg('staffMsg', e.message, 'error'); }
    });
    $('impBtn').addEventListener('click', async () => {
      const f = $('impFile').files[0];
      if (!f) return MS.setMsg('impMsg', 'Choose the file from the machine first.', 'error');
      MS.setMsg('impMsg', 'Importing…');
      try {
        const r = await MS.call('ATTENDANCE_DEVICE_IMPORT', { text: await f.text(), device_name: f.name });
        MS.setMsg('impMsg', `Imported ${r.imported}. Already there ${r.duplicates}. Not matched to staff ${r.unmatched}. Unreadable lines ${(r.bad || 0) + (r.skipped || 0)}.`, 'ok');
        load();
      } catch (e) { MS.setMsg('impMsg', e.message, 'error'); }
    });
    $('closeBtn').addEventListener('click', async () => {
      const d = $('closeDate').value;
      if (!(await MS.confirm('Close ' + (d ? MS.docDate(d) : 'the last working day') + '?', 'Staff with no fingerprint, or with no sign-out, are marked absent and told.', { confirmText: 'Close day' }))) return;
      try { const r = await MS.call('ATTENDANCE_DEVICE_CLOSE_DAY', d ? { date: d } : {}); MS.setMsg('closeMsg', 'Done. ' + JSON.stringify(r), 'ok'); load(); } catch (e) { MS.setMsg('closeMsg', e.message, 'error'); }
    });
  }

  async function loadStaff() {
    try {
      const r = await MS.call('ATTENDANCE_DEVICE_STAFF_LIST', { page: staff.page, page_size: 15, search: staff.q, only_missing: staff.only });
      staffRows = r.rows;
      MS.setMsg('staffMsg', MS.count(r.total, 'person', 'people'));
      $('staffBody').innerHTML = staffRows.length ? staffRows.map((e, i) => `<tr><td>${esc(e.name)}</td><td>${esc(e.department_name || '')}</td><td class="mono">${esc(e.fingerprint_id || '—')}</td><td>${e.punches_today}</td><td><button type="button" data-i="${i}">${e.fingerprint_id ? 'Change' : 'Set'}</button></td></tr>`).join('') : '<tr><td colspan="5" class="empty">Nobody found.</td></tr>';
      MS.pager('staffPager', r, staff, loadStaff);
    } catch (e) { MS.setMsg('staffMsg', e.message, 'error'); }
  }

  async function load() {
    try { st = await MS.call('ATTENDANCE_DEVICE_STATUS', {}); render(); } catch (e) { MS.setMsg('pageMsg', e.message, 'error'); }
  }
  $('reloadBtn').addEventListener('click', load);
  MS.boot({ page: 'fingerprint', any: ['ATTENDANCE_DEVICE'] }).then(load);
})();
