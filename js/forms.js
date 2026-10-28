(function () {
  const MS = (window.MS = window.MS || {});
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let uid = 0;

  MS.toast = function (message, type) {
    if (!message) return;
    let box = document.body.querySelector(':scope > .toasts');
    if (!box) {
      box = document.createElement('div');
      box.className = 'toasts'; box.setAttribute('aria-live', 'polite'); box.setAttribute('role', 'status');
      box.setAttribute('popover', 'manual');
      document.body.appendChild(box);
    }
    try { if (box.showPopover && !box.matches(':popover-open')) box.showPopover(); } catch (e) {  }
    const t = document.createElement('div');
    t.className = 'toast' + (type === 'error' ? ' error' : '');
    t.textContent = message;
    box.appendChild(t);
    setTimeout(() => { t.remove(); if (!box.children.length) { try { box.hidePopover(); } catch (e) {  } } }, type === 'error' ? 6000 : 3200);
  };

  function fieldOf(form, name) { return typeof name === 'string' ? form.querySelector('[name="' + name + '"]') : name; }
  MS.clearFieldErrors = function (form) {
    if (!form) return;
    form.querySelectorAll('.ferr').forEach((e) => e.remove());
    form.querySelectorAll('[aria-invalid]').forEach((e) => { e.removeAttribute('aria-invalid'); if (e.dataset.ferrId) e.removeAttribute('aria-describedby'); });
  };
  MS.fieldError = function (form, name, message) {
    const el = fieldOf(form, name);
    if (!el) return false;
    const old = el.parentElement && el.parentElement.querySelector(':scope > .ferr');
    if (old) old.remove();
    const span = document.createElement('span');
    span.className = 'ferr';
    span.id = 'ferr' + (++uid);
    span.setAttribute('role', 'alert');
    span.textContent = message;
    el.setAttribute('aria-invalid', 'true');
    el.setAttribute('aria-describedby', span.id);
    el.dataset.ferrId = span.id;
    el.insertAdjacentElement('afterend', span);
    return true;
  };
  MS.fieldErrors = function (form, map, focus) {
    let first = null;
    Object.keys(map || {}).forEach((k) => { if (MS.fieldError(form, k, map[k]) && !first) first = fieldOf(form, k); });
    if (first && focus !== false) { first.scrollIntoView({ block: 'center', behavior: 'smooth' }); first.focus({ preventScroll: true }); }
    return !!first;
  };
  MS.checkRequired = function (form, labels) {
    MS.clearFieldErrors(form);
    const bad = {};
    form.querySelectorAll('[required]').forEach((el) => {
      if (el.disabled || el.closest('[hidden]')) return;
      const empty = el.type === 'checkbox' ? !el.checked : String(el.value || '').trim() === '';
      if (empty && el.name) bad[el.name] = (labels && labels[el.name]) || 'Please fill this in.';
    });
    return Object.keys(bad).length ? !MS.fieldErrors(form, bad) : true;
  };
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el && el.getAttribute && el.getAttribute('aria-invalid') === 'true') {
      el.removeAttribute('aria-invalid');
      const m = el.parentElement && el.parentElement.querySelector(':scope > .ferr');
      if (m) m.remove();
    }
  }, true);

  function decorate(d) {
    if (d.dataset.fdone || d.classList.contains('imdlg')) return;
    const form = d.querySelector(':scope > .dlg') || d.querySelector('.dlg');
    if (!form) return;
    d.dataset.fdone = '1';
    const h = form.querySelector('h3');
    if (h) { if (!h.id) h.id = (d.id || 'dlg' + (++uid)) + 'Title'; d.setAttribute('aria-labelledby', h.id); }
    if (!form.querySelector(':scope > .xbtn')) {
      const x = document.createElement('button');
      x.type = 'button'; x.className = 'xbtn'; x.setAttribute('aria-label', 'Close'); x.title = 'Close (Esc)'; x.innerHTML = '&times;';
      x.addEventListener('click', () => d.close());
      form.insertBefore(x, form.firstChild);
    }
    form.querySelectorAll('.err').forEach((e) => { if (!e.getAttribute('role')) { e.setAttribute('role', 'alert'); e.setAttribute('aria-live', 'polite'); } });
    form.setAttribute('novalidate', '');
  }
  const showModal = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function () {
    try { decorate(this); } catch (e) {  }
    MS.clearFieldErrors(this);
    const r = showModal.apply(this, arguments);
    const body = this.querySelector('.dlg');
    if (body) body.scrollTop = 0;
    return r;
  };

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.err:not([role]), .msg:not([role])').forEach((e) => { e.setAttribute('role', e.classList.contains('err') ? 'alert' : 'status'); });
  });
  function stars(root) {
    (root || document).querySelectorAll('label.req:not([data-rq])').forEach((l) => {
      l.dataset.rq = '1';
      const w = document.createTreeWalker(l, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.nodeValue.trim() && !n.parentElement.closest('select,textarea,option,datalist') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
      const t = w.nextNode();
      if (!t) return;
      const s = document.createElement('span');
      s.className = 'rq'; s.setAttribute('aria-hidden', 'true'); s.textContent = '*';
      t.parentNode.insertBefore(s, t.nextSibling);
      const f = l.querySelector('input,select,textarea');
      if (f && !f.getAttribute('aria-required')) f.setAttribute('aria-required', 'true');
    });
  }
  let queued = false;
  const later = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; stars(); }); };
  document.addEventListener('DOMContentLoaded', () => { stars(); new MutationObserver(later).observe(document.body, { childList: true, subtree: true }); });
  MS.stars = stars;
  MS.esc = MS.esc || esc;
})();
