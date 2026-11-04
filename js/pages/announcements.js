(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const state = { page: 1, tab: 'ACTIVE' };
  const LEVELS = [['INFO', 'Information', 'help'], ['IMPORTANT', 'Important', 'alert'], ['URGENT', 'Urgent', 'megaphone']];
  const FOR = [['1h', '1 hour'], ['today', 'Until end of today'], ['24h', '1 day'], ['72h', '3 days'], ['168h', '7 days']];
  let rows = [];

  const chips = (name, items, first) => items.map((x, i) => `<label><input type="radio" name="${name}" value="${esc(x[0])}"${i === first ? ' checked' : ''}>${x[2] ? MS.icon(x[2]) : ''}${esc(x[1])}</label>`).join('');
  $('levelChips').innerHTML = chips('level', LEVELS, 0);
  $('forChips').innerHTML = chips('for', FOR, 2);

  function expiry(v) {
    if (v === 'today') { const d = new Date(); d.setHours(23, 59, 59, 0); return { expires_at: d.toISOString() }; }
    return { hours: parseInt(v, 10) };
  }

  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    try {
      const r = await MS.call('ANNOUNCEMENT_LIST', { page: state.page, page_size: 25, state: state.tab });
      rows = r.rows;
      MS.setMsg('listMsg', MS.count(r.total, 'announcement'));
      $('listBody').innerHTML = rows.length ? rows.map((a, i) => `<tr><td class="wrap"><b>${esc(a.title)}</b>${a.body ? `<div class="sub">${esc(a.body)}</div>` : ''}</td>
        <td>${esc(a.posted_by_name)}<div class="sub">${esc(a.posted_by_title)}</div></td><td>${esc(MS.when(a.posted_at))}</td><td>${esc(MS.when(a.expires_at))}</td>
        <td>${MS.pill(a.state, a.state === 'ACTIVE' ? 'Showing' : a.state === 'EXPIRED' ? 'Ended' : 'Withdrawn')}</td>
        <td>${a.can_withdraw ? `<button type="button" data-i="${i}">Withdraw</button>` : ''}</td></tr>`).join('') : '<tr><td colspan="6" class="empty">Nothing to show.</td></tr>';
      MS.pager('pager', r, state, load);
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  $('tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (!b) return;
    state.tab = b.dataset.tab; state.page = 1;
    $('tabs').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    load();
  });

  $('listBody').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-i]');
    if (!b) return;
    const a = rows[Number(b.dataset.i)];
    if (!(await MS.confirm({ title: 'Withdraw this announcement?', message: 'It disappears from everybody\'s screen now: "' + a.title + '".', confirmText: 'Withdraw', danger: true }))) return;
    try { await MS.call('ANNOUNCEMENT_WITHDRAW', { announcement_id: a.announcement_id }); MS.toast && MS.toast('Announcement withdrawn', 'ok'); if (MS.announce) MS.announce.refresh(); load(); } catch (err) { MS.alert(err.message); }
  });

  $('annForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    MS.clearFieldErrors(f);
    if (!MS.checkRequired(f, { title: 'Write a short title.' })) return;
    const btn = $('sendBtn');
    MS.busy(btn, true, 'Sending…');
    try {
      await MS.call('ANNOUNCEMENT_POST', Object.assign({ title: f.elements.title.value, body: f.elements.body.value, level: f.elements.level.value }, expiry(f.elements.for.value)));
      f.elements.title.value = ''; f.elements.body.value = '';
      MS.setMsg('formMsg', 'Sent. Everybody will see it within a few seconds.', 'ok');
      if (MS.announce) MS.announce.refresh();
      state.page = 1; load();
    } catch (err) { MS.setMsg('formMsg', err.message, 'error'); } finally { MS.busy(btn, false); }
  });

  MS.reload = () => load();
  MS.boot({ page: 'announcements' }).then(load);
})();
