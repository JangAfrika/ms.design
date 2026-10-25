/* Section teams (System Administrator and General Manager): who works in each section and subsection.
   A job reaches a person only through a team they belong to (the Head of Graphic Design and the Graphic Designers are in the Graphic Section by their role, shown "by role"). The lead may complete a section after it was forwarded to a subsection. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  let data = null;

  const memberLi = (m) => `<li><span class="n">${esc(m.display_name)}${m.position ? ` <span class="sub">${esc(m.position)}</span>` : ''}${m.subsection_name ? ` · ${esc(m.subsection_name)}` : ''} ${m.is_lead ? MS.pill('ACTIVE', 'Lead') : ''}</span>
    <span class="a">${m.automatic ? '<span class="sub">by role</span>' : `<button type="button" data-rm="${esc(m.section_member_id)}" data-name="${esc(m.display_name)}">Remove</button>`}</span></li>`;

  function render() {
    $('teams').innerHTML = data.sections.map((s) => {
      const mem = data.rows.filter((m) => m.section_id === s.section_id);
      const secStaff = mem.filter((m) => !m.subsection_id);
      const subHtml = s.subsections.map((x) => {
        const sm = mem.filter((m) => m.subsection_id === x.subsection_id);
        return `<h4>${esc(x.subsection_name)}</h4>${sm.length ? `<ul class="mini-list">${sm.map(memberLi).join('')}</ul>` : '<p class="empty-note">Nobody yet.</p>'}`;
      }).join('');
      return `<div class="team-card" data-s="${esc(s.section_id)}"><h3>${esc(s.section_name)} <span class="sub">${s.is_selectable ? 'section' : 'receives every job after its sections'}</span></h3>
        <h4>${s.subsections.length ? 'Section staff' : 'Team'}</h4>${secStaff.length ? `<ul class="mini-list">${secStaff.map(memberLi).join('')}</ul>` : '<p class="empty-note">Nobody yet.</p>'}
        ${subHtml}
        <div class="add-row"><label>Add a person <select class="addUser"><option value="">— choose —</option>${data.users.map((u) => `<option value="${esc(u.user_id)}">${esc(u.display_name)} (${esc(u.username)})</option>`).join('')}</select></label>
          ${s.subsections.length ? `<label>Team <select class="addSub"><option value="">${esc(s.section_name)} (whole section)</option>${s.subsections.map((x) => `<option value="${esc(x.subsection_id)}">${esc(x.subsection_name)}</option>`).join('')}</select></label>` : ''}
          <label class="check"><input type="checkbox" class="addLead"> Lead</label>
          <button type="button" class="primary" data-add="1">Add</button></div></div>`;
    }).join('');
  }

  async function load() {
    try { data = await MS.call('SECTION_MEMBER_LIST', {}); MS.setMsg('pMsg', ''); render(); } catch (err) { MS.setMsg('pMsg', err.message, 'error'); }
  }

  MS.boot({ page: 'section-teams', any: ['SECTION_TEAM_MANAGE'], ref: false }).then(() => {
    $('teams').addEventListener('click', async (e) => {
      const add = e.target.closest('[data-add]');
      const rm = e.target.closest('[data-rm]');
      try {
        if (add) {
          const card = add.closest('.team-card');
          const user = card.querySelector('.addUser').value;
          if (!user) return MS.setMsg('pMsg', 'Choose the person to add.', 'error');
          const sub = card.querySelector('.addSub');
          await MS.call('SECTION_MEMBER_SET', { user_id: user, section_id: card.dataset.s, subsection_id: sub ? sub.value : '', is_lead: card.querySelector('.addLead').checked });
          await load();
          MS.setMsg('pMsg', 'Team updated. The person is told they work in this section.', 'ok');
        } else if (rm) {
          if (!(await MS.confirm({ title: 'Remove from the team', message: 'Remove ' + rm.dataset.name + '? They will no longer receive jobs from this team.', confirmText: 'Remove' }))) return;
          await MS.call('SECTION_MEMBER_REMOVE', { section_member_id: rm.dataset.rm });
          await load();
        }
      } catch (err) { MS.setMsg('pMsg', err.message, 'error'); }
    });
    load();
  });
})();
