/* The add / edit customer dialog, shared by the list, the customer page and the proforma invoice form.
   MS.customerForm(customer or null, {title, name}) resolves to the saved customer, or null when cancelled.
   The dialog is built here, so every page shows the same friendly form. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;

  const TYPES = [['BUSINESS', 'Business / company'], ['INDIVIDUAL', 'Individual'], ['GOVERNMENT', 'Government'], ['NGO', 'NGO / charity'], ['OTHER', 'Other']];
  const BUSINESS_TYPES = ['Printing agent', 'Bank', 'School', 'Church / mosque', 'NGO', 'Government office', 'Retail shop', 'Restaurant / hotel', 'Individual', 'Other'];
  const HEARD = ['Referral from a friend', 'Walk-in', 'Facebook', 'Instagram', 'WhatsApp', 'Google search', 'Signboard / banner', 'Existing customer', 'Other'];
  const CONTACT = [['PHONE', 'Phone call'], ['WHATSAPP', 'WhatsApp'], ['EMAIL', 'Email'], ['SMS', 'Text message'], ['IN_PERSON', 'Visit us']];
  const PHONE_RE = /^\+?[0-9 ()\-]{7,20}$/, EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const NAME_LABEL = { BUSINESS: 'Business name', GOVERNMENT: 'Name of the office or ministry', NGO: 'Name of the organisation', OTHER: 'Name of the organisation', SCHOOL: 'Name of the school' };

  const html = () => `
    <form class="dlg" id="custForm" novalidate>
      <h3 id="custTitle">Add a customer</h3>
      <div class="info" id="custIntro">Tell us a bit about the customer. Only the name and one way to reach them are needed; the rest helps us serve them better next time.</div>

      <section class="fsec">
        <h4><span class="num">1</span> Who is the customer?</h4>
        <p class="fhelp">A business, an organisation or a person buying for themselves.</p>
        <div class="fgrid">
          <label class="req full">Customer type
            <select name="customer_type" id="cType"></select>
          </label>
          <label class="req full" id="cNameBox"><span id="cNameLabel">Business name</span>
            <input name="business_name" id="cBusiness" type="text" maxlength="120" autocomplete="organization" placeholder="e.g. Jallow Printing Agency">
          </label>
          <label class="full" id="cKindBox">Type of business <span class="fopt">(what do they do?)</span>
            <input name="business_type" id="cKind" type="text" maxlength="80" list="cKindList" placeholder="Pick one below or type your own">
            <datalist id="cKindList">${BUSINESS_TYPES.map((b) => `<option value="${esc(b)}">`).join('')}</datalist>
          </label>
          <div class="suggest full" id="cKindChips" role="group" aria-label="Common kinds of business">${BUSINESS_TYPES.map((b) => `<button type="button" data-kind="${esc(b)}">${esc(b)}</button>`).join('')}</div>
        </div>
      </section>

      <section class="fsec">
        <h4><span class="num">2</span> Who do we speak to?</h4>
        <p class="fhelp">The person who orders, approves proformas or collects the work.</p>
        <div class="fgrid">
          <label class="req" id="cPersonBox"><span id="cPersonLabel">Contact person</span>
            <input name="contact_person" id="cPerson" type="text" maxlength="120" autocomplete="name" placeholder="e.g. Fatou Jallow">
          </label>
          <label id="cTitleBox">Their position <span class="fopt">(optional)</span>
            <input name="contact_title" type="text" maxlength="80" placeholder="e.g. Procurement Officer">
          </label>
        </div>
      </section>

      <section class="fsec">
        <h4><span class="num">3</span> How can we reach them?</h4>
        <p class="fhelp">Give at least a phone number, a WhatsApp number or an email. The proforma link is sent to the email.</p>
        <div class="fgrid">
          <label>Phone <input name="phone" type="tel" maxlength="20" autocomplete="tel" inputmode="tel" placeholder="+220 700 1234"></label>
          <label>Second phone <span class="fopt">(optional)</span><input name="phone_secondary" type="tel" maxlength="20" inputmode="tel" placeholder="+220 …"></label>
          <label>WhatsApp number <span class="fopt">(if different)</span><input name="whatsapp" type="tel" maxlength="20" inputmode="tel" placeholder="+220 …"></label>
          <label>Preferred way to contact <select name="preferred_contact" id="cPref"></select></label>
          <label>Email <input name="email" type="email" maxlength="120" autocomplete="email" placeholder="name@company.com"></label>
          <label>Second email <span class="fopt">(optional)</span><input name="email_secondary" type="email" maxlength="120" placeholder="accounts@company.com"></label>
        </div>
      </section>

      <section class="fsec">
        <h4><span class="num">4</span> Where are they?</h4>
        <div class="fgrid">
          <label class="full">Street / area <input name="address" type="text" maxlength="200" autocomplete="street-address" placeholder="e.g. Kairaba Avenue, next to the bank"></label>
          <label>Town / city <input name="city" type="text" maxlength="80" autocomplete="address-level2" placeholder="e.g. Serrekunda"></label>
          <label>Country <input name="country" type="text" maxlength="80" autocomplete="country-name" value="The Gambia"></label>
        </div>
      </section>

      <section class="fsec">
        <h4><span class="num">5</span> Our relationship</h4>
        <div class="note-ok" id="cReturnAuto" hidden></div>
        <div class="fgrid">
          <label>Returning customer?
            <select name="is_returning" id="cReturning"><option value="">Not sure / first time</option><option value="yes">Yes, bought from us before</option><option value="no">No, a new customer</option></select>
            <span class="fhelp">Choose Yes for customers who bought before the system. Customers with jobs here show as returning by themselves.</span>
          </label>
          <label>How did they hear about us? <input name="heard_about_us" type="text" maxlength="80" list="cHeardList" placeholder="e.g. Referral, Facebook">
            <datalist id="cHeardList">${HEARD.map((h) => `<option value="${esc(h)}">`).join('')}</datalist>
          </label>
          <label>Account manager <select name="account_manager_id" id="cManager"></select><span class="fhelp">Follows up proformas and jobs for this customer.</span></label>
          <label class="check"><input name="is_major_client" type="checkbox"> Major client (on the CEO's focus list)</label>
        </div>
      </section>

      <section class="fsec">
        <h4><span class="num">6</span> Tax, credit and notes</h4>
        <div class="fgrid">
          <label>TIN number <span class="fopt">(optional)</span><input name="tin_number" type="text" maxlength="40" placeholder="GRA tax number"></label>
          <label>VAT number <span class="fopt">(optional)</span><input name="vat_number" type="text" maxlength="40"></label>
          <label id="cLimitBox">Credit limit <input name="credit_limit" type="number" min="0" step="0.01" placeholder="0 = no credit"></label>
          <label id="cDaysBox">Pays within (days) <input name="payment_terms_days" type="number" min="0" step="1" placeholder="0 = cash / deposit"></label>
          <label class="full">Credit terms, in words <span class="fopt">(optional)</span><input name="credit_notes" type="text" maxlength="200" placeholder="e.g. 50% deposit, balance on delivery"></label>
          <label class="full">Anything else we should remember <span class="fopt">(optional)</span><textarea name="notes" rows="3" maxlength="1000" placeholder="e.g. Collects jobs on Fridays. Prefers invoices by email."></textarea></label>
        </div>
      </section>
      <div class="err" id="custError"></div>
      <div class="btns">
        <button type="button" id="custCancel">Cancel</button>
        <button type="submit" class="primary" id="custSave">Save customer</button>
      </div>
    </form>`;

  function ensureDialog() {
    let d = $('custDialog');
    if (!d) { d = document.createElement('dialog'); d.id = 'custDialog'; document.body.appendChild(d); }
    d.className = 'dlg-wide';
    delete d.dataset.fdone;
    d.innerHTML = html();
    return d;
  }

  /* the labels follow the customer type: a person has a full name, an organisation a business name */
  function applyType(f) {
    const t = f.elements.customer_type.value, person = t === 'INDIVIDUAL';
    ['cNameBox', 'cKindBox', 'cKindChips', 'cTitleBox'].forEach((id) => { $(id).hidden = person; });
    $('cBusiness').required = !person;
    $('cPerson').required = person;
    $('cNameLabel').textContent = NAME_LABEL[t] || 'Business name';
    $('cPersonLabel').textContent = person ? 'Full name' : 'Contact person';
    $('cPerson').placeholder = person ? 'e.g. Ousman Ceesay' : 'e.g. Fatou Jallow';
    $('cPersonBox').classList.toggle('req', person);
    $('cNameBox').classList.toggle('req', !person);
    ['cNameBox', 'cPersonBox'].forEach((id) => { delete $(id).dataset.rq; });   // the labels were rewritten: draw their stars again
    if (MS.stars) MS.stars($('custForm'));
  }

  MS.customerForm = function (c, opts) {
    c = c || {};
    opts = opts || {};
    const dlg = ensureDialog();
    const f = $('custForm');
    const editing = !!c.customer_id;
    $('custTitle').textContent = editing ? 'Edit customer' : (opts.title || 'Add a customer');
    if (editing) $('custIntro').textContent = 'Update what we know about ' + (c.customer_name || 'this customer') + '. The changes show on new documents.';
    const types = TYPES.slice();
    if (c.customer_type === 'SCHOOL') types.push(['SCHOOL', 'School']);
    $('cType').innerHTML = MS.options(types.map((t) => ({ value: t[0], label: t[1] })), c.customer_type || 'BUSINESS');
    $('cPref').innerHTML = MS.options(CONTACT.map((t) => ({ value: t[0], label: t[1] })), c.preferred_contact || '', '— no preference —');
    if (MS.refCache) $('cManager').innerHTML = MS.employeeOptions(c.account_manager_id); else $('cManager').closest('label').hidden = true;
    ['business_name', 'business_type', 'contact_person', 'contact_title', 'phone', 'phone_secondary', 'whatsapp', 'email', 'email_secondary', 'address', 'city',
      'heard_about_us', 'tin_number', 'vat_number', 'credit_notes', 'notes'].forEach((k) => { f.elements[k].value = c[k] || ''; });
    if (editing && !c.business_name && c.customer_type !== 'INDIVIDUAL') f.elements.business_name.value = c.customer_name || '';
    if (editing && !c.contact_person && c.customer_type === 'INDIVIDUAL') f.elements.contact_person.value = c.customer_name || '';
    if (opts.name && !editing) f.elements.business_name.value = opts.name;
    f.elements.country.value = c.country || 'The Gambia';
    f.elements.is_major_client.checked = c.is_major_client === true;
    f.elements.is_returning.value = c.is_returning === true ? 'yes' : (c.is_returning === false ? 'no' : '');
    const canCredit = MS.can('FINANCE_APPROVE');
    $('cLimitBox').hidden = !canCredit;
    $('cDaysBox').hidden = !canCredit;
    f.elements.credit_limit.value = c.credit_limit || '';
    f.elements.payment_terms_days.value = c.payment_terms_days || '';
    $('cReturnAuto').hidden = !(editing && c.previous_jobs > 0);
    if (editing && c.previous_jobs > 0) $('cReturnAuto').textContent = c.returning_label + ' (counted by the system from the jobs on file).';
    $('custError').textContent = '';
    applyType(f);
    f.elements.customer_type.addEventListener('change', () => applyType(f));
    $('cKindChips').addEventListener('click', (e) => { const b = e.target.closest('[data-kind]'); if (b) { f.elements.business_type.value = b.dataset.kind; f.elements.business_type.focus(); } });
    MS.openDialog('custDialog');
    return new Promise((resolve) => {
      let saved = null;
      const save = async (confirmDup) => {
        MS.clearFieldErrors(f);
        $('custError').textContent = '';
        const d = MS.formData(f);
        const person = d.customer_type === 'INDIVIDUAL';
        const bad = {};
        if (person && !d.contact_person) bad.contact_person = 'Enter the customer\'s full name.';
        if (!person && !d.business_name) bad.business_name = d.customer_type === 'BUSINESS' ? 'Enter the business name.' : 'Enter the name.';
        if (!d.phone && !d.email && !d.whatsapp) bad.phone = 'Give a phone number, a WhatsApp number or an email.';
        ['phone', 'phone_secondary', 'whatsapp'].forEach((k) => { if (d[k] && !PHONE_RE.test(d[k])) bad[k] = 'Use digits only, for example +220 700 1234.'; });
        ['email', 'email_secondary'].forEach((k) => { if (d[k] && !EMAIL_RE.test(d[k])) bad[k] = 'This does not look like an email address.'; });
        if (Object.keys(bad).length) { MS.fieldErrors(f, bad); $('custError').textContent = 'Please fix the highlighted fields.'; return; }
        d.customer_name = person ? d.contact_person : d.business_name;
        if (person) { d.business_name = ''; d.business_type = d.business_type || 'Individual'; d.contact_title = ''; }
        d.is_returning = d.is_returning === 'yes' ? true : (d.is_returning === 'no' ? false : '');
        if (!canCredit) { delete d.credit_limit; delete d.payment_terms_days; } else {
          d.credit_limit = d.credit_limit === '' ? 0 : d.credit_limit;
          d.payment_terms_days = d.payment_terms_days === '' ? 0 : d.payment_terms_days;
        }
        if (!MS.refCache) delete d.account_manager_id;
        if (c.customer_id) d.customer_id = c.customer_id;
        if (confirmDup) d.confirm_duplicate = true;
        MS.busy($('custSave'), true, 'Saving…');
        try {
          saved = await MS.call(c.customer_id ? 'CUSTOMER_UPDATE' : 'CUSTOMER_CREATE', d);
          dlg.close();
        } catch (err) {
          if (err.code === 'POSSIBLE_DUPLICATE') {
            MS.busy($('custSave'), false);
            if (await MS.confirm({ title: 'This customer may already exist', message: err.message.split('. Send')[0] + '.', detail: 'If this is a different customer, you can still save it.', confirmText: 'Save anyway', cancelText: 'Go back' })) return save(true);
            return;
          }
          const field = err.details && err.details.field;
          if (field && f.elements[field]) MS.fieldErrors(f, { [field]: err.message }); else $('custError').textContent = err.message;
        } finally { MS.busy($('custSave'), false); }
      };
      const onSubmit = (e) => { e.preventDefault(); save(false); };
      f.addEventListener('submit', onSubmit);
      $('custCancel').addEventListener('click', () => dlg.close());
      dlg.addEventListener('close', function done() {
        dlg.removeEventListener('close', done);
        resolve(saved);
      });
    });
  };
})();
