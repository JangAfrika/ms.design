(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const fin = MS.fin;
  const state = { page: 1, q: '', from: '', to: '' };

  MS.reload = () => load();
  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    try {
      const r = await MS.recall('INCOME_LIST', { page: state.page, page_size: 50, search: state.q, from: state.from, to: state.to, dir: 'desc' });
      MS.setMsg('listMsg', r.total + ' entr' + (r.total === 1 ? 'y' : 'ies') + (r.totals ? ' · total ' + MS.money(r.totals.amount) : ''));
      $('listBody').innerHTML = r.rows.length ? r.rows.map((x) => `
        <tr class="${x.status === 'REVERSED' ? 'void' : ''}">
          <td>${esc(MS.shortDate(x.income_date))}</td>
          <td><b>${esc(x.income_number)}</b></td>
          <td class="wrap">${esc(x.description)}${x.reference ? `<span class="sub">${esc(x.reference)}</span>` : ''}</td>
          <td class="wrap">${esc(x.received_from || x.customer_name || '')}</td>
          <td class="wrap">${esc(x.money_account_name)}<span class="sub">${esc(MS.label(x.payment_method))}</span></td>
          <td class="wrap">${esc(x.account_code)} ${esc(x.account_name)}</td>
          <td class="num">${MS.money(x.amount)}</td>
          <td>${x.status === 'REVERSED' ? '<span class="pill bad">Reversed</span>' : '<span class="pill ok">Recorded</span>'}</td>
          <td>${x.status !== 'REVERSED' && MS.can('FINANCE_APPROVE') ? `<button type="button" class="danger" data-rev="${esc(x.income_id)}">Reverse</button>` : ''}</td>
        </tr>`).join('') : `<tr><td colspan="9" class="empty">${state.q ? 'No entry matches.' : 'No other income recorded yet.'}</td></tr>`;
      const pages = Math.max(1, Math.ceil(r.total / r.page_size));
      $('pager').innerHTML = pages > 1 ? `<button type="button" id="pPrev"${state.page <= 1 ? ' disabled' : ''}>Previous</button><span>Page ${state.page} of ${pages}</span><button type="button" id="pNext"${state.page >= pages ? ' disabled' : ''}>Next</button>` : '';
      if (pages > 1) { $('pPrev').onclick = () => { state.page--; load(); }; $('pNext').onclick = () => { state.page++; load(); }; }
      $('listBody').querySelectorAll('[data-rev]').forEach((b) => { b.onclick = () => reverse(r.rows.find((x) => x.income_id === b.dataset.rev)); });
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  async function openForm() {
    const f = $('incForm');
    f.reset();
    $('incError').textContent = '';
    $('iDate').value = MS.todayISO();
    $('iDate').max = MS.todayISO();
    $('iMethod').innerHTML = MS.options(['CASH', 'CHEQUE', 'BANK_TRANSFER', 'MOBILE_MONEY', 'POS'].map((v) => ({ value: v, label: MS.label(v) })), 'CASH');
    let money = { cash: [], bank: [] }, accs = [];
    try { money = await fin.money(); accs = await fin.accounts(['REVENUE']); } catch (e) { $('incError').textContent = e.message; }
    const setMoney = () => { $('iMoney').innerHTML = fin.moneyOptions(money, '', $('iMethod').value); };
    setMoney();
    $('iMethod').onchange = setMoney;
    const def = accs.find((a) => a.account_code === '4090');
    $('iAcc').innerHTML = fin.accountOptions(accs, def ? def.account_id : '', '— choose —');
    const dlg = MS.openDialog('incDialog');
    $('incCancel').onclick = () => dlg.close();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const amount = Number($('iAmount').value), desc = $('iDesc').value.trim();
      if (!(amount > 0)) { $('incError').textContent = 'Enter the amount.'; return; }
      if (!desc) { $('incError').textContent = 'Say what the money is for.'; return; }
      if (!$('iMoney').value) { $('incError').textContent = 'Choose the till or bank account the money went into.'; return; }
      if (!$('iAcc').value) { $('incError').textContent = 'Choose the revenue account.'; return; }
      MS.busy($('incSave'), true, 'Saving…');
      try {
        const r = await MS.call('INCOME_RECORD', Object.assign({ amount, description: desc, income_date: $('iDate').value, received_from: $('iFrom').value.trim(), reference: $('iRef').value.trim(),
          payment_method: $('iMethod').value, revenue_account_id: $('iAcc').value }, fin.moneyPayload($('iMoney').value)));
        dlg.close();
        MS.setMsg('listMsg', r.income_number + ' recorded: ' + MS.money(r.amount) + '.', 'ok');
        load();
      } catch (err) { $('incError').textContent = err.message; } finally { MS.busy($('incSave'), false); }
    };
  }

  function reverse(x) {
    const f = $('noteForm');
    f.reset();
    $('noteError').textContent = '';
    $('noteInfo').textContent = 'Reverse ' + x.income_number + ' (' + MS.money(x.amount) + '). Nothing is deleted: the books get a mirror entry.';
    const dlg = MS.openDialog('noteDialog');
    $('noteCancel').onclick = () => dlg.close();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const t = $('noteText').value.trim();
      if (!t) { $('noteError').textContent = 'Please give the reason.'; return; }
      MS.busy($('noteSave'), true, 'Reversing…');
      try { await MS.call('INCOME_REVERSE', { income_id: x.income_id, reason: t }); dlg.close(); load(); }
      catch (err) { $('noteError').textContent = err.message; } finally { MS.busy($('noteSave'), false); }
    };
  }

  MS.boot({ page: 'income', any: ['FINANCE_VIEW', 'PAYMENT_RECORD'], ref: true }).then(() => {
    $('newBtn').hidden = !MS.can('PAYMENT_RECORD');
    $('newBtn').addEventListener('click', openForm);
    $('search').addEventListener('input', MS.debounce(() => { state.q = $('search').value.trim(); state.page = 1; load(); }, 300));
    $('fFrom').addEventListener('change', () => { state.from = $('fFrom').value; state.page = 1; load(); });
    $('fTo').addEventListener('change', () => { state.to = $('fTo').value; state.page = 1; load(); });
    $('reloadBtn').addEventListener('click', load);
    load();
  });
})();
