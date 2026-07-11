// settings.js — the setup screen: build option chips, read + validate settings,
// generate the exercise.

import { RESULT_TYPES, generateExercise } from './generator.js';
import { GROUPS, GROUP_LABELS } from './operations.js';
import { toSpecChain } from './render.js';

const RESULT_TYPE_LABELS = {
  [RESULT_TYPES.INTEGER]: 'Ganze Zahlen',
  [RESULT_TYPES.DECIMAL]: 'Dezimalbrüche',
  [RESULT_TYPES.FRACTION]: 'Gemeine Brüche',
};

function buildChips(container, entries, checkedIds) {
  container.innerHTML = '';
  for (const [id, label] of entries) {
    const chip = document.createElement('label');
    chip.className = 'chip';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = id;
    input.checked = checkedIds.includes(id);
    if (input.checked) chip.classList.add('checked');
    const span = document.createElement('span');
    span.textContent = label;
    chip.append(input, span);
    input.addEventListener('change', () => chip.classList.toggle('checked', input.checked));
    container.append(chip);
  }
}

export function initSetupChips() {
  buildChips(
    document.getElementById('chips-result-types'),
    Object.entries(RESULT_TYPE_LABELS),
    [RESULT_TYPES.INTEGER] // default: integers only
  );
  buildChips(
    document.getElementById('chips-op-groups'),
    Object.values(GROUPS).map((g) => [g, GROUP_LABELS[g]]),
    Object.values(GROUPS) // default: all operations
  );
}

function checkedValues(containerId) {
  return [...document.querySelectorAll(`#${containerId} input:checked`)].map((i) => i.value);
}

/** Read + validate the form. Returns { settings } or { error }. */
export function readSettings() {
  const num = (id) => parseInt(document.getElementById(id).value, 10);
  const examples = num('in-examples');
  const rows = num('in-rows');
  let rangeMin = num('in-range-min');
  let rangeMax = num('in-range-max');
  const timeLimitMin = num('in-time');
  const resultTypes = checkedValues('chips-result-types');
  const opGroups = checkedValues('chips-op-groups');

  if (!Number.isFinite(examples) || examples < 1 || examples > 60)
    return { error: 'Anzahl Aufgaben muss zwischen 1 und 60 liegen.' };
  if (!Number.isFinite(rows) || rows < 2 || rows > 20)
    return { error: 'Zeilen pro Aufgabe muss zwischen 2 und 20 liegen.' };
  if (!Number.isFinite(rangeMin) || !Number.isFinite(rangeMax))
    return { error: 'Bitte gültige Zahlen für den Zahlenraum eingeben.' };
  if (rangeMin > rangeMax) [rangeMin, rangeMax] = [rangeMax, rangeMin];
  if (rangeMin < -2000 || rangeMax > 2000)
    return { error: 'Der Zahlenraum muss zwischen −2000 und +2000 liegen.' };
  if (rangeMax - rangeMin < 5)
    return { error: 'Der Zahlenraum ist zu klein — bitte etwas größer wählen.' };
  if (!Number.isFinite(timeLimitMin) || timeLimitMin < 1 || timeLimitMin > 120)
    return { error: 'Die Zeit muss zwischen 1 und 120 Minuten liegen.' };
  if (resultTypes.length === 0)
    return { error: 'Bitte mindestens einen Ergebnis-Typ wählen.' };
  if (opGroups.length === 0)
    return { error: 'Bitte mindestens eine Rechenart wählen.' };

  return {
    settings: { examples, rows, rangeMin, rangeMax, timeLimitMin, resultTypes, opGroups },
  };
}

/** Generate an exercise (array of spec-chains) from validated settings. */
export function buildExercise(settings) {
  const chains = generateExercise({
    examples: settings.examples,
    rows: settings.rows,
    rangeMin: settings.rangeMin,
    rangeMax: settings.rangeMax,
    allowedTypes: new Set(settings.resultTypes),
    opGroups: new Set(settings.opGroups),
  });
  return chains.map(toSpecChain);
}
