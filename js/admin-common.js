/* Shared by the People and Administration pages: a pop-up that asks for a reason,
   the one-time password box, and the page-through buttons under a list. */
(function () {
  const MS = window.MS;
  const esc = (s) => MS.esc(s);

  function dialog(id) {
    let d = MS.$(id);
    if (!d) { d = document.createElement('dialog'); d.id = id; document.body.appendChild(d); }
    return d;
  }

  /* MS.askReason({ title, message, label, confirmText, danger, optional, placeholder })
     resolves to the text typed, or null when cancelled. A reason is required unless optional is set. */
  MS.askReason = function (o) {
    const d = dialog('admReasonDlg');
    d.innerHTML = `<form class="dlg" novalidate>
      <h3>${esc(o.title)}</h3>
      ${o.message ? `<div class="info">${esc(o.message)}</div>` : ''}
      <label class="${o.optional ? '' : 'req'}">${esc(o.label || 'Reason')} <textarea name="reason" rows="3" maxlength="500" placeholder="${esc(o.placeholder || '')}"></textarea></label>
      <div class="err"></div>
      <div class="btns"><button type="button" data-no>Cancel</button><button type="submit" class="${o.danger ? 'danger-solid' : 'primary'}">${esc(o.confirmText || 'Save')}</button></div>
    </form>`;
    const f = d.querySelector('form');
    return new Promise((resolve) => {
      let out = null;
      f.onsubmit = (e) => {
        e.preventDefault();
        const v = f.elements.reason.value.trim();
        if (!v && !o.optional) { d.querySelector('.err').textContent = 'Give a reason.'; return; }
        out = v;
        d.close();
      };
      d.querySelector('[data-no]').onclick = () => d.close();
      d.addEventListener('close', function done() { d.removeEventListener('close', done); resolve(out); });
      d.showModal();
      f.elements.reason.focus();
    });
  };

  /* shows a one-time password; it is never stored or shown again */
  MS.showPassword = function (title, pw, who, emailedTo) {
    const d = dialog('admPwDlg');
    d.innerHTML = `<form class="dlg" method="dialog">
      <h3>${esc(title)}</h3>
      <div class="info">${emailedTo ? `We emailed the username, this one-time password and the sign-in steps to <b>${esc(emailedTo)}</b>. Keep this copy in case the email does not arrive.` : `No email could be sent, so give this one-time password to ${esc(who)} in person.`} It is shown only once; ${esc(who)} must choose their own password at first sign-in.</div>
      <div class="onetime-pw" id="admPw">${esc(pw)}</div>
      <div class="btns"><button type="button" id="admPwCopy">Copy</button><button type="submit" class="primary">Done</button></div>
    </form>`;
    MS.$('admPwCopy').onclick = () => {
      try { navigator.clipboard.writeText(pw).then(() => { MS.$('admPwCopy').textContent = 'Copied'; }, () => {}); } catch (e) { /* not allowed */ }
    };
    return new Promise((resolve) => {
      d.addEventListener('close', function done() { d.removeEventListener('close', done); d.innerHTML = ''; resolve(); });
      d.showModal();
    });
  };

  /* Previous / Page x of y / Next under a list. state.page is changed, then load() runs. */
  MS.pager = function (box, r, state, load) {
    if (typeof box === 'string') box = MS.$(box);
    const pages = Math.max(1, Math.ceil(r.total / r.page_size));
    box.innerHTML = pages > 1 ? `<button type="button" data-p="-1"${state.page <= 1 ? ' disabled' : ''}>Previous</button><span>Page ${state.page} of ${pages}</span><button type="button" data-p="1"${state.page >= pages ? ' disabled' : ''}>Next</button>` : '';
    box.querySelectorAll('[data-p]').forEach((b) => { b.onclick = () => { state.page += Number(b.dataset.p); load(); }; });
  };

  /* the friendly name of a module / area code (HR -> People (HR)) */
  MS.areaLabel = (code) => { const a = (MS.AREAS || []).find((x) => x.code === code); return a ? a.label : MS.label(code); };

  /* a short "x thing(s)" count */
  MS.count = (n, word, plural) => n + ' ' + (n === 1 ? word : (plural || word + 's'));

  /* fields whose value differs from the record (so masked or unchanged values are never sent back) */
  MS.changed = (d, rec) => {
    const out = {};
    Object.keys(d).forEach((k) => { if (String(d[k] == null ? '' : d[k]) !== String(rec[k] == null ? '' : rec[k])) out[k] = d[k]; });
    return out;
  };
})();
