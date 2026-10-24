/* The customer's page: opened from the link in the email, no sign-in. Talks to the public actions only (PUBLIC_DOC_*).
   Everything that comes from the server is put on the page with textContent; the document itself is shown in a sandboxed frame
   (no scripts can run in it). The secret in the link is sent in the request body and removed from the address bar after loading. */
(function () {
  'use strict';
  var cfg = window.APP_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var token = '';
  try { token = new URLSearchParams(location.search).get('t') || ''; } catch (e) { token = ''; }
  try { if (token && history.replaceState) history.replaceState(null, '', location.pathname); } catch (e) { /* the secret just stays in the address */ }

  var logo = document.querySelector('[data-app-logo]'), mark = document.querySelector('[data-app-mark]');
  if (cfg.APP_LOGO) { logo.src = cfg.APP_LOGO; logo.onerror = function () { logo.hidden = true; mark.hidden = false; }; } else { logo.hidden = true; mark.hidden = false; }

  function call(action, payload) {
    var url = cfg.SCRIPT_URL;
    if (!url) return Promise.reject({ code: 'NOT_CONFIGURED', message: 'This page is not set up yet.' });
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: action, request_id: String(Date.now()) + Math.random().toString(36).slice(2), payload: payload }) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || res.success !== true) throw { code: (res && res.error_code) || 'ERROR', message: (res && res.message) || 'Something went wrong.' };
        return res.data;
      }, function () { throw { code: 'NETWORK', message: 'Could not reach the server. Check your connection and try again.' }; });
  }

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function show(id, on) { $(id).hidden = !on; }
  function dateText(iso) {
    var m = /^(\d{4})-(\d\d)-(\d\d)/.exec(String(iso || '')); if (!m) return '';
    return m[3] + '-' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m[2] - 1] + '-' + m[1];
  }

  function message(icon, title, lines, quote) {
    var c = $('stateCard'); c.textContent = '';
    var box = el('div', 'rp-msg');
    box.appendChild(el('div', 'big', icon)); box.appendChild(el('h2', '', title));
    lines.forEach(function (l) { if (l) box.appendChild(el('p', '', l)); });
    if (quote) box.appendChild(el('div', 'rp-quote', quote));
    c.appendChild(box); show('stateCard', true);
  }

  function company(co) {
    if (!co) return;
    $('coName').textContent = co.name || 'MS Designs & Printing';
    var f = $('coFoot'); f.textContent = '';
    f.appendChild(el('div', '', co.name || ''));
    if (co.phone) f.appendChild(el('div', '', 'Mob: ' + co.phone));
    if (co.emails && co.emails.length) f.appendChild(el('div', '', co.emails.join(' / ')));
  }

  /* The document is laid out for paper; on a phone it is shrunk to fit the width (and shown at full height) instead of being cut off. */
  function fitDoc() {
    var f = $('docFrame'), box = $('docBox'), doc;
    try { doc = f.contentDocument; } catch (e) { return; }
    if (!doc || !doc.documentElement) return;
    f.style.transform = ''; f.style.width = '100%'; f.style.height = '200px';
    var w = Math.max(doc.documentElement.scrollWidth, 320), h = doc.documentElement.scrollHeight;
    var scale = Math.min(1, box.clientWidth / w);
    f.style.width = w + 'px'; f.style.height = h + 'px';
    f.style.transform = scale < 1 ? 'scale(' + scale + ')' : '';
    box.style.height = Math.ceil(h * scale) + 'px';
  }
  $('docFrame').addEventListener('load', fitDoc);
  window.addEventListener('resize', fitDoc);

  function render(d) {
    company(d.company);
    $('subLine').textContent = 'Proforma invoice ' + (d.number || '');
    show('askCard', false); show('docCard', false); show('stateCard', false);
    if (d.html) { $('docNo').textContent = d.number || ''; $('docFrame').srcdoc = d.html; show('docCard', true); }
    var st = d.state, dec = d.decision;
    if (st === 'OPEN') { show('askCard', true); return; }
    if (st === 'RESPONDED') {
      var when = dec && dec.at ? ' on ' + dateText(dec.at) : '';
      if (dec && dec.type === 'APPROVED') message('✓', 'Thank you. You approved this proforma invoice' + when + '.', [dec.name ? 'Approved by ' + dec.name + '.' : '', 'We will now prepare your job and send you the invoice.']);
      else message('✎', 'Your request for changes was received' + when + '.', ['We will update the proforma invoice and email you the new version.'], dec && dec.comment);
      return;
    }
    if (st === 'SUPERSEDED') return message('↻', 'A newer version was sent', ['We changed this proforma invoice and emailed you a new link. Please open the link in the newest email.']);
    if (st === 'EXPIRED') return message('⌛', 'This link has expired', ['Please ask us to send the proforma invoice again.']);
    if (st === 'UPDATING') return message('✎', 'We are updating this proforma invoice', ['You will get a new email as soon as it is ready.']);
    message('ℹ', 'This proforma invoice is no longer open', ['Please contact us if you have a question.']);
  }

  function fail(e) {
    $('subLine').textContent = '';
    var codeMsg = { INVALID_LINK: 'This link is not valid', RATE_LIMITED: 'Please wait a few minutes' }[e && e.code] || 'We could not open this page';
    message('!', codeMsg, [e && e.message ? e.message : 'Please try again.']);
  }

  var busy = false;
  function answer(type) {
    if (busy) return;
    var name = $('rpName').value.trim(), note = $('rpNote').value.trim(), err = $('rpErr');
    err.textContent = '';
    if (name.length < 2) { err.textContent = 'Please type your name.'; $('rpName').focus(); return; }
    if (type === 'CHANGES_REQUESTED' && note.length < 3) { err.textContent = 'Please describe the changes you would like.'; $('rpNote').focus(); return; }
    if (type === 'APPROVED' && !window.confirm('Approve this proforma invoice?')) return;
    busy = true; $('okBtn').disabled = true; $('chBtn').disabled = true;
    call('PUBLIC_DOC_RESPOND', { token: token, response_type: type, name: name, comment: note, client_note: String(navigator.userAgent || '').slice(0, 180) })
      .then(function (d) { render(d); window.scrollTo(0, 0); })
      .catch(function (e) { err.textContent = e.message || 'Could not send your answer.'; if (e.code === 'LINK_NOT_OPEN' || e.code === 'INVALID_LINK') load(); })
      .then(function () { busy = false; $('okBtn').disabled = false; $('chBtn').disabled = false; });
  }

  function savePdf() {
    var b = $('pdfBtn'); $('pdfErr').textContent = ''; b.disabled = true;
    call('PUBLIC_DOC_PDF', { token: token }).then(function (r) {
      var bin = atob(r.base64), bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      var a = document.createElement('a'); a.href = url; a.download = r.file_name || 'proforma-invoice.pdf';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 20000);
    }).catch(function (e) { $('pdfErr').textContent = e.message || 'Could not make the PDF.'; })
      .then(function () { b.disabled = false; });
  }

  function load() { call('PUBLIC_DOC_GET', { token: token }).then(render).catch(fail); }

  $('okBtn').addEventListener('click', function () { answer('APPROVED'); });
  $('chBtn').addEventListener('click', function () { answer('CHANGES_REQUESTED'); });
  $('pdfBtn').addEventListener('click', savePdf);
  if (!token) fail({ code: 'INVALID_LINK', message: 'This link is incomplete. Please open the link from your email again.' }); else load();
})();
