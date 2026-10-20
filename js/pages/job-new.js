/* New job: a walk-in job (makes and accepts its own quotation) or a job from an accepted quotation (?quotation=).
   ?customer= preselects the customer. On save the job's Work Sheet opens.
   Priority: choosing Emergency asks for a reason and sends a request to the CEO / GM; the box lists the jobs it would push back. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const quotationId = MS.param('quotation');
  let quote = null;

  const sections = () => ((MS.refCache && MS.refCache.stage_types) || []).filter((s) => s.stage_kind === 'PRODUCTION_SECTION')
    .sort((a, b) => a.sequence_no - b.sequence_no);

  async function setup() {
    const f = $('jobForm');
    if (quotationId) {
      quote = await MS.call('QUOTATION_GET', { quotation_id: quotationId });
      $('pTitle').textContent = 'Create job from quotation';
      $('crumbHere').textContent = 'Job from ' + quote.quotation_number;
      $('walkIn').hidden = true;
      $('fromQuote').hidden = false;
      $('fromQuote').innerHTML = `Quotation <b>${esc(quote.quotation_number)}</b> for <b>${esc(quote.customer_name || '')}</b> · ${esc(MS.money(quote.total_amount))}`;
    } else {
      const r = await MS.call('CUSTOMER_LIST', { page_size: 100, sort: 'customer_name', dir: 'asc' });
      const pre = MS.param('customer');
      const rows = r.rows.slice();
      if (pre && !rows.some((c) => c.customer_id === pre)) {
        try { const c = await MS.call('CUSTOMER_GET', { customer_id: pre }); rows.unshift(c); } catch (e) { /* not visible: leave unselected */ }
      }
      $('fCustomer').innerHTML = MS.options(rows.map((c) => ({ value: c.customer_id, label: c.customer_name + (c.customer_number ? ' (' + c.customer_number + ')' : '') })), pre, '— choose customer —');
    }
    $('fPriority').innerHTML = MS.options(MS.enumOf('jobs.priority'), 'NORMAL');
    $('fPM').innerHTML = MS.employeesIn(['PRODUCTION_MANAGER']);
    $('fSPO').innerHTML = MS.employeesIn(['SENIOR_PRODUCTION_OFFICER'], '', '— later —');
    $('fDesigner').innerHTML = MS.employeesIn(['GRAPHIC_DESIGNER', 'HEAD_OF_GRAPHIC_DESIGN'], '', '— later / no design —');
    $('fSales').innerHTML = MS.employeesIn(['SALES_OFFICER'], '', '— me / none —');
    $('fLocs').innerHTML = sections().map((s) => `<label class="loc check"><input type="checkbox" class="locbox" value="${esc(s.stage_code)}"> ${esc(s.stage_name)}</label>`).join('') ||
      '<p class="empty">No Job Locations are set up yet.</p>';
    f.hidden = false;
    f.addEventListener('submit', save);
    const refresh = MS.debounce(emergencyPreview, 300);
    $('fPriority').addEventListener('change', () => { $('emBox').hidden = $('fPriority').value !== 'EMERGENCY'; refresh(); });
    $('fLocs').addEventListener('change', refresh);
    f.elements.customer_deadline.addEventListener('change', refresh);
  }

  // which open jobs share the ticked Job Locations around this deadline (only while Emergency is chosen)
  async function emergencyPreview() {
    if ($('fPriority').value !== 'EMERGENCY') return;
    const f = $('jobForm');
    const codes = Array.from(f.querySelectorAll('.locbox:checked')).map((i) => i.value);
    const dl = f.elements.customer_deadline.value;
    if (!codes.length || !dl) { $('emImpact').innerHTML = '<p class="sub">Tick the Job Locations and set the deadline to see which jobs would be pushed back.</p>'; return; }
    try {
      const imp = await MS.call('JOB_PRIORITY_IMPACT', { stage_codes: codes, customer_deadline: MS.fromLocalInput(dl) });
      const rows = imp.delayed_jobs || [];
      $('emImpact').innerHTML = `<p class="impact-head"><b>${rows.length ? rows.length + ' open job' + (rows.length === 1 ? '' : 's') + ' would be pushed back' : 'No other open job would be pushed back'}</b> <span class="sub">${esc(imp.rule || '')}</span></p>` +
        (rows.length ? `<div class="tablewrap"><table class="inv"><thead><tr><th>Job</th><th>Name</th><th>Customer</th><th>Deadline</th><th>Priority</th></tr></thead><tbody>${rows.map((d) =>
          `<tr><td><b>${esc(d.job_number)}</b></td><td class="wrap">${esc(d.job_name)}</td><td>${esc(d.customer_name || '')}</td><td>${esc(MS.when(d.customer_deadline))}</td><td>${esc(MS.label(d.priority))}</td></tr>`).join('')}</tbody></table></div>` : '');
    } catch (err) { $('emImpact').innerHTML = `<p class="err">${esc(err.message)}</p>`; }
  }

  async function save(e) {
    e.preventDefault();
    const f = $('jobForm');
    const d = MS.formData(f);
    const err = (m) => { $('fErr').textContent = m; };
    if (!quotationId && !d.customer_id) return err('Choose the customer.');
    if (!quotationId && !d.q_description) return err('Say what the work is.');
    if (!d.job_name) return err('Enter the job name.');
    if (!d.customer_deadline) return err('Enter the customer deadline.');
    if (MS.isoOf(new Date(d.customer_deadline)) < MS.todayISO()) return err('The customer deadline is in the past.');
    if (d.priority === 'EMERGENCY' && !d.emergency_reason) return err('Say why this job is an emergency.');
    err('');
    const payload = {
      job_name: d.job_name, customer_deadline: d.customer_deadline, priority: d.priority,
      emergency_reason: d.priority === 'EMERGENCY' ? d.emergency_reason : '',
      stage_codes: Array.from(f.querySelectorAll('.locbox:checked')).map((i) => i.value),
      production_manager_id: d.production_manager_id, senior_production_officer_id: d.senior_production_officer_id,
      responsible_designer_id: d.responsible_designer_id, sales_officer_id: d.sales_officer_id
    };
    if (quotationId) payload.quotation_id = quotationId;
    else {
      payload.quick = { customer_id: d.customer_id, deposit_required_pct: d.q_deposit,
        items: [{ description: d.q_description, quantity: d.q_quantity === '' ? 1 : d.q_quantity, unit_price: d.q_unit_price || 0 }] };
    }
    MS.busy($('fSave'), true, 'Creating…');
    try {
      const j = await MS.call('JOB_CREATE', payload);
      location.href = 'jobs/job.html?id=' + encodeURIComponent(j.job_id);
    } catch (ex) {
      err(ex.message);
      MS.busy($('fSave'), false);
    }
  }

  MS.boot({ page: 'job-new', any: ['JOB_CREATE'], ref: true }).then(() => setup().catch((err) => MS.setMsg('pMsg', err.message, 'error')));
})();
