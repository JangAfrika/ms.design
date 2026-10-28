(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const state = { type: '', page: 1, search: '', from: '', to: '', user: '', record: MS.param('record') };
  let people = null;

  const href = (e) => {
    const q = encodeURIComponent(e.record_id || '');
    if (!e.record_id) return '';
    if (e.table === 'jobs') return 'jobs/job.html?id=' + q;
    if (e.table === 'quotations') return 'customers/quotation.html?id=' + q;
    if (e.table === 'invoices') return 'finance/invoice.html?id=' + q;
    if (e.table === 'customers') return 'customers/customer.html?id=' + q;
    if (e.table === 'employees') return 'people/employee.html?id=' + q;
    if (e.table === 'messages') return 'management/messages.html';
    return '';
  };

  MS.reload = () => load();
  async function load() {
    MS.setMsg('hMsg', 'Loading…');
    try {
      const r = await MS.recall('HISTORY_LIST', { type: state.type, page: state.page, page_size: 30, search: state.search, date_from: state.from, date_to: state.to, user_id: state.user, record_id: state.record });
      $('hTypes').innerHTML = `<button type="button" data-t=""${state.type ? '' : ' class="active"'}>All</button>` +
        r.types.filter((t) => t.count || t.code === state.type).map((t) => `<button type="button" data-t="${esc(t.code)}"${state.type === t.code ? ' class="active"' : ''}>${esc(t.label)} (${t.count})</button>`).join('');
      if (r.can_pick && !people) {
        try { people = (await MS.call('HISTORY_PEOPLE_LIST')).rows; } catch (e) { people = []; }
        $('hWho').innerHTML = `<select id="hPerson" aria-label="Whose history"><option value="">My own history</option>${people.map((p) => `<option value="${esc(p.user_id)}">${esc(p.name)}</option>`).join('')}</select>`;
        $('hPerson').onchange = () => { state.user = $('hPerson').value; state.page = 1; load(); };
      }
      $('hHint').textContent = (r.person.is_me ? 'What you did, and what happened to your work, newest first.' : 'History of ' + r.person.name + ', newest first.') + (state.record ? ' Showing one item only.' : '');
      MS.setMsg('hMsg', r.total + ' item' + (r.total === 1 ? '' : 's'));
      $('hList').innerHTML = r.rows.length ? r.rows.map((e) => {
        const l = href(e), text = esc(e.text);
        return `<li><div class="ht"><span class="hk">${esc(e.type_label)}</span>${l ? `<a class="lnk" href="${esc(l)}">${text}</a>` : text}${e.note ? `<div class="hn">${esc(e.note)}</div>` : ''}${e.by ? `<div class="hn">By ${esc(e.by)}</div>` : ''}</div>
          <span class="hw" title="${esc(MS.dateTime(e.at))}">${esc(MS.when(e.at))}</span></li>`;
      }).join('') : '<li><div class="ht empty">Nothing here yet.</div></li>';
      MS.sc.pager('pager', r, state, load);
    } catch (err) { MS.setMsg('hMsg', err.message, 'error'); }
  }

  MS.boot({ page: 'history' }).then(() => {
    $('hTypes').addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (b) { state.type = b.dataset.t; state.page = 1; load(); } });
    let t = 0;
    $('hSearch').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { state.search = $('hSearch').value.trim(); state.page = 1; load(); }, 300); });
    $('hFrom').onchange = () => { state.from = $('hFrom').value; state.page = 1; load(); };
    $('hTo').onchange = () => { state.to = $('hTo').value; state.page = 1; load(); };
    $('hClear').onclick = () => { state.type = ''; state.search = state.from = state.to = state.record = ''; state.page = 1; $('hSearch').value = $('hFrom').value = $('hTo').value = ''; load(); };
    if (state.record) $('hSearch').placeholder = 'Search';
    load();
  });
})();
