/* Training: what each person must do and has done, with the next due date. Managers plan training for the people in their scope;
   people see their own training on My HR. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const sc = MS.sc, dc = MS.dc, hr = MS.hr;
  const state = { tab: 'people', page: 1, q: '', status: '', overdue: false };
  let r = null;

  MS.reload = () => load();
  async function load() {
    $('peoplePane').hidden = state.tab !== 'people';
    $('recPane').hidden = state.tab !== 'records';
    MS.setMsg('msg', 'Loading…');
    try {
      r = await MS.recall('TRAINING_LIST', { page: state.page, page_size: 50, status: state.status, overdue: state.overdue || undefined, search: state.q });
      const can = MS.can('TRAINING_MANAGE') && r.can.manage;
      $('addBtn').hidden = !can;
      const t = r.totals;
      $('cards').innerHTML = `<div class="card"><div class="k">Required training</div><div class="v">${esc(t.required)}</div><div class="s">${esc(t.completed)} completed</div></div>
        <div class="card ${t.pct !== null && t.pct < 100 ? '' : 'green'}"><div class="k">Completed</div><div class="v">${esc(hr.pct(t.pct))}</div><div class="s">of the required items</div></div>
        <div class="card ${t.overdue ? 'red' : ''}"><div class="k">Overdue</div><div class="v">${esc(t.overdue)}</div><div class="s">required, past the due date</div></div>
        <div class="card"><div class="k">Missed</div><div class="v">${esc(t.missed)}</div><div class="s">to be planned again</div></div>`;
      MS.setMsg('msg', r.people.length + ' people with training records');
      $('pBody').innerHTML = r.people.length ? r.people.map((p) => `<tr><td>${hr.person(p.name, p.department_name)}</td><td class="num">${esc(p.required)}</td><td class="num">${esc(p.completed)}</td><td class="num${p.overdue ? ' late' : ''}">${esc(p.overdue)}</td><td class="num">${esc(p.missed)}</td><td class="num">${esc(hr.pct(p.pct))}</td><td>${esc(MS.shortDate(p.next_due))}</td>
        <td class="acts">${can ? `<button type="button" data-plan="${esc(p.employee_id)}">Plan training</button>` : ''}</td></tr>`).join('') : '<tr><td colspan="8" class="empty">No training has been planned yet.</td></tr>';
      $('rBody').innerHTML = r.rows.length ? r.rows.map((x) => `<tr${x.status === 'CANCELLED' ? ' class="void"' : ''}><td>${hr.person(x.employee_name, x.department_name)}</td><td>${esc(x.training_title)}</td><td>${x.is_required ? 'Yes' : 'No'}</td>
        <td class="${x.overdue ? 'late' : x.due_soon ? 'soon' : ''}">${esc(MS.shortDate(x.due_date))}${x.overdue ? ' (overdue)' : ''}</td><td>${MS.pill(x.status)}</td><td>${esc(MS.shortDate(x.completed_date))}</td>
        <td class="acts">${can && (x.status === 'PLANNED' || x.status === 'MISSED') ? `<button type="button" class="primary" data-done="${esc(x.training_record_id)}">Completed</button>` : ''}${can && x.status === 'PLANNED' ? `<button type="button" data-edit="${esc(x.training_record_id)}">Change</button><button type="button" data-set="MISSED" data-id="${esc(x.training_record_id)}">Missed</button><button type="button" class="danger" data-set="CANCELLED" data-id="${esc(x.training_record_id)}">Cancel</button>` : ''}${can && x.status === 'MISSED' ? `<button type="button" data-set="PLANNED" data-id="${esc(x.training_record_id)}">Plan again</button>` : ''}</td></tr>`).join('')
        : '<tr><td colspan="7" class="empty">No training records.</td></tr>';
      sc.pager('pager', r, state, load);
    } catch (err) { MS.setMsg('msg', err.message, 'error'); }
  }

  const yesNo = (v) => MS.options([{ value: 'true', label: 'Required' }, { value: 'false', label: 'Optional' }], v ? 'true' : 'false');

  function planForm(empId) {
    sc.ask({ title: 'Plan training', wide: true, noText: true, button: 'Save',
      info: 'Required training counts towards the completed percentage and is chased when it is overdue.',
      extra: `<label class="req">Person <select id="tEmp">${MS.employeeOptions(empId || '', '— choose —')}</select></label>
        <label class="req">Training <input id="tTitle" type="text" maxlength="200"></label>
        <div class="two"><label>Type <select id="tReq">${yesNo(true)}</select></label><label>Due date <input id="tDue" type="date"></label></div>`,
      run: async () => {
        if (!dc.val('tEmp') || !dc.val('tTitle')) throw new Error('Choose the person and enter the training.');
        await MS.call('TRAINING_SAVE', dc.clean({ employee_id: dc.val('tEmp'), training_title: dc.val('tTitle'), is_required: dc.val('tReq') === 'true', due_date: dc.val('tDue') }));
        await load();
      } });
  }

  function editForm(x) {
    sc.ask({ title: 'Change training · ' + x.employee_name, noText: true, button: 'Save',
      extra: `<label class="req">Training <input id="tTitle" type="text" maxlength="200" value="${esc(x.training_title)}"></label>
        <div class="two"><label>Type <select id="tReq">${yesNo(x.is_required)}</select></label><label>Due date <input id="tDue" type="date" value="${esc(x.due_date || '')}"></label></div>`,
      run: async () => {
        if (!dc.val('tTitle')) throw new Error('Enter the training.');
        await MS.call('TRAINING_SAVE', { training_record_id: x.training_record_id, employee_id: x.employee_id, training_title: dc.val('tTitle'), is_required: dc.val('tReq') === 'true', due_date: dc.val('tDue') });
        await load();
      } });
  }

  function doneForm(x) {
    sc.ask({ title: 'Training completed · ' + x.employee_name, noText: true, button: 'Save', info: x.training_title + '. Enter the next due date when it must be repeated; it is planned as a new required item.',
      extra: `<div class="two"><label>Completed on <input id="tDone" type="date" value="${esc(MS.todayISO())}"></label><label>Next due <input id="tNext" type="date"></label></div>`,
      run: async () => { await MS.call('TRAINING_COMPLETE', dc.clean({ training_record_id: x.training_record_id, completed_date: dc.val('tDone'), next_due_date: dc.val('tNext') })); await load(); } });
  }

  function statusForm(x, status) {
    sc.ask({ title: (status === 'PLANNED' ? 'Plan again · ' : status === 'MISSED' ? 'Mark missed · ' : 'Cancel training · ') + x.employee_name, danger: status === 'CANCELLED', label: 'Why', required: true,
      info: x.training_title, button: 'Save', run: async (t) => { await MS.call('TRAINING_STATUS_SET', { training_record_id: x.training_record_id, status, reason: t }); await load(); } });
  }

  MS.boot({ page: 'training', any: ['TRAINING_MANAGE'], ref: true }).then(() => {
    $('fStatus').innerHTML = MS.options(['PLANNED', 'COMPLETED', 'MISSED', 'CANCELLED'], '', 'Any status');
    sc.tabs('tabs', state, load);
    $('addBtn').addEventListener('click', () => planForm(''));
    $('fStatus').addEventListener('change', () => { state.status = $('fStatus').value; state.page = 1; load(); });
    $('fOver').addEventListener('change', () => { state.overdue = $('fOver').checked; state.page = 1; load(); });
    $('search').addEventListener('input', MS.debounce(() => { state.q = $('search').value.trim(); state.page = 1; load(); }, 300));
    $('reloadBtn').addEventListener('click', load);
    $('pBody').addEventListener('click', (e) => { const b = e.target.closest('[data-plan]'); if (b) planForm(b.dataset.plan); });
    $('rBody').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const id = b.dataset.done || b.dataset.edit || b.dataset.id;
      const x = r.rows.find((v) => v.training_record_id === id);
      if (b.dataset.done) doneForm(x);
      else if (b.dataset.edit) editForm(x);
      else if (b.dataset.set) statusForm(x, b.dataset.set);
    });
    load();
  });
})();
