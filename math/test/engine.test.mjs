// Self-test harness for the chain engine. Run with: node test/engine.test.mjs
// No test framework — plain asserts, so it runs anywhere Node is present.

import { Rational } from '../js/rational.js';
import { checkAnswer, parseAnswer } from '../js/answer.js';
import {
  generateChain,
  generateExercise,
  RESULT_TYPES,
  resultTypeOf,
  valueAllowed,
} from '../js/generator.js';
import { GROUPS, applySpec, renderSpec, isRegular, typeKey } from '../js/operations.js';

let passed = 0;
let failed = 0;
const failures = [];

function ok(cond, msg) {
  if (cond) passed++;
  else {
    failed++;
    failures.push(msg);
  }
}
function eq(a, b, msg) {
  ok(a === b, `${msg} (expected ${b}, got ${a})`);
}

// --- Rational unit tests -----------------------------------------------------
{
  ok(new Rational(2, 4).equals(new Rational(1, 2)), 'rational reduces 2/4=1/2');
  ok(new Rational(6, 2).isInteger(), '6/2 is integer');
  eq(new Rational(1, 2).add(new Rational(1, 3)).toMixedString(), '5/6', '1/2+1/3=5/6');
  eq(new Rational(3, 2).toMixedString(), '1 1/2', '3/2 mixed = 1 1/2');
  eq(new Rational(-3, 2).toMixedString(), '-1 1/2', 'negative mixed');
  ok(new Rational(1, 2).isTerminatingDecimal(), '1/2 terminating');
  ok(!new Rational(1, 3).isTerminatingDecimal(), '1/3 not terminating');
  eq(new Rational(60).mul(new Rational(1, 12)).toMixedString(), '5', '60 * 1/12 = 5');
  ok(new Rational(60).mul(new Rational(1, 7)).d !== 1, '60 * 1/7 not integer');
}

// --- parseAnswer / checkAnswer ----------------------------------------------
{
  eq(parseAnswer('1 1/2').value.toMixedString(), '1 1/2', 'parse mixed');
  eq(parseAnswer('3/4').value.toMixedString(), '3/4', 'parse pure fraction');
  eq(parseAnswer('1.5').value.toMixedString(), '1 1/2', 'parse decimal 1.5');
  eq(parseAnswer('1,5').value.toMixedString(), '1 1/2', 'parse comma decimal');
  eq(parseAnswer('-7').value.toMixedString(), '-7', 'parse negative int');
  ok(parseAnswer('abc').error, 'garbage rejected');
  ok(parseAnswer('1/0').error, 'div-by-zero rejected');

  // strict form matching
  const five = Rational.int(5);
  ok(checkAnswer('5', five, RESULT_TYPES.INTEGER).correct, 'int row: 5 accepted');
  ok(!checkAnswer('5.0', five, RESULT_TYPES.INTEGER).correct, 'int row: 5.0 rejected');
  ok(!checkAnswer('5/1', five, RESULT_TYPES.INTEGER).correct, 'int row: 5/1 rejected');

  const half = new Rational(1, 2);
  ok(checkAnswer('1/2', half, RESULT_TYPES.FRACTION).correct, 'frac row: 1/2 accepted');
  ok(!checkAnswer('0.5', half, RESULT_TYPES.FRACTION).correct, 'frac row: 0.5 rejected');
  ok(checkAnswer('0.5', half, RESULT_TYPES.DECIMAL).correct, 'dec row: 0.5 accepted');
  ok(!checkAnswer('1/2', half, RESULT_TYPES.DECIMAL).correct, 'dec row: 1/2 rejected');

  // integer true-value in a fraction row must be typed as integer
  ok(checkAnswer('5', five, RESULT_TYPES.FRACTION).correct, 'frac row, int value: 5 ok');
  ok(!checkAnswer('5/1', five, RESULT_TYPES.FRACTION).correct, 'frac row, int value: 5/1 rejected');

  // wrong value
  ok(!checkAnswer('6', five, RESULT_TYPES.INTEGER).correct, 'wrong value rejected');
}

// --- Chain invariants across many configs -----------------------------------
function assertChainValid(chain, cfg, label) {
  // 1. row count
  eq(chain.steps.length, cfg.rows, `${label}: row count`);
  // 2. every value in range and of an allowed type
  for (const v of chain.values) {
    ok(
      valueAllowed(v, cfg.allowedTypes, cfg.rangeMin, cfg.rangeMax),
      `${label}: value ${v.toMixedString()} allowed & in range [${cfg.rangeMin},${cfg.rangeMax}]`
    );
  }
  // 3. replaying steps reproduces the values (apply is pure & consistent)
  let v = chain.start;
  for (let i = 0; i < chain.steps.length; i++) {
    v = chain.steps[i].apply(v);
    ok(v.equals(chain.values[i + 1]), `${label}: step ${i} replay matches`);
  }
  // 3b. spec round-trip: JSON-serialize specs, replay via applySpec — must match.
  //     (This is what IndexedDB persistence relies on.)
  const specs = JSON.parse(JSON.stringify(chain.steps.map((s) => s.spec)));
  let vs = chain.start;
  for (let i = 0; i < specs.length; i++) {
    ok(typeof renderSpec(specs[i]) === 'string', `${label}: spec ${i} renders`);
    vs = applySpec(specs[i], vs);
    ok(vs.equals(chain.values[i + 1]), `${label}: spec ${i} applySpec matches`);
  }
  // 3c. no step undoes the previous one: value[i+1] must never return to value[i-1].
  for (let i = 1; i < chain.values.length - 1; i++) {
    ok(
      !chain.values[i + 1].equals(chain.values[i - 1]),
      `${label}: step ${i} does not undo step ${i - 1} ` +
        `(${chain.values[i - 1].toMixedString()} → ${chain.values[i].toMixedString()} → back)`
    );
  }
  // 3d. repetition limits: specials never repeat their type consecutively; regulars
  //     appear at most twice in a row.
  {
    let run = 0;
    let prevKey = null;
    for (const step of chain.steps) {
      const key = typeKey(step.spec);
      run = key === prevKey ? run + 1 : 1;
      const limit = isRegular(step.spec) ? 2 : 1;
      ok(
        run <= limit,
        `${label}: '${renderSpec(step.spec)}' run length ${run} exceeds limit ${limit}`
      );
      prevKey = key;
    }
  }
  // 4. result equals last value & the answer round-trips through checkAnswer
  ok(chain.result.equals(chain.values[chain.values.length - 1]), `${label}: result = last value`);
  const rt = chain.resultType;
  let correctForm;
  if (rt === RESULT_TYPES.INTEGER) correctForm = chain.result.toMixedString();
  else if (rt === RESULT_TYPES.DECIMAL)
    correctForm = chain.result.isInteger() ? chain.result.toMixedString() : chain.result.toDecimalString();
  else correctForm = chain.result.toMixedString(); // fraction
  ok(
    checkAnswer(correctForm, chain.result, rt).correct,
    `${label}: canonical answer "${correctForm}" accepted for ${rt}`
  );
}

const configs = [
  {
    name: 'default (int, all ops, 0-100)',
    rows: 8, rangeMin: 0, rangeMax: 100,
    allowedTypes: new Set([RESULT_TYPES.INTEGER]),
    opGroups: new Set(Object.values(GROUPS)),
  },
  {
    name: 'int only, basic ops',
    rows: 8, rangeMin: 0, rangeMax: 100,
    allowedTypes: new Set([RESULT_TYPES.INTEGER]),
    opGroups: new Set([GROUPS.ADD, GROUPS.SUB, GROUPS.MUL, GROUPS.DIV]),
  },
  {
    name: 'wide range, all ops',
    rows: 10, rangeMin: -2000, rangeMax: 2000,
    allowedTypes: new Set([RESULT_TYPES.INTEGER]),
    opGroups: new Set(Object.values(GROUPS)),
  },
  {
    name: 'decimals allowed',
    rows: 6, rangeMin: 0, rangeMax: 200,
    allowedTypes: new Set([RESULT_TYPES.INTEGER, RESULT_TYPES.DECIMAL]),
    opGroups: new Set(Object.values(GROUPS)),
  },
  {
    name: 'common fractions allowed',
    rows: 6, rangeMin: 0, rangeMax: 200,
    allowedTypes: new Set([RESULT_TYPES.INTEGER, RESULT_TYPES.FRACTION]),
    opGroups: new Set(Object.values(GROUPS)),
  },
  {
    name: 'small range stress',
    rows: 8, rangeMin: 0, rangeMax: 30,
    allowedTypes: new Set([RESULT_TYPES.INTEGER]),
    opGroups: new Set([GROUPS.ADD, GROUPS.SUB, GROUPS.MUL, GROUPS.DIV, GROUPS.FRACMUL]),
  },
];

const N_PER_CONFIG = 200;
for (const cfg of configs) {
  let genFails = 0;
  for (let i = 0; i < N_PER_CONFIG; i++) {
    const chain = generateChain(cfg);
    if (!chain) {
      genFails++;
      continue;
    }
    assertChainValid(chain, cfg, cfg.name);
  }
  ok(genFails === 0, `${cfg.name}: generated all ${N_PER_CONFIG} (fails=${genFails})`);
}

// --- generateExercise smoke --------------------------------------------------
{
  const chains = generateExercise({
    examples: 12, rows: 8, rangeMin: 0, rangeMax: 100,
    allowedTypes: new Set([RESULT_TYPES.INTEGER]),
    opGroups: new Set(Object.values(GROUPS)),
  });
  eq(chains.length, 12, 'generateExercise produced 12 examples');
}

// --- report ------------------------------------------------------------------
console.log(`\nPASSED: ${passed}   FAILED: ${failed}`);
if (failed) {
  console.log('\nFirst failures:');
  for (const f of failures.slice(0, 25)) console.log('  ✗ ' + f);
  process.exit(1);
} else {
  console.log('All engine invariants hold. ✅');
}
