/* Budget: a grid of accounts × the 12 months of a financial year (per department if wanted), versions,
   send for approval (the Finance Director; the CEO when there is none) → approve or return with a comment, yearly amounts spread evenly over the months,
   the Monthly view (budget, actual and % used for every month, with charts) and Budget vs actual for a month or the year to date. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const fin = MS.fin;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mLabel = (k) => MONTHS[Number(k.slice(5, 7)) - 1] + ' ' + k.slice(2, 4);
  const r2 = fin.r2;
  const SECTIONS = [['REVENUE', 'Revenue'], ['COST_OF_SALES', 'Cost of sales'], ['EXPENSE', 'Expenses']];
  const st = { list: null, year: 0, budget: null, dept: '', grid: {}, dirty: false, tab: 'entry' };
  const fmt = (n) => (Number(n) ? Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '');
  const amt = (n) => (Number(n) ? fin.amt(n) : '–');

  function monthsOf(year) {
    const start = (st.list && st.list.fiscal_year_start_month) || 1;
    const out = [];
    let y = Number(year), m = start;
    for (let i = 0; i < 12; i++) { out.push(y + '-' + String(m).padStart(2, '0')); m++; if (m > 12) { m = 1; y++; } }
    return out;
  }
  const yearLabel = (y) => { const ms = monthsOf(y); return ms[0].slice(0, 4) === ms[11].slice(0, 4) ? String(y) : y + '/' + String(Number(y) + 1).slice(2); };
  const deptName = (id) => { const d = ((MS.refCache && MS.refCache.departments) || []).find((x) => x.department_id === id); return d ? d.department_name : ''; };

  /* ---------- loading ---------- */
  async function loadList() {
    st.list = await MS.call('BUDGET_LIST', {});
    const cur = st.list.current_fiscal_year;
    const years = new Set([cur - 1, cur, cur + 1]);
    st.list.rows.forEach((b) => years.add(Number(b.fiscal_year)));
    const sorted = Array.from(years).sort((a, b) => b - a);
    if (!st.year) st.year = Number(MS.param('year')) || cur;
    $('yearSel').innerHTML = sorted.map((y) => `<option value="${y}"${y === st.year ? ' selected' : ''}>${esc(yearLabel(y))}${y === cur ? ' (this year)' : ''}</option>`).join('');
  }

  async function loadBudget(budgetId) {
    MS.setMsg('bMsg', 'Loading…');
    const versions = st.list.rows.filter((b) => Number(b.fiscal_year) === st.year);
    const pick = budgetId || (versions.find((b) => b.status === 'DRAFT' || b.status === 'SUBMITTED') || versions.find((b) => b.status === 'APPROVED') || versions[0] || {}).budget_id;
    st.budget = null;
    if (pick) {
      try { st.budget = await MS.call('BUDGET_GET', { budget_id: pick, department_id: st.dept }); } catch (err) { MS.setMsg('bMsg', err.message, 'error'); return; }
    }
    st.grid = {};
    if (st.budget) st.budget.lines.forEach((l) => {
      const i = st.budget.months.indexOf(l.period);
      if (i < 0) return;
      (st.grid[l.account_id] = st.grid[l.account_id] || Array(12).fill(0))[i] = Number(l.amount) || 0;
    });
    st.dirty = false;
    MS.setMsg('bMsg', '');
    drawEntry();
    if (st.tab === 'bva') runBva();
    if (st.tab === 'monthly') runMonthly();
  }

  /* ---------- the entry tab ---------- */
  function drawBar() {
    const b = st.budget;
    const canManage = st.list.can_manage;
    $('newBtn').hidden = !(canManage && !b);
    $('versionBtn').hidden = !(b && b.can_new_version);
    if (!b) {
      $('bBar').innerHTML = `<div class="plan-empty">There is no budget for ${esc(yearLabel(st.year))} yet.${canManage ? ' Press <b>Start the budget</b> to begin.' : ' The Finance Manager prepares it.'}</div>`;
      $('bNotes').hidden = true;
      return;
    }
    const v = b.versions.length > 1 ? `<select id="verSel" aria-label="Version">${b.versions.map((x) => `<option value="${esc(x.budget_id)}"${x.budget_id === b.budget_id ? ' selected' : ''}>Version ${esc(x.version)} · ${esc(MS.label(x.status))}</option>`).join('')}</select>` : `<b>Version ${esc(b.version)}</b>`;
    const t = b.totals;
    $('bBar').innerHTML = `<div class="plan-bar-row">
        <span class="plan-name">${esc(b.budget_name)}</span> ${v} ${MS.pill(b.status === 'SUBMITTED' ? 'AWAITING' : b.status, statusText(b.status))}
        <span class="plan-who">Prepared by ${esc(b.prepared_by_name || '—')}${b.approved_by_name ? ' · approved by ' + esc(b.approved_by_name) + ' on ' + esc(MS.shortDate(b.approved_at)) : ''}</span>
      </div>
      <div class="plan-bar-row plan-totals">
        <span>Revenue <b>${MS.money(t.revenue)}</b></span><span>Cost of sales <b>${MS.money(t.cost_of_sales)}</b></span>
        <span>Expenses <b>${MS.money(t.expenses)}</b></span><span>Net profit <b class="${t.net_profit < 0 ? 'neg' : ''}">${fin.amt(t.net_profit)}</b></span>
        <span class="qhint">Whole year, all departments</span>
      </div>`;
    if ($('verSel')) $('verSel').onchange = async (e) => { if (await leaveOk()) loadBudget(e.target.value); else e.target.value = b.budget_id; };
    const notes = String(b.notes || '').trim();
    $('bNotes').hidden = !notes;
    $('bNotes').textContent = notes;
  }
  const statusText = (s) => ({ DRAFT: 'Draft', SUBMITTED: 'Waiting for approval', APPROVED: 'Approved', SUPERSEDED: 'Replaced by a newer version' }[s] || MS.label(s));

  function drawEntry() {
    drawBar();
    const b = st.budget;
    $('entryHead').hidden = !b;
    if (!b) { $('gridWrap').innerHTML = ''; $('gridNote').textContent = ''; return; }
    const edit = b.can_edit;
    document.querySelectorAll('.edit-only').forEach((el) => { el.hidden = !edit; });
    $('submitBtn').hidden = !b.can_submit;
    $('approveBtn').hidden = !b.can_approve;
    $('returnBtn').hidden = !b.can_approve;
    const ms = b.months;
    const head = `<thead><tr><th>Account</th>${ms.map((k) => `<th>${esc(mLabel(k))}</th>`).join('')}<th>Year</th>${edit ? '<th class="tools"></th>' : ''}</tr></thead>`;
    let body = '';
    SECTIONS.forEach(([type, title]) => {
      const accs = b.accounts.filter((a) => a.account_type === type);
      body += `<tr class="grp"><td>${esc(title)}</td><td colspan="${ms.length + (edit ? 2 : 1)}"></td></tr>`;
      body += accs.map((a) => {
        const vals = st.grid[a.account_id] || Array(12).fill(0);
        const cells = ms.map((k, i) => edit
          ? `<td class="cell"><input type="number" min="0" step="0.01" inputmode="decimal" data-a="${esc(a.account_id)}" data-i="${i}" value="${vals[i] ? esc(vals[i]) : ''}" aria-label="${esc(a.account_code + ' ' + mLabel(k))}"></td>`
          : `<td class="num">${esc(fmt(vals[i]))}</td>`).join('');
        return `<tr class="acc" data-a="${esc(a.account_id)}"><td title="${esc(a.account_name)}">${esc(a.account_code + ' ' + a.account_name)}</td>${cells}<td class="num yr" data-yr="${esc(a.account_id)}">${esc(fmt(r2(vals.reduce((s, v) => s + v, 0))))}</td>${edit ? `<td class="tools"><button type="button" class="mini" data-fill="${esc(a.account_id)}" title="Fill all 12 months with one amount" aria-label="Fill all months">→</button><button type="button" class="mini" data-split="${esc(a.account_id)}" title="Split a yearly amount evenly over the 12 months" aria-label="Split a yearly amount">÷</button></td>` : ''}</tr>`;
      }).join('');
      body += `<tr class="tot" data-tot="${type}"></tr>`;
      if (type === 'COST_OF_SALES') body += '<tr class="tot big" data-tot="GP"></tr>';
    });
    body += '<tr class="tot big" data-tot="NP"></tr>';
    $('gridWrap').innerHTML = `<table class="pl plan-grid${edit ? ' editing' : ''}">${head}<tbody>${body}</tbody></table>`;
    drawTotals();
    $('gridNote').textContent = (st.dept ? 'Showing the amounts for ' + deptName(st.dept) + ' only. ' : 'Showing company-wide amounts (not tied to a department). ') +
      (b.departments_used.filter(Boolean).length ? 'Departments with their own amounts: ' + b.departments_used.filter(Boolean).map(deptName).join(', ') + '.' : '') +
      (edit ? '' : ' This version cannot be changed' + (st.list.can_manage && b.can_new_version ? ': press New version to make changes.' : '.'));
  }

  function drawTotals() {
    const b = st.budget;
    const ms = b.months;
    const sum = (type) => ms.map((k, i) => r2(b.accounts.filter((a) => a.account_type === type).reduce((s, a) => s + ((st.grid[a.account_id] || [])[i] || 0), 0)));
    const t = { REVENUE: sum('REVENUE'), COST_OF_SALES: sum('COST_OF_SALES'), EXPENSE: sum('EXPENSE') };
    t.GP = ms.map((k, i) => r2(t.REVENUE[i] - t.COST_OF_SALES[i]));
    t.NP = ms.map((k, i) => r2(t.GP[i] - t.EXPENSE[i]));
    const label = { REVENUE: 'Total revenue', COST_OF_SALES: 'Total cost of sales', EXPENSE: 'Total expenses', GP: 'Gross profit', NP: 'Net profit / (loss)' };
    const edit = b.can_edit;
    Object.keys(label).forEach((k) => {
      const row = $('gridWrap').querySelector(`tr[data-tot="${k}"]`);
      if (!row) return;
      const yr = r2(t[k].reduce((s, v) => s + v, 0));
      row.innerHTML = `<td>${label[k]}</td>${t[k].map((v) => `<td class="num${v < 0 ? ' neg' : ''}">${v ? esc(v < 0 ? '− ' + fmt(-v) : fmt(v)) : '–'}</td>`).join('')}<td class="num${yr < 0 ? ' neg' : ''}">${esc(fin.amt(yr))}</td>${edit ? '<td></td>' : ''}`;
    });
  }

  function setRow(accId, vals) {
    st.grid[accId] = vals.map((v) => r2(Math.max(0, Number(v) || 0)));
    const tr = $('gridWrap').querySelector(`tr.acc[data-a="${CSS.escape(accId)}"]`);
    if (tr) tr.querySelectorAll('input[data-i]').forEach((inp) => { const v = st.grid[accId][Number(inp.dataset.i)]; inp.value = v ? v : ''; });
    updateYear(accId);
    markDirty();
  }
  function updateYear(accId) {
    const c = $('gridWrap').querySelector(`td[data-yr="${CSS.escape(accId)}"]`);
    if (c) c.textContent = fmt(r2((st.grid[accId] || []).reduce((s, v) => s + v, 0)));
    drawTotals();
  }
  function markDirty() {
    st.dirty = true;
    MS.setMsg('bMsg', 'You have changes that are not saved yet.');
  }
  async function leaveOk() {
    if (!st.dirty) return true;
    return MS.confirm({ title: 'Unsaved changes', message: 'Your changes to the amounts are not saved. Leave them?', confirmText: 'Leave without saving', danger: true });
  }

  function rowDialog(accId, mode) {
    const a = st.budget.accounts.find((x) => x.account_id === accId);
    const vals = st.grid[accId] || Array(12).fill(0);
    $('rowTitle').textContent = mode === 'fill' ? 'Same amount every month' : 'Split a yearly amount';
    $('rowInfo').textContent = a.account_code + ' ' + a.account_name + ': ' + (mode === 'fill' ? 'every one of the 12 months gets this amount.' : 'the amount is divided evenly over the 12 months (any cents left over go to the last month).');
    $('rowLabel').firstChild.textContent = (mode === 'fill' ? 'Amount per month (GMD)' : 'Amount for the whole year (GMD)') + ' ';
    $('rowAmount').value = mode === 'fill' ? (vals.find((v) => v) || '') : (r2(vals.reduce((s, v) => s + v, 0)) || '');
    $('rowError').textContent = '';
    const dlg = MS.openDialog('rowDialog');
    $('rowForm').onsubmit = (e) => {
      e.preventDefault();
      const v = Number($('rowAmount').value);
      if (!(v >= 0) || $('rowAmount').value === '') { $('rowError').textContent = 'Enter an amount of 0 or more.'; return; }
      if (mode === 'fill') setRow(accId, Array(12).fill(r2(v)));
      else {
        const each = Math.floor(v * 100 / 12) / 100;
        const out = Array(12).fill(each);
        out[11] = r2(v - each * 11);
        setRow(accId, out);
      }
      dlg.close();
    };
    $('rowCancel').onclick = () => dlg.close();
  }

  async function copyActuals() {
    $('copyError').textContent = '';
    const dlg = MS.openDialog('copyDialog');
    $('copyForm').onsubmit = async (e) => {
      e.preventDefault();
      MS.busy($('copyGo'), true, 'Working…');
      try {
        const r = await MS.call('BUDGET_PRIOR_ACTUALS', { fiscal_year: st.year, pct: Number($('copyPct').value) || 0, department_id: st.dept });
        const ids = Object.keys(r.accounts).filter((id) => st.budget.accounts.some((a) => a.account_id === id));
        if (!ids.length) { $('copyError').textContent = 'Nothing was posted in the books last year' + (st.dept ? ' for this department' : '') + ', so there is nothing to copy.'; return; }
        let n = 0;
        ids.forEach((id) => {
          const has = (st.grid[id] || []).some((v) => v);
          if ($('copyOnlyEmpty').checked && has) return;
          setRow(id, r.accounts[id]); n++;
        });
        dlg.close();
        MS.setMsg('bMsg', n + ' account' + (n === 1 ? '' : 's') + ' filled from ' + r.from_year + ' actuals' + (r.pct ? ' ' + (r.pct > 0 ? '+' : '') + r.pct + '%' : '') + '. Check them, then press Save.');
      } catch (err) { $('copyError').textContent = err.message; } finally { MS.busy($('copyGo'), false); }
    };
    $('copyCancel').onclick = () => dlg.close();
  }

  async function save(quiet) {
    const b = st.budget;
    const lines = [];
    Object.keys(st.grid).forEach((id) => st.grid[id].forEach((v, i) => { if (v) lines.push({ account_id: id, period: b.months[i], amount: v }); }));
    MS.busy($('saveBtn'), true, 'Saving…');
    try {
      const r = await MS.call('BUDGET_SAVE_LINES', { budget_id: b.budget_id, department_id: st.dept, lines, replace: true });
      st.dirty = false;
      st.budget = r;
      drawBar();
      if (!quiet) MS.setMsg('bMsg', 'Saved: ' + r.saved.added + ' new, ' + r.saved.changed + ' changed, ' + r.saved.removed + ' removed.', 'ok');
      return true;
    } catch (err) { MS.setMsg('bMsg', err.message, 'error'); return false; } finally { MS.busy($('saveBtn'), false); }
  }

  function noteDialog(o) {
    return new Promise((resolve) => {
      $('noteForm').reset();
      $('noteTitle').textContent = o.title;
      $('noteInfo').textContent = o.info || '';
      $('noteLabel').classList.toggle('req', !!o.required);
      $('noteError').textContent = '';
      $('noteSave').textContent = o.button;
      $('noteSave').className = o.danger ? 'danger-solid' : 'primary';
      const dlg = MS.openDialog('noteDialog');
      let done = false;
      $('noteForm').onsubmit = async (e) => {
        e.preventDefault();
        const t = $('noteText').value.trim();
        if (o.required && !t) { $('noteError').textContent = 'Please write a comment.'; return; }
        MS.busy($('noteSave'), true, 'Saving…');
        try { await o.run(t); done = true; dlg.close(); } catch (err) { $('noteError').textContent = err.message; } finally { MS.busy($('noteSave'), false); }
      };
      $('noteCancel').onclick = () => dlg.close();
      dlg.addEventListener('close', () => resolve(done), { once: true });
    });
  }

  async function afterAction(r, msg) {
    await loadList();
    await loadBudget(r.budget_id);
    MS.setMsg('bMsg', msg, 'ok');
  }

  /* ---------- budget vs actual ---------- */
  function ragPill(rag, kind, variance) {
    if (!rag) return '';
    const text = rag === 'GREEN' ? (variance > 0 && kind === 'income' ? 'Above budget' : 'On track')
      : rag === 'RED' ? (kind === 'cost' ? 'Over budget' : 'Below budget') : 'Well under budget';
    return `<span class="pill ${rag === 'GREEN' ? 'ok' : rag === 'RED' ? 'failed' : 'pending'}">${esc(text)}</span>`;
  }
  const pct = (p) => (p === null || p === undefined ? '–' : (p > 0 ? '+' : '') + p.toFixed(1) + '%');

  async function runBva() {
    MS.setMsg('bvaMsg', 'Working it out…');
    try {
      const r = await MS.call('BUDGET_VS_ACTUAL', { fiscal_year: st.year, period: $('bvaMonth').value, mode: $('bvaMode').value, department_id: $('bvaDept').value });
      const basis = r.budget ? (r.budget.budget_name + ' version ' + r.budget.version + (r.budget.status === 'APPROVED' ? ' (approved)' : ' — NOT APPROVED YET')) : 'no budget for this year';
      MS.setMsg('bvaMsg', (r.mode === 'ytd' ? 'Year to date: ' : 'Month: ') + MS.shortDate(r.from) + ' to ' + MS.shortDate(r.to) +
        ($('bvaDept').value ? ' · ' + deptName($('bvaDept').value) : '') + ' · compared with ' + basis, r.budget && r.budget.status !== 'APPROVED' ? 'error' : '');
      const card = (k, o, kind, sub) => `<div class="card${o.rag === 'RED' ? ' red' : ''}"><div class="k">${esc(k)}</div><div class="v">${fin.amt(o.actual)}</div>
        <div class="s">budget ${esc(MS.money(o.budget))} · ${esc(pct(o.variance_pct))} ${ragPill(o.rag, kind, o.variance)}</div>${sub ? `<div class="s">${esc(sub)}</div>` : ''}</div>`;
      $('bvaCards').innerHTML = card('Revenue', r.revenue, 'income') + card('Gross profit', r.gross_profit, 'income') + card('Expenses', r.expenses, 'cost') + card(r.net_profit.actual < 0 ? 'Net loss' : 'Net profit', r.net_profit, 'income');
      const line = (label, o, kind, cls) => `<tr class="${cls}"><td>${esc(label)}</td><td class="num">${amt(o.budget)}</td><td class="num">${amt(o.actual)}</td><td class="num${(kind === 'cost' ? o.variance > 0 : o.variance < 0) ? ' neg' : ''}">${o.variance ? fin.amt(o.variance) : '–'}</td><td class="num">${esc(pct(o.variance_pct))}</td><td>${ragPill(o.rag, kind, o.variance)}</td></tr>`;
      const section = (title, s, kind) => `<tr class="grp"><td colspan="6">${esc(title)}</td></tr>` +
        (s.accounts.length ? s.accounts.map((a) => line(a.account_code + ' ' + a.account_name, a, kind, 'acc')).join('') : '<tr class="acc"><td colspan="6" class="fin-note">No budget and nothing posted.</td></tr>') +
        line('Total ' + title.toLowerCase(), s, kind, 'tot');
      $('bvaBody').innerHTML = `<table class="pl plan-bva"><thead><tr><th>Account</th><th>Budget</th><th>Actual</th><th>Difference</th><th>%</th><th>Mark</th></tr></thead><tbody>
        ${section('Revenue', r.revenue, 'income')}${section('Cost of sales', r.cost_of_sales, 'cost')}
        ${line('Gross profit', r.gross_profit, 'income', 'tot big')}
        ${section('Expenses', r.expenses, 'cost')}
        ${line('Net profit / (loss)', r.net_profit, 'income', 'tot big')}
      </tbody></table>`;
      $('bvaRule').textContent = 'Difference = actual − budget. Within ' + r.tolerance_pct + '% of budget is green. Costs more than ' + r.tolerance_pct +
        '% over budget are red; more than ' + r.tolerance_pct + '% under budget are amber (check nothing is missing, or the budget was too high). Revenue and profit more than ' +
        r.tolerance_pct + '% below budget are red; above budget is green. Actual figures come from the books (posted entries).';
    } catch (err) { MS.setMsg('bvaMsg', err.message, 'error'); $('bvaBody').innerHTML = ''; $('bvaCards').innerHTML = ''; }
  }

  function fillBvaMonths() {
    const ms = monthsOf(st.year);
    const cur = MS.todayISO().slice(0, 7);
    const sel = ms.indexOf(cur) >= 0 ? cur : (cur > ms[11] ? ms[11] : ms[0]);
    $('bvaMonth').innerHTML = ms.map((k) => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(MONTHS[Number(k.slice(5, 7)) - 1] + ' ' + k.slice(0, 4))}</option>`).join('');
  }

  /* ---------- yearly amounts, spread evenly (BUDGET_SPREAD) ---------- */
  function annualDialog() {
    const b = st.budget;
    $('annualError').textContent = '';
    $('annualList').innerHTML = SECTIONS.map(([type, title]) => `<b>${esc(title)}</b>` + b.accounts.filter((a) => a.account_type === type).map((a) => {
      const cur = r2((st.grid[a.account_id] || []).reduce((s, v) => s + v, 0));
      return `<label>${esc(a.account_code + ' ' + a.account_name)}<input type="number" min="0" step="0.01" inputmode="decimal" data-ann="${esc(a.account_id)}" placeholder="${cur ? esc(fmt(cur)) : '0'}" aria-label="Yearly amount ${esc(a.account_name)}"></label>`;
    }).join('')).join('');
    const dlg = MS.openDialog('annualDialog');
    $('annualForm').onsubmit = async (e) => {
      e.preventDefault();
      const lines = Array.from($('annualList').querySelectorAll('input[data-ann]')).filter((i) => i.value !== '').map((i) => ({ account_id: i.dataset.ann, annual: Number(i.value) }));
      if (!lines.length) { $('annualError').textContent = 'Type at least one yearly amount.'; return; }
      if (lines.some((l) => !(l.annual >= 0))) { $('annualError').textContent = 'Amounts must be 0 or more.'; return; }
      MS.busy($('annualGo'), true, 'Saving…');
      try {
        if (st.dirty && !(await save(true))) return;
        await MS.call('BUDGET_SPREAD', { budget_id: b.budget_id, department_id: st.dept, lines });
        dlg.close();
        await loadBudget(b.budget_id);
        MS.setMsg('bMsg', lines.length + ' account' + (lines.length === 1 ? '' : 's') + ' spread evenly over the 12 months and saved.', 'ok');
      } catch (err) { $('annualError').textContent = err.message; } finally { MS.busy($('annualGo'), false); }
    };
    $('annualCancel').onclick = () => dlg.close();
  }

  /* ---------- monthly view (BUDGET_MONTHLY) ---------- */
  const usedBar = (p) => p === null || p === undefined ? '–' : `<span class="used${p > 100 ? ' over' : p > 85 ? ' warn' : ''}" aria-hidden="true"><i style="width:${Math.min(100, Math.max(0, p))}%"></i></span>${p.toFixed(0)}%`;
  async function runMonthly() {
    MS.setMsg('moMsg', 'Working it out…');
    try {
      const r = await MS.call('BUDGET_MONTHLY', { fiscal_year: st.year, department_id: $('moDept').value });
      const basis = r.budget ? r.budget.budget_name + ' version ' + r.budget.version + (r.budget.status === 'APPROVED' ? ' (approved)' : ' (' + MS.label(r.budget.status).toLowerCase() + ', not approved yet)') : 'no budget for this year';
      MS.setMsg('moMsg', yearLabel(st.year) + ' · ' + basis, r.budget && r.budget.status !== 'APPROVED' ? 'error' : '');
      $('moTitle').textContent = 'Monthly budget ' + yearLabel(st.year) + ' · ' + basis;
      const y = r.year, td = r.to_date;
      const card = (k, v, s) => `<div class="card"><div class="k">${esc(k)}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
      $('moCards').innerHTML = card('Revenue, year', fin.amt(y.revenue.actual), 'budget ' + esc(MS.money(y.revenue.budget)) + ' · ' + usedBar(y.revenue.used_pct))
        + card('Spending, year', fin.amt(y.cost_of_sales.actual + y.expenses.actual), 'budget ' + esc(MS.money(y.cost_of_sales.budget + y.expenses.budget)))
        + card('Net profit, year', fin.amt(y.net_profit.actual), 'budget ' + esc(fin.amt(y.net_profit.budget)))
        + (td ? card('Budget used to ' + esc(MONTHS[Number(td.through.slice(5, 7)) - 1]), usedBar(td.spend.used_pct), 'spent ' + esc(MS.money(td.spend.actual)) + ' of ' + esc(MS.money(td.spend.budget)) + ' planned to date') : '');
      const labels = r.months.map((k) => MONTHS[Number(k.slice(5, 7)) - 1]);
      $('moChartRev').innerHTML = MS.charts.bars({ title: 'Revenue: budget and actual', labels, fmt: (v) => MS.money(v),
        series: [{ name: 'Budget', cls: 's1', values: r.monthly.map((m) => m.revenue.budget) }, { name: 'Actual', cls: 's2', values: r.monthly.map((m) => m.revenue.actual) }] });
      $('moChartExp').innerHTML = MS.charts.bars({ title: 'Spending: budget and actual', labels, fmt: (v) => MS.money(v),
        series: [{ name: 'Budget', cls: 's1', values: r.monthly.map((m) => m.cost_of_sales.budget + m.expenses.budget) }, { name: 'Actual', cls: 's2', values: r.monthly.map((m) => m.cost_of_sales.actual + m.expenses.actual) }] });
      const row = (label, m, cls) => `<tr class="${cls}"><td>${label}</td><td class="num">${amt(m.revenue.budget)}</td><td class="num">${amt(m.revenue.actual)}</td><td class="num">${amt(m.cost_of_sales.budget + m.expenses.budget)}</td><td class="num">${amt(m.cost_of_sales.actual + m.expenses.actual)}</td>
        <td class="num">${amt(m.net_profit.budget)}</td><td class="num${m.net_profit.actual < 0 ? ' neg' : ''}">${m.net_profit.actual ? fin.amt(m.net_profit.actual) : '–'}</td></tr>`;
      $('moMonths').innerHTML = `<table class="pl"><thead><tr><th>Month</th><th>Revenue budget</th><th>Revenue actual</th><th>Spending budget</th><th>Spending actual</th><th>Net budget</th><th>Net actual</th></tr></thead><tbody>
        ${r.monthly.map((m) => row(esc(mLabel(m.period)) + (m.is_current ? ' <span class="qhint">this month</span>' : ''), m, 'acc' + (m.is_current ? ' cur' : ''))).join('')}
        ${row('Whole year', { revenue: y.revenue, cost_of_sales: { budget: y.cost_of_sales.budget + y.expenses.budget, actual: y.cost_of_sales.actual + y.expenses.actual }, expenses: { budget: 0, actual: 0 }, net_profit: y.net_profit }, 'tot big')}</tbody></table>`;
      const kindOf = (a) => (a.account_type === 'REVENUE' ? 'income' : 'cost');
      $('moAccounts').innerHTML = r.accounts.length ? `<table class="pl"><thead><tr><th>Account</th><th>Budget (year)</th><th>Actual (year)</th><th>Difference</th><th>Used</th></tr></thead><tbody>
        ${SECTIONS.map(([type, title]) => { const rows = r.accounts.filter((a) => a.account_type === type); return rows.length ? `<tr class="grp"><td colspan="5">${esc(title)}</td></tr>` + rows.map((a) =>
          `<tr class="acc"><td>${esc(a.account_code + ' ' + a.account_name)}</td><td class="num">${amt(a.annual_budget)}</td><td class="num">${amt(a.actual)}</td><td class="num${(kindOf(a) === 'cost' ? a.variance > 0 : a.variance < 0) ? ' neg' : ''}">${a.variance ? fin.amt(a.variance) : '–'}</td><td>${usedBar(a.used_pct)}</td></tr>`).join('') : ''; }).join('')}
        </tbody></table>` : '<p class="empty">There are no budget amounts and nothing posted for this year.</p>';
      $('moNote').textContent = 'Actual = what the books show on the account that month. % used = actual divided by budget. Spending = cost of sales + expenses. Within ' + r.tolerance_pct + '% of the plan counts as on track.';
    } catch (err) { MS.setMsg('moMsg', err.message, 'error'); $('moCards').innerHTML = ''; $('moMonths').innerHTML = ''; $('moAccounts').innerHTML = ''; }
  }

  function show(t) {
    st.tab = t;
    $('tabs').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    $('entryTab').hidden = t !== 'entry';
    $('bvaTab').hidden = t !== 'bva';
    $('monthlyTab').hidden = t !== 'monthly';
    if (t === 'bva') runBva();
    if (t === 'monthly') runMonthly();
  }

  MS.boot({ page: 'budget', any: ['FINANCE_VIEW', 'BUDGET_MANAGE', 'BUDGET_APPROVE'], ref: true }).then(async () => {
    const depts = ((MS.refCache && MS.refCache.departments) || []).filter((d) => d.status !== 'INACTIVE').map((d) => ({ value: d.department_id, label: d.department_name }));
    $('deptSel').innerHTML = MS.options(depts, '', 'Whole company (no department)');
    $('bvaDept').innerHTML = MS.options(depts, '', 'Whole company');
    $('moDept').innerHTML = MS.options(depts, '', 'Whole company');
    try { await loadList(); } catch (err) { MS.setMsg('bMsg', err.message, 'error'); return; }
    fillBvaMonths();
    await loadBudget();

    $('tabs').addEventListener('click', (e) => { const b = e.target.closest('button[data-tab]'); if (b) show(b.dataset.tab); });
    $('yearSel').onchange = async () => {
      if (!(await leaveOk())) { $('yearSel').value = st.year; return; }
      st.year = Number($('yearSel').value); fillBvaMonths(); loadBudget();
    };
    $('deptSel').onchange = async () => {
      if (!(await leaveOk())) { $('deptSel').value = st.dept; return; }
      st.dept = $('deptSel').value; loadBudget(st.budget && st.budget.budget_id);
    };
    $('gridWrap').addEventListener('input', (e) => {
      const inp = e.target.closest('input[data-a]');
      if (!inp) return;
      const id = inp.dataset.a;
      st.grid[id] = st.grid[id] || Array(12).fill(0);
      st.grid[id][Number(inp.dataset.i)] = r2(Math.max(0, Number(inp.value) || 0));
      updateYear(id); markDirty();
    });
    $('gridWrap').addEventListener('click', (e) => {
      const f = e.target.closest('[data-fill]'); if (f) return rowDialog(f.dataset.fill, 'fill');
      const s = e.target.closest('[data-split]'); if (s) return rowDialog(s.dataset.split, 'split');
    });
    $('newBtn').onclick = async () => {
      MS.busy($('newBtn'), true, 'Starting…');
      try { const r = await MS.call('BUDGET_CREATE', { fiscal_year: st.year }); await afterAction(r, 'Budget started. Enter the amounts, then press Save.'); }
      catch (err) { MS.setMsg('bMsg', err.message, 'error'); } finally { MS.busy($('newBtn'), false); }
    };
    $('versionBtn').onclick = async () => {
      const yes = await MS.confirm({ title: 'New version', message: 'Start version ' + (Math.max(...st.budget.versions.map((v) => v.version)) + 1) + ' of the ' + yearLabel(st.year) + ' budget? It starts as a copy of the latest version. The approved budget stays in use until the new version is approved.', confirmText: 'Start new version' });
      if (!yes) return;
      try { const r = await MS.call('BUDGET_CREATE', { fiscal_year: st.year }); await afterAction(r, 'New version started as a copy. Make your changes and press Save.'); }
      catch (err) { MS.setMsg('bMsg', err.message, 'error'); }
    };
    $('saveBtn').onclick = () => save(false);
    $('copyBtn').onclick = copyActuals;
    $('annualBtn').onclick = annualDialog;
    $('moDept').addEventListener('change', runMonthly);
    $('moPrint').onclick = () => window.print();
    $('submitBtn').onclick = async () => {
      if (st.dirty && !(await save(true))) return;
      const yes = await MS.confirm({ title: 'Send for approval', message: 'Send ' + st.budget.budget_name + ' (version ' + st.budget.version + ') for approval? The Finance Director is told (the CEO when there is no Finance Director). You cannot change it while it waits.', confirmText: 'Send for approval' });
      if (!yes) return;
      try { const r = await MS.call('BUDGET_SUBMIT', { budget_id: st.budget.budget_id }); await afterAction(r, 'Sent for approval.'); }
      catch (err) { MS.setMsg('bMsg', err.message, 'error'); }
    };
    $('approveBtn').onclick = () => noteDialog({ title: 'Approve the budget', info: 'Once approved, this budget is used for Budget vs actual and the monthly report' + (st.budget.versions.some((v) => v.status === 'APPROVED') ? ', in place of the version approved before' : '') + '.',
      button: 'Approve budget', run: async (t) => { const r = await MS.call('BUDGET_APPROVE', { budget_id: st.budget.budget_id, comment: t }); await afterAction(r, 'Budget approved.'); } });
    $('returnBtn').onclick = () => noteDialog({ title: 'Return for changes', info: 'The budget goes back to the person who prepared it as a draft, with your comment.', required: true, danger: true,
      button: 'Return budget', run: async (t) => { const r = await MS.call('BUDGET_RETURN', { budget_id: st.budget.budget_id, comment: t }); await afterAction(r, 'Budget returned with your comment.'); } });
    $('bvaRun').onclick = runBva;
    ['bvaMonth', 'bvaMode', 'bvaDept'].forEach((id) => $(id).addEventListener('change', runBva));
    $('bvaPrint').onclick = () => window.print();
    window.addEventListener('beforeunload', (e) => { if (st.dirty) { e.preventDefault(); e.returnValue = ''; } });
    if (MS.param('tab') === 'bva') show('bva');
    if (MS.param('tab') === 'monthly') show('monthly');
  });
})();
