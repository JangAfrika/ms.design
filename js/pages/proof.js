(function () {
  'use strict';
  var cfg = window.APP_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var token = '';
  try { token = new URLSearchParams(location.search).get('t') || ''; } catch (e) { token = ''; }
  try { if (token && history.replaceState) history.replaceState(null, '', location.pathname); } catch (e) {  }

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

  function message(icon, title, lines, quote, next) {
    var c = $('stateCard'); c.textContent = '';
    var box = el('div', 'rp-msg' + (icon === '✓' ? ' good' : ''));
    box.appendChild(el('div', 'big', icon)); box.appendChild(el('h2', '', title));
    lines.forEach(function (l) { if (l) box.appendChild(el('p', '', l)); });
    if (quote) box.appendChild(el('div', 'rp-quote', quote));
    if (next && next.length) {
      var nx = el('div', 'rp-next'), ul = el('ul'); nx.appendChild(el('b', '', 'What happens next'));
      next.forEach(function (t) { ul.appendChild(el('li', '', t)); }); nx.appendChild(ul); box.appendChild(nx);
    }
    c.appendChild(box); show('stateCard', true);
  }

  function company(co) { RP.company(co, 'MS Designs & Printing'); }

  var urls = [];
  function fileBytes(r) { var bin = atob(r.base64), arr = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return arr; }
  function showFile(f, holder) {
    var box = el('div', 'pf'), head = el('div', 'pf-head'), acts = el('div', 'acts'), body = el('div', 'pf-body');
    head.appendChild(el('b', '', f.name + (f.version_no > 1 ? '  (version ' + f.version_no + ')' : '')));
    head.appendChild(acts); box.appendChild(head); box.appendChild(body); holder.appendChild(box);
    if (f.too_large) { body.appendChild(el('div', 'pf-note', 'This file is too big to show here (over ' + dMax + ' MB). Please ask us to send it to you by email.')); return; }
    body.appendChild(el('div', 'pf-note', 'Loading...'));
    call('PUBLIC_PROOF_FILE', { token: token, index: f.index }).then(function (r) {
      var url = URL.createObjectURL(new Blob([fileBytes(r)], { type: r.kind === 'other' ? 'application/octet-stream' : r.mime_type }));
      urls.push(url); body.textContent = '';
      var dl = el('a', '', 'Download'); dl.href = url; dl.download = r.file_name; acts.appendChild(dl);
      if (r.kind === 'image') {
        var im = el('img'); im.alt = r.file_name; im.src = url; body.appendChild(im);
        var op = el('a', '', 'Open full size'); op.href = url; op.target = '_blank'; op.rel = 'noopener'; acts.insertBefore(op, dl);
      } else if (r.kind === 'pdf') {
        var op2 = el('a', '', 'Open in a new tab'); op2.href = url; op2.target = '_blank'; op2.rel = 'noopener'; acts.insertBefore(op2, dl);
        if (window.innerWidth < 640) { body.appendChild(el('div', 'pf-note', 'Tap "Open in a new tab" to look at this PDF, or "Download" to save it.')); return; }
        var ob = el('object'); ob.data = url; ob.type = 'application/pdf'; ob.setAttribute('aria-label', r.file_name);
        ob.appendChild(el('div', 'pf-note', 'Your browser cannot show this PDF here. Use "Open in a new tab" or "Download" above.'));
        body.appendChild(ob);
      } else body.appendChild(el('div', 'pf-note', 'This kind of file cannot be shown here. Use "Download" above.'));
    }).catch(function (e) { body.textContent = ''; body.appendChild(el('div', 'pf-note', e.message || 'Could not load this file.')); });
  }

  var dMax = 15;
  function render(d) {
    company(d.company);
    dMax = d.max_mb || dMax;
    $('subLine').textContent = (d.title || 'Your design') + (d.proof_no > 1 ? ' · version ' + d.proof_no : '');
    show('askCard', false); show('docCard', false); show('stateCard', false); RP.how('design', d.expires_at, d.state === 'OPEN');
    if (d.files && !$('files').firstChild) {
      $('docNo').textContent = d.title || '';
      d.files.forEach(function (f) { showFile(f, $('files')); });
      show('docCard', true);
    } else if (d.files) show('docCard', true);
    var st = d.state, dec = d.decision;
    if (st === 'OPEN') { show('askCard', true); return; }
    if (st === 'RESPONDED') {
      var when = dec && dec.at ? ' on ' + dateText(dec.at) : '';
      if (dec && dec.type === 'APPROVED') message('✓', 'Thank you. You approved this design' + when + '.', [dec.name ? 'Approved by ' + dec.name + '.' : '', 'There is nothing more for you to do.'], '', ['We go ahead with your job.', 'We keep you updated until it is ready.', 'If you have a question, call or write to us (the numbers are below).']);
      else message('✎', 'Your request for changes was received' + when + '.', ['Thank you. We have your request.'], dec && dec.comment, ['We update the design.', 'We email you a new link. Open it to approve the new version.']);
      return;
    }
    if (st === 'SUPERSEDED') return message('↻', 'A newer version was sent', ['We changed this design and emailed you a new link. Please open the link in the newest email.']);
    if (st === 'EXPIRED') return message('⌛', 'This link has expired', ['Please ask us to send the design again.']);
    message('ℹ', 'This design is no longer open', ['Please contact us if you have a question.']);
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
    if (name.length < 2) { err.textContent = 'Please type your full name so we know who approved.'; $('rpName').focus(); return; }
    if (type === 'CHANGES_REQUESTED' && note.length < 3) { err.textContent = 'Please describe the changes you would like.'; $('rpNote').focus(); return; }
    busy = true; $('okBtn').disabled = true; $('chBtn').disabled = true;
    RP.busy($(type === 'APPROVED' ? 'okBtn' : 'chBtn'), true, 'Sending…');
    var go = type === 'APPROVED' ? MS.confirm('Approve this design?', 'We will then go ahead with your job.', { confirmText: 'Approve', cancelText: 'Not now' }) : Promise.resolve(true);
    go.then(function (yes) { if (!yes) { busy = false; RP.busy($('okBtn'), false); RP.busy($('chBtn'), false); return; } send(type, name, note, err); });
  }

  function send(type, name, note, err) {
    call('PUBLIC_PROOF_RESPOND', { token: token, response_type: type, name: name, comment: note, client_note: String(navigator.userAgent || '').slice(0, 180) })
      .then(function (d) { render(d); window.scrollTo(0, 0); })
      .catch(function (e) { err.textContent = e.message || 'Could not send your answer.'; if (e.code === 'LINK_NOT_OPEN' || e.code === 'INVALID_LINK') load(); })
      .then(function () { busy = false; RP.busy($('okBtn'), false); RP.busy($('chBtn'), false); });
  }

  function load() { call('PUBLIC_PROOF_GET', { token: token }).then(render).catch(fail); }

  $('okBtn').addEventListener('click', function () { answer('APPROVED'); });
  $('chBtn').addEventListener('click', function () { answer('CHANGES_REQUESTED'); });
  if (!token) fail({ code: 'INVALID_LINK', message: 'This link is incomplete. Please open the link from your email again.' }); else load();
})();
