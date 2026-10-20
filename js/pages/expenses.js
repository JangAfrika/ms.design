/* Expenses: request (lines by expense account, receipt attached), submit, approve / reject (not your own, within your
   limit, receipt or a reason), pay from a till or bank (posts to the books and the job costing), reverse. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const fin = MS.fin;
  const state = { page: 1, q: '', status: '', tab: 'all' };
  let expAccounts = [];
  let jobs = null;

  MS.reload = () => load();
  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    const p = { page: state.page, page_size: 50, search: state.q, filters: { status: state.status }, sort: 'expense_number', dir: 'desc' };
    if (state.tab === 'approve') p.to_approve = true;
    if (state.tab === 'pay') p.filters.status = 'APPROVED';
    if (state.tab === 'mine') p.mine = true;
    try {
      const r = await MS.recall('EXPENSE_LIST', p);
      MS.setMsg('listMsg', r.total + ' expense' + (r.total === 1 ? '' : 's'));
      $('listBody').innerHTML = r.rows.length ? r.rows.map((x) => `
        <tr class="clk${['REJECTED', 'REVERSED'].indexOf(x.status) >= 0 ? ' void' : ''}" data-id="${esc(x.expense_id)}">
          <td><b><a class="lnk" href="#" data-id="${esc(x.expense_id)}">${esc(x.expense_number)}</a></b></td>
          <td>${esc(MS.shortDate(x.expense_date))}</td>
          <td class="wrap">${esc(x.description)}</td>
          <td>${esc(x.department_name)}</td>
          <td>${esc(x.job_number || '')}</td>
          <td>${esc(x.requested_by_name)}</td>
          <td class="num">${MS.money(x.total_amount)}</td>
          <td>${x.has_document ? '<span class="pill ok">Attached</span>' : '<span class="pill pending">Missing</span>'}</td>
          <td>${MS.pill(x.status, MS.statusLabel(x.status, 'expenses'))}</td>
        </tr>`).join('') : `<tr><td colspan="9" class="empty">${state.tab === 'approve' ? 'Nothing waiting for your approval.' : 'No expenses here.'}</td></tr>`;
      pager(r);
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  function pager(r) {
    const pages = Math.max(1, Math.ceil(r.total / r.page_size));
    $('pager').innerHTML = pages > 1 ? `<button type="button" id="pPrev"${state.page <= 1 ? ' disabled' : ''}>Previous</button><span>Page ${state.page} of ${pages}</span><button type="button" id="pNext"${state.page >= pages ? ' disabled' : ''}>Next</button>` : '';
    if (pages > 1) { $('pPrev').onclick = () => { state.page--; load(); }; $('pNext').onclick = () => { state.page++; load(); }; }
  }

  /* ---------- lines ---------- */
  function lineEditor(box, items, onChange) {
    const cats = MS.enumOf('job_costs.cost_category');
    box.innerHTML = `<div class="tablewrap"><table class="inv lines"><thead><tr><th>Expense account</th><th>Description</th><th>Job cost type</th><th class="num">Amount</th><th></th></tr></thead><tbody></tbody></table></div>
      <div class="lines-foot"><button type="button" class="add-line">Add line</button></div>`;
    const body = box.querySelector('tbody');
    const total = () => Array.from(body.querySelectorAll('tr')).reduce((s, tr) => s + (Number(tr.querySelector('[data-f=amount]').value) || 0), 0);
    function addRow(it) {
      it = it || {};
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="a"><select data-f="expense_account_id" aria-label="Expense account">${fin.accountOptions(expAccounts, it.expense_account_id || '', '— choose —')}</select></td>
        <td class="d"><input data-f="description" type="text" maxlength="300" value="${esc(it.description || '')}" placeholder="e.g. Generator diesel 20 litres" aria-label="Description"></td>
        <td class="c"><select data-f="cost_category" aria-label="Job cost type">${MS.options(cats, it.cost_category || '', '—')}</select></td>
        <td class="p"><input data-f="amount" type="number" min="0" step="0.01" value="${esc(it.amount == null ? '' : it.amount)}" aria-label="Amount"></td>
        <td><button type="button" class="x" title="Remove line" aria-label="Remove line">×</button></td>`;
      tr.querySelector('.x').addEventListener('click', () => { tr.remove(); if (!body.children.length) addRow(); onChange(total()); });
      tr.addEventListener('input', () => onChange(total()));
      body.appendChild(tr);
      onChange(total());
    }
    (items && items.length ? items : [{}]).forEach(addRow);
    box.querySelector('.add-line').addEventListener('click', () => addRow());
    return {
      items: () => Array.from(body.querySelectorAll('tr')).map((tr) => {
        const g = (n) => tr.querySelector('[data-f=' + n + ']').value.trim();
        return { expense_account_id: g('expense_account_id'), description: g('description'), cost_category: g('cost_category'), amount: Number(g('amount') || 0) };
      }).filter((x) => x.description || x.amount || x.expense_account_id)
    };
  }

  async function openForm(x) {
    const f = $('expForm');
    f.reset();
    $('expError').textContent = '';
    $('expTitle').textContent = x ? 'Edit ' + x.expense_number : 'New expense';
    try { if (!expAccounts.length) expAccounts = await fin.accounts(['EXPENSE', 'COST_OF_SALES']); } catch (err) { $('expError').textContent = err.message; }
    $('eDate').value = x ? x.expense_date : MS.todayISO();
    $('eDept').innerHTML = MS.options(((MS.refCache && MS.refCache.departments) || []).map((d) => ({ value: d.department_id, label: d.department_name })),
      x ? x.department_id : (MS.employeeDept || ''), '— choose —');
    if (!x) {
      const me = ((MS.refCache && MS.refCache.employees) || []).find((e) => e.employee_id === MS.user.employee_id);
      if (me && me.department_id) $('eDept').value = me.department_id;
    }
    $('eMethod').innerHTML = MS.options(MS.enumOf('expenses.payment_method'), x ? x.payment_method : 'CASH');
    let money = { cash: [], bank: [] };
    try { money = await fin.money(); } catch (e) { /* optional */ }
    const setMoney = () => { $('eMoney').innerHTML = fin.moneyOptions(money, x && x.cash_account_id ? 'C:' + x.cash_account_id : x && x.bank_account_id ? 'B:' + x.bank_account_id : '', $('eMethod').value); };
    setMoney();
    $('eMethod').onchange = setMoney;
    if (!jobs && MS.can('JOB_VIEW')) {
      try { jobs = (await MS.call('JOB_LIST', { page_size: 100, open_only: true })).rows; } catch (e) { jobs = []; }
    }
    $('eJob').innerHTML = MS.options((jobs || []).map((j) => ({ value: j.job_id, label: j.job_number + ' – ' + j.job_name })), x ? x.job_id : MS.param('job'), '— not for a job —');
    const editor = lineEditor($('eLines'), x ? x.items : [], (t) => { $('eTotal').innerHTML = `<div class="big"><span>Total</span><span>${MS.money(t)}</span></div>`; });
    const dlg = MS.openDialog('expDialog');
    $('expCancel').onclick = () => dlg.close();
    const save = async (submit, btn) => {
      const items = editor.items();
      for (let i = 0; i < items.length; i++) {
        if (!items[i].expense_account_id || !items[i].description || !(items[i].amount > 0)) { $('expError').textContent = 'Line ' + (i + 1) + ': choose the account, describe it and enter the amount.'; return; }
      }
      if (!items.length) { $('expError').textContent = 'Add at least one line.'; return; }
      const d = MS.formData(f);
      const payload = Object.assign({ expense_date: d.expense_date, department_id: d.department_id, job_id: d.job_id, payment_method: d.payment_method, items },
        fin.moneyPayload($('eMoney').value));
      MS.busy(btn, true, 'Saving…');
      try {
        let r = x ? await MS.call('EXPENSE_UPDATE', Object.assign({ expense_id: x.expense_id }, payload)) : await MS.call('EXPENSE_CREATE', payload);
        const file = $('eFile').files[0];
        if (file) r = await MS.call('EXPENSE_ATTACH', Object.assign({ expense_id: r.expense_id }, await MS.fileForUpload(file)));
        if (submit) r = await MS.call('EXPENSE_SUBMIT', { expense_id: r.expense_id });
        dlg.close();
        MS.setMsg('listMsg', r.expense_number + (submit ? ' submitted for approval.' : ' saved as a draft.'), 'ok');
        load();
      } catch (err) { $('expError').textContent = err.message; MS.busy(btn, false); }
    };
    $('expDraft').onclick = () => save(false, $('expDraft'));
    f.onsubmit = (e) => { e.preventDefault(); save(true, $('expSubmit')); };
  }

  /* ---------- one expense ---------- */
  async function view(eid) {
    const dlg = $('viewDialog');
    $('viewError').textContent = '';
    $('viewBody').innerHTML = '<p class="fin-note">Loading…</p>';
    $('viewBtns').innerHTML = '';
    if (!dlg.open) dlg.showModal();
    let x;
    try { x = await MS.call('EXPENSE_GET', { expense_id: eid }); } catch (err) { $('viewBody').innerHTML = ''; $('viewError').textContent = err.message; $('viewBtns').innerHTML = '<button type="button" id="vClose">Close</button>'; $('vClose').onclick = () => dlg.close(); return; }
    const mine = x.requested_by === MS.user.user_id;
    $('viewBody').innerHTML = `<h3>Expense ${esc(x.expense_number)} ${MS.pill(x.status, MS.statusLabel(x.status, 'expenses'))}</h3>
      <div class="dgrid" style="margin-top:8px">
        <div class="dpanel">${MS.kv([['Date', MS.shortDate(x.expense_date)], ['Department', x.department_name], ['Job', x.job_number ? MS.lnk('jobs/job.html?id=' + encodeURIComponent(x.job_id), x.job_number) : '', true],
          ['Requested by', x.requested_by_name], ['Approved by', x.approved_by_name], ['To be paid by', MS.label(x.payment_method)], ['Paid from', x.money_account_name]])}</div>
        <div class="dpanel"><h3>Receipt / supplier invoice</h3>${x.document ? `<p>${esc(x.document.file_name)} <button type="button" id="vOpen">Open</button></p>` : '<p class="fin-note">Nothing attached yet. An approver needs it, or a reason why there is none.</p>'}
          ${['REJECTED', 'REVERSED'].indexOf(x.status) < 0 && (mine || MS.canAny(['FINANCE_CREATE', 'EXPENSE_APPROVE'])) && MS.can('EXPENSE_CREATE') ? '<div class="upload-form"><input type="file" id="vFile" accept="image/*,application/pdf"> <button type="button" id="vUpload">Attach</button></div>' : ''}</div>
        <div class="dpanel wide"><div class="tablewrap"><table class="inv"><thead><tr><th>Account</th><th>Description</th><th>Job cost type</th><th class="num">Amount</th></tr></thead><tbody>
          ${(x.items || []).map((i) => `<tr><td>${esc(i.account_code + ' ' + i.account_name)}</td><td class="wrap">${esc(i.description)}</td><td>${esc(MS.label(i.cost_category || ''))}</td><td class="num">${MS.money(i.amount)}</td></tr>`).join('')}
          </tbody><tfoot><tr><td colspan="3">Total</td><td class="num">${MS.money(x.total_amount)}</td></tr></tfoot></table></div></div>
        ${(x.history || []).length ? `<div class="dpanel wide"><h3>History</h3><ul class="mini-list">${x.history.map((h) => `<li><span>${esc(MS.label(h.action))}${h.reason ? ' – ' + esc(h.reason) : ''}</span><span class="n">${esc(h.by)} · ${esc(MS.when(h.at))}</span></li>`).join('')}</ul></div>` : ''}
        ${(x.journal_entries || []).length && MS.can('FINANCE_VIEW') ? `<div class="dpanel wide"><p class="fin-note">In the books: ${x.journal_entries.map((e) => MS.lnk('finance/accounts.html?journal=' + encodeURIComponent(e.journal_entry_id), e.entry_number)).join(', ')}</p></div>` : ''}
      </div>`;
    const st = x.status;
    $('viewBtns').innerHTML = [
      '<button type="button" id="vClose">Close</button>',
      st === 'DRAFT' && (mine || MS.can('FINANCE_EDIT')) && '<button type="button" id="vEdit">Edit</button>',
      st === 'DRAFT' && (mine || MS.can('FINANCE_EDIT')) && '<button type="button" class="primary" id="vSubmit">Submit for approval</button>',
      ['SUBMITTED', 'APPROVED'].indexOf(st) >= 0 && !mine && MS.can('EXPENSE_APPROVE') && '<button type="button" class="danger" id="vReject">Reject</button>',
      st === 'SUBMITTED' && !mine && MS.can('EXPENSE_APPROVE') && '<button type="button" class="primary" id="vApprove">Approve</button>',
      st === 'APPROVED' && MS.can('FINANCE_CREATE') && '<button type="button" class="primary" id="vPay">Pay</button>',
      st === 'PAID' && MS.can('FINANCE_APPROVE') && '<button type="button" class="danger" id="vReverse">Reverse</button>'
    ].filter(Boolean).join('');
    const bind = (bid, fn) => { if ($(bid)) $(bid).onclick = fn; };
    const run = async (btn, action, payload, msg) => {
      MS.busy(btn, true);
      try { await MS.call(action, Object.assign({ expense_id: x.expense_id }, payload || {})); MS.setMsg('listMsg', x.expense_number + ' ' + msg, 'ok'); view(eid); load(); }
      catch (err) { MS.busy(btn, false); $('viewError').textContent = err.message; }
    };
    bind('vClose', () => dlg.close());
    bind('vEdit', () => { dlg.close(); openForm(x); });
    bind('vSubmit', () => run($('vSubmit'), 'EXPENSE_SUBMIT', {}, 'submitted.'));
    bind('vOpen', async () => {
      try { const d = await MS.call('EXPENSE_DOCUMENT_GET', { expense_id: x.expense_id }); const w = window.open(); if (w) w.location = 'data:' + d.mime_type + ';base64,' + d.base64; }
      catch (err) { $('viewError').textContent = err.message; }
    });
    bind('vUpload', async () => {
      const file = $('vFile').files[0];
      if (!file) { $('viewError').textContent = 'Choose the file first.'; return; }
      MS.busy($('vUpload'), true, 'Uploading…');
      try { await MS.call('EXPENSE_ATTACH', Object.assign({ expense_id: x.expense_id }, await MS.fileForUpload(file))); view(eid); load(); }
      catch (err) { MS.busy($('vUpload'), false); $('viewError').textContent = err.message; }
    });
    bind('vApprove', () => ask({ title: 'Approve ' + x.expense_number, info: MS.money(x.total_amount) + ' requested by ' + x.requested_by_name + '.',
      label: x.document ? 'Comment (optional)' : 'Why is there no receipt?', required: !x.document, button: 'Approve',
      run: (t) => MS.call('EXPENSE_APPROVE', x.document ? { expense_id: x.expense_id, comment: t } : { expense_id: x.expense_id, no_document_reason: t }) }).then((ok) => { if (ok) { view(eid); load(); } }));
    bind('vReject', () => ask({ title: 'Reject ' + x.expense_number, label: 'Reason', required: true, danger: true, button: 'Reject',
      run: (t) => MS.call('EXPENSE_REJECT', { expense_id: x.expense_id, reason: t }) }).then((ok) => { if (ok) { view(eid); load(); } }));
    bind('vReverse', () => ask({ title: 'Reverse ' + x.expense_number, info: 'Posts a mirror entry and takes the cost off the job.', label: 'Reason', required: true, danger: true, button: 'Reverse',
      run: (t) => MS.call('EXPENSE_REVERSE', { expense_id: x.expense_id, reason: t }) }).then((ok) => { if (ok) { view(eid); load(); } }));
    bind('vPay', async () => {
      let money = { cash: [], bank: [] };
      try { money = await fin.money(); } catch (e) { /* shown by the server */ }
      ask({ title: 'Pay ' + x.expense_number, info: 'Pay ' + MS.money(x.total_amount) + '. The books show the money leaving this till or bank.',
        extra: `<div class="two"><label>Paid from <select id="payFrom">${fin.moneyOptions(money, x.cash_account_id ? 'C:' + x.cash_account_id : x.bank_account_id ? 'B:' + x.bank_account_id : '', x.payment_method)}</select></label>
          <label>Date <input type="date" id="payOn" value="${esc(MS.todayISO())}"></label></div>`,
        label: 'Note (optional)', button: 'Pay',
        run: () => MS.call('EXPENSE_PAY', Object.assign({ expense_id: x.expense_id, paid_date: $('payOn').value }, fin.moneyPayload($('payFrom').value))) })
        .then((ok) => { if (ok) { view(eid); load(); } });
    });
  }

  function ask(o) {
    return new Promise((resolve) => {
      const f = $('noteForm');
      f.reset();
      $('noteTitle').textContent = o.title;
      $('noteInfo').textContent = o.info || '';
      $('noteExtra').innerHTML = o.extra || '';
      $('noteLabel').firstChild.textContent = o.label + ' ';
      $('noteLabel').classList.toggle('req', !!o.required);
      $('noteError').textContent = '';
      $('noteSave').textContent = o.button;
      $('noteSave').dataset.label = o.button;
      $('noteSave').className = o.danger ? 'danger-solid' : 'primary';
      const dlg = MS.openDialog('noteDialog');
      let done = false;
      f.onsubmit = async (e) => {
        e.preventDefault();
        const t = $('noteText').value.trim();
        if (o.required && !t) { $('noteError').textContent = 'Please fill this in.'; return; }
        MS.busy($('noteSave'), true, 'Saving…');
        try { await o.run(t); done = true; dlg.close(); } catch (err) { $('noteError').textContent = err.message; } finally { MS.busy($('noteSave'), false); }
      };
      $('noteCancel').onclick = () => dlg.close();
      dlg.addEventListener('close', () => resolve(done), { once: true });
    });
  }

  MS.boot({ page: 'expenses', any: ['FINANCE_VIEW', 'EXPENSE_CREATE', 'EXPENSE_APPROVE'], ref: true }).then(() => {
    $('statusFilter').innerHTML = MS.options(['DRAFT', 'SUBMITTED', 'APPROVED', 'PAID', 'REJECTED', 'REVERSED'].map((s) => ({ value: s, label: MS.statusLabel(s, 'expenses') })), '', 'Any status');
    $('newBtn').hidden = !MS.can('EXPENSE_CREATE');
    $('tabApprove').hidden = !MS.can('EXPENSE_APPROVE');
    $('tabPay').hidden = !MS.can('FINANCE_CREATE');
    $('newBtn').addEventListener('click', () => openForm(null));
    $('tabs').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-tab]');
      if (!b) return;
      $('tabs').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      state.tab = b.dataset.tab; state.page = 1; load();
    });
    $('search').addEventListener('input', MS.debounce(() => { state.q = $('search').value.trim(); state.page = 1; load(); }, 300));
    $('statusFilter').addEventListener('change', () => { state.status = $('statusFilter').value; state.page = 1; load(); });
    $('reloadBtn').addEventListener('click', load);
    $('listBody').addEventListener('click', (e) => {
      const el = e.target.closest('[data-id]');
      if (!el) return;
      e.preventDefault();
      view(el.dataset.id);
    });
    if (MS.can('EXPENSE_APPROVE') && !MS.can('EXPENSE_CREATE')) $('tabApprove').click(); else load();
    if (MS.param('new') && MS.can('EXPENSE_CREATE')) openForm(null);
    if (MS.param('id')) view(MS.param('id'));
  });
})();
