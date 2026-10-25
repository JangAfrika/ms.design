/* The General Manager's daily, weekly and monthly reports. The figures are drafted from live data; the General Manager writes the narrative and
   submits (the figures are then frozen). The CEO marks it reviewed. Submitting on time is a KPI. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const mg = MS.mg, sc = MS.sc, dc = MS.dc;
  const state = { type: '', page: 1 };
  let rows = [];

  const pct = (v) => (v === null || v === undefined ? '–' : MS.num(v) + ' %');
  function figs(f) {
    if (!f) return '';
    const sec = (t, kv) => `<h3 class="sub-h">${esc(t)}</h3>${MS.kv(kv)}`;
    return sec('Jobs', [['Opened', f.jobs.created], ['Done', f.jobs.done + ' (' + f.jobs.done_on_time + ' on time)'], ['Open now', f.jobs.open + ' (' + f.jobs.delayed + ' delayed)']])
      + sec('Customers', [['Complaints received', f.customers.complaints + ' (' + f.customers.complaints_open + ' open now)']])
      + sec('Staff', [['Present', f.staff.present + f.staff.late], ['Late', f.staff.late], ['Absent', f.staff.absent], ['On leave', f.staff.on_leave], ['Attendance', pct(f.staff.attendance_pct)]])
      + sec('Issues, actions, meetings', [['Issues opened / resolved', f.issues.opened + ' / ' + f.issues.resolved], ['Issues open / past date', f.issues.open + ' / ' + f.issues.overdue], ['Actions due / done on time', f.actions.due + ' / ' + f.actions.done_on_time], ['Actions overdue now', f.actions.overdue_open], ['Meetings held', f.meetings.held]])
      + (f.finance ? sec('Finance', [['Revenue', MS.money(f.finance.revenue)], ['Gross margin', pct(f.finance.gross_margin_pct)], ['Net profit', MS.money(f.finance.net_profit)]]) : '')
      + (f.kpis ? sec('KPIs', [['Green', f.kpis.counts.GREEN], ['Amber', f.kpis.counts.AMBER], ['Red', f.kpis.counts.RED], ['No target yet', f.kpis.counts.no_target], ['No figure', f.kpis.counts.no_figure]]) + (f.kpis.reds.length ? mg.list(f.kpis.reds.map((r) => `<span>Red: ${esc(r.kpi_name)}</span><span class="sub">${esc(mg.val(r.actual, r.unit))} against ${esc(r.target_text)}</span>`)) : '') : '');
  }

  MS.reload = () => load();
  async function load() {
    MS.setMsg('msg', 'Loading…');
    try {
      const r = await MS.recall('MGMT_REPORT_LIST', { report_type: state.type || undefined, page: state.page });
      rows = r.rows;
      $('cards').innerHTML = r.due_now.map((d) => `<div class="card ${d.overdue ? 'red' : ''}"><div class="k">${esc(MS.label(d.report_type))} report</div><div class="v">${esc(d.label)}</div><div class="s">${d.state ? esc(MS.label(d.state)) + ' · ' : ''}due ${esc(MS.when(d.due_at))}${r.can.submit ? `<br><button type="button" data-new="${esc(d.report_type)}|${esc(d.period)}">${d.state === 'DRAFT' ? 'Continue' : 'Write it'}</button>` : ''}</div></div>`).join('');
      MS.setMsg('msg', r.total + ' report' + (r.total === 1 ? '' : 's'));
      $('repBody').innerHTML = rows.length ? rows.map((x) => `<tr><td><b>${esc(MS.label(x.report_type))}</b></td><td>${esc(x.label)}</td><td>${MS.pill(x.status)}</td><td>${esc(x.prepared_by_name)}</td>
        <td>${x.submitted_at ? esc(MS.when(x.submitted_at)) : ''}${x.submitted_at ? (x.on_time ? ' <span class="sub">on time</span>' : ' <span class="sub late">late</span>') : ''}</td><td>${esc(x.reviewed_by_name)}</td><td class="acts"><button type="button" data-open="${esc(x.management_report_id)}">Open</button></td></tr>`).join('')
        : '<tr><td colspan="7" class="empty">No reports yet.</td></tr>';
      sc.pager('pager', r, state, load);
    } catch (err) { MS.setMsg('msg', err.message, 'error'); }
  }

  async function open(payload) {
    await sc.view(() => MS.call('MGMT_REPORT_GET', payload), (g) => {
      const rp = g.report, can = g.can, edit = can.edit && MS.can('MGMT_REPORT_SUBMIT');
      const type = g.report_type, period = g.period;
      const save = async (submit) => {
        try { await MS.call(submit ? 'MGMT_REPORT_SUBMIT' : 'MGMT_REPORT_DRAFT', { report_type: type, period, narrative: dc.val('rNarr') }); sc.closeView(); await load(); } catch (err) { sc.viewError(err.message); }
      };
      return {
        html: `<h3>${esc(MS.label(type))} report · ${esc(g.label)}</h3>${rp ? MS.kv([['Status', MS.pill(rp.status), true], ['Prepared by', rp.prepared_by_name], ['Submitted', rp.submitted_at ? MS.when(rp.submitted_at) + (rp.on_time ? ' (on time)' : ' (late)') : ''], ['Reviewed by', rp.reviewed_by_name]]) : '<p class="hint">Not started. Saving makes a draft.</p>'}
          <label>Narrative: achievements, challenges and recommendations <textarea id="rNarr" rows="6" maxlength="8000"${edit ? '' : ' disabled'}>${esc(rp ? rp.narrative : '')}</textarea></label>
          <p class="hint">${rp && rp.status !== 'DRAFT' ? 'These figures were frozen when the report was submitted.' : 'Figures are read from live data now and frozen when you submit.'}</p>${figs(g.data_snapshot)}`,
        buttons: [edit ? ['rSave', 'Save draft', '', () => save(false)] : null, edit ? ['rSub', 'Submit report', 'primary', () => save(true)] : null,
          can.review && MS.can('REPORT_VIEW') ? ['rRev', 'Mark as reviewed', 'primary', async () => { try { await MS.call('MGMT_REPORT_REVIEW', { management_report_id: rp.management_report_id }); sc.closeView(); await load(); } catch (err) { sc.viewError(err.message); } }] : null,
          ['rPrint', 'Print', '', mg.print]]
      };
    });
  }

  MS.boot({ page: 'gm-reports', any: ['MGMT_REPORT_SUBMIT', 'KPI_REVIEW', 'KPI_VERIFY'] }).then(() => {
    $('typeSel').onchange = () => { state.type = $('typeSel').value; state.page = 1; load(); };
    $('cards').addEventListener('click', (e) => { const b = e.target.closest('[data-new]'); if (b) { const [t, p] = b.dataset.new.split('|'); open({ report_type: t, period: p }); } });
    $('repBody').addEventListener('click', (e) => { const b = e.target.closest('[data-open]'); if (b) open({ management_report_id: b.dataset.open }); });
    if (MS.param('type') && MS.param('period')) open({ report_type: MS.param('type'), period: MS.param('period') });
    load();
  });
})();
