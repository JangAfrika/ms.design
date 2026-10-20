/* The add / edit customer dialog, shared by the list and the customer page.
   MS.customerForm(customer or null) resolves to the saved customer, or null when cancelled. */
(function () {
  const MS = window.MS;
  const { $ } = MS;
  MS.customerForm = function (c) {
    c = c || {};
    const f = $('custForm');
    f.reset();
    $('custTitle').textContent = c.customer_id ? 'Edit customer' : 'Add customer';
    $('cType').innerHTML = MS.options(MS.enumOf('customers.customer_type'), c.customer_type || 'BUSINESS');
    $('cManager').innerHTML = MS.employeeOptions(c.account_manager_id);
    ['customer_name', 'phone', 'email', 'address', 'tin_number'].forEach((k) => { f.elements[k].value = c[k] || ''; });
    f.elements.is_major_client.checked = c.is_major_client === true;
    $('custError').textContent = '';
    const dlg = MS.openDialog('custDialog');
    return new Promise((resolve) => {
      let saved = null;
      const save = async (confirmDup) => {
        const d = MS.formData(f);
        if (!d.customer_name) { $('custError').textContent = 'Enter the customer name.'; return; }
        if (c.customer_id) d.customer_id = c.customer_id;
        if (confirmDup) d.confirm_duplicate = true;
        MS.busy($('custSave'), true, 'Saving…');
        try {
          saved = await MS.call(c.customer_id ? 'CUSTOMER_UPDATE' : 'CUSTOMER_CREATE', d);
          dlg.close();
        } catch (err) {
          if (err.code === 'POSSIBLE_DUPLICATE' && await MS.confirm({ title: 'This customer may already exist', message: err.message.split('. Send')[0] + '.', confirmText: 'Create anyway' })) {
            MS.busy($('custSave'), false);
            return save(true);
          }
          $('custError').textContent = err.message;
        } finally { MS.busy($('custSave'), false); }
      };
      const onSubmit = (e) => { e.preventDefault(); save(false); };
      const onCancel = () => dlg.close();
      f.addEventListener('submit', onSubmit);
      $('custCancel').addEventListener('click', onCancel);
      dlg.addEventListener('close', function done() {
        f.removeEventListener('submit', onSubmit);
        $('custCancel').removeEventListener('click', onCancel);
        dlg.removeEventListener('close', done);
        resolve(saved);
      });
    });
  };
})();
