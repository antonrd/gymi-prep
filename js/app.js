// app.js — bootstrap + screen router. Owns the current attempt and wires the
// setup / session / report modules together, plus IndexedDB persistence & resume.

import * as db from './db.js';
import { initSetupChips, readSettings, buildExercise } from './settings.js';
import { Session } from './session.js';
import { Report } from './report.js';
import { renderHistory } from './history.js';

const SCREENS = ['setup', 'solve', 'report', 'retry', 'history'];
function showScreen(name) {
  for (const s of SCREENS) {
    document.getElementById(`screen-${s}`).classList.toggle('active', s === name);
  }
}

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

let currentSession = null;
let currentAttempt = null;

async function refreshTotalScore() {
  try {
    const total = await db.getTotalScore();
    document.getElementById('total-score').textContent = `★ ${total} Punkte`;
  } catch {
    /* db unavailable — leave default */
  }
}

async function persist(attempt) {
  try {
    await db.saveAttempt(attempt);
  } catch (e) {
    console.warn('Speichern fehlgeschlagen:', e);
  }
}

// --- Flow ------------------------------------------------------------------

async function startNewExercise() {
  const setupErr = document.getElementById('setup-error');
  setupErr.textContent = '';
  const parsed = readSettings();
  if (parsed.error) {
    setupErr.textContent = parsed.error;
    return;
  }
  let specChains;
  try {
    specChains = buildExercise(parsed.settings);
  } catch (e) {
    setupErr.textContent =
      'Mit diesen Einstellungen konnten keine Aufgaben erzeugt werden. ' +
      'Bitte den Zahlenraum vergrößern oder mehr Rechenarten wählen.';
    return;
  }

  const now = new Date().toISOString();
  currentAttempt = {
    id: uuid(),
    createdAt: now,
    startedAt: now,
    endedAt: null,
    status: 'in_progress',
    settings: parsed.settings,
    examples: specChains.map((c) => ({
      start: { n: c.start.n, d: c.start.d },
      steps: c.steps,
      result: c.result,
      resultType: c.resultType,
      firstAnswer: null,
      firstCorrect: null,
      withinTimeOnFirst: null,
      retryCorrect: null,
    })),
    score: 0,
    bonus: 0,
  };
  await persist(currentAttempt);
  launchSession(currentAttempt);
}

function launchSession(attempt) {
  currentAttempt = attempt;
  showScreen('solve');
  document.getElementById('timer').classList.remove('overtime');
  document.getElementById('overtime-notice').classList.remove('show');
  showCancelConfirm(false);

  currentSession = new Session(
    attempt,
    (a) => finishExercise(a),
    (a) => persist(a)
  );
  currentSession.start();
}

async function finishExercise(attempt) {
  attempt.status = 'completed';
  attempt.endedAt = new Date().toISOString();
  await persist(attempt);

  const report = new Report(attempt, {
    onRescore: async (a) => {
      await persist(a);
      refreshTotalScore();
    },
    onNew: () => resetToSetup(),
    showScreen,
  });
  currentReport = report;
  report.render();
  showScreen('report');
  refreshTotalScore();
}

let currentReport = null;

// --- Cancel current exercise -----------------------------------------------

function showCancelConfirm(show) {
  document.getElementById('cancel-confirm').classList.toggle('show', show);
}

async function cancelExercise() {
  showCancelConfirm(false);
  currentSession?.stop();
  currentSession = null;
  // wipe every record of this session from the database
  if (currentAttempt) {
    try {
      await db.deleteAttempt(currentAttempt.id);
    } catch (e) {
      console.warn('Löschen fehlgeschlagen:', e);
    }
  }
  currentAttempt = null;
  refreshTotalScore();
  await resetToSetup();
}

async function resetToSetup() {
  currentSession?.stop();
  currentSession = null;
  currentAttempt = null;
  document.getElementById('setup-error').textContent = '';
  await checkResumable();
  showScreen('setup');
}

// --- Resume ----------------------------------------------------------------

async function checkResumable() {
  const banner = document.getElementById('resume-banner');
  let resumable = null;
  try {
    resumable = await db.getResumableAttempt();
  } catch {
    /* ignore */
  }
  if (!resumable) {
    banner.classList.remove('show');
    return;
  }
  const started = new Date(resumable.startedAt);
  const answered = resumable.examples.filter((e) => e.firstAnswer != null).length;
  document.getElementById('resume-text').textContent =
    `Offene Übung vom ${started.toLocaleDateString('de-CH')} ` +
    `${started.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })} ` +
    `(${answered}/${resumable.examples.length} gelöst).`;
  banner.classList.add('show');

  document.getElementById('btn-resume').onclick = () => {
    banner.classList.remove('show');
    launchSession(resumable);
  };
  document.getElementById('btn-discard').onclick = async () => {
    await db.deleteAttempt(resumable.id);
    banner.classList.remove('show');
  };
}

// --- Wire up ---------------------------------------------------------------

async function openHistory() {
  await renderHistory(() => refreshTotalScore());
  showScreen('history');
}

function init() {
  initSetupChips();
  document.getElementById('btn-start').onclick = startNewExercise;
  document.getElementById('btn-new').onclick = resetToSetup;
  document.getElementById('btn-history').onclick = openHistory;
  document.getElementById('btn-history-back').onclick = () => resetToSetup();
  document.getElementById('btn-cancel').onclick = () => showCancelConfirm(true);
  document.getElementById('btn-cancel-no').onclick = () => showCancelConfirm(false);
  document.getElementById('btn-cancel-yes').onclick = () => cancelExercise();
  refreshTotalScore();
  checkResumable();
  showScreen('setup');
}

init();
