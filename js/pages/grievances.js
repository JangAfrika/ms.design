/* Staff concerns (grievances): confidential. Handlers take a concern, answer it within 7 working days and close it. Nobody handles a concern
   they raised themselves. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const sc = MS.sc, dc = MS.dc, hr = MS.hr;
  const state = { tab: 'open', page: 1 };
  let rows = [];

  MS.reload = () => load();
  async function load() {
    MS.setMsg('msg', 'Loading…');
    try {
      const r = await MS.recall('GRIEVANCE_LIST', { page: state.page, page_size: 50, open: state.tab === 'open' || undefined, overdue: state.tab === 'overdue' || undefined });
      rows = r.rows;
      const f = r.figures;
      $('cards').innerHTML = `<div class="card"><div class="k">Open</div><div class="v">${esc(f.open)}</div><div class="s">not answered yet</div></div>
        <div class="card ${f.overdue ? 'red' : 'green'}"><div class="k">Overdue</div><div class="v">${esc(f.overdue)}</div><div class="s">past the 7 working days</div></div>
        <div class="card"><div class="k">Received this month</div><div class="v">${esc(f.received_month)}</div><div class="s">concerns raised</div></div>
        <div class="card ${f.on_time_pct !== null && f.on_time_pct < f.target ? 'red' : 'green'}"><div class="k">Answered on time</div><div class="v">${esc(hr.pct(f.on_time_pct))}</div><div class="s">target ${esc(f.target)} % · this month ${esc(hr.pct(f.on_time_pct_month))}</div></div>`;
      MS.setMsg('msg', r.total + ' concern' + (r.total === 1 ? '' : 's'));
      $('listBody').innerHTML = rows.length ? rows.map((g) => `<tr>
        <td>${hr.person(g.raised_by_name, g.employee_number)}</td><td>${esc(MS.label(g.category))}</td><td>${esc(MS.shortDate(g.received_date))}</td>
        <td class="${g.overdue ? 'late' : ''}">${esc(MS.shortDate(g.due_date))}${g.overdue ? ' (' + esc(g.working_days_late) + ' working day' + (g.working_days_late === 1 ? '' : 's') + ' late)' : g.working_days_left && g.status !== 'ADDRESSED' ? ` <span class="muted">(${esc(g.working_days_left)} left)</span>` : ''}</td>
        <td>${MS.pill(g.status)}${g.on_time === false ? '<div class="sub late">answered late</div>' : ''}</td><td>${esc(g.handled_by_name || '')}</td>
        <td class="acts"><button type="button" data-open="${esc(g.grievance_id)}">Open</button>${g.can_assign && !g.handled_by && g.status === 'RECEIVED' ? `<button type="button" data-take="${esc(g.grievance_id)}">Take it</button>` : ''}${g.can_respond ? `<button type="button" class="primary" data-resp="${esc(g.grievance_id)}">Respond</button>` : ''}${g.can_close ? `<button type="button" data-close="${esc(g.grievance_id)}">Close</button>` : ''}</td></tr>`).join('')
        : '<tr><td colspan="7" class="empty">No concerns here.</td></tr>';
      sc.pager('pager', r, state, load);
    } catch (err) { MS.setMsg('msg', err.message, 'error'); }
  }

  function view(g) {
    sc.view(async () => g, (x) => ({
      html: `<h3>${esc(MS.label(x.category))} · ${esc(x.raised_by_name)}</h3>
        ${MS.kv([['Received', MS.shortDate(x.received_date)], ['Answer due', MS.shortDate(x.due_date)], ['Status', MS.pill(x.status), true], ['Handled by', x.handled_by_name], ['Answered on', MS.shortDate(x.addressed_date)]])}
        <h3 class="sub-h">What was said</h3><div class="hr-pre">${esc(x.description)}</div>
        ${x.response ? `<h3 class="sub-h">Response</h3><div class="hr-pre">${esc(x.response)}</div>` : ''}`,
      buttons: [x.can_assign && x.status !== 'ADDRESSED' ? ['vAssign', 'Assign', '', () => { sc.closeView(); assignForm(x); }] : null,
        x.can_respond ? ['vResp', 'Respond', 'primary', () => { sc.closeView(); respondForm(x); }] : null]
    }));
  }

  async function assignForm(g) {
    let handlers = [];
    try { handlers = (await MS.call('GRIEVANCE_HANDLER_LIST')).rows; } catch (err) { MS.setMsg('msg', err.message, 'error'); return; }
    sc.ask({ title: 'Assign concern', noText: true, button: 'Assign', info: 'Choose who will answer it. They cannot be the person who raised it.',
      extra: `<label class="req">Handler <select id="gWho">${MS.options(handlers.map((h) => ({ value: h.user_id, label: h.name })), MS.user.user_id, '— choose —')}</select></label>`,
      run: async () => { await MS.call('GRIEVANCE_ASSIGN', { grievance_id: g.grievance_id, handled_by: dc.val('gWho') }); await load(); } });
  }

  function respondForm(g) {
    sc.ask({ title: 'Respond to ' + g.raised_by_name, wide: true, label: 'Response', required: true, button: 'Send response',
      info: 'The person is told that there is a response and reads it on My HR. Answering within 7 working days counts as on time.',
      extra: `<p class="hr-pre">${esc(g.description)}</p>`,
      run: async (t) => { await MS.call('GRIEVANCE_RESPOND', { grievance_id: g.grievance_id, response: t }); await load(); } });
  }

  MS.boot({ page: 'grievances', any: ['GRIEVANCE_MANAGE'] }).then(() => {
    sc.tabs('tabs', state, load);
    $('listBody').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const id = b.dataset.open || b.dataset.take || b.dataset.resp || b.dataset.close;
      const g = rows.find((x) => x.grievance_id === id);
      if (b.dataset.open) view(g);
      else if (b.dataset.take) sc.ask({ title: 'Take this concern', noText: true, button: 'Take it', info: 'You will be the one who answers it.', run: async () => { await MS.call('GRIEVANCE_ASSIGN', { grievance_id: id }); await load(); } });
      else if (b.dataset.resp) respondForm(g);
      else if (b.dataset.close) sc.ask({ title: 'Close this concern', noText: true, button: 'Close concern', run: async () => { await MS.call('GRIEVANCE_CLOSE', { grievance_id: id }); await load(); } });
    });
    load();
  });
})();
