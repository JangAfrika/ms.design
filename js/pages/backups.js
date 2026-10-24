/* Backups and exports (System Administrator): copy chosen tables to Google Drive as JSON (one file) or CSV (one file per table). Every run is logged. */
(function () {
  const MS = window.MS;
  const { $, esc } = MS;
  const dc = MS.dc;
  let tables = [];

  MS.reload = () => load();
  async function load() {
    MS.setMsg('msg', 'Loading…');
    try {
      const [t, log] = await Promise.all([MS.call('BACKUP_TABLES'), MS.call('BACKUP_LOG')]);
      tables = t.rows;
      $('tblBox').innerHTML = tables.map((x) => `<label><input type="checkbox" value="${esc(x.table)}"> ${esc(x.table)} <span class="muted">${esc(x.rows)} row${x.rows === 1 ? '' : 's'}</span></label>`).join('');
      $('runBtn').hidden = !MS.can('BACKUP_RUN');
      MS.setMsg('msg', t.drive_enabled ? '' : 'Drive is switched off (DRIVE_ENABLED), so backups cannot be saved.', 'error');
      $('logBody').innerHTML = log.rows.length ? log.rows.map((x) => `<tr><td>${esc(MS.when(x.timestamp))}</td><td>${esc(x.by)}</td><td>${esc(x.format)} · ${esc(MS.label(x.kind))}</td><td class="num">${esc(x.tables)}</td><td class="num">${esc(x.rows)}</td><td>${(x.files || []).map(esc).join('<br>')}</td></tr>`).join('') : '<tr><td colspan="6" class="empty">No backup has been run yet.</td></tr>';
    } catch (err) { MS.setMsg('msg', err.message, 'error'); }
  }

  MS.boot({ page: 'backups', any: ['BACKUP_RUN'] }).then(() => {
    $('allBtn').onclick = () => $('tblBox').querySelectorAll('input').forEach((i) => { i.checked = true; });
    $('noneBtn').onclick = () => $('tblBox').querySelectorAll('input').forEach((i) => { i.checked = false; });
    $('runBtn').onclick = async () => {
      const chosen = Array.from($('tblBox').querySelectorAll('input:checked')).map((i) => i.value);
      if (!chosen.length) { MS.setMsg('msg', 'Tick at least one table.', 'error'); return; }
      MS.busy($('runBtn'), true, 'Saving to Drive…');
      try {
        const r = await MS.call('BACKUP_RUN', { tables: chosen.length === tables.length ? 'ALL' : chosen, format: dc.val('fmt'), kind: dc.val('kind') });
        MS.setMsg('msg', 'Saved ' + r.files.length + ' file' + (r.files.length === 1 ? '' : 's') + ' (' + r.rows + ' rows) in System / Backups / ' + (r.kind === 'DAILY' ? 'Daily' : 'Monthly') + '.', 'ok');
        await load();
      } catch (err) { MS.setMsg('msg', err.message, 'error'); } finally { MS.busy($('runBtn'), false); }
    };
    load();
  });
})();
