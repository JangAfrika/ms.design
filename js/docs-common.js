(function () {
  const MS = window.MS;
  const { esc } = MS;
  const docs = (MS.docs = {});
  const SEND = { proforma: ['PROFORMA_EMAIL', 'quotation_id'], invoice: ['INVOICE_EMAIL', 'invoice_id'], receipt: ['RECEIPT_EMAIL', 'customer_payment_id'] };

  function dialog(id, html) {
    let d = document.getElementById(id);
    if (!d) { d = document.createElement('dialog'); d.id = id; document.body.appendChild(d); }
    d.innerHTML = html;
    if (!d.open) d.showModal();
    return d;
  }

  docs.pdf = async (kind, id, versionNo, btn) => {
    if (btn) MS.busy(btn, true, 'Preparing…');
    try {
      const r = await MS.call('DOC_PDF_GET', { kind, id, version_no: versionNo });
      if (r.fallback === 'HTML') return docs.printFallback(r);
      const bin = atob(r.base64), arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([arr], { type: r.mime_type }));
      const a = document.createElement('a');
      a.href = url; a.download = r.file_name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) { MS.alert(err.message); } finally { if (btn) MS.busy(btn, false); }
  };

  docs.printFallback = (r) => {
    const d = dialog('docPreview', `<div class="dlg doc-dlg"><h3>${esc(r.file_name || 'Document')}</h3><div class="notice-bar">${esc(r.message || 'The PDF could not be made. Print this page and choose "Save as PDF".')}</div>${docs.frame(r.html)}
      <div class="btns"><button type="button" id="dpClose">Close</button><button type="button" class="primary" id="dpPrint">Print or save as PDF</button></div></div>`);
    d.classList.add('fin-wide');
    d.querySelector('#dpClose').onclick = () => d.close();
    d.querySelector('#dpPrint').onclick = () => { const f = d.querySelector('iframe'); try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { window.print(); } };
  };

  docs.frame = (html) => `<iframe class="doc-frame" sandbox="allow-same-origin allow-modals" title="Document" srcdoc="${esc(html)}"></iframe>`;

  docs.preview = async (kind, id, versionNo) => {
    const d = dialog('docPreview', '<div class="dlg doc-dlg"><p class="fin-note">Loading…</p></div>');
    d.classList.add('fin-wide');
    try {
      const r = await MS.call('DOC_HTML_GET', { kind, id, version_no: versionNo });
      d.innerHTML = `<div class="dlg doc-dlg"><h3>${esc(r.label)}${r.is_draft ? ' (draft preview)' : ''}</h3>${docs.frame(r.html)}
        <div class="btns"><button type="button" id="dpClose">Close</button><button type="button" id="dpPdf">Download PDF</button><button type="button" class="primary" id="dpPrint">Print</button></div></div>`;
      d.querySelector('#dpClose').onclick = () => d.close();
      d.querySelector('#dpPdf').onclick = (e) => docs.pdf(kind, id, versionNo, e.currentTarget);
      d.querySelector('#dpPrint').onclick = () => { const f = d.querySelector('iframe'); try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { window.print(); } };
    } catch (err) { d.innerHTML = `<div class="dlg"><div class="err">${esc(err.message)}</div><div class="btns"><button type="button" id="dpClose">Close</button></div></div>`; d.querySelector('#dpClose').onclick = () => d.close(); }
  };

  docs.send = async (kind, id, onDone) => {
    let p;
    try { p = await MS.call('DOC_SEND_PREPARE', { kind, id }); } catch (err) { return MS.alert(err.message); }
    const contacts = (p.contacts || []).map((c) => `<option value="${esc(c.email)}">${esc(c.name)}${c.role ? ' (' + esc(c.role) + ')' : ''}</option>`).join('');
    const d = dialog('docSend', `<form class="dlg" id="dsForm" novalidate>
      <h3>Send ${esc(p.doc_label)} to ${esc(p.customer_name)}</h3>
      ${p.email_enabled ? '' : '<div class="notice-bar">Email is switched off in the system settings, so nothing will be emailed. The document is still saved' + (p.includes_link ? ' and the approval link is shown so you can pass it on yourself' : '') + '.</div>'}
      <label class="req">To (customer email) <input id="dsTo" type="email" value="${esc(p.to)}" maxlength="120" autocomplete="off" placeholder="customer@example.com"></label>
      ${contacts ? `<label>Or choose a contact <select id="dsContact"><option value="">— choose —</option>${contacts}</select></label>` : ''}
      <label class="req">Subject <input id="dsSubject" type="text" value="${esc(p.subject)}" maxlength="200"></label>
      ${kind === 'proforma' && (p.history || []).length ? '<label>What changed in this version <span class="opt">(kept in the revision list)</span> <input id="dsChange" type="text" maxlength="300" placeholder="For example: banners now 3"></label>' : ''}
      <label>Message <textarea id="dsMessage" rows="9" maxlength="3000">${esc(p.message)}</textarea></label>
      <div class="info">Attached: <b>${esc(p.attachment)}</b>${p.includes_link ? '. The customer approval link is added to the email.' : '.'}<br>
        Shown to the customer as <b>${esc(p.sender_name)}</b>${p.from_alias ? ' &lt;' + esc(p.from_alias) + '&gt;' : ''}; replies go to <b>${esc(p.reply_to || 'the Google account that owns the system')}</b>.</div>
      ${(p.history || []).length ? `<div class="fin-note">Sent before: ${p.history.slice(0, 3).map((h) => esc(MS.when(h.created_at)) + ' to ' + esc(h.to_email) + ' by ' + esc(h.sent_by_name)).join('; ')}</div>` : ''}
      <div class="err" id="dsError"></div>
      <div class="btns"><button type="button" id="dsCancel">Cancel</button><button type="submit" class="primary" id="dsSend">Send to customer</button></div></form>`);
    d.classList.remove('fin-wide');
    const q = (s) => d.querySelector(s);
    if (q('#dsContact')) q('#dsContact').onchange = () => { if (q('#dsContact').value) q('#dsTo').value = q('#dsContact').value; };
    q('#dsCancel').onclick = () => d.close();
    q('#dsForm').onsubmit = async (e) => {
      e.preventDefault();
      if (!q('#dsTo').value.trim()) { q('#dsError').textContent = 'Enter the customer\'s email address.'; return; }
      const payload = { to: q('#dsTo').value.trim(), subject: q('#dsSubject').value.trim(), message: q('#dsMessage').value };
      if (q('#dsChange') && q('#dsChange').value.trim()) payload.change_note = q('#dsChange').value.trim();
      payload[SEND[kind][1]] = id;
      MS.busy(q('#dsSend'), true, 'Sending…');
      try {
        const r = await MS.call(SEND[kind][0], payload);
        const s = r.send_result || {};
        const sent = s.delivery !== 'NOT_SENT';
        d.innerHTML = `<div class="dlg"><h3>${sent ? 'Sent' : 'Saved, not emailed'}</h3>
          <p>${sent ? esc(s.doc_label || p.doc_label) + ' was emailed to ' + esc(s.to) + '.' : esc(s.doc_label || p.doc_label) + ' is saved, but it was not emailed because email is switched off.'}</p>
          <div class="btns"><button type="button" class="primary" id="dsOk">OK</button></div></div>`;
        d.querySelector('#dsOk').onclick = () => d.close();
        if (onDone) onDone(r);
      } catch (err) { q('#dsError').textContent = err.message; MS.busy(q('#dsSend'), false); }
    };
  };
})();
