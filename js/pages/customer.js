/* One customer: details, contacts, jobs and quotations (each opens its own page). */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const id = MS.param('id');
  let cust = null;

  function render(c) {
    cust = c;
    document.title = c.customer_name + ' · MS BMS';
    $('dTitle').innerHTML = esc(c.customer_name) + ' ' + MS.pill(c.status);
    $('dCrumbs').innerHTML = `<a href="customers/customers.html">Customers</a> › ${esc(c.customer_name)}`;
    $('dActions').innerHTML = [
      MS.can('QUOTATION_CREATE') && `<a class="btn primary" href="customers/quotation.html?new=1&customer=${encodeURIComponent(c.customer_id)}">New quotation</a>`,
      MS.can('JOB_CREATE') && `<a class="btn" href="jobs/job-new.html?customer=${encodeURIComponent(c.customer_id)}">New job</a>`,
      MS.can('CUSTOMER_EDIT') && '<button type="button" id="editBtn">Edit</button>'
    ].filter(Boolean).join('');
    const jobs = c.jobs || [], quotes = c.quotations || [], contacts = c.contacts || [];
    const open = jobs.filter((j) => ['CLOSED', 'CANCELLED', 'DELIVERED'].indexOf(j.status) < 0);
    $('dBody').innerHTML = `
      <div class="cards">
        <a class="card" href="#jobs"><div class="k">Jobs</div><div class="v">${jobs.length}</div><div class="s">${open.length} open</div></a>
        <a class="card" href="#quotes"><div class="k">Quotations</div><div class="v">${quotes.length}</div><div class="s">${quotes.filter((q) => q.status === 'SENT').length} waiting for an answer</div></a>
        ${c.balance_due !== undefined ? `<div class="card ${Number(c.balance_due) > 0 ? 'red' : 'green'}"><div class="k">Balance due</div><div class="v">${MS.money(c.balance_due)}</div><div class="s">&nbsp;</div></div>` : ''}
      </div>
      <div class="dgrid">
        <div class="dpanel"><h3>Details</h3>${MS.kv([['Number', c.customer_number], ['Type', MS.label(c.customer_type)], ['Phone', c.phone], ['Email', c.email],
          ['Address', c.address], ['TIN number', c.tin_number], ['Account manager', c.account_manager_name], ['Major client', c.is_major_client === true ? 'Yes' : '']])}</div>
        <div class="dpanel"><h3>Contacts ${MS.can('CUSTOMER_EDIT') ? '<button type="button" class="linkbtn" id="addContact">Add contact</button>' : ''}</h3>
          <div class="tablewrap"><table class="inv"><thead><tr><th>Name</th><th>Role</th><th>Phone</th><th>Approves designs</th></tr></thead><tbody>
          ${contacts.length ? contacts.map((x) => `<tr><td>${esc(x.contact_name)}${x.is_primary === true ? ' <span class="pill ok">Primary</span>' : ''}${x.email ? `<div class="sub">${esc(x.email)}</div>` : ''}</td><td>${esc(x.role_title || '')}</td><td>${esc(x.phone || '')}</td><td>${x.can_approve_designs === true ? 'Yes' : ''}</td></tr>`).join('') : '<tr><td colspan="4" class="empty">No contacts yet.</td></tr>'}
          </tbody></table></div></div>
        <div class="dpanel wide" id="jobs"><h3>Jobs</h3><div class="tablewrap"><table class="inv"><thead><tr><th>Job</th><th>Name</th><th>Status</th><th>Deadline</th></tr></thead><tbody id="jobRows">
          ${jobs.length ? jobs.map((j) => `<tr class="clk" data-href="jobs/job.html?id=${encodeURIComponent(j.job_id)}"><td><b>${MS.lnk('jobs/job.html?id=' + encodeURIComponent(j.job_id), j.job_number)}</b></td><td>${esc(j.job_name)}</td><td>${MS.pill(j.status)}</td><td>${esc(MS.when(j.customer_deadline))}</td></tr>`).join('') : '<tr><td colspan="4" class="empty">No jobs yet.</td></tr>'}
        </tbody></table></div></div>
        <div class="dpanel wide" id="quotes"><h3>Quotations</h3><div class="tablewrap"><table class="inv"><thead><tr><th>No.</th><th>Date</th><th class="num">Total</th><th>Status</th></tr></thead><tbody id="quoteRows">
          ${quotes.length ? quotes.map((q) => `<tr class="clk" data-href="customers/quotation.html?id=${encodeURIComponent(q.quotation_id)}"><td><b>${MS.lnk('customers/quotation.html?id=' + encodeURIComponent(q.quotation_id), q.quotation_number)}</b></td><td>${esc(MS.shortDate(q.quotation_date))}</td><td class="num">${MS.money(q.total_amount)}</td><td>${MS.pill(q.status)}</td></tr>`).join('') : '<tr><td colspan="4" class="empty">No quotations yet.</td></tr>'}
        </tbody></table></div></div>
      </div>`;
    MS.clickable($('jobRows'));
    MS.clickable($('quoteRows'));
    if ($('editBtn')) $('editBtn').addEventListener('click', async () => { if (await MS.customerForm(cust)) load(); });
    if ($('addContact')) $('addContact').addEventListener('click', addContact);
  }

  function addContact() {
    const f = $('contactForm');
    f.reset();
    $('contactError').textContent = '';
    const dlg = MS.openDialog('contactDialog');
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = MS.formData(f);
      if (!d.contact_name) { $('contactError').textContent = 'Enter the contact name.'; return; }
      MS.busy($('contactSave'), true, 'Saving…');
      try { await MS.call('CONTACT_SAVE', Object.assign(d, { customer_id: id })); dlg.close(); load(); } catch (err) { $('contactError').textContent = err.message; } finally { MS.busy($('contactSave'), false); }
    };
    $('contactCancel').onclick = () => dlg.close();
  }

  async function load() {
    MS.setMsg('dStatus', 'Loading…');
    try {
      const c = await MS.call('CUSTOMER_GET', { customer_id: id });
      MS.setMsg('dStatus', '');
      render(c);
    } catch (err) {
      MS.setMsg('dStatus', err.message, 'error');
      $('dBody').innerHTML = '<p><a class="lnk" href="customers/customers.html">Back to customers</a></p>';
    }
  }

  MS.boot({ page: 'customers', any: ['CUSTOMER_VIEW'], ref: true }).then(load);
})();
