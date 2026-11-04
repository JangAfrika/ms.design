(function () {
  const MS = window.MS;
  const { esc } = MS;

  MS.stars5 = (n) => '<span class="stars" role="img" aria-label="' + Number(n) + ' out of 5">' + [1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? 'on' : ''}">★</i>`).join('') + '</span>';

  // Resolves with the saved feedback or null. o = { customer_id, customer_name, job_id, job_label }
  MS.feedbackForm = function (o) {
    const dlg = document.createElement('dialog');
    dlg.innerHTML = `<form class="dlg" novalidate>
      <h3>Customer feedback</h3>
      <p class="info"><b>${esc(o.customer_name)}</b> · job ${esc(o.job_label)}. Ask how the job went and tap the stars.</p>
      <div class="starpick" role="radiogroup" aria-label="Rating">${[1, 2, 3, 4, 5].map((i) => `<button type="button" role="radio" aria-checked="false" aria-label="${i} star${i > 1 ? 's' : ''}" data-v="${i}">★</button>`).join('')}</div>
      <label>Comment <textarea name="comment" rows="3" maxlength="500" placeholder="In the customer's own words"></textarea></label>
      <div class="err" id="fbError"></div>
      <div class="btns"><button type="button" id="fbCancel">Cancel</button><button type="submit" class="primary" id="fbSave">Save feedback</button></div>
    </form>`;
    document.body.appendChild(dlg);
    let rating = 0;
    const btns = [...dlg.querySelectorAll('.starpick button')];
    const paint = () => btns.forEach((b) => { const on = Number(b.dataset.v) <= rating; b.classList.toggle('on', on); b.setAttribute('aria-checked', Number(b.dataset.v) === rating ? 'true' : 'false'); });
    btns.forEach((b) => b.addEventListener('click', () => { rating = Number(b.dataset.v); paint(); }));
    dlg.showModal();
    return new Promise((resolve) => {
      const close = (v) => { dlg.close(); dlg.remove(); resolve(v); };
      const err = dlg.querySelector('#fbError');
      dlg.querySelector('#fbCancel').onclick = () => close(null);
      dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(null); });
      dlg.querySelector('form').onsubmit = async (e) => {
        e.preventDefault();
        if (!rating) { err.textContent = 'Tap the stars to give a rating.'; return; }
        MS.busy(dlg.querySelector('#fbSave'), true, 'Saving…');
        try { close(await MS.call('CUSTOMER_FEEDBACK_SAVE', { customer_id: o.customer_id, job_id: o.job_id, rating, comment: dlg.querySelector('[name=comment]').value.trim() })); } catch (x) { err.textContent = x.message; MS.busy(dlg.querySelector('#fbSave'), false); }
      };
    });
  };
})();
