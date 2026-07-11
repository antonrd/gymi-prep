// session.js — the solving screen: renders one example at a time, runs the timer,
// records answers, advances, and calls onFinish when all examples are submitted.
//
// The timer counts from the attempt's original startedAt (so resumed attempts keep
// counting), turns red when past the limit, but never blocks the user.

import { Rational } from './rational.js';
import { rehydrateChain } from './render.js';
import { renderChain } from './render.js';
import { checkAnswer } from './answer.js';
import { RESULT_TYPES } from './generator.js';

const els = {};
function el(id) {
  return (els[id] ||= document.getElementById(id));
}

function fmtClock(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function answerHelpText(resultTypes) {
  const parts = [];
  if (resultTypes.includes(RESULT_TYPES.FRACTION)) {
    parts.push('Gemeine Brüche als <code>N A/B</code> (z. B. <code>1 1/2</code> oder <code>3/4</code>)');
  }
  if (resultTypes.includes(RESULT_TYPES.DECIMAL)) {
    parts.push('Dezimalzahlen als eine Zahl (z. B. <code>1.5</code>)');
  }
  parts.push('Ganze Zahlen als eine Zahl (z. B. <code>42</code>)');
  return 'So schreibst du deine Antwort: ' + parts.join(' · ');
}

export class Session {
  /**
   * @param attempt  the mutable attempt record (with .examples spec-chains + answers)
   * @param onFinish callback(attempt) when all examples submitted
   * @param onProgress callback(attempt) after each submit (for autosave)
   */
  constructor(attempt, onFinish, onProgress) {
    this.attempt = attempt;
    this.onFinish = onFinish;
    this.onProgress = onProgress || (() => {});
    this.timerId = null;
    this.overtimeShown = false;
  }

  start() {
    // resume at the first not-yet-answered example
    this.index = this.attempt.examples.findIndex((e) => e.firstAnswer == null);
    if (this.index === -1) this.index = this.attempt.examples.length; // all done already

    this.limitMs = this.attempt.settings.timeLimitMin * 60 * 1000;
    this.startMs = new Date(this.attempt.startedAt).getTime();

    el('btn-submit').onclick = () => this.submit();
    el('answer-input').onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.submit();
      }
    };
    el('answer-help').innerHTML = answerHelpText(this.attempt.settings.resultTypes);

    this._tick();
    this.timerId = setInterval(() => this._tick(), 1000);

    if (this.index >= this.attempt.examples.length) this._finish();
    else this._renderCurrent();
  }

  stop() {
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = null;
  }

  elapsedMs() {
    return Date.now() - this.startMs;
  }
  isOvertime() {
    return this.elapsedMs() > this.limitMs;
  }

  _tick() {
    const remaining = this.limitMs - this.elapsedMs();
    const timer = el('timer');
    if (remaining >= 0) {
      timer.textContent = fmtClock(remaining);
    } else {
      timer.textContent = '+' + fmtClock(-remaining);
      timer.classList.add('overtime');
      if (!this.overtimeShown) {
        this.overtimeShown = true;
        el('overtime-notice').classList.add('show');
      }
    }
  }

  _renderCurrent() {
    const ex = this.attempt.examples[this.index];
    const chain = rehydrateChain(ex);
    el('progress-pill').textContent = `Aufgabe ${this.index + 1} / ${this.attempt.examples.length}`;
    el('chain-number').textContent = `${this.index + 1}.`;
    renderChain(el('chain'), chain);
    const input = el('answer-input');
    input.value = '';
    input.classList.remove('shake');
    // autofocus (defer so it works after screen switch)
    setTimeout(() => input.focus(), 30);
  }

  submit() {
    const ex = this.attempt.examples[this.index];
    const input = el('answer-input');
    const raw = input.value;
    if (raw.trim() === '') {
      input.focus();
      return;
    }
    const trueValue = new Rational(ex.result.n, ex.result.d);
    const res = checkAnswer(raw, trueValue, ex.resultType);

    ex.firstAnswer = raw.trim();
    ex.firstCorrect = res.correct;
    ex.withinTimeOnFirst = !this.isOvertime();
    ex.retryCorrect = null;

    this.onProgress(this.attempt);

    this.index++;
    if (this.index >= this.attempt.examples.length) this._finish();
    else this._renderCurrent();
  }

  _finish() {
    this.stop();
    // "all submitted within time" = the last submit happened before overtime began.
    // We approximate: eligible if the timer was not in overtime at finish AND every
    // example was answered. (withinTimeOnFirst per example gives the precise per-item
    // flag used by scoring's bonus.)
    this.attempt.allSubmittedWithinTime = this.attempt.examples.every(
      (e) => e.firstAnswer != null && e.withinTimeOnFirst
    );
    this.attempt.solveElapsedMs = this.elapsedMs();
    this.onFinish(this.attempt);
  }
}
