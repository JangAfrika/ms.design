/* The buttons section staff use on a job, shared by "My section" and the job page: Forward to subsection, Mark completed,
   Return / hold with a reason, and for the Production Department: tick the steps, complete a step, mark the job done.
   Each function takes the job as the server described it (j.job_id, j.work.*) and resolves true when something was saved.
   Whether a button shows comes from the server's `work` flags; the server checks the same rules again. */
(function () {
  const MS = window.MS;
  const esc = (s) => MS.esc(s);
  const act = (action, payload) => MS.call(action, payload);
  const ja = (MS.jobAct = {});

  ja.forward = (j) => MS.sc.ask({
    title: 'Forward to subsection', info: j.job_number + ' · ' + j.job_name + '. Tick the subsection(s) that should do this job. The job stays in ' + (j.work.label || 'your section') + ' until they finish.',
    extra: `<div class="pick-list">${(j.work.subsections || []).map((s) => `<label><input type="checkbox" class="subpick" value="${esc(s.subsection_id)}"> ${esc(s.subsection_name)}</label>`).join('')}</div>`,
    label: 'Note for them (optional)', button: 'Forward',
    run: async (t) => {
      const ids = Array.from(document.querySelectorAll('.subpick:checked')).map((x) => x.value);
      if (!ids.length) throw new Error('Tick at least one subsection.');
      const r = await act('JOB_SECTION_FORWARD', { job_id: j.job_id, subsection_ids: ids, note: t });
      if (r.warnings && r.warnings.length) MS.alert(r.warnings.join(' '), 'Forwarded, but check this');
    }
  });

  ja.complete = (j) => MS.sc.ask({
    title: 'Mark completed', info: 'Your work on ' + j.job_number + ' · ' + j.job_name + ' is finished. The job goes to the next section straight away.',
    label: 'Note (optional)', button: 'Mark completed', run: (t) => act('JOB_SECTION_COMPLETE', { job_id: j.job_id, note: t, job_subsection_id: j.work.my_job_subsection_id && j.work.role === 'SUBSECTION' ? j.work.my_job_subsection_id : undefined })
  });

  ja.verify = (j) => MS.jobFiles.verify(j);
  ja.notOk = (j) => MS.jobFiles.notOk(j);
  ja.sendProof = (j) => MS.jobFiles.sendProof(j);
  ja.openJob = (j) => { location.href = 'jobs/job.html?id=' + encodeURIComponent(j.job_id) + '#jfPanel'; return false; };

  ja.hold = (j) => MS.sc.ask({
    title: 'Return / hold with reason', info: j.job_number + ' will be put on hold and the General Manager is told. Only the General Manager or the CEO can start it again.',
    label: 'Reason', required: true, danger: true, button: 'Put on hold', run: (t) => act('JOB_SECTION_HOLD', { job_id: j.job_id, reason: t })
  });

  const STEPS = [['CUTTING', 'Cutting'], ['NUMBERING', 'Numbering'], ['FINISHING', 'Finishing']];
  ja.pdSteps = (j) => {
    const have = {};
    (j.pd_steps || []).forEach((s) => { have[s.step_code] = s; });
    return MS.sc.ask({
      title: 'Production Department steps', info: 'Tick the steps this job needs. Steps already done stay ticked.',
      extra: `<div class="pick-list">${STEPS.map(([c, n]) => `<label><input type="checkbox" class="steppick" value="${c}"${have[c] && have[c].status !== 'NOT_NEEDED' ? ' checked' : ''}${have[c] && have[c].status === 'DONE' ? ' disabled' : ''}> ${n}</label>`).join('')}</div>`,
      noText: true, button: 'Save steps',
      run: () => {
        const steps = Array.from(document.querySelectorAll('.steppick')).filter((x) => x.checked || x.disabled && have[x.value] && have[x.value].status === 'DONE').map((x) => x.value);
        return act('JOB_PD_STEPS_SET', { job_id: j.job_id, steps });
      }
    });
  };

  ja.pdStepDone = (j, code) => MS.sc.ask({
    title: 'Complete ' + MS.label(code).toLowerCase(), info: j.job_number + ' · ' + j.job_name, label: 'Note (optional)', button: 'Mark done',
    run: (t) => act('JOB_PD_STEP_DONE', { job_id: j.job_id, step_code: code, note: t })
  });

  ja.done = async (j) => {
    if (!(await MS.confirm({ title: 'Mark job done', message: j.job_number + ' · ' + j.job_name + ' is finished in the Production Department. This closes the job.', confirmText: 'Mark job done' }))) return false;
    await act('JOB_DONE', { job_id: j.job_id });
    return true;
  };

  /** The buttons for one job, as html; wire them with ja.wire(box, getJob, after). */
  ja.buttons = (j) => {
    const w = j.work || {};
    return [
      w.forward && '<button type="button" class="primary" data-ja="forward">Forward to subsection</button>',
      w.complete && w.gate === 'VERIFY' && '<button type="button" class="primary" data-ja="verify">Verified</button>',
      w.hold && w.gate === 'VERIFY' && '<button type="button" class="danger" data-ja="notOk">Not OK – send back to GM</button>',
      w.gate === 'PROOF' && w.send_proof && '<button type="button" class="primary" data-ja="sendProof">Send to customer for approval</button>',
      w.gate === 'PROOF' && !w.send_proof && w.role && '<button type="button" data-ja="openJob">Open the files</button>',
      w.complete && !w.gate && '<button type="button" class="primary" data-ja="complete">Mark completed</button>',
      w.pd_steps && '<button type="button" data-ja="pdSteps">Tick the steps</button>',
      w.role === 'PD' && (j.pd_steps || []).length === 0 && '<button type="button" data-ja="pdSteps">Tick the steps</button>',
      w.pd_done && '<button type="button" class="primary" data-ja="done">Mark job done</button>',
      w.hold && w.gate !== 'VERIFY' && '<button type="button" class="danger" data-ja="hold">Return / hold with reason</button>'
    ].filter(Boolean).join('');
  };

  /** Click handling for buttons made by ja.buttons and the per-step buttons (data-step). after() redraws the page. */
  ja.wire = (box, find, after) => {
    box.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-ja],[data-step]');
      if (!b || !box.contains(b)) return;
      const j = find(b);
      if (!j) return;
      try {
        let changed;
        if (b.dataset.step) changed = await ja.pdStepDone(j, b.dataset.step);
        else changed = await ja[b.dataset.ja](j);
        if (changed) after();
      } catch (err) { MS.alert(err.message); }
    });
  };
})();
