// Simulate the app's data flow without a DOM: generate an exercise, answer every
// example (some right, some wrong), run scoring + bonus, and assert the numbers.
import { generateExercise, RESULT_TYPES } from '../js/generator.js';
import { GROUPS } from '../js/operations.js';
import { toSpecChain, rehydrateChain } from '../js/render.js';
import { Rational } from '../js/rational.js';
import { checkAnswer } from '../js/answer.js';
import { computeScore, pointsForExample } from '../js/scoring.js';

let pass = 0, fail = 0;
const fails = [];
const ok = (c, m) => (c ? pass++ : (fail++, fails.push(m)));

// Build a 6-example integer exercise.
const chains = generateExercise({
  examples: 6, rows: 8, rangeMin: 0, rangeMax: 100,
  allowedTypes: new Set([RESULT_TYPES.INTEGER]),
  opGroups: new Set(Object.values(GROUPS)),
});
const specChains = chains.map(toSpecChain);
ok(specChains.length === 6, 'six spec-chains');

// Turn into attempt-style examples and verify rehydration reproduces the result.
const examples = specChains.map((c) => ({
  start: { n: c.start.n, d: c.start.d },
  steps: c.steps,
  result: c.result,
  resultType: c.resultType,
  firstAnswer: null, firstCorrect: null, withinTimeOnFirst: null, retryCorrect: null,
}));

for (const ex of examples) {
  const chain = rehydrateChain(ex);
  const trueV = new Rational(ex.result.n, ex.result.d);
  ok(chain.result.equals(trueV), 'rehydrated result matches stored result');
}

// Answer: examples 0..3 correct within time, example 4 wrong, example 5 correct.
examples.forEach((ex, i) => {
  const trueV = new Rational(ex.result.n, ex.result.d);
  const correctStr = trueV.toMixedString();
  if (i === 4) {
    ex.firstAnswer = String(trueV.n + 1); // wrong
    ex.firstCorrect = false;
    ex.withinTimeOnFirst = true;
  } else {
    ex.firstAnswer = correctStr;
    const res = checkAnswer(correctStr, trueV, ex.resultType);
    ex.firstCorrect = res.correct;
    ex.withinTimeOnFirst = true;
  }
});

// 5 correct within time (3 each) + 1 wrong (0) = 15 base.
// allSubmittedWithinTime=true, 1 incorrect -> bonus 15. Total 30.
let score = computeScore(examples, true);
ok(score.base === 15, `base 15 (got ${score.base})`);
ok(score.bonus === 15, `bonus 15 for 1 incorrect (got ${score.bonus})`);
ok(score.total === 30, `total 30 (got ${score.total})`);

// Now retry-fix example 4: earns 1 pt, but incorrect-at-report was measured pre-retry,
// so bonus stays 15 (based on firstCorrect count). base becomes 15 + 1 = 16.
examples[4].retryCorrect = true;
score = computeScore(examples, true);
ok(pointsForExample(examples[4]) === 1, 'retry-fixed example worth 1');
ok(score.base === 16, `base 16 after retry (got ${score.base})`);
ok(score.bonus === 15, `bonus still 15 (firstCorrect-based) (got ${score.bonus})`);
ok(score.total === 31, `total 31 (got ${score.total})`);

// Overtime case: same answers but not all within time -> no bonus, 2pts each.
const otExamples = examples.map((e) => ({ ...e, withinTimeOnFirst: false, retryCorrect: null }));
score = computeScore(otExamples, false);
ok(score.bonus === 0, 'no bonus when not all within time');
ok(score.base === 10, `5 correct * 2pts = 10 (got ${score.base})`);

// All-correct-within-time perfect run -> +20 bonus.
const perfect = examples.map((e) => ({ ...e, firstCorrect: true, withinTimeOnFirst: true, retryCorrect: null }));
score = computeScore(perfect, true);
ok(score.base === 18, `6 * 3 = 18 (got ${score.base})`);
ok(score.bonus === 20, `perfect bonus 20 (got ${score.bonus})`);
ok(score.total === 38, `total 38 (got ${score.total})`);

console.log(`\nPASSED: ${pass}  FAILED: ${fail}`);
if (fail) {
  fails.slice(0, 20).forEach((f) => console.log('  ✗ ' + f));
  process.exit(1);
}
console.log('Flow + scoring correct. ✅');
