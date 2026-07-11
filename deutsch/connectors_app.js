// connectors_app.js — the Bindewörter trainer.
// Flow: Setup → Solving → Report → Retry. Per-sentence accepted answers.
// Scoring: correct-count + Swiss Note (1–6).

import { CONNECTORS, SENTENCES } from './connectors_data.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['setup', 'solve', 'report', 'retry'];
function showScreen(name) {
  for (const s of SCREENS) $(`screen-${s}`).classList.toggle('active', s === name);
}

// --- normalization + checking ----------------------------------------------
// Fold case/umlauts/punctuation so "Wenn" == "wenn" and "weder ... noch" == "weder noch".
function norm(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[.,;:!?]/g, ' ')
    .replace(/…|\.\.\./g, ' ')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
    .trim();
}
function acceptedSet(sentence) {
  return new Set((sentence.accepted || []).map(norm));
}
function isCorrect(answer, sentence) {
  return acceptedSet(sentence).has(norm(answer));
}

// --- Swiss Note (1–6) -------------------------------------------------------
// Linear: 0 correct → 1, all correct → 6. Rounded to nearest 0.25, clamped [1,6].
function swissNote(correct, total) {
  if (total === 0) return 1;
  const n = 1 + (5 * correct) / total;
  return Math.max(1, Math.min(6, Math.round(n * 4) / 4));
}
function fmtNote(n) {
  return n.toFixed(2).replace(/0$/, '').replace(/\.$/, '').replace('.', ',');
}

// --- shuffle / sampling -----------------------------------------------------
function shuffle(a) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- setup: build chips -----------------------------------------------------
const DIFFICULTIES = ['Easy', 'Medium', 'Challenging'];
const DIFFICULTY_DE = { Easy: 'Leicht', Medium: 'Mittel', Challenging: 'Schwer' };

function categoriesInData() {
  return [...new Set(SENTENCES.map((s) => s.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'de')
  );
}

function buildChips(container, entries, checked) {
  container.innerHTML = '';
  for (const [value, label, count] of entries) {
    const chip = document.createElement('label');
    chip.className = 'chip';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = value;
    input.checked = checked;
    if (checked) chip.classList.add('checked');
    const span = document.createElement('span');
    span.textContent = count != null ? `${label} (${count})` : label;
    chip.append(input, span);
    input.addEventListener('change', () => {
      chip.classList.toggle('checked', input.checked);
      updatePoolInfo();
    });
    container.append(chip);
  }
}

function checkedValues(containerId) {
  return [...document.querySelectorAll(`#${containerId} input:checked`)].map((i) => i.value);
}

function filteredPool() {
  const cats = new Set(checkedValues('chips-categories'));
  const diffs = new Set(checkedValues('chips-difficulty'));
  return SENTENCES.filter(
    (s) => (cats.size === 0 || cats.has(s.category)) && (diffs.size === 0 || diffs.has(s.difficulty))
  );
}

function updatePoolInfo() {
  const pool = filteredPool();
  $('pool-info').textContent = `Verfügbare Sätze mit dieser Auswahl: ${pool.length}`;
}

function initSetup() {
  const catCounts = {};
  for (const s of SENTENCES) catCounts[s.category] = (catCounts[s.category] || 0) + 1;
  buildChips(
    $('chips-categories'),
    categoriesInData().map((c) => [c, c, catCounts[c]]),
    true
  );
  buildChips(
    $('chips-difficulty'),
    DIFFICULTIES.map((d) => [d, DIFFICULTY_DE[d]]),
    true
  );
  updatePoolInfo();
}

// --- session state ----------------------------------------------------------
let session = null; // { items:[{sentence, answer, correct, retried}], index }

function startSession() {
  $('setup-error').textContent = '';
  const count = parseInt($('in-count').value, 10);
  if (!Number.isFinite(count) || count < 1 || count > 60) {
    $('setup-error').textContent = 'Anzahl Aufgaben muss zwischen 1 und 60 liegen.';
    return;
  }
  const pool = filteredPool();
  if (pool.length === 0) {
    $('setup-error').textContent = 'Keine Sätze mit dieser Auswahl. Bitte Filter anpassen.';
    return;
  }
  // Sample: shuffle, prefer covering distinct connectors before repeating.
  const byConnector = shuffle(pool);
  const picked = byConnector.slice(0, Math.min(count, pool.length));
  session = {
    items: shuffle(picked).map((sentence) => ({
      sentence,
      answer: null,
      correct: null,
      retried: false,
    })),
    index: 0,
  };
  showCancelConfirm(false);
  showScreen('solve');
  renderCurrent();
}

// --- render a gap sentence with inline inputs -------------------------------
function metaPillsHtml(sentence) {
  const pills = [
    { kind: 'category', label: 'Kategorie', value: sentence.category },
    { kind: 'difficulty', label: 'Schwierigkeit', value: DIFFICULTY_DE[sentence.difficulty] || sentence.difficulty },
  ].filter((p) => p.value);
  return pills
    .map(
      (p) =>
        `<span class="pill pill--${p.kind}">` +
        `<span class="pill-label">${escapeHtml(p.label)}:</span>` +
        `<span class="pill-value">${escapeHtml(p.value)}</span>` +
        `</span>`
    )
    .join('');
}

// Size an input to hug its content (via the `size` attribute = character count), so
// blanks stay short and the sentence flows naturally instead of showing wide gaps.
const MIN_BLANK_CHARS = 5;
function autosize(inp) {
  inp.size = Math.max(MIN_BLANK_CHARS, inp.value.length + 1);
}

function renderSentenceInto(containerEl, sentence, { locked = false, answer = null } = {}) {
  // Split the gap sentence on runs of underscores; interleave inputs.
  const segments = sentence.gapSentence.split(/_{2,}/);
  containerEl.innerHTML = '';
  const inputs = [];
  segments.forEach((seg, i) => {
    if (seg) containerEl.append(document.createTextNode(seg));
    if (i < segments.length - 1) {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'blankInput';
      inp.autocomplete = 'off';
      inp.setAttribute('autocapitalize', 'off');
      inp.setAttribute('spellcheck', 'false');
      inp.dataset.idx = String(inputs.length);
      autosize(inp);
      inp.addEventListener('input', () => autosize(inp));
      containerEl.append(inp);
      inputs.push(inp);
    }
  });
  return inputs;
}

let activeInputs = [];

function renderCurrent() {
  const item = session.items[session.index];
  $('progress-pill').textContent = `Aufgabe ${session.index + 1} / ${session.items.length}`;
  $('solve-meta').innerHTML = metaPillsHtml(item.sentence);
  $('feedback').textContent = '';
  $('feedback').className = 'feedback';
  $('solution-block').innerHTML = '';
  $('btn-check').style.display = '';
  $('btn-next').style.display = 'none';

  activeInputs = renderSentenceInto($('sentence'), item.sentence);
  wireInputs(activeInputs, () => checkCurrent(), $('btn-check'), $('btn-next'), () => nextCurrent());
  setTimeout(() => activeInputs[0]?.focus(), 40);
}

function wireInputs(inputs, onSubmit, checkBtn, nextBtn, onNext) {
  inputs.forEach((inp, i) => {
    inp.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (checkBtn.style.display !== 'none') {
        if (i < inputs.length - 1) inputs[i + 1].focus();
        else onSubmit();
      } else if (onNext) {
        onNext();
      }
    });
  });
}

function collectAnswer(inputs) {
  return inputs.map((i) => i.value.trim()).join(' ').replace(/\s+/g, ' ').trim();
}

function solutionBlockHtml(sentence, correct) {
  const accepted = sentence.accepted || [];
  const words = accepted.map((w) => `<span class="word">${escapeHtml(w)}</span>`).join(' / ');
  const lead = correct
    ? ''
    : `<div class="solution-line">Richtig wäre: ${words}</div>`;
  const alsoNote =
    correct && accepted.length > 1
      ? `<div class="solution-line">Auch möglich: ${words}</div>`
      : '';
  return `${lead}${alsoNote}<div class="full-sentence">${escapeHtml(sentence.fullSentence)}</div>`;
}

function lockInputs(inputs, correct) {
  inputs.forEach((inp) => {
    inp.disabled = true;
    inp.classList.add('locked', correct ? 'ok' : 'bad');
  });
}

function checkCurrent() {
  const item = session.items[session.index];
  const values = activeInputs.map((i) => i.value.trim());
  if (values.some((v) => !v)) {
    activeInputs.find((i) => !i.value.trim())?.focus();
    return;
  }
  const answer = collectAnswer(activeInputs);
  const correct = isCorrect(answer, item.sentence);
  item.answer = answer;
  item.correct = correct;

  lockInputs(activeInputs, correct);
  $('btn-check').style.display = 'none';
  $('btn-next').style.display = '';
  $('feedback').textContent = correct ? '✓ Richtig!' : '✗ Leider falsch.';
  $('feedback').className = 'feedback ' + (correct ? 'good' : 'bad');
  $('solution-block').innerHTML = solutionBlockHtml(item.sentence, correct);
  $('btn-next').focus();
}

function nextCurrent() {
  session.index++;
  if (session.index >= session.items.length) showReport();
  else renderCurrent();
}

// --- report -----------------------------------------------------------------
function correctCount() {
  return session.items.filter((it) => it.correct || it.retried).length;
}

function showReport() {
  const total = session.items.length;
  const firstCorrect = session.items.filter((it) => it.correct).length;
  const nowCorrect = correctCount();
  const note = swissNote(nowCorrect, total);

  const summary = $('report-summary');
  summary.innerHTML = '';
  const tile = (cls, label, value) => {
    const d = document.createElement('div');
    d.className = `stat ${cls}`;
    d.innerHTML = `<div class="label">${label}</div><div class="value">${value}</div>`;
    return d;
  };
  summary.append(
    tile('', 'Richtig', `${nowCorrect} / ${total}`),
    tile('score', 'Note', `<span class="note-big">${fmtNote(note)}</span>`)
  );

  const grid = $('report-grid');
  grid.innerHTML = '';
  session.items.forEach((it, i) => {
    const cell = document.createElement('div');
    const fixed = !it.correct && it.retried;
    cell.className = 'report-cell ' + (it.correct ? 'correct' : fixed ? 'fixed' : 'wrong');
    const mark = it.correct || fixed ? '✓' : '✗';
    cell.innerHTML =
      `<div class="rc-num">${escapeHtml(it.sentence.word)}</div>` +
      `<div class="rc-mark">${mark}</div>`;
    if (!it.correct) {
      const hint = document.createElement('div');
      hint.className = 'rc-hint';
      hint.textContent = fixed ? 'Verbessert!' : 'Nochmal versuchen';
      cell.append(hint);
      if (!fixed) cell.onclick = () => openRetry(i);
    }
    grid.append(cell);
  });

  showScreen('report');
}

// --- retry ------------------------------------------------------------------
let retryIndex = -1;
let retryInputs = [];

function openRetry(i) {
  retryIndex = i;
  const item = session.items[i];
  $('retry-meta').innerHTML = metaPillsHtml(item.sentence);
  $('retry-feedback').textContent = '';
  $('retry-feedback').className = 'feedback';
  $('retry-solution-block').innerHTML = '';
  $('btn-retry-check').style.display = '';
  $('btn-retry-check').disabled = false;

  retryInputs = renderSentenceInto($('retry-sentence'), item.sentence);
  wireInputs(retryInputs, submitRetry, $('btn-retry-check'), null, null);
  showScreen('retry');
  setTimeout(() => retryInputs[0]?.focus(), 40);
}

function submitRetry() {
  const item = session.items[retryIndex];
  const values = retryInputs.map((i) => i.value.trim());
  if (values.some((v) => !v)) {
    retryInputs.find((i) => !i.value.trim())?.focus();
    return;
  }
  const answer = collectAnswer(retryInputs);
  const correct = isCorrect(answer, item.sentence);
  lockInputs(retryInputs, correct);
  $('btn-retry-check').disabled = true;

  if (correct) {
    item.retried = true;
    $('retry-feedback').textContent = '✓ Richtig!';
    $('retry-feedback').className = 'feedback good';
    $('retry-solution-block').innerHTML = solutionBlockHtml(item.sentence, true);
    setTimeout(() => showReport(), 1100);
  } else {
    $('retry-feedback').textContent = '✗ Noch nicht richtig — versuch es nochmal.';
    $('retry-feedback').className = 'feedback bad';
    $('retry-solution-block').innerHTML = solutionBlockHtml(item.sentence, false);
    // allow another attempt
    setTimeout(() => openRetry(retryIndex), 1300);
  }
}

// --- cancel -----------------------------------------------------------------
function showCancelConfirm(show) {
  $('cancel-confirm').classList.toggle('show', show);
}
function cancelSession() {
  showCancelConfirm(false);
  session = null;
  showScreen('setup');
}

// --- utils ------------------------------------------------------------------
function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// --- wire up ----------------------------------------------------------------
function init() {
  initSetup();
  $('btn-start').onclick = startSession;
  $('btn-check').onclick = checkCurrent;
  $('btn-next').onclick = nextCurrent;
  $('btn-cancel').onclick = () => showCancelConfirm(true);
  $('btn-cancel-no').onclick = () => showCancelConfirm(false);
  $('btn-cancel-yes').onclick = cancelSession;
  $('btn-new').onclick = () => {
    session = null;
    showScreen('setup');
  };
  $('btn-retry-check').onclick = submitRetry;
  $('btn-retry-back').onclick = () => showReport();
  showScreen('setup');
}
init();
