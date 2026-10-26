(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const sig = (MS.sig = {});
  const W = 600, H = 200;
  const FONT_CSS = { Script: 'italic 76px "Brush Script MT", "Segoe Script", cursive', Formal: 'italic 64px Georgia, serif', Casual: '64px "Comic Sans MS", "Chalkboard SE", sans-serif', Classic: 'italic 66px "Times New Roman", Times, serif' };
  const INK = '#10265a';

  function dialog() {
    let d = document.getElementById('sigDlg');
    if (!d) { d = document.createElement('dialog'); d.id = 'sigDlg'; document.body.appendChild(d); }
    return d;
  }

  sig.sign = (kind, id, info, onDone) => {
    const d = dialog();
    const word = kind === 'INVOICE' ? 'invoice' : 'receipt';
    const none = info && !info.has_signature;
    d.innerHTML = `<form class="dlg" id="sgForm" novalidate><h3>Sign this ${word}</h3>
      ${none ? '<div class="notice-bar">You have not set your signature yet. Open <a href="account.html#sigPanel">My account</a> and add it first.</div>'
        : `<p class="sub">Your signature, name, title, the time and a verification code are added to the ${word}. After this the ${word} is locked as signed and anyone can check the code on the verify page.</p>
        <label class="req">Your password <input id="sgPw" type="password" autocomplete="current-password" required></label>`}
      <div class="err" id="sgError"></div>
      <div class="btns"><button type="button" id="sgCancel">Cancel</button>${none ? '' : '<button type="submit" class="primary" id="sgGo">Sign</button>'}</div></form>`;
    d.showModal();
    d.querySelector('#sgCancel').onclick = () => d.close();
    d.querySelector('#sgForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (none) return;
      const err = d.querySelector('#sgError'), pw = d.querySelector('#sgPw');
      err.textContent = '';
      if (!pw.value) { err.textContent = 'Enter your password to confirm.'; pw.focus(); return; }
      try {
        const r = await MS.busy(d.querySelector('#sgGo'), MS.call('DOC_SIGN', { kind, id, password: pw.value }), 'Signing…');
        pw.value = '';
        d.close();
        if (MS.toast) MS.toast('Signed. Verification code ' + r.verification_code);
        if (onDone) onDone(r);
      } catch (x) { err.textContent = x.message; pw.value = ''; }
    });
  };

  sig.badge = (s) => (s && s.signed ? `<p class="sigline no-print">${MS.icon('check')} Signed by <b>${esc(s.signer_name)}</b> on ${esc(MS.when(s.signed_at))} · code <b>${esc(s.verification_code)}</b> · <a class="lnk" href="verify.html?code=${encodeURIComponent(s.verification_code)}" target="_blank" rel="noopener">verify</a></p>` : '');

  sig.guardSend = (kind, s) => {
    if (s && s.required && !s.signed) { MS.alert('This ' + kind + ' must be signed by the CEO before it is sent. Ask the CEO to sign it first.', 'Signature needed'); return true; }
    return false;
  };

  sig.mount = async (box) => {
    box.hidden = false;
    box.innerHTML = `<h3>My signature</h3>${MS.skeleton(4)}`;
    let st = null, mode = 'UPLOAD', ink = false, drawing = false, last = null;
    async function paint() {
      try { st = await MS.call('SIGNATURE_GET', {}); } catch (err) { box.innerHTML = `<h3>My signature</h3><div class="err">${esc(err.message)}</div>`; return; }
      let img = '';
      if (st.active) { try { const r = await MS.call('SIGNATURE_IMAGE_GET', {}); if (r.has_signature) img = `<img class="sig-img" alt="Your signature" src="data:${esc(r.mime_type)};base64,${r.base64}">`; } catch (e) {  } }
      box.innerHTML = `<h3>My signature</h3>
        <p class="qhint" style="margin-top:0">Used to sign invoices and receipts. It is kept in a private Drive folder and only shown on documents you sign. Changing it needs your password.</p>
        ${st.active ? `<div class="sig-cur">${img || '<span class="sub">The image file could not be read.</span>'}<div class="sub">${esc(MS.label(st.active.method))} · set ${esc(MS.when(st.active.created_at))} · fingerprint ${esc(st.active.fingerprint)} · ${st.signed_count} document${st.signed_count === 1 ? '' : 's'} signed</div></div>`
          : '<div class="notice-bar">You have no signature yet. Add one below.</div>'}
        <div class="chips sig-tabs" role="tablist" aria-label="How to make the signature"><button type="button" data-m="UPLOAD" class="active">Upload</button><button type="button" data-m="DRAW">Draw</button><button type="button" data-m="TYPE">Type my name</button></div>
        <div id="sgUpload"><label>Picture of your signature (PNG or JPEG, on white paper or transparent) <input id="sgFile" type="file" accept="image/png,image/jpeg"></label></div>
        <div id="sgType" hidden><div class="two"><label>Name <input id="sgName" type="text" maxlength="80" value="${esc(st.printed_name)}"></label><label>Style <select id="sgFont">${st.fonts.map((f) => `<option>${esc(f)}</option>`).join('')}</select></label></div></div>
        <div class="sig-pad"><canvas id="sgCanvas" width="${W}" height="${H}" aria-label="Signature preview"></canvas></div>
        <div class="acts"><button type="button" id="sgClear">Clear</button></div>
        <label class="req">Your password <input id="sgPass" type="password" autocomplete="current-password"></label>
        <div class="err" id="sgErr"></div>
        <div class="acts"><button type="button" class="primary" id="sgSave">${st.active ? 'Replace my signature' : 'Save my signature'}</button>${st.active ? '<button type="button" class="danger" id="sgRemove">Remove</button>' : ''}</div>
        <p class="qhint">Signing is ${st.required_for_send ? '<b>required</b> before a document is sent to a customer' : 'optional before a document is sent (the System Administrator can make it required)'}. Printed on the document: ${esc(st.printed_name)}${st.printed_title ? ', ' + esc(st.printed_title) : ''}.</p>`;
      wire();
    }

    function wire() {
      const cv = $('sgCanvas'), cx = cv.getContext('2d');
      const clear = () => { cx.clearRect(0, 0, W, H); ink = false; };
      const point = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
      cv.style.touchAction = 'none';
      cv.addEventListener('pointerdown', (e) => { if (mode !== 'DRAW') return; drawing = true; last = point(e); cv.setPointerCapture(e.pointerId); });
      cv.addEventListener('pointermove', (e) => {
        if (!drawing) return;
        const p = point(e);
        cx.strokeStyle = INK; cx.lineWidth = 3.2; cx.lineCap = 'round'; cx.lineJoin = 'round';
        cx.beginPath(); cx.moveTo(last[0], last[1]); cx.lineTo(p[0], p[1]); cx.stroke();
        last = p; ink = true;
      });
      ['pointerup', 'pointercancel'].forEach((n) => cv.addEventListener(n, () => { drawing = false; }));
      const typed = () => {
        clear();
        const name = $('sgName').value.trim();
        if (!name) return;
        cx.fillStyle = INK; cx.textBaseline = 'middle'; cx.font = FONT_CSS[$('sgFont').value] || FONT_CSS.Script;
        let size = 76;
        while (cx.measureText(name).width > W - 40 && size > 20) { size -= 4; cx.font = cx.font.replace(/\d+px/, size + 'px'); }
        cx.fillText(name, 20, H / 2);
        ink = true;
      };
      box.querySelector('.sig-tabs').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-m]');
        if (!b) return;
        mode = b.dataset.m;
        box.querySelectorAll('.sig-tabs button').forEach((x) => x.classList.toggle('active', x === b));
        $('sgUpload').hidden = mode !== 'UPLOAD';
        $('sgType').hidden = mode !== 'TYPE';
        clear();
        if (mode === 'TYPE') typed();
        cv.classList.toggle('drawable', mode === 'DRAW');
      });
      $('sgName').addEventListener('input', typed);
      $('sgFont').addEventListener('change', typed);
      $('sgClear').addEventListener('click', clear);
      $('sgFile').addEventListener('change', () => {
        const f = $('sgFile').files[0];
        $('sgErr').textContent = '';
        if (!f) return;
        if (!/^image\/(png|jpeg)$/.test(f.type)) { $('sgErr').textContent = 'Choose a PNG or JPEG picture.'; $('sgFile').value = ''; return; }
        if (f.size > 4 * 1024 * 1024) { $('sgErr').textContent = 'That picture is too large. Use one under 4 MB.'; $('sgFile').value = ''; return; }
        const url = URL.createObjectURL(f), im = new Image();
        im.onload = () => {
          clear();
          const k = Math.min(W / im.width, H / im.height, 1);
          cx.drawImage(im, (W - im.width * k) / 2, (H - im.height * k) / 2, im.width * k, im.height * k);
          ink = true; URL.revokeObjectURL(url);
        };
        im.onerror = () => { $('sgErr').textContent = 'That file could not be read as a picture.'; URL.revokeObjectURL(url); };
        im.src = url;
      });
      $('sgSave').addEventListener('click', async () => {
        const err = $('sgErr');
        err.textContent = '';
        if (!ink) { err.textContent = mode === 'DRAW' ? 'Draw your signature in the box first.' : mode === 'TYPE' ? 'Type your name first.' : 'Choose a picture first.'; return; }
        if (!$('sgPass').value) { err.textContent = 'Enter your password to confirm.'; $('sgPass').focus(); return; }
        const payload = { method: mode, base64: cv.toDataURL('image/png').split(',')[1], password: $('sgPass').value };
        if (mode === 'TYPE') { payload.typed_name = $('sgName').value.trim(); payload.font_name = $('sgFont').value; }
        try { await MS.call('SIGNATURE_SET', payload); if (MS.toast) MS.toast('Signature saved'); paint(); } catch (x) { err.textContent = x.message; $('sgPass').value = ''; }
      });
      if ($('sgRemove')) $('sgRemove').addEventListener('click', async () => {
        if (!$('sgPass').value) { $('sgErr').textContent = 'Enter your password to confirm.'; $('sgPass').focus(); return; }
        if (!(await MS.confirm({ title: 'Remove signature', message: 'Documents already signed keep their signature. You will not be able to sign new ones until you add a new one.', confirmText: 'Remove', danger: true }))) return;
        try { await MS.call('SIGNATURE_REMOVE', { password: $('sgPass').value }); paint(); } catch (x) { $('sgErr').textContent = x.message; $('sgPass').value = ''; }
      });
    }
    paint();
  };
})();
