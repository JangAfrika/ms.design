(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const state = { page: 1, till: '', status: '', from: '', to: '' };
  let rows = [], can = {}, tills = [], expected = null;
  const STATUS = { DRAFT: 'Waiting for check', VERIFIED: 'Checked', DISCREPANCY: 'Difference' };
  const diffTxt = (n) => (Number(n) === 0 ? '–' : (Number(n) > 0 ? '+ ' : '− ') + MS.money(Math.abs(n)));

  MS.reload = () => load();
  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    try {
      const r = await MS.recall('CASH_COUNT_LIST', { page: state.page, page_size: 50, status: state.status, cash_account_id: state.till, date_from: state.from, date_to: state.to });
      rows = r.rows; can = r.can; tills = r.tills;
      MS.setMsg('listMsg', r.total + ' count' + (r.total === 1 ? '' : 's'));
      $('countBtn').hidden = !can.count || !tills.length;
      if (!$('tillFilter').dataset.set && tills.length) { $('tillFilter').innerHTML = MS.options(tills.map((t) => ({ value: t.cash_account_id, label: t.account_name })), state.till, 'All tills'); $('tillFilter').dataset.set = '1'; }
      $('ccCards').innerHTML = tills.length ? tills.map((t) => `<div class="card${t.today_status === 'MISSING' ? ' red' : t.today_status === 'VERIFIED' ? ' green' : ''}"><div class="k">${esc(t.account_name)} today</div>
        <div class="v">${t.today_status === 'MISSING' ? 'Not counted' : esc(STATUS[t.today_status] || MS.label(t.today_status))}</div><div class="s">${esc(MS.shortDate(MS.todayISO()))}</div></div>`).join('')
        + (r.waiting_check ? `<div class="card red"><div class="k">Waiting for a check</div><div class="v">${r.waiting_check}</div><div class="s">counts not checked yet</div></div>` : '')
        : '<div class="card"><div class="k">No till set up</div><div class="v">–</div><div class="s">add one under Accounts</div></div>';
      $('listBody').innerHTML = r.rows.length ? r.rows.map((c, i) => {
        const mine = c.counted_by === can.me;
        const acts = [
          can.verify && c.status !== 'VERIFIED' && !mine && `<button type="button" class="primary" data-act="check" data-i="${i}">Check</button>`,
          can.count && c.status !== 'VERIFIED' && `<button type="button" data-act="recount" data-i="${i}">Count again</button>`
        ].filter(Boolean).join(' ');
        return `<tr><td>${esc(MS.shortDate(c.recon_date))}</td><td>${esc(c.account_name)}</td><td class="num">${MS.money(c.expected_balance)}</td><td class="num">${MS.money(c.counted_balance)}</td>
          <td class="num${Number(c.difference) ? ' neg' : ''}">${diffTxt(c.difference)}${c.explanation ? `<span class="sub">${esc(c.explanation)}</span>` : ''}</td>
          <td>${MS.pill(c.status, STATUS[c.status])}</td><td>${esc(c.counted_by_name)}</td><td>${esc(c.verified_by_name)}</td><td class="num">${acts}</td></tr>`;
      }).join('') : '<tr><td colspan="9" class="empty">No cash counts yet.</td></tr>';
      pager(r);
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  function pager(r) {
    const pages = Math.max(1, Math.ceil(r.total / r.page_size));
    $('pager').innerHTML = pages > 1 ? `<button type="button" id="pPrev"${state.page <= 1 ? ' disabled' : ''}>Previous</button><span>Page ${state.page} of ${pages}</span><button type="button" id="pNext"${state.page >= pages ? ' disabled' : ''}>Next</button>` : '';
    if (pages > 1) { $('pPrev').onclick = () => { state.page--; load(); }; $('pNext').onclick = () => { state.page++; load(); }; }
  }

  async function fetchExpected() {
    const till = $('ctTill').value, date = $('ctDate').value;
    expected = null;
    if (!till || !date) { $('ctExpected').textContent = ''; return; }
    try {
      expected = await MS.call('CASH_COUNT_EXPECTED_GET', { cash_account_id: till, recon_date: date });
      $('ctExpected').textContent = 'The books say ' + MS.money(expected.expected_balance) + ' should be in ' + expected.account_name + ' at the end of ' + MS.shortDate(date) + '.' +
        (expected.shared_gl ? ' Another till uses the same ledger account, so this figure covers both.' : '') + (expected.existing && expected.existing.status !== 'VERIFIED' ? ' A count already exists for this day; saving replaces it.' : '');
    } catch (err) { $('ctExpected').textContent = err.message; }
    diff();
  }

  function diff() {
    const v = $('ctCounted').value;
    const d = expected && v !== '' ? Math.round((Number(v) - expected.expected_balance) * 100) / 100 : 0;
    $('ctDiff').hidden = !(expected && v !== '' && d !== 0);
    $('ctWhyLabel').hidden = $('ctDiff').hidden;
    if (!$('ctDiff').hidden) $('ctDiff').textContent = 'Difference: ' + (d > 0 ? 'the till has ' : 'the till is short by ') + MS.money(Math.abs(d)) + '. Explain it below.';
  }

  async function countForm(pre) {
    const f = $('countForm');
    f.reset();
    $('countError').textContent = '';
    $('ctTill').innerHTML = MS.options(tills.map((t) => ({ value: t.cash_account_id, label: t.account_name })), pre ? pre.cash_account_id : '');
    $('ctDate').value = pre ? pre.recon_date : MS.todayISO();
    $('ctDate').max = MS.todayISO();
    $('ctDiff').hidden = true; $('ctWhyLabel').hidden = true;
    const dlg = MS.openDialog('countDialog');
    $('countCancel').onclick = () => dlg.close();
    $('ctTill').onchange = fetchExpected; $('ctDate').onchange = fetchExpected; $('ctCounted').oninput = diff;
    fetchExpected();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = MS.formData(f);
      if (d.counted_balance === '') { $('countError').textContent = 'Enter the cash you counted.'; return; }
      MS.busy($('countSave'), true, 'Saving…');
      try { await MS.call('CASH_COUNT_SAVE', d); dlg.close(); load(); } catch (err) { $('countError').textContent = err.message; } finally { MS.busy($('countSave'), false); }
    };
  }

  function check(c) {
    const f = $('checkForm');
    f.reset();
    $('checkError').textContent = '';
    const hasDiff = Number(c.difference) !== 0;
    $('chkInfo').textContent = c.account_name + ', ' + MS.shortDate(c.recon_date) + ': books ' + MS.money(c.expected_balance) + ', counted ' + MS.money(c.counted_balance) + (hasDiff ? ', difference ' + diffTxt(c.difference) + '. Counted by ' + c.counted_by_name + ': "' + (c.explanation || '') + '"' : '. No difference.');
    $('chkWhyLabel').hidden = !hasDiff;
    if (hasDiff) f.elements.explanation.value = c.explanation || '';
    const dlg = MS.openDialog('checkDialog');
    $('checkCancel').onclick = () => dlg.close();
    f.onsubmit = async (e) => {
      e.preventDefault();
      MS.busy($('checkSave'), true, 'Saving…');
      try { await MS.call('CASH_COUNT_VERIFY', { cash_reconciliation_id: c.cash_reconciliation_id, explanation: f.elements.explanation.value.trim() }); dlg.close(); load(); }
      catch (err) { $('checkError').textContent = err.message; } finally { MS.busy($('checkSave'), false); }
    };
  }

  MS.boot({ page: 'cash-count', any: ['FINANCE_VIEW'] }).then(() => {
    $('statusFilter').innerHTML = MS.options([{ value: 'DRAFT', label: STATUS.DRAFT }, { value: 'DISCREPANCY', label: STATUS.DISCREPANCY }, { value: 'VERIFIED', label: STATUS.VERIFIED }], '', 'Any status');
    $('tillFilter').addEventListener('change', () => { state.till = $('tillFilter').value; state.page = 1; load(); });
    $('statusFilter').addEventListener('change', () => { state.status = $('statusFilter').value; state.page = 1; load(); });
    $('fromDate').addEventListener('change', () => { state.from = $('fromDate').value; state.page = 1; load(); });
    $('toDate').addEventListener('change', () => { state.to = $('toDate').value; state.page = 1; load(); });
    $('reloadBtn').addEventListener('click', load);
    $('countBtn').addEventListener('click', () => countForm(null));
    $('listBody').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]');
      if (!b) return;
      const c = rows[Number(b.dataset.i)];
      if (b.dataset.act === 'check') check(c); else countForm(c);
    });
    load();
  });
})();
