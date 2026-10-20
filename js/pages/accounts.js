/* Accounts & journal: the chart of accounts with balances, the journal (detail, manual journal, reversal),
   and the tills and bank accounts money is received into and paid from. ?journal=<id> opens one entry. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const fin = MS.fin;
  const TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'COST_OF_SALES', 'EXPENSE'];
  const TYPE_LABEL = { ASSET: 'Asset', LIABILITY: 'Liability', EQUITY: 'Equity', REVENUE: 'Revenue', COST_OF_SALES: 'Cost of sales', EXPENSE: 'Expense' };
  const SOURCE = { invoices: ['Invoice', (id) => 'finance/invoice.html?id=' + encodeURIComponent(id)], customer_payments: ['Payment', () => 'finance/payments.html'],
    expenses: ['Expense', () => 'finance/expenses.html'] };
  let accounts = [];
  const jstate = { page: 1, q: '', from: '', to: '', account: '', manual: false };
  let canEditChart = false;

  /* ---------- chart ---------- */
  async function loadChart() {
    MS.setMsg('pageMsg', 'Loading…');
    try {
      const r = await MS.call('ACCOUNT_LIST', { include_inactive: true, as_of: $('accAsOf').value });
      accounts = r.rows;
      MS.setMsg('pageMsg', '');
      drawChart();
      $('jAccount').innerHTML = MS.options(accounts.filter((a) => a.is_postable === true).map((a) => ({ value: a.account_id, label: a.account_code + ' ' + a.account_name })), jstate.account, 'Any account');
    } catch (err) { MS.setMsg('pageMsg', err.message, 'error'); }
  }

  function drawChart() {
    const q = $('accSearch').value.trim().toLowerCase();
    const type = $('accType').value;
    const showOff = $('accInactive').checked;
    const rows = accounts.filter((a) => (showOff || a.status === 'ACTIVE') && (!type || a.account_type === type) &&
      (!q || (a.account_code + ' ' + a.account_name).toLowerCase().indexOf(q) >= 0));
    $('accBody').innerHTML = rows.length ? rows.map((a) => {
      const head = a.is_postable !== true;
      return `<tr class="${head ? 'hd' : 'sub-acc clk'}${a.status !== 'ACTIVE' ? ' inactive' : ''}" ${head ? '' : `data-acc="${esc(a.account_id)}"`}>
        <td>${esc(a.account_code)}</td><td class="wrap">${esc(a.account_name)}${head ? ' <span class="sub">heading</span>' : ''}</td>
        <td>${esc(TYPE_LABEL[a.account_type] || a.account_type)}</td>
        <td class="num${Number(a.balance) < 0 ? ' neg' : ''}">${a.balance === undefined ? '' : fin.amt(a.balance)}</td>
        <td>${a.status === 'ACTIVE' ? '' : MS.pill('INACTIVE', 'Switched off')}</td>
        <td>${canEditChart ? `<button type="button" class="linkbtn" data-edit="${esc(a.account_id)}">Edit</button>` : ''}</td></tr>`;
    }).join('') : '<tr><td colspan="6" class="empty">No account matches.</td></tr>';
  }

  function accountForm(a) {
    const f = $('accForm');
    f.reset();
    $('accError').textContent = '';
    $('accTitle').textContent = a ? 'Edit ' + a.account_code + ' ' + a.account_name : 'New account';
    $('accTypeSel').innerHTML = MS.options(TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] })), a ? a.account_type : 'EXPENSE');
    const parents = () => MS.options(accounts.filter((x) => x.is_postable !== true && x.account_type === $('accTypeSel').value && (!a || x.account_id !== a.account_id))
      .map((x) => ({ value: x.account_id, label: x.account_code + ' ' + x.account_name })), a ? a.parent_account_id : '', '— top level —');
    $('accParent').innerHTML = parents();
    $('accTypeSel').onchange = () => { $('accParent').innerHTML = parents(); };
    if (a) {
      f.account_code.value = a.account_code; f.account_name.value = a.account_name; f.is_postable.checked = a.is_postable === true; f.status.value = a.status;
      f.account_code.disabled = !!a.has_postings; $('accTypeSel').disabled = !!a.has_postings;
    } else { f.account_code.disabled = false; $('accTypeSel').disabled = false; }
    const dlg = MS.openDialog('accDialog');
    $('accCancel').onclick = () => dlg.close();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = MS.formData(f);
      const payload = { account_name: d.account_name, parent_account_id: d.parent_account_id, is_postable: d.is_postable, status: d.status };
      if (!a || !a.has_postings) { payload.account_code = d.account_code; payload.account_type = d.account_type; }
      if (a) payload.account_id = a.account_id;
      if (!a && !/^\d{4}$/.test(d.account_code)) { $('accError').textContent = 'The code must be 4 digits.'; return; }
      MS.busy($('accSave'), true, 'Saving…');
      try { await MS.call('ACCOUNT_SAVE', payload); dlg.close(); MS.setMsg('pageMsg', 'Account saved.', 'ok'); loadChart(); }
      catch (err) { $('accError').textContent = err.message; } finally { MS.busy($('accSave'), false); }
    };
  }

  /* ---------- journal ---------- */
  async function loadJournal() {
    MS.setMsg('jMsg', 'Loading…');
    try {
      const r = await MS.call('JOURNAL_LIST', { page: jstate.page, page_size: 50, search: jstate.q, from: jstate.from, to: jstate.to, account_id: jstate.account,
        manual_only: jstate.manual, sort: 'entry_number', dir: 'desc' });
      MS.setMsg('jMsg', r.total + ' entr' + (r.total === 1 ? 'y' : 'ies'));
      $('jBody').innerHTML = r.rows.length ? r.rows.map((e) => `<tr class="clk${e.status === 'REVERSED' ? ' void' : ''}" data-je="${esc(e.journal_entry_id)}">
          <td><b><a class="lnk" href="#" data-je="${esc(e.journal_entry_id)}">${esc(e.entry_number)}</a></b></td><td>${esc(MS.shortDate(e.entry_date))}</td>
          <td class="wrap">${esc(e.description)}</td><td>${esc(e.source_table ? (SOURCE[e.source_table] || [MS.label(e.source_table)])[0] : 'Manual')}</td>
          <td class="num">${MS.money(e.total)}</td><td>${MS.pill(e.status, MS.statusLabel(e.status, 'journal_entries'))}</td></tr>`).join('')
        : '<tr><td colspan="6" class="empty">No journal entries.</td></tr>';
      const pages = Math.max(1, Math.ceil(r.total / r.page_size));
      $('jPager').innerHTML = pages > 1 ? `<button type="button" id="jPrev"${jstate.page <= 1 ? ' disabled' : ''}>Previous</button><span>Page ${jstate.page} of ${pages}</span><button type="button" id="jNext"${jstate.page >= pages ? ' disabled' : ''}>Next</button>` : '';
      if (pages > 1) { $('jPrev').onclick = () => { jstate.page--; loadJournal(); }; $('jNext').onclick = () => { jstate.page++; loadJournal(); }; }
    } catch (err) { MS.setMsg('jMsg', err.message, 'error'); }
  }

  async function showEntry(jid) {
    const dlg = $('jeDialog');
    $('jeError').textContent = '';
    $('jeBody').innerHTML = '<p class="fin-note">Loading…</p>';
    $('jeBtns').innerHTML = '';
    if (!dlg.open) dlg.showModal();
    let e;
    try { e = await MS.call('JOURNAL_GET', { journal_entry_id: jid }); } catch (err) { $('jeBody').innerHTML = ''; $('jeError').textContent = err.message; $('jeBtns').innerHTML = '<button type="button" id="jeClose">Close</button>'; $('jeClose').onclick = () => dlg.close(); return; }
    const src = SOURCE[e.source_table];
    const dr = e.lines.reduce((s, l) => s + Number(l.debit || 0), 0), cr = e.lines.reduce((s, l) => s + Number(l.credit || 0), 0);
    $('jeBody').innerHTML = `<h3>Journal ${esc(e.entry_number)} ${MS.pill(e.status, MS.statusLabel(e.status, 'journal_entries'))}</h3>
      ${MS.kv([['Date', MS.shortDate(e.entry_date)], ['Description', e.description], ['From', src ? MS.lnk(src[1](e.source_record_id), src[0] + ' ' + (e.source_label || '')) : (e.source_table ? esc(e.source_table) : 'Manual journal'), true],
        ['Posted by', (e.posted_by_name || '') + (e.posted_at ? ' · ' + MS.when(e.posted_at) : '')],
        ['Reverses', e.reverses ? `<a class="lnk" href="#" data-je="${esc(e.reverses.journal_entry_id)}">${esc(e.reverses.entry_number)}</a>` : '', true],
        ['Reversed by', e.reversed_by ? `<a class="lnk" href="#" data-je="${esc(e.reversed_by.journal_entry_id)}">${esc(e.reversed_by.entry_number)}</a>` : '', true]])}
      <div class="tablewrap"><table class="inv"><thead><tr><th>#</th><th>Account</th><th>Job</th><th>Department</th><th class="num">Debit</th><th class="num">Credit</th></tr></thead><tbody>
        ${e.lines.map((l) => `<tr><td>${esc(l.line_no)}</td><td>${esc(l.account_code + ' ' + l.account_name)}</td><td>${l.job_id ? MS.lnk('jobs/job.html?id=' + encodeURIComponent(l.job_id), l.job_number) : ''}</td><td>${esc(l.department_name)}</td>
          <td class="num">${Number(l.debit) ? MS.money(l.debit) : ''}</td><td class="num">${Number(l.credit) ? MS.money(l.credit) : ''}</td></tr>`).join('')}
      </tbody><tfoot><tr><td colspan="4">Total</td><td class="num">${MS.money(dr)}</td><td class="num">${MS.money(cr)}</td></tr></tfoot></table></div>`;
    const manual = !e.source_table;
    $('jeBtns').innerHTML = ['<button type="button" id="jeClose">Close</button>',
      e.status === 'POSTED' && !e.reverses && manual && MS.can('FINANCE_APPROVE') && '<button type="button" class="danger" id="jeRev">Reverse</button>'].filter(Boolean).join('');
    if (e.status === 'POSTED' && !manual) $('jeBtns').insertAdjacentHTML('afterbegin', '<span class="fin-note" style="margin-right:auto">Posted by a document: correct it from that document.</span>');
    $('jeClose').onclick = () => dlg.close();
    $('jeBody').onclick = (ev) => { const a = ev.target.closest('a[data-je]'); if (a) { ev.preventDefault(); showEntry(a.dataset.je); } };
    if ($('jeRev')) $('jeRev').onclick = () => {
      const f = $('noteForm');
      f.reset();
      $('noteError').textContent = '';
      $('noteInfo').textContent = 'Posts the mirror of ' + e.entry_number + ' today, so the two cancel out. The original stays in the journal marked Reversed.';
      const nd = MS.openDialog('noteDialog');
      $('noteCancel').onclick = () => nd.close();
      f.onsubmit = async (ev) => {
        ev.preventDefault();
        const t = $('noteText').value.trim();
        if (!t) { $('noteError').textContent = 'Please give the reason.'; return; }
        MS.busy($('noteSave'), true, 'Reversing…');
        try { const r = await MS.call('JOURNAL_REVERSE', { journal_entry_id: e.journal_entry_id, reason: t }); nd.close(); showEntry(r.journal_entry_id); loadJournal(); loadChart(); }
        catch (err) { $('noteError').textContent = err.message; } finally { MS.busy($('noteSave'), false); }
      };
    };
  }

  function manualJournal() {
    const f = $('mjForm');
    f.reset();
    $('mjError').textContent = '';
    $('mjDate').value = MS.todayISO();
    const postable = accounts.filter((a) => a.is_postable === true && a.status === 'ACTIVE');
    const depts = ((MS.refCache && MS.refCache.departments) || []).map((d) => ({ value: d.department_id, label: d.department_name }));
    const body = $('mjLines');
    body.innerHTML = '';
    const sums = () => {
      let dr = 0, cr = 0;
      body.querySelectorAll('tr').forEach((tr) => { dr += Number(tr.querySelector('[data-f=debit]').value) || 0; cr += Number(tr.querySelector('[data-f=credit]').value) || 0; });
      dr = fin.r2(dr); cr = fin.r2(cr);
      $('mjDr').textContent = MS.money(dr); $('mjCr').textContent = MS.money(cr);
      $('mjDiff').innerHTML = dr === cr ? (dr ? '<span class="ok">Balanced</span>' : '') : `<span class="neg">Difference ${esc(MS.money(Math.abs(dr - cr)))}</span>`;
    };
    const add = () => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="a"><select data-f="account_id" aria-label="Account">${fin.accountOptions(postable, '', '— choose —')}</select></td>
        <td class="c"><select data-f="department_id" aria-label="Department">${MS.options(depts, '', '—')}</select></td>
        <td class="p"><input data-f="debit" type="number" min="0" step="0.01" aria-label="Debit"></td>
        <td class="p"><input data-f="credit" type="number" min="0" step="0.01" aria-label="Credit"></td>
        <td><button type="button" class="x" title="Remove line" aria-label="Remove line">×</button></td>`;
      tr.querySelector('.x').onclick = () => { tr.remove(); sums(); };
      tr.oninput = sums;
      body.appendChild(tr);
      sums();
    };
    add(); add();
    $('mjAdd').onclick = add;
    const dlg = MS.openDialog('mjDialog');
    $('mjCancel').onclick = () => dlg.close();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = MS.formData(f);
      const lines = Array.from(body.querySelectorAll('tr')).map((tr) => {
        const g = (n) => tr.querySelector('[data-f=' + n + ']').value;
        return { account_id: g('account_id'), department_id: g('department_id'), debit: Number(g('debit')) || 0, credit: Number(g('credit')) || 0 };
      }).filter((l) => l.account_id || l.debit || l.credit);
      if (!d.description || !d.reason) { $('mjError').textContent = 'Fill in the description and the reason.'; return; }
      MS.busy($('mjSave'), true, 'Posting…');
      try { const r = await MS.call('JOURNAL_POST', { entry_date: d.entry_date, description: d.description, reason: d.reason, lines }); dlg.close(); MS.setMsg('pageMsg', 'Journal ' + r.entry_number + ' posted.', 'ok'); loadJournal(); loadChart(); }
      catch (err) { $('mjError').textContent = err.message; } finally { MS.busy($('mjSave'), false); }
    };
  }

  /* ---------- cash and bank ---------- */
  async function loadMoney() {
    try {
      const m = await MS.call('CASH_BANK_LIST', { include_inactive: true });
      const canSave = MS.can('FINANCE_APPROVE');
      $('cashBody').innerHTML = m.cash.length ? m.cash.map((c) => `<tr><td><b>${esc(c.account_name)}</b></td><td>${esc(c.gl_account_code + ' ' + c.gl_account_name)}</td><td>${esc(c.custodian_name)}</td>
          <td class="num">${MS.money(c.float_amount)}</td><td class="num">${c.gl_balance === undefined ? '' : MS.money(c.gl_balance)}</td><td>${MS.pill(c.status)}</td>
          <td>${canSave ? `<button type="button" class="linkbtn" data-cash="${esc(c.cash_account_id)}">Edit</button>` : ''}</td></tr>`).join('')
        : '<tr><td colspan="7" class="empty">No till yet. Add the front desk till so cash payments can be recorded.</td></tr>';
      $('bankBody').innerHTML = m.bank.length ? m.bank.map((b) => `<tr><td><b>${esc(b.bank_name)}</b></td><td>${esc(b.account_name)}</td><td>${esc(b.account_number_masked)}</td><td>${esc(b.gl_account_code + ' ' + b.gl_account_name)}</td>
          <td>${esc(b.currency)}</td><td class="num">${b.gl_balance === undefined ? '' : MS.money(b.gl_balance)}</td><td>${MS.pill(b.status)}</td>
          <td>${canSave ? `<button type="button" class="linkbtn" data-bank="${esc(b.bank_account_id)}">Edit</button>` : ''}</td></tr>`).join('')
        : '<tr><td colspan="8" class="empty">No bank account yet.</td></tr>';
      $('moneyTab').dataset.m = JSON.stringify(m);
    } catch (err) { MS.setMsg('pageMsg', err.message, 'error'); }
  }
  const assetOptions = (sel) => fin.accountOptions(accounts.filter((a) => a.account_type === 'ASSET' && a.is_postable === true && a.status === 'ACTIVE'), sel, '— choose —');

  function cashForm(c) {
    const f = $('cashForm');
    f.reset();
    $('cashError').textContent = '';
    $('cashTitle').textContent = c ? 'Edit ' + c.account_name : 'Add till or petty cash';
    $('cashGl').innerHTML = assetOptions(c ? c.gl_account_id : (accounts.find((a) => a.account_code === '1010') || {}).account_id);
    $('cashCust').innerHTML = MS.employeeOptions(c ? c.custodian_id : '', '— choose —');
    if (c) { f.account_name.value = c.account_name; f.float_amount.value = c.float_amount; f.status.value = c.status; }
    const dlg = MS.openDialog('cashDialog');
    $('cashCancel').onclick = () => dlg.close();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = MS.formData(f);
      if (c) d.cash_account_id = c.cash_account_id;
      if (d.float_amount === '') d.float_amount = 0;
      MS.busy($('cashSave'), true, 'Saving…');
      try { await MS.call('CASH_ACCOUNT_SAVE', d); dlg.close(); loadMoney(); } catch (err) { $('cashError').textContent = err.message; } finally { MS.busy($('cashSave'), false); }
    };
  }

  function bankForm(b) {
    const f = $('bankForm');
    f.reset();
    $('bankError').textContent = '';
    $('bankTitle').textContent = b ? 'Edit ' + b.bank_name + ' ' + b.account_number_masked : 'Add bank or mobile money account';
    $('bankGl').innerHTML = assetOptions(b ? b.gl_account_id : (accounts.find((a) => a.account_code === '1020') || {}).account_id);
    $('bankCur').innerHTML = MS.options(MS.enumOf('bank_accounts.currency').length ? MS.enumOf('bank_accounts.currency') : ['GMD'], b ? b.currency : 'GMD');
    $('bankNoLabel').classList.toggle('req', !b);
    if (b) { f.bank_name.value = b.bank_name; f.account_name.value = b.account_name; f.status.value = b.status; f.account_number.placeholder = b.account_number_masked + ' (type to change)'; }
    const dlg = MS.openDialog('bankDialog');
    $('bankCancel').onclick = () => dlg.close();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = MS.formData(f);
      if (b) d.bank_account_id = b.bank_account_id;
      MS.busy($('bankSave'), true, 'Saving…');
      try { await MS.call('BANK_ACCOUNT_SAVE', d); dlg.close(); loadMoney(); } catch (err) { $('bankError').textContent = err.message; } finally { MS.busy($('bankSave'), false); }
    };
  }

  function showTab(t) {
    $('tabs').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    $('chartTab').hidden = t !== 'chart'; $('journalTab').hidden = t !== 'journal'; $('moneyTab').hidden = t !== 'money';
    $('headActs').innerHTML = t === 'chart' && canEditChart ? '<button type="button" class="primary" id="newAcc">New account</button>'
      : t === 'journal' && MS.can('FINANCE_APPROVE') ? '<button type="button" class="primary" id="newJe">Manual journal</button>' : '';
    if ($('newAcc')) $('newAcc').onclick = () => accountForm(null);
    if ($('newJe')) $('newJe').onclick = manualJournal;
    if (t === 'journal') loadJournal();
    if (t === 'money') loadMoney();
  }

  MS.boot({ page: 'accounts', any: ['FINANCE_VIEW'], ref: true }).then(async () => {
    canEditChart = MS.canAny(['FINANCE_APPROVE', 'PERIOD_CLOSE']);
    $('accType').innerHTML = MS.options(TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] })), '', 'All types');
    $('addCash').hidden = $('addBank').hidden = !MS.can('FINANCE_APPROVE');
    $('tabs').addEventListener('click', (e) => { const b = e.target.closest('button[data-tab]'); if (b) showTab(b.dataset.tab); });
    ['accSearch', 'accType', 'accInactive'].forEach((k) => $(k).addEventListener('input', drawChart));
    $('accAsOf').addEventListener('change', loadChart);
    $('accBody').addEventListener('click', (e) => {
      const ed = e.target.closest('[data-edit]');
      if (ed) { accountForm(accounts.find((a) => a.account_id === ed.dataset.edit)); return; }
      const row = e.target.closest('[data-acc]');
      if (row) { jstate.account = row.dataset.acc; $('jAccount').value = jstate.account; jstate.page = 1; showTab('journal'); }
    });
    $('jSearch').addEventListener('input', MS.debounce(() => { jstate.q = $('jSearch').value.trim(); jstate.page = 1; loadJournal(); }, 300));
    $('jFrom').addEventListener('change', () => { jstate.from = $('jFrom').value; jstate.page = 1; loadJournal(); });
    $('jTo').addEventListener('change', () => { jstate.to = $('jTo').value; jstate.page = 1; loadJournal(); });
    $('jAccount').addEventListener('change', () => { jstate.account = $('jAccount').value; jstate.page = 1; loadJournal(); });
    $('jManual').addEventListener('change', () => { jstate.manual = $('jManual').checked; jstate.page = 1; loadJournal(); });
    $('jBody').addEventListener('click', (e) => { const el = e.target.closest('[data-je]'); if (el) { e.preventDefault(); showEntry(el.dataset.je); } });
    $('addCash').onclick = () => cashForm(null);
    $('addBank').onclick = () => bankForm(null);
    $('moneyTab').addEventListener('click', (e) => {
      const m = JSON.parse($('moneyTab').dataset.m || '{"cash":[],"bank":[]}');
      const c = e.target.closest('[data-cash]'), b = e.target.closest('[data-bank]');
      if (c) cashForm(m.cash.find((x) => x.cash_account_id === c.dataset.cash));
      if (b) bankForm(m.bank.find((x) => x.bank_account_id === b.dataset.bank));
    });
    await loadChart();
    const tab = MS.param('tab');
    showTab(MS.param('journal') ? 'journal' : (['journal', 'money'].indexOf(tab) >= 0 ? tab : 'chart'));
    if (MS.param('journal')) showEntry(MS.param('journal'));
  });
})();
