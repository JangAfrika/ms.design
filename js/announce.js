(function () {
  const MS = window.MS;
  if (!MS || MS.announce) return;
  const esc = MS.esc;
  const KEY = 'ms.ann.dismissed';
  const ICON = { INFO: 'help', IMPORTANT: 'alert', URGENT: 'megaphone' };
  const LEVEL = { INFO: 'Information', IMPORTANT: 'Important', URGENT: 'Urgent' };
  const MAX_SHOWN = 3;
  let list = [], small = {}, timer = null;

  const dismissed = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
  const remember = (id) => { try { const d = dismissed(); d[id] = 1; const ids = Object.keys(d).slice(-100); localStorage.setItem(KEY, JSON.stringify(ids.reduce((o, k) => { o[k] = 1; return o; }, {}))); } catch (e) {  } };

  function box() {
    let b = document.getElementById('annBar');
    if (b) return b;
    const bar = document.querySelector('header.appbar');
    if (!bar) return null;
    b = document.createElement('div');
    b.id = 'annBar'; b.className = 'ann-bar no-print'; b.setAttribute('role', 'region'); b.setAttribute('aria-label', 'Announcements');
    bar.insertAdjacentElement('afterend', b);
    return b;
  }

  function visible() {
    const now = Date.now(), gone = dismissed();
    return list.filter((a) => Date.parse(a.expires_at) > now && (a.level === 'URGENT' || !gone[a.announcement_id]));
  }

  function render() {
    const b = box();
    if (!b) return;
    const rows = visible();
    const shown = rows.slice(0, MAX_SHOWN);
    b.innerHTML = shown.map((a) => {
      const urgent = a.level === 'URGENT', min = !!small[a.announcement_id];
      return `<div class="ann ${esc(a.level)}${min ? ' small' : ''}" data-id="${esc(a.announcement_id)}" role="${urgent ? 'alert' : 'status'}">${MS.icon(ICON[a.level] || 'info')}
        <div class="ann-main"><b>${esc(a.title)}</b>${a.body ? `<p>${esc(a.body)}</p>` : ''}<div class="ann-by">${esc(a.posted_by_name)}${a.posted_by_title ? ', ' + esc(a.posted_by_title) : ''} · ${esc(MS.when(a.posted_at))} · until ${esc(MS.when(a.expires_at))}</div></div>
        <button type="button" data-act="${urgent ? 'fold' : 'close'}" aria-label="${urgent ? (min ? 'Show' : 'Make smaller') : 'Dismiss'}">${urgent ? (min ? 'Show' : 'Smaller') : 'Dismiss'}</button></div>`;
    }).join('') + (rows.length > MAX_SHOWN ? `<a class="ann-more" href="announcements.html">+${rows.length - MAX_SHOWN} more announcement${rows.length - MAX_SHOWN === 1 ? '' : 's'}</a>` : '');
  }

  async function refresh() {
    try {
      const r = await MS.call('ANNOUNCEMENT_ACTIVE', {}, { live: true, noRetry: true });
      list = r.rows || [];
      render();
    } catch (e) {  }
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#annBar button[data-act]');
    if (!btn) return;
    const id = btn.closest('.ann').dataset.id;
    if (btn.dataset.act === 'close') remember(id); else small[id] = !small[id];
    render();
  });

  MS.announce = { refresh, render, list: () => list.slice() };
  refresh();
  timer = setInterval(render, 30000);
})();
