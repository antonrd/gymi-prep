// scoring.js — points & bonus, per the spec.
//
// Per problem:
//   3 pts  correct first try, within time limit
//   2 pts  correct first try, after time limit
//   1 pt   initially wrong (shown ✗ in report), later corrected on retry
//
// Completion bonus — only if ALL problems were submitted within the time limit:
//   incorrect(at report) 0 → +20, 1 → +15, 2 → +10, 3 → +5, 4+ → 0

export function pointsForExample(ex) {
  if (ex.firstCorrect) return ex.withinTimeOnFirst ? 3 : 2;
  if (ex.retryCorrect) return 1;
  return 0;
}

export function computeScore(examples, allSubmittedWithinTime) {
  const base = examples.reduce((sum, ex) => sum + pointsForExample(ex), 0);

  let bonus = 0;
  if (allSubmittedWithinTime) {
    const incorrectAtReport = examples.filter((ex) => !ex.firstCorrect).length;
    const table = { 0: 20, 1: 15, 2: 10, 3: 5 };
    bonus = table[incorrectAtReport] ?? 0;
  }
  return { base, bonus, total: base + bonus };
}
