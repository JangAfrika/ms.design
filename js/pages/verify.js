(function () {
  'use strict';
  var cfg = window.APP_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var logo = document.querySelector('[data-app-logo]'), mark = document.querySelector('[data-app-mark]');
  if (cfg.APP_LOGO) { logo.src = cfg.APP_LOGO; logo.onerror = function () { logo.hidden = true; mark.hidden = false; }; } else { logo.hidden = true; mark.hidden = false; }

  function call(action, payload) {
    var url = cfg.SCRIPT_URL;
    if (!url) return Promise.reject({ message: 'This page is not set up yet.' });
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: action, request_id: String(Date.now()) + Math.random().toString(36).slice(2), payload: payload }) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || res.success !== true) throw { message: (res && res.message) || 'Something went wrong.' };
        return res.data;
      }, function () { throw { message: 'Could not reach the server. Check your connection and try again.' }; });
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function money(n, cur) { return (cur || '') + ' ' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  function show(d) {
    var c = $('vResult'); c.textContent = ''; c.hidden = false;
    var box = el('div', 'rp-msg' + (d.valid && d.status === 'VALID' ? ' good' : ''));
    if (!d.valid) {
      box.appendChild(el('div', 'big', '!')); box.appendChild(el('h2', '', 'Not recognised')); box.appendChild(el('p', '', d.message));
    } else {
      box.appendChild(el('div', 'big', d.status === 'VALID' ? '✓' : '!'));
      box.appendChild(el('h2', '', d.status === 'VALID' ? 'This document is genuine' : 'Signed, but now void'));
      box.appendChild(el('p', '', (d.doc_type === 'INVOICE' ? 'Invoice ' : 'Receipt ') + d.doc_number + (d.status === 'VOID' ? ' was signed and has since been cancelled.' : ' was signed by ' + d.signer_name + '.')));
      var q = el('div', 'rp-quote');
      [['Issued by', d.company], ['Document', d.doc_number], ['Date', d.doc_date], ['Amount', money(d.amount, d.currency)], ['Signed by', d.signer_name], ['Signed on', String(d.signed_at || '').replace('T', ' ').slice(0, 16)]].forEach(function (r) {
        var line = el('div'); line.appendChild(el('b', '', r[0] + ': ')); line.appendChild(document.createTextNode(r[1] || '')); q.appendChild(line);
      });
      box.appendChild(q);
    }
    c.appendChild(box);
  }

  $('vForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var code = $('vCode').value.trim().toUpperCase();
    $('vErr').textContent = '';
    if (code.length < 6) { $('vErr').textContent = 'Type the code from the document.'; return; }
    RP.busy($('vGo'), true, 'Checking…');
    call('DOC_VERIFY', { code: code }).then(show, function (x) { $('vErr').textContent = x.message; }).then(function () { RP.busy($('vGo'), false); });
  });
  var pre = '';
  try { pre = new URLSearchParams(location.search).get('code') || ''; } catch (e) { pre = ''; }
  if (pre) { $('vCode').value = pre.toUpperCase().slice(0, 14); $('vForm').dispatchEvent(new Event('submit', { cancelable: true })); }
})();
