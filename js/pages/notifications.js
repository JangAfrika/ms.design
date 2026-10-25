/* My notifications: newest first, mark one or all as read; one about a job opens that job. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const state = { page: 1, unread: false };
  let rows = [];

  const hrefOf = (n) => (/^(jobs|quotations|messages|role_requests|users)$/.test(n.related_table || '') ? MS.recordHref(n.related_table, n.related_record_id) : '');

  MS.reload = () => load();
  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    try {
      const r = await MS.recall('NOTIFICATION_LIST', { page: state.page, page_size: 50, unread_only: state.unread, sort: 'created_at', dir: 'desc' });
      rows = r.rows;
      const unread = rows.filter((n) => !n.read_at).length;
      MS.setMsg('listMsg', r.total + ' notification' + (r.total === 1 ? '' : 's') + (state.unread ? ' not read yet' : unread ? ' · ' + unread + ' unread on this page' : ''));
      if (MS.$('bellDot') && !state.unread && state.page === 1 && !unread) { MS.$('bellDot').hidden = true; MS.store.update({ unread: 0 }); }
      $('listBody').innerHTML = rows.length ? rows.map((n) => {
        const href = hrefOf(n);
        return `<li class="${n.read_at ? '' : 'unread'}${href ? ' clk' : ''}" data-id="${esc(n.notification_id)}"${href ? ` data-href="${esc(href)}"` : ''}>
          <div class="t"><b>${esc(n.title)}</b>${n.body ? `<p>${esc(n.body)}</p>` : ''}${href ? `<p><span class="lnk">${n.related_table === 'jobs' ? 'Open the job' : 'Open'} ›</span></p>` : ''}</div>
          <div class="w"><span title="${esc(MS.dateTime(n.created_at))}">${esc(MS.ago(n.created_at))}</span>${n.read_at ? '' : `<br><button type="button" data-read="${esc(n.notification_id)}">Mark as read</button>`}</div>
        </li>`;
      }).join('') : `<li><p class="empty" style="margin:0;width:100%">${state.unread ? 'You have read everything.' : 'No notifications.'}</p></li>`;
      pager(r);
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  function pager(r) {
    const pages = Math.max(1, Math.ceil(r.total / r.page_size));
    $('pager').innerHTML = pages > 1 ? `<button type="button" id="pPrev"${state.page <= 1 ? ' disabled' : ''}>Previous</button><span>Page ${state.page} of ${pages}</span><button type="button" id="pNext"${state.page >= pages ? ' disabled' : ''}>Next</button>` : '';
    if (pages > 1) {
      $('pPrev').onclick = () => { state.page--; load(); };
      $('pNext').onclick = () => { state.page++; load(); };
    }
  }

  async function onClick(e) {
    const rb = e.target.closest('button[data-read]');
    if (rb) {
      MS.busy(rb, true, '…');
      try { await MS.call('NOTIFICATION_READ', { notification_id: rb.dataset.read }); load(); } catch (err) { MS.busy(rb, false); MS.alert(err.message); }
      return;
    }
    const li = e.target.closest('li[data-href]');
    if (!li) return;
    const n = rows.find((x) => x.notification_id === li.dataset.id);
    if (n && !n.read_at) { try { await MS.call('NOTIFICATION_READ', { notification_id: n.notification_id }); } catch (err) { /* opening the job matters more */ } }
    location.href = li.dataset.href;
  }

  MS.boot({ page: 'notifications' }).then(() => {
    MS.notifyReady.then(() => { if (MS.notify && MS.notify.supported) MS.notify.mount($('notifyBar')); });
    $('listBody').addEventListener('click', onClick);
    $('reloadBtn').addEventListener('click', load);
    $('chips').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-f]');
      if (!b) return;
      $('chips').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
      state.unread = b.dataset.f === 'unread';
      state.page = 1;
      load();
    });
    $('allBtn').addEventListener('click', async () => {
      MS.busy($('allBtn'), true, 'Marking…');
      try {
        const r = await MS.call('NOTIFICATION_READ', { all: true });
        if (MS.$('bellDot')) { MS.$('bellDot').hidden = true; MS.store.update({ unread: 0 }); }
        await load();
        MS.setMsg('listMsg', (r.marked || 0) + ' marked as read.', 'ok');
      } catch (err) { MS.alert(err.message); } finally { MS.busy($('allBtn'), false); }
    });
    load();
  });
})();
