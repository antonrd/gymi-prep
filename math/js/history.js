// history.js — the "Verlauf" screen: lists past completed runs (date, correct,
// time, points) plus a small lifetime summary. Reads straight from IndexedDB.

import * as db from './db.js';

const els = {};
const el = (id) => (els[id] ||= document.getElementById(id));

function fmtDateTime(iso) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })
  );
}

function fmtDuration(ms) {
  const totalSec = Math.round((ms || 0) / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function correctCount(a) {
  // Count as correct: solved on first try, OR fixed on retry.
  return a.examples.filter((e) => e.firstCorrect || e.retryCorrect).length;
}

/** Render the history screen. `onChange` is called after a delete so app.js can
 *  refresh the total-score badge. */
export async function renderHistory(onChange) {
  let attempts = [];
  try {
    attempts = await db.getAllAttempts();
  } catch {
    /* db unavailable */
  }
  const completed = attempts.filter((a) => a.status === 'completed');

  const body = el('history-body');
  const table = el('history-table');
  const empty = el('history-empty');
  const summary = el('history-summary');

  body.innerHTML = '';

  if (completed.length === 0) {
    table.style.display = 'none';
    empty.style.display = 'block';
    summary.innerHTML = '';
    return;
  }
  table.style.display = '';
  empty.style.display = 'none';

  // Lifetime summary tiles.
  const totalPoints = completed.reduce((s, a) => s + (a.score || 0), 0);
  const totalRuns = completed.length;
  const totalCorrect = completed.reduce((s, a) => s + correctCount(a), 0);
  const totalProblems = completed.reduce((s, a) => s + a.examples.length, 0);
  summary.innerHTML = '';
  const tile = (label, value) => {
    const d = document.createElement('div');
    d.className = 'stat';
    d.innerHTML = `<div class="label">${label}</div><div class="value">${value}</div>`;
    return d;
  };
  summary.append(
    tile('Übungen', String(totalRuns)),
    tile('Punkte gesamt', String(totalPoints)),
    tile('Richtig gesamt', `${totalCorrect} / ${totalProblems}`)
  );

  // One row per run.
  for (const a of completed) {
    const tr = document.createElement('tr');
    const correct = correctCount(a);
    const total = a.examples.length;
    const limitMs = (a.settings?.timeLimitMin || 0) * 60 * 1000;
    const overTime = (a.solveElapsedMs || 0) > limitMs;
    const allCorrect = correct === total;

    const dateTd = document.createElement('td');
    dateTd.className = 'col-date';
    dateTd.textContent = fmtDateTime(a.startedAt);

    const correctTd = document.createElement('td');
    correctTd.className = 'num' + (allCorrect ? ' good' : '');
    correctTd.textContent = `${correct} / ${total}`;

    const timeTd = document.createElement('td');
    timeTd.className = 'num ' + (overTime ? 'bad' : 'good');
    timeTd.textContent = fmtDuration(a.solveElapsedMs);

    const pointsTd = document.createElement('td');
    pointsTd.className = 'num points';
    pointsTd.textContent = String(a.score || 0);

    const actionTd = document.createElement('td');
    actionTd.className = 'col-actions';
    const del = document.createElement('button');
    del.className = 'btn-icon';
    del.title = 'Löschen';
    del.setAttribute('aria-label', 'Diese Übung löschen');
    del.textContent = '🗑';
    del.onclick = async () => {
      await db.deleteAttempt(a.id);
      await renderHistory(onChange);
      onChange?.();
    };
    actionTd.append(del);

    tr.append(dateTd, correctTd, timeTd, pointsTd, actionTd);
    body.append(tr);
  }
}
