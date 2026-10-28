(function () {
  const MS = (window.MS = window.MS || {});
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const WARN = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>';
  let dlg = null;
  let queue = Promise.resolve();

  function ensure() {
    if (dlg) return dlg;
    dlg = document.createElement('dialog');
    dlg.id = 'msDialog';
    dlg.className = 'imdlg';
    dlg.setAttribute('aria-labelledby', 'msDlgTitle');
    dlg.setAttribute('aria-describedby', 'msDlgMsg');
    document.body.appendChild(dlg);
    return dlg;
  }

  function open(o) {
    const run = () => new Promise((resolve) => {
      const d = ensure();
      const icon = (MS.icon && MS.icon('alert')) || WARN;
      const kind = o.danger ? 'danger' : (o.info ? 'info' : 'ask');
      const field = !o.prompt ? '' : `<div class="imdlg-field"><label for="msDlgInput">${esc(o.label || '')}</label>${o.multiline
        ? `<textarea id="msDlgInput" rows="4" maxlength="${o.maxLength || 1000}" placeholder="${esc(o.placeholder || '')}">${esc(o.value || '')}</textarea>`
        : `<input id="msDlgInput" type="text" maxlength="${o.maxLength || 300}" placeholder="${esc(o.placeholder || '')}" value="${esc(o.value || '')}" autocomplete="off">`}<div class="imdlg-err" id="msDlgErr" role="alert"></div></div>`;
      d.innerHTML = `
        <div class="imdlg-body">
          <div class="imdlg-icon ${kind}" aria-hidden="true">${icon}</div>
          <div class="imdlg-text">
            <h3 id="msDlgTitle">${esc(o.title)}</h3>
            <p id="msDlgMsg">${esc(o.message).replace(/\n/g, '<br>')}</p>
            ${o.detail ? `<p class="imdlg-detail${o.danger ? ' danger' : ''}">${esc(o.detail)}</p>` : ''}
            ${field}
          </div>
        </div>
        <div class="imdlg-btns">
          ${o.info ? '' : `<button type="button" id="msDlgNo">${esc(o.cancelText || 'Cancel')}</button>`}
          <button type="button" id="msDlgYes" class="${o.danger ? 'danger-solid' : 'primary'}">${esc(o.confirmText || 'OK')}</button>
        </div>`;
      let result = o.prompt ? null : false;
      const input = d.querySelector('#msDlgInput');
      const done = () => { d.removeEventListener('close', done); d.removeEventListener('click', away); d.removeEventListener('keydown', keys); resolve(result); };
      const away = (e) => { if (e.target === d) d.close(); };
      const yes = () => {
        if (o.prompt) {
          const v = input.value.trim();
          if (o.required && !v) { d.querySelector('#msDlgErr').textContent = o.requiredMessage || 'Please fill this in.'; input.focus(); return; }
          result = v;
        } else result = true;
        d.close();
      };
      const focusable = () => Array.from(d.querySelectorAll('input, textarea, button')).filter((x) => !x.disabled);
      const keys = (e) => {
        if (e.key === 'Tab') {
          const f = focusable(); if (!f.length) return;
          const first = f[0], last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        } else if (e.key === 'Enter' && o.prompt && e.target === input && input.tagName === 'INPUT') { e.preventDefault(); yes(); }
        else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && o.prompt) { e.preventDefault(); yes(); }
      };
      d.addEventListener('close', done);
      d.addEventListener('click', away);
      d.addEventListener('keydown', keys);
      d.querySelector('#msDlgYes').addEventListener('click', yes);
      const no = d.querySelector('#msDlgNo');
      if (no) no.addEventListener('click', () => d.close());
      if (input) input.addEventListener('input', () => { d.querySelector('#msDlgErr').textContent = ''; });
      d.showModal();
      (input || no || d.querySelector('#msDlgYes')).focus();
    });
    const p = queue.then(run, run);
    queue = p.catch(() => {});
    return p;
  }

  MS.confirm = (a, b, c) => open(a && typeof a === 'object' ? a
    : typeof b === 'string' || c ? Object.assign({ title: a, message: b || '', confirmText: 'Yes' }, c) : { title: 'Please confirm', message: a, confirmText: 'Yes' });
  MS.alert = (message, title) => open({ title: title || 'Something went wrong', message, info: true, confirmText: 'OK' });
  MS.prompt = (title, message, opts) => open(Object.assign({ title, message: message || '', prompt: true, confirmText: 'Save' }, opts));
})();
