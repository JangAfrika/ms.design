(function () {
  'use strict';
  var RP = (window.RP = window.RP || {});
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

  RP.busy = function (btn, on, label) {
    if (!btn) return;
    if (on) { if (btn.dataset.html === undefined) btn.dataset.html = btn.innerHTML; btn.disabled = true; btn.classList.add('is-busy'); btn.setAttribute('aria-busy', 'true'); btn.textContent = label || 'Working…'; }
    else { btn.disabled = false; btn.classList.remove('is-busy'); btn.setAttribute('aria-busy', 'false'); if (btn.dataset.html !== undefined) { btn.innerHTML = btn.dataset.html; delete btn.dataset.html; } }
  };

  RP.longDate = function (iso) {
    var m = /^(\d{4})-(\d\d)-(\d\d)/.exec(String(iso || '')); if (!m) return '';
    return (+m[3]) + ' ' + ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][+m[2] - 1] + ' ' + m[1];
  };

  RP.how = function (kind, expiresAt, on) {
    var card = $('howCard');
    if (!on) { card.hidden = true; return; }
    var what = kind === 'design' ? 'design' : 'proforma invoice';
    var steps = kind === 'design'
      ? ['<b>Look at the design</b> below. You can open or download each file.', 'If everything is correct, <b>type your name</b> and press <b>APPROVE</b>.',
        'If you want something changed, press <b>REQUEST CHANGES</b> and tell us what to change. We will send you a new version.']
      : ['<b>Read the proforma invoice</b> below. You can download it as a PDF.', 'If everything is correct, <b>type your name</b> and press <b>APPROVE</b>.',
        'If you want something changed, press <b>REQUEST CHANGES</b> and tell us what to change. We will send you a new version.'];
    var list = $('howList'); list.textContent = '';
    steps.forEach(function (s, i) { var li = el('li', i === 1 ? 'ok' : ''); li.innerHTML = '<span>' + s + '</span>'; list.appendChild(li); });
    $('howAfter').textContent = kind === 'design'
      ? 'After you approve: we go ahead with your job and keep you updated.'
      : 'After you approve: we start your job and send you an invoice.';
    $('howWhen').textContent = (expiresAt ? 'This link works on your phone and on a computer until ' + RP.longDate(expiresAt) + '. ' : 'This link works on your phone and on a computer. ') +
      'Nothing is final until you press a button below.';
    $('howLead').textContent = 'It takes about a minute. You do not need an account or a password.';
    card.hidden = false;
  };

  function digits(s) { return String(s || '').replace(/[^\d+]/g, ''); }
  RP.company = function (co, defaultName) {
    co = co || {};
    $('coName').textContent = co.name || defaultName;
    var h = $('helpBody'); h.textContent = '';
    h.appendChild(el('p', 'co', co.name || defaultName));
    var line = el('p'), added = false;
    String(co.phone || '').split(/\s*[\/,|;]\s*/).filter(Boolean).forEach(function (p) {
      if (digits(p).length < 7) return;
      if (added) line.appendChild(document.createTextNode('  '));
      var a = el('a', '', 'Call ' + p); a.href = 'tel:' + digits(p); line.appendChild(a); added = true;
    });
    (co.emails || []).forEach(function (m) {
      if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(m)) return;
      if (added) line.appendChild(document.createTextNode('  '));
      var a = el('a', '', m); a.href = 'mailto:' + m; line.appendChild(a); added = true;
    });
    if (added) h.appendChild(line);
  };
})();
