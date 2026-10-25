/* Leave: requests waiting for a decision, all requests in the manager's scope, my own requests, and the team calendar.
   Nobody decides their own request; the buttons follow what the server says the person may do. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const sc = MS.sc, hr = MS.hr;
  const state = { tab: '', page: 1, q: '', status: '', month: hr.monthNow() };
  let rows = [];

  const STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];

  MS.reload = () => load();
  function load() {
    const cal = state.tab === 'calendar';
    $('listPane').hidden = cal;
    $('calPane').hidden = !cal;
    $('fStatus').hidden = state.tab === 'waiting';
    return cal ? loadCalendar() : loadList();
  }

  async function loadList() {
    MS.setMsg('msg', 'Loading…');
    try {
      const own = state.tab === 'mine';
      const status = state.tab === 'waiting' ? 'PENDING' : state.status;
      const r = await MS.recall('LEAVE_LIST', { tab: own ? 'mine' : 'team', status, page: state.page, page_size: 50, search: state.q });
      rows = r.rows;
      $('tWaitN').textContent = r.waiting ? '(' + r.waiting + ')' : '';
      MS.setMsg('msg', r.total + ' request' + (r.total === 1 ? '' : 's'));
      $('listBody').innerHTML = rows.length ? rows.map((l) => `<tr${l.status === 'CANCELLED' || l.status === 'REJECTED' ? ' class="void"' : ''}>
        <td>${hr.person(l.employee_name, l.department_name)}</td>
        <td>${esc(MS.label(l.leave_type))}${l.reason ? `<div class="sub">${esc(l.reason)}</div>` : ''}</td>
        <td>${esc(MS.shortDate(l.start_date))}</td><td>${esc(MS.shortDate(l.end_date))}</td><td class="num">${esc(l.days_requested)}</td>
        <td>${MS.pill(l.status)}</td><td>${esc(l.approved_by_name || '')}</td>
        <td class="acts">${hr.leaveActions(l)}</td></tr>`).join('')
        : `<tr><td colspan="8" class="empty">${state.tab === 'waiting' ? 'Nothing is waiting for your decision.' : 'No leave requests.'}</td></tr>`;
      sc.pager('pager', r, state, load);
    } catch (err) { MS.setMsg('msg', err.message, 'error'); }
  }

  async function loadCalendar() {
    MS.setMsg('msg', 'Loading…');
    try {
      const c = await MS.recall('LEAVE_CALENDAR_GET', { month: state.month });
      const at = (id, date) => c.entries.find((e) => e.employee_id === id && e.start_date <= date && e.end_date >= date);
      $('calBox').innerHTML = `<table class="hr-cal"><thead><tr><th class="n">${esc(hr.monthName(c.month))}</th>${c.days.map((x) => `<th class="${x.holiday ? 'hol' : x.working ? '' : 'off'}" title="${esc(x.holiday || '')}">${Number(x.date.slice(8))}</th>`).join('')}</tr></thead><tbody>
        ${c.people.map((p) => `<tr><td class="n">${esc(p.name)}</td>${c.days.map((x) => { const e = at(p.employee_id, x.date);
          return `<td class="${e ? (e.status === 'PENDING' ? 'wait' : 'away') : x.holiday ? 'hol' : x.working ? '' : 'off'}" title="${e ? esc(p.name + ' · ' + (e.leave_type ? MS.label(e.leave_type) + ' · ' : '') + MS.label(e.status)) : ''}">${e ? '&bull;' : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
      MS.setMsg('msg', c.people.length ? c.people.length + ' people away or waiting in ' + hr.monthName(c.month) : 'Nobody is away in ' + hr.monthName(c.month) + '.');
    } catch (err) { MS.setMsg('msg', err.message, 'error'); }
  }

  MS.boot({ page: 'leave', any: ['LEAVE_APPROVE', 'LEAVE_REQUEST'] }).then(() => {
    const approver = MS.can('LEAVE_APPROVE'), requester = MS.can('LEAVE_REQUEST');
    $('tWaiting').hidden = !approver;
    $('tTeam').hidden = !approver;
    $('tMine').hidden = !requester;
    $('reqBtn').hidden = !requester;
    $('fStatus').innerHTML = MS.options(STATUSES, '', 'Any status');
    sc.setTab('tabs', approver ? 'waiting' : 'mine', state);
    sc.tabs('tabs', state, load);
    hr.monthBar('cBar', state, load);
    hr.wireLeave('listBody', () => rows, load);
    $('reqBtn').addEventListener('click', () => hr.requestLeave(load));
    $('fStatus').addEventListener('change', () => { state.status = $('fStatus').value; state.page = 1; load(); });
    $('search').addEventListener('input', MS.debounce(() => { state.q = $('search').value.trim(); state.page = 1; load(); }, 300));
    $('reloadBtn').addEventListener('click', load);
    if (MS.param('tab') === 'calendar') sc.setTab('tabs', 'calendar', state);
    load();
  });
})();
