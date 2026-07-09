// report.js — the report grid + retry flow.
//
// Renders summary stats (time, score, bonus), a grid of all examples with ✓/✗,
// and lets the user click a wrong one to retry it. Retry uses the same strict
// checker; a corrected example flips retryCorrect = true and re-scores.

import { Rational } from './rational.js';
import { rehydrateChain, renderChain } from './render.js';
import { checkAnswer } from './answer.js';
import { RESULT_TYPES } from './generator.js';
import { computeScore } from './scoring.js';

const els = {};
function el(id) {
  return (els[id] ||= document.getElementById(id));
}

function fmtDuration(ms) {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function canonicalAnswer(ex) {
  const v = new Rational(ex.result.n, ex.result.d);
  if (ex.resultType === RESULT_TYPES.DECIMAL && !v.isInteger()) return v.toDecimalString();
  return v.toMixedString();
}

export class Report {
  /**
   * @param attempt   the completed attempt (mutable — retries update it)
   * @param callbacks { onRescore(attempt), onNew(), showScreen(name) }
   */
  constructor(attempt, callbacks) {
    this.attempt = attempt;
    this.cb = callbacks;
  }

  render() {
    this._renderSummary();
    this._renderGrid();
  }

  _renderSummary() {
    const a = this.attempt;
    const score = computeScore(a.examples, a.allSubmittedWithinTime);
    a.score = score.total;
    a.bonus = score.bonus;

    const limitMs = a.settings.timeLimitMin * 60 * 1000;
    const overTime = (a.solveElapsedMs || 0) > limitMs;
    const correct = a.examples.filter((e) => e.firstCorrect).length;

    const summary = el('report-summary');
    summary.innerHTML = '';
    const stat = (cls, label, value) => {
      const d = document.createElement('div');
      d.className = `stat ${cls}`;
      d.innerHTML = `<div class="label">${label}</div><div class="value">${value}</div>`;
      return d;
    };
    summary.append(
      stat('', 'Richtig', `${correct} / ${a.examples.length}`),
      stat(overTime ? 'time-bad' : 'time-ok', 'Zeit', fmtDuration(a.solveElapsedMs || 0)),
      stat('score', 'Punkte', String(score.total))
    );

    const banner = el('bonus-banner');
    if (score.bonus > 0) {
      banner.style.display = 'block';
      banner.textContent = `🎉 Bonus: +${score.bonus} Punkte!`;
    } else {
      banner.style.display = 'none';
    }

    // persist re-score
    this.cb.onRescore(a);
  }

  _renderGrid() {
    const grid = el('report-grid');
    grid.innerHTML = '';
    this.attempt.examples.forEach((ex, i) => {
      const cell = document.createElement('div');
      const solvedNow = ex.firstCorrect;
      const fixed = !ex.firstCorrect && ex.retryCorrect;
      cell.className = 'report-cell ' + (solvedNow ? 'correct' : fixed ? 'fixed' : 'wrong');

      const mark = solvedNow ? '✓' : fixed ? '✓' : '✗';
      cell.innerHTML =
        `<div class="rc-num">Aufgabe ${i + 1}</div>` +
        `<div class="rc-mark">${mark}</div>`;

      if (!solvedNow) {
        const hint = document.createElement('div');
        hint.className = 'rc-hint';
        hint.textContent = fixed ? 'Verbessert!' : 'Nochmal versuchen';
        cell.append(hint);
        if (!fixed) {
          cell.onclick = () => this._openRetry(i);
        }
      }
      grid.append(cell);
    });
  }

  _openRetry(index) {
    this.retryIndex = index;
    const ex = this.attempt.examples[index];
    const chain = rehydrateChain(ex);
    el('retry-number').textContent = `${index + 1}.`;
    renderChain(el('retry-chain'), chain);
    el('retry-feedback').textContent = '';
    el('retry-feedback').className = 'feedback';
    el('retry-help').innerHTML = '';
    const input = el('retry-input');
    input.value = '';

    el('btn-retry-submit').onclick = () => this._submitRetry();
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this._submitRetry();
      }
    };
    el('btn-retry-back').onclick = () => {
      this.render();
      this.cb.showScreen('report');
    };

    this.cb.showScreen('retry');
    setTimeout(() => input.focus(), 30);
  }

  _submitRetry() {
    const ex = this.attempt.examples[this.retryIndex];
    const raw = el('retry-input').value;
    if (raw.trim() === '') return;
    const trueValue = new Rational(ex.result.n, ex.result.d);
    const res = checkAnswer(raw, trueValue, ex.resultType);
    const fb = el('retry-feedback');

    if (res.correct) {
      ex.retryCorrect = true;
      fb.textContent = '✓ Richtig! (+1 Punkt)';
      fb.className = 'feedback good';
      el('retry-help').innerHTML = '';
      el('btn-retry-submit').disabled = true;
      this.cb.onRescore(this.attempt);
      // auto-return to the report after a short beat
      setTimeout(() => {
        el('btn-retry-submit').disabled = false;
        this.render();
        this.cb.showScreen('report');
      }, 1100);
    } else {
      fb.textContent = '✗ Noch nicht richtig — versuch es nochmal.';
      fb.className = 'feedback bad';
      // gentle nudge showing the expected form (not the value)
      el('retry-help').innerHTML =
        res.reason === 'wrong-form'
          ? `Achte auf die Schreibweise für dieses Ergebnis.`
          : '';
    }
  }
}
