(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = (p) => MONTHS[Number(String(p).slice(5, 7)) - 1] + ' ' + String(p).slice(0, 4);
  const signed = (n) => (Number(n) < 0 ? '− ' + MS.money(-Number(n)) : MS.money(n));
  const STATUS = { DRAFT: 'Draft', SUBMITTED: 'Waiting for approval', APPROVED: 'Approved', MISSING: 'Not started' };
  const state = { page: 1, bank: MS.param('bank'), period: MS.param('period') };
  let banks = [], cur = null, can = {};

  MS.reload = () => loadList();
  async function loadList() {
    MS.setMsg('listMsg', 'Loading…');
    try {
      const r = await MS.recall('BANK_RECON_LIST', { page: state.page, page_size: 24 });
      banks = r.banks; can = r.can;
      MS.setMsg('listMsg', r.total + ' reconciliation' + (r.total === 1 ? '' : 's'));
      $('openBank').innerHTML = MS.options(banks.map((b) => ({ value: b.bank_account_id, label: b.name })), state.bank);
      $('duePanel').hidden = !r.due.length;
      $('dueBody').innerHTML = r.due.map((d, i) => `<div class="bar-row"><span><b>${esc(monthName(d.period))}</b></span><span>${esc(d.bank_name)}</span><span class="n">${MS.pill(d.status, STATUS[d.status])} <button type="button" data-due="${i}">${d.status === 'MISSING' ? 'Start' : 'Open'}</button></span></div>`).join('');
      $('dueBody').querySelectorAll('[data-due]').forEach((b) => b.addEventListener('click', () => { const d = r.due[Number(b.dataset.due)]; openMonth(d.bank_account_id, d.period); }));
      $('listBody').innerHTML = r.rows.length ? r.rows.map((x) => `<tr class="clk" data-bank="${esc(x.bank_account_id)}" data-period="${esc(x.period)}"><td><b>${esc(monthName(x.period))}</b></td><td>${esc(x.bank_name)}</td>
        <td class="num">${signed(x.statement_balance)}</td><td class="num">${signed(x.book_balance)}</td><td class="num${Number(x.difference) ? ' neg' : ''}">${Number(x.difference) ? signed(x.difference) : '–'}</td>
        <td>${MS.pill(x.status, STATUS[x.status])}</td><td>${esc(x.prepared_by_name)}</td><td>${esc(x.approved_by_name)}</td></tr>`).join('') : '<tr><td colspan="8" class="empty">No reconciliation yet. Choose a bank account and month above.</td></tr>';
      const pages = Math.max(1, Math.ceil(r.total / r.page_size));
      $('pager').innerHTML = pages > 1 ? `<button type="button" id="pPrev"${state.page <= 1 ? ' disabled' : ''}>Previous</button><span>Page ${state.page} of ${pages}</span><button type="button" id="pNext"${state.page >= pages ? ' disabled' : ''}>Next</button>` : '';
      if (pages > 1) { $('pPrev').onclick = () => { state.page--; loadList(); }; $('pNext').onclick = () => { state.page++; loadList(); }; }
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  function openMonth(bank, period) {
    state.bank = bank; state.period = period;
    loadDetail();
    $('detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function loadDetail() {
    if (!state.bank || !state.period) { $('detail').innerHTML = ''; return; }
    try { cur = await MS.call('BANK_RECON_GET', { bank_account_id: state.bank, period: state.period }); drawDetail(); }
    catch (err) { $('detail').innerHTML = `<div class="msg error">${esc(err.message)}</div>`; }
  }

  function drawDetail() {
    const c = cur, rec = c.reconciliation, k = c.can;
    const unmatchedLedger = c.ledger_lines.filter((x) => !x.matched_txn_id);
    $('detail').innerHTML = `<div class="panel" style="margin-top:16px">
      <h2>${esc(c.bank_name)} · ${esc(monthName(c.period))} ${rec ? MS.pill(rec.status, STATUS[rec.status]) : MS.pill('MISSING', STATUS.MISSING)}</h2>
      <div class="cards fin-cards">
        <div class="card"><div class="k">The books say</div><div class="v">${signed(c.book_balance)}</div><div class="s">at ${esc(MS.shortDate(c.book_as_of))}</div></div>
        <div class="card"><div class="k">The statement says</div><div class="v">${c.statement_balance === null ? '–' : signed(c.statement_balance)}</div><div class="s">closing balance</div></div>
        <div class="card ${c.difference === null ? '' : c.difference === 0 ? 'green' : 'red'}"><div class="k">Difference</div><div class="v">${c.difference === null ? '–' : c.difference === 0 ? 'None' : signed(c.difference)}</div><div class="s">statement − books</div></div>
        <div class="card ${c.unexplained === null ? '' : c.unexplained === 0 ? 'green' : 'red'}"><div class="k">Not explained yet</div><div class="v">${c.unexplained === null ? '–' : c.unexplained === 0 ? 'Nothing' : signed(c.unexplained)}</div><div class="s">after unmatched lines</div></div>
      </div>
      ${k.save ? `<form class="report-head" id="balForm"><label>Closing balance on the statement <input type="number" step="0.01" id="stBal" value="${c.statement_balance === null ? '' : esc(c.statement_balance)}"></label><button type="submit" class="primary" id="balSave">Save balance</button></form>` : ''}
      <h2>On the bank statement ${k.add_line ? '<button type="button" class="linkbtn" id="addLine">Add a line</button>' : ''}</h2>
      <div class="tablewrap"><table class="inv"><thead><tr><th>Date</th><th>Description</th><th>Reference</th><th class="num">Amount</th><th>Matched to</th></tr></thead><tbody>
      ${c.statement_lines.length ? c.statement_lines.map((t, i) => {
        const opts = unmatchedLedger.filter((x) => x.amount === Number(t.amount));
        const match = t.status === 'UNMATCHED' ? (k.match ? (opts.length ? `<select data-match="${i}"><option value="">— match to an entry —</option>${opts.map((x) => `<option value="${esc(x.journal_entry_id)}">${esc(x.entry_number + ' · ' + MS.shortDate(x.entry_date) + ' · ' + x.description.slice(0, 40))}</option>`).join('')}</select>` : '<span class="qhint">no entry in the books with this amount</span>') : '<span class="qhint">not matched</span>')
          : `${esc(t.matched_label)} ${MS.pill(t.status)} ${k.match && t.status === 'MATCHED' ? `<button type="button" class="linkbtn" data-unmatch="${i}">Unmatch</button>` : ''}`;
        return `<tr><td>${esc(MS.shortDate(t.transaction_date))}</td><td class="wrap">${esc(t.description)}</td><td>${esc(t.statement_ref || '')}</td><td class="num${Number(t.amount) < 0 ? ' neg' : ''}">${signed(t.amount)}</td><td>${match}</td></tr>`;
      }).join('') : '<tr><td colspan="5" class="empty">No statement line for this month yet.</td></tr>'}
      </tbody></table></div>
      <h2>In the books on this bank account</h2>
      <div class="tablewrap"><table class="inv"><thead><tr><th>Date</th><th>Entry</th><th>Description</th><th class="num">Amount</th><th>On the statement?</th></tr></thead><tbody>
      ${c.ledger_lines.length ? c.ledger_lines.map((x) => `<tr><td>${esc(MS.shortDate(x.entry_date))}</td><td>${MS.lnk('finance/accounts.html?journal=' + encodeURIComponent(x.journal_entry_id), x.entry_number)}</td><td class="wrap">${esc(x.description)}</td>
        <td class="num${x.amount < 0 ? ' neg' : ''}">${signed(x.amount)}</td><td>${x.matched_txn_id ? '<span class="pill ok">Matched</span>' : '<span class="pill pending">Not on the statement</span>'}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">Nothing was posted to this account in the month.</td></tr>'}
      </tbody></table></div>
      <div class="btns" style="justify-content:flex-start;margin-top:12px">
        ${k.submit ? '<button type="button" class="primary" id="submitBtn">Send for approval</button>' : ''}
        ${k.approve ? '<button type="button" class="primary" id="approveBtn">Approve</button>' : ''}
        ${k.return ? '<button type="button" id="returnBtn">Return to the preparer</button>' : ''}
        ${rec && rec.status === 'SUBMITTED' && !k.approve && !k.return ? '<span class="qhint">Waiting for someone else to approve it.</span>' : ''}
      </div></div>`;
    if ($('balForm')) $('balForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      if ($('stBal').value === '') { MS.setMsg('listMsg', 'Enter the closing balance shown on the statement.', 'error'); return; }
      MS.busy($('balSave'), true, 'Saving…');
      try { cur = await MS.call('BANK_RECON_SAVE', { bank_account_id: state.bank, period: state.period, statement_balance: $('stBal').value }); MS.setMsg('listMsg', 'Saved.', 'ok'); drawDetail(); loadList(); }
      catch (err) { MS.setMsg('listMsg', err.message, 'error'); MS.busy($('balSave'), false); }
    });
    if ($('addLine')) $('addLine').addEventListener('click', addLine);
    $('detail').querySelectorAll('select[data-match]').forEach((s) => s.addEventListener('change', () => {
      if (s.value) matchLine(cur.statement_lines[Number(s.dataset.match)], s.value);
    }));
    $('detail').querySelectorAll('[data-unmatch]').forEach((b) => b.addEventListener('click', () => matchLine(cur.statement_lines[Number(b.dataset.unmatch)], '')));
    if ($('submitBtn')) $('submitBtn').addEventListener('click', () => step('BANK_RECON_SUBMIT', {}, 'Sent for approval.'));
    if ($('approveBtn')) $('approveBtn').addEventListener('click', () => {
      if (cur.difference === 0) return step('BANK_RECON_APPROVE', {}, 'Reconciliation approved.');
      askReason('Approve with a difference', 'The statement and the books differ by ' + signed(cur.difference) + '. Write why it is acceptable (for example bank charges not yet booked).', 'Approve', (r) => step('BANK_RECON_APPROVE', { reason: r }, 'Reconciliation approved.'));
    });
    if ($('returnBtn')) $('returnBtn').addEventListener('click', () => askReason('Return to the preparer', 'Say what has to be corrected.', 'Return', (r) => step('BANK_RECON_RETURN', { reason: r }, 'Returned.')));
  }

  async function step(action, extra, msg) {
    try {
      cur = await MS.call(action, Object.assign({ bank_reconciliation_id: cur.reconciliation.bank_reconciliation_id }, extra));
      MS.setMsg('listMsg', msg, 'ok'); drawDetail(); loadList(); return true;
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); return false; }
  }

  async function matchLine(t, entryId) {
    try { await MS.call('BANK_TXN_MATCH', { bank_transaction_id: t.bank_transaction_id, journal_entry_id: entryId }); await loadDetail(); }
    catch (err) { MS.setMsg('listMsg', err.message, 'error'); loadDetail(); }
  }

  function addLine() {
    const f = $('lineForm');
    f.reset();
    $('lineError').textContent = '';
    f.elements.transaction_date.value = cur.period_end < MS.todayISO() ? cur.period_end : MS.todayISO();
    f.elements.transaction_date.min = cur.period_start; f.elements.transaction_date.max = MS.todayISO();
    const dlg = MS.openDialog('lineDialog');
    $('lineCancel').onclick = () => dlg.close();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = MS.formData(f);
      if (!d.transaction_date || d.amount === '' || !d.description) { $('lineError').textContent = 'Enter the date, the amount and the description.'; return; }
      MS.busy($('lineSave'), true, 'Saving…');
      try { await MS.call('BANK_TXN_ADD', Object.assign({ bank_account_id: state.bank }, d)); dlg.close(); loadDetail(); }
      catch (err) { $('lineError').textContent = err.message; } finally { MS.busy($('lineSave'), false); }
    };
  }

  function askReason(title, info, confirm, run) {
    const f = $('reasonForm');
    f.reset();
    $('reasonError').textContent = '';
    $('reasonTitle').textContent = title; $('reasonInfo').textContent = info; $('reasonSave').textContent = confirm;
    const dlg = MS.openDialog('reasonDialog');
    $('reasonCancel').onclick = () => dlg.close();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const r = f.elements.reason.value.trim();
      if (!r) { $('reasonError').textContent = 'Please give the reason.'; return; }
      MS.busy($('reasonSave'), true, 'Saving…');
      try { if (await run(r)) dlg.close(); else $('reasonError').textContent = 'It could not be saved. See the message at the top.'; }
      finally { MS.busy($('reasonSave'), false); }
    };
  }

  MS.boot({ page: 'bank-recon', any: ['FINANCE_VIEW'] }).then(() => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    $('openMonth').value = state.period || (prev.getFullYear() + '-' + MS.pad(prev.getMonth() + 1));
    $('openMonth').max = MS.todayISO().slice(0, 7);
    $('openBtn').addEventListener('click', () => { if ($('openBank').value && $('openMonth').value) openMonth($('openBank').value, $('openMonth').value); });
    $('listBody').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-bank]'); if (tr) openMonth(tr.dataset.bank, tr.dataset.period); });
    loadList().then(() => { if (state.bank && state.period) loadDetail(); });
  });
})();
