/* Shared by the People pages (My HR, attendance, leave, overtime, training, staff concerns): month picker, small helpers and the leave dialogs
   used by more than one page. Needs ui-common.js (MS.sc, MS.dc). */
(function () {
  const MS = window.MS;
  const esc = (s) => MS.esc(s);
  const sc = MS.sc, dc = MS.dc;
  const hr = (MS.hr = {});

  hr.LEAVE_TYPES = ['ANNUAL', 'SICK', 'MATERNITY', 'PATERNITY', 'COMPASSIONATE', 'UNPAID', 'OTHER'];
  hr.ATT_STATUSES = ['PRESENT', 'LATE', 'ABSENT', 'ON_LEAVE', 'SICK', 'PUBLIC_HOLIDAY', 'OFF_DUTY'];

  hr.monthNow = () => MS.todayISO().slice(0, 7);
  hr.monthName = (m) => new Date(m + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  hr.shiftMonth = (m, n) => { const d = new Date(m + '-01T00:00:00'); d.setMonth(d.getMonth() + n); return d.getFullYear() + '-' + MS.pad(d.getMonth() + 1); };
  hr.pct = (v) => (v === null || v === undefined ? '–' : MS.num(v) + ' %');
  /* a figure below its target is shown in red */
  hr.pctCell = (v, ok) => `<span class="${ok === false ? 'hr-warn' : ''}">${esc(hr.pct(v))}</span>`;
  hr.hours = (v) => (v === '' || v == null ? '' : MS.num(v) + ' h');
  hr.clock = (v) => esc(v || '');
  hr.person = (name, sub) => `<b>${esc(name)}</b>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}`;

  /* previous / month box / next; state.month is kept in step and load() runs after each change */
  hr.monthBar = (boxId, state, load) => {
    const box = MS.$(boxId);
    box.classList.add('hr-month');
    box.innerHTML = `<button type="button" data-m="-1" aria-label="Previous month">&lsaquo;</button><input type="month" value="${esc(state.month)}" aria-label="Month"><button type="button" data-m="1" aria-label="Next month">&rsaquo;</button>`;
    const input = box.querySelector('input');
    const go = (m) => { if (!/^\d{4}-\d{2}$/.test(m)) return; state.month = m; input.value = m; load(); };
    box.addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (b) go(hr.shiftMonth(state.month, Number(b.dataset.m))); });
    input.addEventListener('change', () => go(input.value));
  };

  hr.leaveBalanceTable = (list) => (list.length ? `<div class="tablewrap"><table class="inv"><thead><tr><th>Leave</th><th class="num">Entitled</th><th class="num">Used</th><th class="num">Waiting</th><th class="num">Left</th></tr></thead><tbody>
    ${list.map((b) => `<tr><td>${esc(MS.label(b.leave_type))}</td><td class="num">${b.entitlement === null ? 'no limit' : esc(MS.num(b.entitlement))}</td><td class="num">${esc(MS.num(b.used))}</td><td class="num">${esc(MS.num(b.pending))}</td><td class="num${b.over ? ' late' : ''}">${b.remaining === null ? '–' : esc(MS.num(b.remaining))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">No leave allowance is set.</p>');

  /* ---------- leave dialogs ---------- */
  hr.requestLeave = (done) => sc.ask({ title: 'Request leave', wide: true,
    info: 'Rest days and public holidays are not counted. Sick and compassionate leave can be reported up to 30 days afterwards; all other leave must start today or later.',
    extra: `<label class="req">Type <select id="lType">${MS.options(hr.LEAVE_TYPES, 'ANNUAL')}</select></label>
      <div class="two"><label class="req">First day <input id="lFrom" type="date"></label><label class="req">Last day <input id="lTo" type="date"></label></div>`,
    label: 'Reason (needed for Other)', button: 'Send request',
    run: async (t) => {
      if (!dc.val('lFrom') || !dc.val('lTo')) throw new Error('Choose the first and last day.');
      const r = await MS.call('LEAVE_REQUEST', dc.clean({ leave_type: dc.val('lType'), start_date: dc.val('lFrom'), end_date: dc.val('lTo'), reason: t }));
      MS.setMsg('msg', 'Leave requested: ' + r.days_requested + ' working day' + (Number(r.days_requested) === 1 ? '' : 's') + '. Your manager has been told.', 'ok');
      await done();
    } });

  hr.decideLeave = (l, decision, done) => sc.ask({ title: (decision === 'APPROVE' ? 'Approve leave · ' : 'Reject leave · ') + l.employee_name,
    info: MS.label(l.leave_type) + ', ' + l.days_requested + ' working day' + (Number(l.days_requested) === 1 ? '' : 's') + ', ' + MS.shortDate(l.start_date) + ' to ' + MS.shortDate(l.end_date) + (l.reason ? '. ' + l.reason : '') + '.',
    label: decision === 'APPROVE' ? 'Note (optional)' : 'Why not', required: decision !== 'APPROVE', danger: decision !== 'APPROVE', button: decision === 'APPROVE' ? 'Approve' : 'Reject',
    run: async (t) => { await MS.call('LEAVE_DECIDE', dc.clean({ leave_request_id: l.leave_request_id, decision, comment: t })); await done(); } });

  hr.cancelLeave = (l, done) => sc.ask({ title: 'Cancel leave' + (l.is_mine ? '' : ' · ' + l.employee_name), danger: true,
    info: MS.shortDate(l.start_date) + ' to ' + MS.shortDate(l.end_date) + '. The days go back to the balance.',
    label: l.is_mine ? 'Why (optional)' : 'Why', required: !l.is_mine, button: 'Cancel leave',
    run: async (t) => { await MS.call('LEAVE_CANCEL', dc.clean({ leave_request_id: l.leave_request_id, reason: t })); await done(); } });

  hr.leaveActions = (l) => (l.can_decide ? `<button type="button" class="primary" data-ldec="APPROVE" data-id="${esc(l.leave_request_id)}">Approve</button><button type="button" class="danger" data-ldec="REJECT" data-id="${esc(l.leave_request_id)}">Reject</button>` : '')
    + (l.can_cancel ? `<button type="button" data-lcan="${esc(l.leave_request_id)}">Cancel</button>` : '');
  /* one click handler for a table drawn with hr.leaveActions */
  hr.wireLeave = (bodyId, rows, done) => {
    if (!MS.$(bodyId)) return;
    MS.$(bodyId).onclick = (e) => {
      const d = e.target.closest('[data-ldec]'), c = e.target.closest('[data-lcan]');
      if (d) hr.decideLeave(rows().find((x) => x.leave_request_id === d.dataset.id), d.dataset.ldec, done);
      else if (c) hr.cancelLeave(rows().find((x) => x.leave_request_id === c.dataset.lcan), done);
    };
  };
})();
