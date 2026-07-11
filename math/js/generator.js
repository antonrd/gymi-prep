// generator.js — forward chain generation with rejection + backtracking.
//
// Strategy: pick a start value, then for each row pick a random enabled operation
// and a random valid operand (one that keeps the running value in range AND of an
// allowed result type). If a row dead-ends, backtrack. Regenerate from scratch if
// we exceed an attempt cap.

import { Rational } from './rational.js';
import {
  GROUPS,
  OPERATION_GENERATORS,
  SMALL_FRACTIONS,
  isRegular,
  typeKey,
} from './operations.js';

// Repetition limits (consecutive steps of the same type):
//   special ops (daraus, die Hälfte, doppelt, das N-fache, Rest bis N, quadriert):
//     no two of the same type in a row.
//   regular ops (+ − × :): at most 2 of the same op in a row.
const MAX_SAME_REGULAR = 2;
const MAX_SAME_SPECIAL = 1;

// Result-type ids (settings checkboxes).
export const RESULT_TYPES = {
  INTEGER: 'integer',
  DECIMAL: 'decimal',
  FRACTION: 'fraction',
};

// "Reasonableness" caps so generated results are sane mental-math answers rather
// than things like 21.462952 or 87/128.
const MAX_DECIMAL_PLACES = 2; // decimals shown to at most 2 places (0.25, 1.5, …)
// Allowed common-fraction denominators. An explicit menu (not "divisors of N") so we
// get variety — fifths, sevenths, eighths, tenths… — while excluding odd ones (13ths,
// 128ths). A value is only a valid fraction result if its reduced denominator is here.
const ALLOWED_FRACTION_DENOMS = new Set([2, 3, 4, 5, 6, 7, 8, 9, 10, 12]);

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Classify a rational into the "narrowest" result type it needs, then check it's
 * allowed. Integer values are always allowed if ANY result type is on (an integer
 * is a valid integer, decimal, and fraction). A non-integer needs decimal or
 * fraction enabled; a non-terminating value (e.g. 1/3) needs fraction enabled.
 */
function valueAllowed(v, allowedTypes, rangeMin, rangeMax) {
  // range: bound the magnitude
  if (v.toNumber() < rangeMin || v.toNumber() > rangeMax) return false;

  if (v.isInteger()) {
    return (
      allowedTypes.has(RESULT_TYPES.INTEGER) ||
      allowedTypes.has(RESULT_TYPES.DECIMAL) ||
      allowedTypes.has(RESULT_TYPES.FRACTION)
    );
  }
  // non-integer, terminating decimal (e.g. 1.5, 0.25) — allowed as a DECIMAL only
  // when short enough, or as a FRACTION when its denominator is small enough.
  if (v.isTerminatingDecimal()) {
    if (allowedTypes.has(RESULT_TYPES.DECIMAL) && v.decimalPlaces() <= MAX_DECIMAL_PLACES) {
      return true;
    }
    if (allowedTypes.has(RESULT_TYPES.FRACTION) && ALLOWED_FRACTION_DENOMS.has(v.d)) {
      return true;
    }
    return false;
  }
  // repeating (e.g. 1/3): only common fractions, and only with a small denominator
  return allowedTypes.has(RESULT_TYPES.FRACTION) && ALLOWED_FRACTION_DENOMS.has(v.d);
}

/** The result type a value should be *displayed/answered* as, given what's allowed. */
export function resultTypeOf(v, allowedTypes) {
  // Integers are answered as integers whenever integer results are on.
  if (v.isInteger()) {
    return allowedTypes.has(RESULT_TYPES.INTEGER)
      ? RESULT_TYPES.INTEGER
      : allowedTypes.has(RESULT_TYPES.DECIMAL)
        ? RESULT_TYPES.DECIMAL
        : RESULT_TYPES.FRACTION;
  }
  // Non-integer: prefer decimal only if it's short enough; else fall back to fraction.
  if (
    allowedTypes.has(RESULT_TYPES.DECIMAL) &&
    v.isTerminatingDecimal() &&
    v.decimalPlaces() <= MAX_DECIMAL_PLACES
  ) {
    return RESULT_TYPES.DECIMAL;
  }
  return RESULT_TYPES.FRACTION;
}

function pickStartValue(cfg, rng) {
  const { rangeMin, rangeMax, allowedTypes } = cfg;
  // Prefer a "nice" start: an integer in range, biased toward round-ish numbers.
  const lo = Math.max(1, Math.ceil(rangeMin));
  const hi = Math.max(lo, Math.floor(rangeMax));
  // A fraction-of start (A/B v. n) if fraction/fracmul flavor is desired — for the
  // engine we start from a plain integer; the "fraction of a number" start is a
  // display choice added below when the first op is a fracmul.
  for (let tries = 0; tries < 50; tries++) {
    const n = lo + Math.floor(rng() * (hi - lo + 1));
    const v = Rational.int(n);
    if (valueAllowed(v, allowedTypes, rangeMin, rangeMax)) return v;
  }
  return Rational.int(Math.min(hi, Math.max(lo, 10)));
}

/**
 * Build one chain.
 * cfg = { rows, rangeMin, rangeMax, allowedTypes:Set, opGroups:Set, rng,
 *         maxOperand, maxMultiplier }
 * Returns { start: Rational, steps: [{render, apply}], values: [Rational], result }
 * or null if it couldn't build within the attempt budget.
 */
export function generateChain(cfg) {
  const rng = cfg.rng || Math.random;
  const allowedTypes = cfg.allowedTypes;
  const rangeMin = cfg.rangeMin;
  const rangeMax = cfg.rangeMax;
  const opGroups = [...cfg.opGroups];

  const ctx = {
    maxOperand: cfg.maxOperand ?? Math.min(20, Math.max(2, Math.floor((rangeMax - rangeMin) / 2))),
    maxMultiplier: cfg.maxMultiplier ?? 12,
    accept: (v) => valueAllowed(v, allowedTypes, rangeMin, rangeMax),
  };

  const MAX_RESTARTS = 40;
  for (let restart = 0; restart < MAX_RESTARTS; restart++) {
    const start = pickStartValue(cfg, rng);
    const steps = [];
    const values = [start];

    let dead = false;
    let backtracks = 0;
    const MAX_BACKTRACKS = cfg.rows * 6;

    while (steps.length < cfg.rows && !dead) {
      const V = values[values.length - 1];
      // The value we had *before* the previous step. If a candidate would return us
      // here, it simply undoes the previous operation (× 2 then die Hälfte, + 5 then
      // − 5, × 6 then daraus 1/6, …) — the student could just skip both. Forbid it.
      const prevValue = values.length >= 2 ? values[values.length - 2] : null;

      // Count how many steps at the tail share the previous step's type, so we can
      // block a candidate that would make a too-long run of the same operation type.
      const prevStep = steps.length ? steps[steps.length - 1] : null;
      const prevKey = prevStep ? typeKey(prevStep.spec) : null;
      let runLen = 0;
      for (let j = steps.length - 1; j >= 0 && typeKey(steps[j].spec) === prevKey; j--) {
        runLen++;
      }
      const repetitionOk = (spec) => {
        if (!prevStep || typeKey(spec) !== prevKey) return true; // different type resets run
        const limit = isRegular(spec) ? MAX_SAME_REGULAR : MAX_SAME_SPECIAL;
        return runLen < limit; // adding one more must not exceed the limit
      };

      // gather candidate operations across enabled groups
      const groupsShuffled = shuffle(opGroups, rng);
      let chosen = null;
      for (const g of groupsShuffled) {
        const gen = OPERATION_GENERATORS[g];
        if (!gen) continue;
        let cands = gen(V, ctx);
        cands = cands.filter((c) => repetitionOk(c.spec));
        if (prevValue) {
          cands = cands.filter((c) => !c.apply(V).equals(prevValue));
        }
        if (cands.length) {
          chosen = cands[Math.floor(rng() * cands.length)];
          break;
        }
      }
      if (chosen) {
        const next = chosen.apply(V);
        steps.push(chosen);
        values.push(next);
      } else {
        // dead end: backtrack
        if (steps.length === 0 || backtracks >= MAX_BACKTRACKS) {
          dead = true;
        } else {
          steps.pop();
          values.pop();
          backtracks++;
        }
      }
    }

    if (!dead && steps.length === cfg.rows) {
      return {
        start,
        steps,
        values,
        result: values[values.length - 1],
        resultType: resultTypeOf(values[values.length - 1], allowedTypes),
      };
    }
  }
  return null;
}

/** Generate a full exercise: `count` chains. Throws if generation fails outright. */
export function generateExercise(cfg) {
  const chains = [];
  for (let i = 0; i < cfg.examples; i++) {
    const chain = generateChain({
      rows: cfg.rows,
      rangeMin: cfg.rangeMin,
      rangeMax: cfg.rangeMax,
      allowedTypes: cfg.allowedTypes,
      opGroups: cfg.opGroups,
      rng: cfg.rng,
    });
    if (!chain) {
      throw new Error(
        `Could not generate chain ${i + 1}: constraints too tight ` +
          `(range ${cfg.rangeMin}..${cfg.rangeMax}, rows ${cfg.rows}).`
      );
    }
    chains.push(chain);
  }
  return chains;
}

export { valueAllowed };
