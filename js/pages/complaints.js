(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const state = { page: 1, q: '', status: 'OPEN', overdue: false };
  const CHIPS = [['OPEN', 'Open'], ['OVERDUE', 'Overdue'], ['RECEIVED', 'Received'], ['INVESTIGATING', 'Investigating'], ['ACTION_REQUIRED', 'Action required'], ['RESOLVED', 'Resolved'], ['CLOSED', 'Closed'], ['', 'All']];
  const STEP_LABEL = { ACKNOWLEDGED: 'Acknowledge', INVESTIGATING: 'Start investigating', ACTION_REQUIRED: 'Action required', RESOLVED: 'Resolve', CLOSED: 'Close' };

  const due = (c) => `<span class="${c.overdue ? 'late' : ''}">${esc(MS.when(c.resolution_due_at))}</span>`;
  const pillOf = (c) => MS.pill(c.status, MS.label(c.status)) + (c.overdue ? ' <span class="pill urgent">Overdue</span>' : '');

  MS.reload = () => load();
  async function load() {
    MS.setMsg('listMsg', 'Loading…');
    const filters = {};
    if (state.status && state.status !== 'OVERDUE') filters.status = state.status;
    try {
      const r = await MS.call('COMPLAINT_LIST', { page: state.page, page_size: 50, search: state.q, filters, overdue: state.status === 'OVERDUE' });
      MS.setMsg('listMsg', r.total + ' complaint' + (r.total === 1 ? '' : 's'));
      $('listBody').innerHTML = r.rows.length ? r.rows.map((c) => `
        <tr class="clk${c.overdue ? ' overdue' : ''}" data-id="${esc(c.complaint_id)}">
          <td><b>${esc(c.complaint_number)}</b></td>
          <td>${MS.lnk('customers/customer.html?id=' + encodeURIComponent(c.customer_id), c.customer_name)}${c.job_number ? `<div class="sub">Job ${esc(c.job_number)}</div>` : ''}</td>
          <td>${esc(MS.label(c.complaint_type))}<div class="sub">${esc(String(c.description).slice(0, 80))}</div></td>
          <td>${esc(MS.label(c.severity))}</td><td>${due(c)}</td><td>${pillOf(c)}</td></tr>`).join('')
        : `<tr><td colspan="6" class="empty">${state.q ? 'No complaint matches.' : 'No complaints here. That is good news.'}</td></tr>`;
      const pages = Math.max(1, Math.ceil(r.total / r.page_size));
      $('pager').innerHTML = pages > 1 ? `<button type="button" id="pPrev"${state.page <= 1 ? ' disabled' : ''}>Previous</button><span>Page ${state.page} of ${pages}</span><button type="button" id="pNext"${state.page >= pages ? ' disabled' : ''}>Next</button>` : '';
      if (pages > 1) { $('pPrev').onclick = () => { state.page--; load(); }; $('pNext').onclick = () => { state.page++; load(); }; }
    } catch (err) { MS.setMsg('listMsg', err.message, 'error'); }
  }

  function chips() {
    $('chips').innerHTML = CHIPS.map(([k, l]) => `<button type="button" data-k="${k}" class="${state.status === k ? 'active' : ''}">${l}</button>`).join('');
  }

  async function openDetail(id) {
    let c;
    try { c = await MS.call('COMPLAINT_GET', { complaint_id: id }); } catch (err) { MS.alert(err.message); return; }
    const dlg = document.createElement('dialog');
    dlg.className = 'wide-dlg';
    const kv = MS.kv([['Customer', c.customer_name], ['Job', c.job_number ? c.job_number + ' · ' + c.job_name : ''], ['About', MS.label(c.complaint_type)], ['Severity', MS.label(c.severity)],
      ['Received', MS.when(c.date_received)], ['Due', MS.when(c.resolution_due_at)], ['Handled by', c.responsible_name], ['Valid', c.is_valid === true ? 'Yes' : c.is_valid === false ? 'No' : ''],
      ['Root cause', c.root_cause], ['Corrective action', c.corrective_action], ['Resolved', MS.when(c.resolution_date) + (c.late ? ' (late)' : '')], ['Customer response', c.customer_response]]);
    dlg.innerHTML = `<div class="dlg">
      <h3>${esc(c.complaint_number)} ${pillOf(c)}</h3>
      <p class="info">${esc(c.description)}</p>
      ${kv}
      <h4 style="margin:12px 0 2px">Timeline</h4>
      <ul class="tl">${c.timeline.map((t) => `<li><b>${esc(t.status ? MS.label(t.status) : MS.label(t.action))}</b>${t.note ? ' · ' + esc(t.note) : ''}<small>${esc(MS.when(t.at))}${t.by_name ? ' · ' + esc(t.by_name) : ''}</small></li>`).join('')}</ul>
      <div class="btns">${c.next.map((n) => `<button type="button" class="primary" data-step="${n}">${esc(STEP_LABEL[n] || MS.label(n))}</button>`).join('')}<button type="button" id="dClose">Close window</button></div>
    </div>`;
    document.body.appendChild(dlg);
    dlg.showModal();
    const shut = () => { dlg.close(); dlg.remove(); };
    dlg.querySelector('#dClose').onclick = shut;
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); shut(); });
    dlg.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', async () => {
      const to = b.dataset.step;
      const d = await stepForm(c, to);
      if (!d) return;
      try { await MS.call('COMPLAINT_STEP', Object.assign({ complaint_id: c.complaint_id, to_status: to }, d)); shut(); load(); openDetail(c.complaint_id); } catch (err) { MS.alert(err.message); }
    }));
  }

  // Extra details only the resolve and close steps need; the other steps take an optional note.
  function stepForm(c, to) {
    const dlg = document.createElement('dialog');
    const fields = to === 'RESOLVED'
      ? `<label class="req">Root cause <textarea name="root_cause" rows="2" maxlength="2000"></textarea></label>
         <label class="req">Corrective action <textarea name="corrective_action" rows="2" maxlength="2000"></textarea></label>
         <label class="req">Was the complaint valid? <select name="is_valid"><option value="">Choose…</option><option value="yes">Yes, it was valid</option><option value="no">No, it was not valid</option></select></label>`
      : to === 'CLOSED' ? '<label class="req">What the customer said <input name="customer_response" type="text" maxlength="500" placeholder="e.g. Satisfied with the reprint"></label>'
      : '<label>Note <input name="note" type="text" maxlength="300" placeholder="Optional"></label>';
    dlg.innerHTML = `<form class="dlg" novalidate><h3>${esc(STEP_LABEL[to] || MS.label(to))} · ${esc(c.complaint_number)}</h3>${fields}<div class="err" id="sErr"></div>
      <div class="btns"><button type="button" id="sNo">Cancel</button><button type="submit" class="primary">${esc(STEP_LABEL[to] || 'Save')}</button></div></form>`;
    document.body.appendChild(dlg);
    dlg.showModal();
    return new Promise((resolve) => {
      const end = (v) => { dlg.close(); dlg.remove(); resolve(v); };
      dlg.querySelector('#sNo').onclick = () => end(null);
      dlg.addEventListener('cancel', (e) => { e.preventDefault(); end(null); });
      dlg.querySelector('form').onsubmit = (e) => {
        e.preventDefault();
        const d = MS.formData(dlg.querySelector('form'));
        if (to === 'RESOLVED') {
          if (!d.root_cause || !d.corrective_action) { dlg.querySelector('#sErr').textContent = 'Write the root cause and the corrective action.'; return; }
          if (!d.is_valid) { dlg.querySelector('#sErr').textContent = 'Say whether the complaint was valid.'; return; }
          d.is_valid = d.is_valid === 'yes';
        }
        if (to === 'CLOSED' && !d.customer_response) { dlg.querySelector('#sErr').textContent = 'Write what the customer said.'; return; }
        end(d);
      };
    });
  }

  async function add() {
    const c = await MS.complaintForm({});
    if (c) { MS.toast('Complaint ' + c.complaint_number + ' saved'); state.status = 'OPEN'; chips(); load(); }
  }

  MS.boot({ page: 'complaints', any: ['COMPLAINT_MANAGE'], ref: true }).then(() => {
    if (MS.param('status')) state.status = MS.param('status');
    chips();
    $('chips').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) { state.status = b.dataset.k; state.page = 1; chips(); load(); } });
    $('addBtn').addEventListener('click', add);
    $('search').addEventListener('input', MS.debounce(() => { state.q = $('search').value.trim(); state.page = 1; load(); }, 300));
    $('reloadBtn').addEventListener('click', load);
    $('listBody').addEventListener('click', (e) => { if (e.target.closest('a')) return; const tr = e.target.closest('[data-id]'); if (tr) openDetail(tr.dataset.id); });
    load();
    if (MS.param('id')) openDetail(MS.param('id'));
  });
})();
