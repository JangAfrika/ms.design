(function () {
  const MS = window.MS;
  const { $, esc } = MS;

  const dot = (ok) => `<span class="pill ${ok ? 'ok' : 'failed'}">${ok ? 'OK' : 'Check'}</span>`;
  const ago = (iso) => (iso ? esc(MS.dateTime(iso)) : '<span class="muted">never</span>');

  function draw(h) {
    const bad = h.triggers.filter((t) => !t.installed).length;
    $('hBox').innerHTML = `
      <section class="panel" style="margin-bottom:12px">
        <h2 style="font-size:14px;margin:0 0 8px">Timed jobs ${dot(h.triggers_ok)}</h2>
        <div class="tablewrap"><table class="inv"><thead><tr><th>Job</th><th>Runs</th><th>Installed</th><th>Last ran</th></tr></thead><tbody>
          ${h.triggers.map((t) => `<tr><td>${esc(t.label)}</td><td>${esc(t.schedule)}</td><td>${dot(t.installed)}${t.count > 1 ? ' <span class="muted">(' + t.count + ' copies)</span>' : ''}</td><td>${ago(t.last_run)}</td></tr>`).join('')}
        </tbody></table></div>
        ${bad ? '<p class="msg error" style="margin-top:8px">Some timed jobs are missing, so delay alerts, attendance close, proforma expiry and the nightly backup are not running.</p>' : ''}
        <p style="margin:8px 0 0"><button type="button" class="primary" id="instBtn">${bad ? 'Install the missing jobs' : 'Check the jobs again'}</button></p>
      </section>
      <section class="panel" style="margin-bottom:12px">
        <h2 style="font-size:14px;margin:0 0 8px">Backup ${dot(!!h.last_backup && h.drive_enabled)}</h2>
        <p style="margin:0">Last nightly backup: ${ago(h.last_backup)}. <a href="management/backups.html">Backups &amp; exports</a> lists the files and runs one by hand.</p>
        ${h.drive_enabled ? '' : '<p class="msg error">Drive is switched off, so no backup is saved.</p>'}
      </section>
      <section class="panel" style="margin-bottom:12px">
        <h2 style="font-size:14px;margin:0 0 8px">Settings and connections</h2>
        <div class="tablewrap"><table class="inv"><tbody>
          ${h.checks.map((c) => `<tr><td>${esc(c.label)}</td><td>${dot(c.ok)}</td><td class="wrap">${esc(c.detail)}</td></tr>`).join('')}
          <tr><td>Emails left today</td><td>${dot(h.mail_quota_left === null || h.mail_quota_left > 10)}</td><td>${h.mail_quota_left === null ? 'Google did not say.' : esc(String(h.mail_quota_left))}</td></tr>
          <tr><td>Errors in the last 24 hours</td><td>${dot(h.errors_24h === 0)}</td><td>${esc(String(h.errors_24h))} <a href="admin/errors.html">Open the error list</a></td></tr>
        </tbody></table></div>
      </section>
      <section class="panel">
        <h2 style="font-size:14px;margin:0 0 8px">Biggest tables</h2>
        <div class="tablewrap"><table class="inv"><thead><tr><th>Table</th><th class="num">Rows</th></tr></thead><tbody>
          ${h.tables.map((t) => `<tr><td>${esc(t.table)}</td><td class="num">${esc(String(t.rows))}</td></tr>`).join('')}
        </tbody></table></div>
        <p class="muted" style="margin:6px 0 0">Version ${esc(h.version)}, checked ${esc(MS.dateTime(h.time))}.</p>
      </section>`;
    $('instBtn').addEventListener('click', install);
  }

  async function load() {
    MS.setMsg('hMsg', 'Checking…');
    try { draw(await MS.call('HEALTH_GET', {})); MS.setMsg('hMsg', ''); } catch (err) { MS.setMsg('hMsg', err.message, 'error'); }
  }
  async function install() {
    MS.busy($('instBtn'), true, 'Working…');
    try { await MS.call('HEALTH_INSTALL_TRIGGERS', {}); await load(); } catch (err) { MS.setMsg('hMsg', err.message, 'error'); } finally { MS.busy($('instBtn'), false); }
  }

  $('reloadBtn').addEventListener('click', load);
  MS.boot({ page: 'health', any: ['SYSTEM_CONFIG'] }).then(load);
})();
