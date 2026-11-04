(function () {
  const MS = window.MS;
  const { esc } = MS;
  const TYPES = ['PRINT_QUALITY', 'DESIGN_ERROR', 'WRONG_QUANTITY', 'LATE_DELIVERY', 'DAMAGE', 'PRICING', 'SERVICE', 'OTHER'];
  const SEVERITY = [['MINOR', 'Minor · answer within 24 hours'], ['NORMAL', 'Normal · within 48 hours'], ['COMPLEX', 'Complex · within 72 hours']];

  // Resolves with the saved complaint, or null when cancelled. opts.customer = { customer_id, customer_name } fixes the customer.
  MS.complaintForm = function (opts) {
    opts = opts || {};
    const dlg = document.createElement('dialog');
    dlg.innerHTML = `<form class="dlg" novalidate>
      <h3>New complaint</h3>
      <p class="info">The General Manager is told at once. Pick how serious it is and the due time is set for you.</p>
      ${opts.customer ? `<input type="hidden" name="customer_id" value="${esc(opts.customer.customer_id)}"><p><b>${esc(opts.customer.customer_name)}</b></p>` : `
      <label class="req">Customer <input type="search" id="cfFind" placeholder="Type a name or phone to find the customer" autocomplete="off"></label>
      <label class="req">Pick the customer <select name="customer_id" id="cfCustomer"><option value="">Type above to find a customer</option></select></label>`}
      <label>Job <select name="job_id" id="cfJob"><option value="">Not about one job</option></select></label>
      <div class="two">
        <label class="req">About <select name="complaint_type">${MS.options(TYPES, 'OTHER')}</select></label>
        <label class="req">Severity <select name="severity">${SEVERITY.map((s) => `<option value="${s[0]}"${s[0] === 'NORMAL' ? ' selected' : ''}>${esc(s[1])}</option>`).join('')}</select></label>
      </div>
      <label class="req">What happened <textarea name="description" rows="4" maxlength="2000" placeholder="What the customer said, in a few lines"></textarea></label>
      <div class="err" id="cfError"></div>
      <div class="btns"><button type="button" id="cfCancel">Cancel</button><button type="submit" class="primary" id="cfSave">Save complaint</button></div>
    </form>`;
    document.body.appendChild(dlg);
    const f = dlg.querySelector('form'), err = dlg.querySelector('#cfError'), jobSel = dlg.querySelector('#cfJob');
    const loadJobs = async (cid) => {
      jobSel.innerHTML = '<option value="">Not about one job</option>';
      if (!cid) return;
      try {
        const c = await MS.call('CUSTOMER_GET', { customer_id: cid });
        jobSel.innerHTML = '<option value="">Not about one job</option>' + (c.jobs || []).map((j) => `<option value="${esc(j.job_id)}">${esc(j.job_number)} · ${esc(j.job_name)}</option>`).join('');
      } catch (e) { /* the job is optional */ }
    };
    if (opts.customer) loadJobs(opts.customer.customer_id);
    else {
      const sel = dlg.querySelector('#cfCustomer');
      dlg.querySelector('#cfFind').addEventListener('input', MS.debounce(async (e) => {
        const q = e.target.value.trim();
        if (q.length < 2) return;
        try {
          const r = await MS.call('CUSTOMER_LIST', { page: 1, page_size: 30, search: q, sort: 'customer_name', dir: 'asc' });
          sel.innerHTML = r.rows.length ? r.rows.map((c) => `<option value="${esc(c.customer_id)}">${esc(c.customer_name)}${c.phone ? ' · ' + esc(c.phone) : ''}</option>`).join('') : '<option value="">No customer matches</option>';
          loadJobs(sel.value);
        } catch (x) { err.textContent = x.message; }
      }, 300));
      sel.addEventListener('change', () => loadJobs(sel.value));
    }
    dlg.showModal();
    return new Promise((resolve) => {
      const close = (v) => { dlg.close(); dlg.remove(); resolve(v); };
      dlg.querySelector('#cfCancel').onclick = () => close(null);
      dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(null); });
      f.onsubmit = async (e) => {
        e.preventDefault();
        const d = MS.formData(f);
        if (!d.customer_id) { err.textContent = 'Choose the customer.'; return; }
        if (String(d.description || '').length < 3) { err.textContent = 'Describe what happened.'; return; }
        MS.busy(dlg.querySelector('#cfSave'), true, 'Saving…');
        try { close(await MS.call('COMPLAINT_SAVE', d)); } catch (x) { err.textContent = x.message; MS.busy(dlg.querySelector('#cfSave'), false); }
      };
    });
  };
})();
