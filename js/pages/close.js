/* Month-end close: the months with their status, and for the chosen month the checklist (worked out from the books,
   some items ticked by the Finance Officer with a note), Start close, Close the month (in order; override with a reason)
   and Reopen (Finance Officer or CEO, latest closed month only, with a reason). ?period=YYYY-MM opens a month. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  let list = null;
  let cur = null;
  let chosen = MS.param('period') || '';

  const BOOKS = { OPEN: ['pending', 'Open'], CLOSING: ['waiting', 'Closing'], CLOSED: ['ok', 'Closed'] };
  const REPORT = { NOT_STARTED: ['off', 'Not started'], DRAFT: ['pending', 'Draft'], SUBMITTED: ['waiting', 'Waiting for review'], RETURNED: ['failed', 'Returned'], APPROVED: ['ok', 'Approved'] };
  const pill = (map, s) => { const t = map[s] || ['off', MS.label(s)]; return `<span class="pill ${t[0]}">${esc(t[1])}</span>`; };

  async function loadList() {
    MS.setMsg('listMsg', 'Loading…');
    try {
      list = await MS.call('PERIOD_LIST', {});
      list.can_report = MS.canAny(['FIN_REPORT_SUBMIT', 'FIN_REPORT_REVIEW']);
      MS.setMsg('listMsg', list.next_to_close ? 'Next month to close: ' + monthName(list.next_to_close) + '.' : 'Every finished month is closed.');
      if (!chosen) chosen = list.next_to_close || (list.rows[0] && list.rows[0].period) || '';
      drawList();
      if (chosen) loadMonth(chosen);
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = (p) => MONTHS[Number(String(p).slice(5, 7)) - 1] + ' ' + String(p).slice(0, 4);

  function drawList() {
    $('monthBody').innerHTML = list.rows.length ? list.rows.map((r) => `
      <tr class="clk${r.period === chosen ? ' on' : ''}" data-period="${esc(r.period)}">
        <td><b>${esc(r.month_name)}</b>${r.closed_at ? `<span class="sub">Closed ${esc(MS.shortDate(r.closed_at))}${r.closed_by_name ? ' by ' + esc(r.closed_by_name) : ''}</span>` : !r.ended ? '<span class="sub">Month in progress</span>' : ''}</td>
        <td>${pill(BOOKS, r.status)}${r.ended && list.can_report ? `<span class="sub">Report: ${esc((REPORT[r.report_status || 'NOT_STARTED'] || [])[1] || '')}</span>` : ''}</td>
      </tr>`).join('') : '<tr><td colspan="2" class="empty">No months yet.</td></tr>';
  }

  async function loadMonth(p) {
    chosen = p;
    drawList();
    history.replaceState(null, '', 'finance/close.html?period=' + encodeURIComponent(p));
    $('detail').innerHTML = '<div class="dpanel"><p class="empty">Loading…</p></div>';
    try { render(await MS.call('PERIOD_GET', { period: p })); }
    catch (err) { $('detail').innerHTML = `<div class="dpanel"><p class="msg error">${esc(err.message)}</p></div>`; }
  }

  const ICON = (i) => (i.done ? '<span class="chk-ic ok" title="Done">✓</span>' : i.passed === false ? '<span class="chk-ic bad" title="Not done">✗</span>' : '<span class="chk-ic todo" title="To do">○</span>');

  function itemHtml(i, d) {
    const editable = d.can_close && d.status !== 'CLOSED';
    const rows = (i.list || []).map((x) => `<tr><td class="wrap">${x.href ? MS.lnk(x.href, x.label) : esc(x.label)}${x.note ? `<span class="sub">${esc(x.note)}</span>` : ''}</td>
      <td>${x.date ? esc(MS.shortDate(x.date)) : ''}</td><td class="num">${x.amount !== undefined && x.amount !== '' ? MS.money(x.amount) : ''}</td><td>${x.status ? MS.pill(x.status, MS.label(x.status)) : ''}</td></tr>`).join('');
    const how = i.mode === 'AUTO' ? 'Checked from the books' : i.mode === 'TICK' ? 'Ticked by the Finance Officer' : 'From the books, or ticked with a note';
    return `<li class="chk${i.done ? ' done' : ''}">
      ${ICON(i)}
      <div class="chk-body">
        <div class="chk-top"><b>${esc(i.label)}</b><span class="chk-how">${esc(how)}</span></div>
        <p class="chk-ev">${esc(i.evidence)}</p>
        ${rows ? `<div class="tablewrap chk-list"><table class="inv"><tbody>${rows}</tbody></table></div>` : ''}
        ${i.tick ? `<p class="chk-tick">Ticked by ${esc(i.tick.by_name)} · ${esc(MS.when(i.tick.at))}${i.tick.note ? ' — “' + esc(i.tick.note) + '”' : ''}</p>` : ''}
      </div>
      <div class="chk-act no-print">${editable && i.can_tick ? (i.tick ? `<button type="button" data-untick="${esc(i.key)}">Untick</button>` : !i.done ? `<button type="button" data-tick="${esc(i.key)}">Tick</button>` : '') : ''}</div>
    </li>`;
  }

  function render(d) {
    cur = d;
    const notices = [];
    if (d.status === 'CLOSED') notices.push(`The books for ${esc(d.month_name)} are closed${d.closed_by_name ? ' by ' + esc(d.closed_by_name) : ''} on ${esc(MS.when(d.closed_at))}. Nothing can be posted with a date in this month.`);
    if (d.auto_closed) notices.push('There were no entries in this month, so it was closed together with a later month.');
    if (d.status !== 'CLOSED' && !d.ended) notices.push(`${esc(d.month_name)} has not ended yet. You can start the close and work through the checklist, but the month can only be closed from the 1st of next month.`);
    if (d.status !== 'CLOSED' && d.earlier_not_closed.length) notices.push(`Close ${d.earlier_not_closed.map((p) => `<a href="finance/close.html?period=${encodeURIComponent(p)}" data-go="${esc(p)}">${esc(monthName(p))}</a>`).join(', ')} first: months close in order.`);
    if (d.status === 'OPEN' && d.reopen_reason) notices.push('Reopened: ' + esc(d.reopen_reason));
    if (d.closed_with && d.closed_with.override_reason && d.status === 'CLOSED') notices.push('Closed with items not done (' + esc(d.closed_with.not_done.map((k) => (d.items.find((i) => i.key === k) || {}).label || k).join('; ')) + '). Reason: ' + esc(d.closed_with.override_reason));
    const done = d.items.filter((i) => i.done).length;
    const acts = [
      d.can_close && d.status === 'OPEN' && '<button type="button" class="primary" data-act="start">Start close</button>',
      d.can_close && d.status === 'CLOSING' && `<button type="button" class="primary" data-act="close">Close ${esc(d.month_name)}</button>`,
      d.can_reopen && d.status === 'CLOSED' && !d.later_closed.length && '<button type="button" class="danger" data-act="reopen">Reopen</button>',
      d.ended && `<a class="btn" href="finance/monthly-report.html?period=${encodeURIComponent(d.period)}">Monthly report</a>`,
      MS.can('FINANCE_VIEW') && `<a class="btn" href="finance/reports.html">Profit &amp; loss</a>`
    ].filter(Boolean).join('');
    $('detail').innerHTML = `
      <div class="dpanel close-head">
        <div class="close-title"><h2>${esc(d.month_name)} ${pill(BOOKS, d.status)}</h2><div class="close-acts">${acts}</div></div>
        <div class="close-meter"><span class="bar"><i style="width:${Math.round(100 * done / d.items.length)}%"></i></span><span>${done} of ${d.items.length} done</span></div>
        <div class="sub">${esc(MS.shortDate(d.start_date))} – ${esc(MS.shortDate(d.end_date))} · ${esc(d.journal_count)} journal entr${d.journal_count === 1 ? 'y' : 'ies'}</div>
      </div>
      ${notices.map((n) => `<div class="notice-bar">${n}</div>`).join('')}
      <div class="dpanel"><h3>Checklist</h3><ul class="chk-list-ul">${d.items.map((i) => itemHtml(i, d)).join('')}</ul></div>
      ${d.history.length ? `<div class="dpanel"><h3>History</h3><div class="tablewrap"><table class="inv"><tbody>${d.history.slice().reverse().map((h) => `<tr><td>${esc(MS.when(h.at))}</td><td>${esc(h.by_name)}</td><td>${esc(histLabel(h.action))}</td><td class="wrap">${esc(h.reason)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}`;
  }

  function histLabel(a) {
    const key = String(a).split(' ');
    const it = key[1] && cur && cur.items.find((i) => i.key === key[1]);
    if (key[0] === 'TICK') return 'Ticked: ' + (it ? it.label : key[1]);
    if (key[0] === 'UNTICK') return 'Unticked: ' + (it ? it.label : key[1]);
    return { START_CLOSE: 'Close started', CLOSE: 'Closed', REOPEN: 'Reopened' }[a] || MS.label(a);
  }

  function tick(key) {
    const it = cur.items.find((i) => i.key === key);
    const needNote = it.mode === 'AUTO_OR_TICK';
    $('tickForm').reset();
    $('tickTitle').textContent = it.label;
    $('tickInfo').textContent = needNote ? 'The system could not confirm this from its own records. Say what you checked and where the proof is kept.' : 'Your name and the time are recorded with the tick.';
    $('tickLabel').classList.toggle('req', needNote);
    $('tickLabel').firstChild.textContent = needNote ? 'What you checked ' : 'Note (optional) ';
    $('tickError').textContent = '';
    const dlg = MS.openDialog('tickDialog');
    $('tickCancel').onclick = () => dlg.close();
    $('tickForm').onsubmit = async (e) => {
      e.preventDefault();
      const note = $('tickNote').value.trim();
      if (needNote && !note) { $('tickError').textContent = 'Please write what you checked.'; return; }
      MS.busy($('tickSave'), true, 'Saving…');
      try { render(await MS.call('PERIOD_CHECK_ITEM', { period: cur.period, item: key, done: true, note })); dlg.close(); refreshList(); }
      catch (err) { $('tickError').textContent = err.message; } finally { MS.busy($('tickSave'), false); }
    };
  }

  async function untick(key) {
    const it = cur.items.find((i) => i.key === key);
    if (!await MS.confirm({ title: 'Untick', message: 'Untick "' + it.label + '"?', confirmText: 'Untick' })) return;
    try { render(await MS.call('PERIOD_CHECK_ITEM', { period: cur.period, item: key, done: false })); } catch (err) { MS.alert(err.message); }
  }

  function closeMonth() {
    const open = cur.items.filter((i) => !i.done);
    $('closeForm').reset();
    $('closeError').textContent = '';
    $('closeTitle').textContent = 'Close ' + cur.month_name;
    $('closeInfo').textContent = open.length
      ? 'These items are not done. Finish them first if you can. To close anyway, give the reason: it is kept with the month and in the audit log.'
      : 'Every item is done. After closing, nothing can be posted with a date in ' + cur.month_name + '.';
    $('closeOpen').innerHTML = open.map((i) => `<li>${esc(i.label)}</li>`).join('');
    $('closeOpen').hidden = !open.length;
    $('closeReasonLabel').hidden = !open.length;
    const dlg = MS.openDialog('closeDialog');
    $('closeCancel').onclick = () => dlg.close();
    $('closeForm').onsubmit = async (e) => {
      e.preventDefault();
      const reason = $('closeReason').value.trim();
      if (open.length && !reason) { $('closeError').textContent = 'Give the reason to close with items not done.'; return; }
      MS.busy($('closeSave'), true, 'Closing…');
      try { render(await MS.call('PERIOD_CLOSE', { period: cur.period, override_reason: reason })); dlg.close(); refreshList(); }
      catch (err) { $('closeError').textContent = err.message; } finally { MS.busy($('closeSave'), false); }
    };
  }

  function reopen() {
    $('reopenForm').reset();
    $('reopenError').textContent = '';
    $('reopenTitle').textContent = 'Reopen ' + cur.month_name;
    const dlg = MS.openDialog('reopenDialog');
    $('reopenCancel').onclick = () => dlg.close();
    $('reopenForm').onsubmit = async (e) => {
      e.preventDefault();
      const reason = $('reopenReason').value.trim();
      if (!reason) { $('reopenError').textContent = 'Give the reason.'; return; }
      MS.busy($('reopenSave'), true, 'Reopening…');
      try { render(await MS.call('PERIOD_REOPEN', { period: cur.period, reason })); dlg.close(); refreshList(); }
      catch (err) { $('reopenError').textContent = err.message; } finally { MS.busy($('reopenSave'), false); }
    };
  }

  async function refreshList() {
    try { list = await MS.call('PERIOD_LIST', {}); list.can_report = MS.canAny(['FIN_REPORT_SUBMIT', 'FIN_REPORT_REVIEW']); drawList(); MS.setMsg('listMsg', list.next_to_close ? 'Next month to close: ' + monthName(list.next_to_close) + '.' : 'Every finished month is closed.'); } catch (e) { /* keep the old list */ }
  }

  async function onClick(e) {
    const go = e.target.closest('[data-go]');
    if (go) { e.preventDefault(); return loadMonth(go.dataset.go); }
    const t = e.target.closest('button[data-tick]');
    if (t) return tick(t.dataset.tick);
    const u = e.target.closest('button[data-untick]');
    if (u) return untick(u.dataset.untick);
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    if (b.dataset.act === 'start') {
      if (!await MS.confirm({ title: 'Start the close', message: 'Start closing ' + cur.month_name + '? Postings are still allowed while you work through the checklist.', confirmText: 'Start close' })) return;
      MS.busy(b, true, 'Starting…');
      try { render(await MS.call('PERIOD_START_CLOSE', { period: cur.period })); refreshList(); } catch (err) { MS.busy(b, false); MS.alert(err.message); }
    } else if (b.dataset.act === 'close') closeMonth();
    else if (b.dataset.act === 'reopen') reopen();
  }

  MS.boot({ page: 'close', any: ['PERIOD_CLOSE', 'FINANCE_VIEW'], ref: true }).then(() => {
    $('monthBody').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-period]'); if (tr) loadMonth(tr.dataset.period); });
    $('detail').addEventListener('click', onClick);
    if (!MS.canAny(['FIN_REPORT_SUBMIT', 'FIN_REPORT_REVIEW'])) document.querySelector('.page-head .grow').innerHTML = '';
    loadList();
  });
})();
