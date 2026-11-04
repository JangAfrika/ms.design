(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const state = { page: 1, q: '', status: 'OPEN', type: '' };
  let rows = [], types = [];
  const TYPE_LABEL = { VAT_RETURN: 'VAT return', INCOME_TAX: 'Income tax', PAYE: 'PAYE', WITHHOLDING: 'Withholding tax', OTHER: 'Other' };
  const typeLabel = (t) => TYPE_LABEL[t] || MS.label(t);
  const STATUS_LABEL = { UPCOMING: 'Upcoming', SUBMITTED: 'Submitted', PAID: 'Paid', OVERDUE: 'Overdue' };

  MS.reload = () => load();
  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    try {
      const r = await MS.recall('GRA_LIST', { page: state.page, page_size: 50, search: state.q, status: state.status, obligation_type: state.type });
      rows = r.rows; types = r.types;
      MS.setMsg('listMsg', r.total + ' obligation' + (r.total === 1 ? '' : 's'));
      $('addBtn').hidden = !(r.can && r.can.add);
      const s = r.summary;
      $('graCards').innerHTML = `
        <div class="card${s.overdue ? ' red' : ' green'}"><div class="k">Overdue</div><div class="v">${s.overdue}</div><div class="s">${s.overdue ? 'submit or pay now' : 'nothing late'}</div></div>
        <div class="card${s.due_soon ? ' red' : ''}"><div class="k">Due in 14 days</div><div class="v">${s.due_soon}</div><div class="s">coming up</div></div>
        <div class="card"><div class="k">Still open</div><div class="v">${s.open}</div><div class="s">${s.amount_open ? esc(MS.money(s.amount_open)) + ' to pay' : 'not paid yet'}</div></div>
        <div class="card"><div class="k">Paid this year</div><div class="v">${s.paid_this_year}</div><div class="s">&nbsp;</div></div>`;
      $('listBody').innerHTML = rows.length ? rows.map((g, i) => {
        const due = g.status === 'PAID' ? '' : g.days_to_due === null ? '' : g.days_to_due < 0 ? `<span class="sub neg">${-g.days_to_due} day${g.days_to_due === -1 ? '' : 's'} late</span>` : g.days_to_due === 0 ? '<span class="sub">today</span>' : `<span class="sub">in ${g.days_to_due} day${g.days_to_due === 1 ? '' : 's'}</span>`;
        const acts = [
          g.can.submit && `<button type="button" data-act="submit" data-i="${i}">Mark submitted</button>`,
          g.can.pay && `<button type="button" data-act="pay" data-i="${i}">Mark paid</button>`,
          g.can.edit && `<button type="button" data-act="edit" data-i="${i}">Edit</button>`,
          g.can.reopen && `<button type="button" data-act="reopen" data-i="${i}">Reopen</button>`
        ].filter(Boolean).join(' ');
        return `<tr><td><b>${esc(typeLabel(g.obligation_type))}</b></td><td>${esc(g.period)}</td><td>${esc(MS.shortDate(g.due_date))}${due}</td>
          <td class="num">${g.amount_due === '' || g.amount_due == null ? '–' : MS.money(g.amount_due)}</td>
          <td>${MS.pill(g.status, STATUS_LABEL[g.status])}${g.status === 'PAID' ? `<span class="sub">${esc(MS.shortDate(g.paid_date))}</span>` : g.status === 'SUBMITTED' ? `<span class="sub">${esc(MS.shortDate(g.submitted_date))}</span>` : ''}</td>
          <td>${esc(g.responsible_name)}</td><td class="num">${acts}</td></tr>`;
      }).join('') : '<tr><td colspan="7" class="empty">' + (state.status === 'OPEN' && !state.q && !state.type ? 'Nothing is waiting for the GRA.' : 'No obligation matches.') + '</td></tr>';
      pager(r);
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  function pager(r) {
    const pages = Math.max(1, Math.ceil(r.total / r.page_size));
    $('pager').innerHTML = pages > 1 ? `<button type="button" id="pPrev"${state.page <= 1 ? ' disabled' : ''}>Previous</button><span>Page ${state.page} of ${pages}</span><button type="button" id="pNext"${state.page >= pages ? ' disabled' : ''}>Next</button>` : '';
    if (pages > 1) { $('pPrev').onclick = () => { state.page--; load(); }; $('pNext').onclick = () => { state.page++; load(); }; }
  }

  function form(g) {
    const f = $('graForm');
    f.reset();
    $('graError').textContent = '';
    $('graTitle').textContent = g ? 'Edit obligation' : 'Add obligation';
    $('graType').innerHTML = MS.options((types.length ? types : Object.keys(TYPE_LABEL)).map((t) => ({ value: t, label: typeLabel(t) })), g ? g.obligation_type : 'VAT_RETURN');
    if (g) {
      f.elements.period.value = g.period; f.elements.due_date.value = g.due_date; f.elements.amount_due.value = g.amount_due === '' || g.amount_due == null ? '' : g.amount_due;
    }
    $('graType').disabled = !!g; f.elements.period.disabled = !!g;
    const dlg = MS.openDialog('graDialog');
    $('graCancel').onclick = () => dlg.close();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = MS.formData(f);
      if (g) { d.gra_obligation_id = g.gra_obligation_id; delete d.obligation_type; delete d.period; } else { d.obligation_type = $('graType').value; }
      if (!d.due_date) { $('graError').textContent = 'Enter the due date.'; return; }
      MS.busy($('graSave'), true, 'Saving…');
      try { await MS.call('GRA_SAVE', d); dlg.close(); load(); } catch (err) { $('graError').textContent = err.message; } finally { MS.busy($('graSave'), false); }
    };
  }

  function act(kind, g) {
    const f = $('actForm');
    f.reset();
    $('actError').textContent = '';
    const pay = kind === 'pay', reopen = kind === 'reopen';
    $('actTitle').textContent = pay ? 'Mark as paid' : reopen ? 'Reopen obligation' : 'Mark as submitted';
    $('actInfo').textContent = typeLabel(g.obligation_type) + ' for ' + g.period + (reopen ? '. It goes back to ' + (g.submitted_date ? 'submitted' : 'upcoming') + '.' : pay ? '. Record the date the money reached the GRA.' : '. Record the date the return was filed.');
    $('actDateLabel').hidden = reopen; f.elements.amount_due.closest('label').hidden = reopen;
    $('actReasonLabel').hidden = !reopen;
    f.elements.date.value = MS.todayISO(); f.elements.date.max = MS.todayISO();
    if (g.amount_due !== '' && g.amount_due != null) f.elements.amount_due.value = g.amount_due;
    $('actSave').textContent = pay ? 'Mark paid' : reopen ? 'Reopen' : 'Mark submitted';
    const dlg = MS.openDialog('actDialog');
    $('actCancel').onclick = () => dlg.close();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = MS.formData(f);
      let action, payload;
      if (reopen) { if (!d.reason) { $('actError').textContent = 'Please give the reason.'; return; } action = 'GRA_REOPEN'; payload = { gra_obligation_id: g.gra_obligation_id, reason: d.reason }; }
      else if (pay) { action = 'GRA_PAY'; payload = { gra_obligation_id: g.gra_obligation_id, paid_date: d.date, amount_due: d.amount_due }; }
      else { action = 'GRA_SUBMIT'; payload = { gra_obligation_id: g.gra_obligation_id, submitted_date: d.date, amount_due: d.amount_due }; }
      MS.busy($('actSave'), true, 'Saving…');
      try { await MS.call(action, payload); dlg.close(); load(); } catch (err) { $('actError').textContent = err.message; } finally { MS.busy($('actSave'), false); }
    };
  }

  MS.boot({ page: 'gra', any: ['FINANCE_VIEW'] }).then(() => {
    $('statusFilter').innerHTML = MS.options([{ value: 'OPEN', label: 'Not paid yet' }, { value: 'OVERDUE', label: 'Overdue' }, { value: 'UPCOMING', label: 'Upcoming' },
      { value: 'SUBMITTED', label: 'Submitted' }, { value: 'PAID', label: 'Paid' }, { value: '', label: 'All' }], state.status);
    $('typeFilter').innerHTML = MS.options(Object.keys(TYPE_LABEL).map((t) => ({ value: t, label: typeLabel(t) })), '', 'Anything');
    $('statusFilter').addEventListener('change', () => { state.status = $('statusFilter').value; state.page = 1; load(); });
    $('typeFilter').addEventListener('change', () => { state.type = $('typeFilter').value; state.page = 1; load(); });
    $('search').addEventListener('input', MS.debounce(() => { state.q = $('search').value.trim(); state.page = 1; load(); }, 300));
    $('reloadBtn').addEventListener('click', load);
    $('addBtn').addEventListener('click', () => form(null));
    $('listBody').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]');
      if (!b) return;
      const g = rows[Number(b.dataset.i)];
      if (b.dataset.act === 'edit') form(g); else act(b.dataset.act, g);
    });
    load();
  });
})();
