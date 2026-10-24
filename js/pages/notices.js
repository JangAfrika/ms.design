/* Management notices: the General Manager and CEO publish a notice to everyone or to one department; staff read it and, where asked, confirm they have. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const mg = MS.mg, sc = MS.sc, dc = MS.dc;
  const state = { tab: 'all', page: 1 };
  let rows = [], deps = [];

  MS.reload = () => load();
  async function load() {
    MS.setMsg('msg', 'Loading…');
    try {
      const r = await MS.recall('NOTICE_LIST', { tab: state.tab === 'all' ? undefined : state.tab, page: state.page, page_size: 50 });
      rows = r.rows; deps = r.departments;
      const pub = r.can.publish && MS.can('NOTICE_PUBLISH');
      $('newBtn').hidden = !pub;
      $('draftTab').hidden = !pub;
      $('cards').innerHTML = `<div class="card ${r.counts.to_acknowledge ? 'red' : 'green'}"><div class="k">To confirm</div><div class="v">${esc(r.counts.to_acknowledge)}</div><div class="s">notices you must read and confirm</div></div>`;
      MS.setMsg('msg', r.total + ' notice' + (r.total === 1 ? '' : 's'));
      $('noticeBody').innerHTML = rows.length ? rows.map((n) => `<tr><td><b>${esc(n.title)}</b><div class="sub">${esc(n.body_short)}</div></td><td>${esc(n.audience_name)}</td><td>${esc(MS.shortDate(n.effective_date))}</td>
        <td>${MS.pill(n.status)}${n.needs_ack ? '<div class="sub late">please confirm</div>' : n.acknowledged ? '<div class="sub">confirmed</div>' : ''}</td><td>${n.audience_count !== undefined && n.requires_acknowledgement ? esc(n.ack_count) + ' / ' + esc(n.audience_count) : ''}</td>
        <td class="acts"><button type="button" data-open="${esc(n.notice_id)}">Open</button></td></tr>`).join('') : '<tr><td colspan="6" class="empty">No notices.</td></tr>';
      sc.pager('pager', r, state, load);
    } catch (err) { MS.setMsg('msg', err.message, 'error'); }
  }

  function form(n) {
    sc.ask({ title: n ? 'Change notice' : 'New notice', wide: true, label: 'Notice', required: true, button: 'Save as draft',
      info: 'A draft is not shown to staff until you publish it.',
      extra: `<label class="req">Title <input id="nTitle" maxlength="200" value="${esc(n ? n.title : '')}"></label>
        <div class="two"><label>For <select id="nDep">${mg.deptOptions(deps, n ? n.audience_department_id : '', 'All staff')}</select></label><label>Takes effect <input id="nDate" type="date" value="${esc(n ? n.effective_date : MS.todayISO())}"></label></div>
        <label><input type="checkbox" id="nAck" style="width:auto;margin:0 6px 0 0"${n && n.requires_acknowledgement ? ' checked' : ''}> Staff must confirm they have read it</label>`,
      run: async (t) => { await MS.call('NOTICE_SAVE', dc.clean({ notice_id: n ? n.notice_id : '', title: dc.val('nTitle'), body: t, audience_department_id: dc.val('nDep'), effective_date: dc.val('nDate'), requires_acknowledgement: MS.$('nAck').checked })); await load(); } });
    if (n) MS.$('noteText').value = n.body;
    MS.$('noteText').maxLength = 20000;
  }

  async function open(id) {
    await sc.view(() => MS.call('NOTICE_GET', { notice_id: id }), (n) => {
      const pub = MS.can('NOTICE_PUBLISH'), c = n.can;
      return {
        html: `<h3>${esc(n.title)}</h3>${MS.kv([['For', n.audience_name], ['From', n.issued_by_name], ['Takes effect', MS.shortDate(n.effective_date)], ['Status', MS.pill(n.status), true], ['Confirmations', n.audience_count !== undefined && n.requires_acknowledgement ? n.ack_count + ' of ' + n.audience_count : '']])}<div class="mg-pre">${esc(n.body)}</div>`,
        buttons: [c.ack ? ['nAck', 'I have read this', 'primary', async () => { try { await MS.call('NOTICE_ACK', { notice_id: n.notice_id }); sc.closeView(); await load(); } catch (err) { sc.viewError(err.message); } }] : null,
          c.edit && pub ? ['nEdit', 'Change', '', () => { sc.closeView(); form(n); }] : null,
          c.issue && pub ? ['nPub', 'Publish', 'primary', async () => { try { await MS.call('NOTICE_ISSUE', { notice_id: n.notice_id }); sc.closeView(); await load(); } catch (err) { sc.viewError(err.message); } }] : null,
          c.withdraw && pub ? ['nWd', 'Withdraw', '', () => { sc.closeView(); sc.ask({ title: 'Withdraw notice', label: 'Why', required: true, danger: true, button: 'Withdraw', run: async (t) => { await MS.call('NOTICE_WITHDRAW', { notice_id: n.notice_id, reason: t }); await load(); } }); }] : null,
          pub && n.status !== 'DRAFT' && n.requires_acknowledgement ? ['nWho', 'Who has confirmed', '', async () => {
            try { const a = await MS.call('NOTICE_ACK_LIST', { notice_id: n.notice_id }); $('viewBody').insertAdjacentHTML('beforeend', `<h3 class="sub-h">Confirmed ${esc(a.acknowledged)} of ${esc(a.total)}</h3>${mg.list(a.rows.map((x) => `<span>${esc(x.name)} <span class="sub">${esc(x.department_name)}</span></span>${x.acknowledged_at ? '<span class="sub">' + esc(MS.when(x.acknowledged_at)) + '</span>' : '<span class="late">not yet</span>'}`))}`); } catch (err) { sc.viewError(err.message); }
          }] : null]
      };
    });
  }

  MS.boot({ page: 'notices', any: ['KPI_VIEW'] }).then(() => {
    sc.tabs('tabs', state, load);
    $('newBtn').onclick = () => form(null);
    $('noticeBody').addEventListener('click', (e) => { const b = e.target.closest('[data-open]'); if (b) open(b.dataset.open); });
    if (MS.param('id')) open(MS.param('id'));
    load();
  });
})();
