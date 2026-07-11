// answer.js — parse a typed answer and check it against the true result in STRICT
// mode: the typed answer must both equal the true value AND be written in a form
// matching the row's result type.
//
// Input conventions (shown to the user):
//   common fraction:  "N A/B"  (mixed) or "A/B"   e.g. "1 1/2", "3/4"
//   decimal/integer:  one number                  e.g. "1.5", "12", "-7"
//   comma accepted as decimal separator            e.g. "1,5"

import { Rational } from './rational.js';
import { RESULT_TYPES } from './generator.js';

/**
 * Parse raw input into { value: Rational, form: 'integer'|'decimal'|'fraction' }
 * or { error } if unparseable.
 */
export function parseAnswer(raw) {
  const s = String(raw).trim();
  if (s === '') return { error: 'empty' };

  // Mixed fraction: "N A/B"  (N may be negative)
  let m = s.match(/^(-?\d+)\s+(\d+)\/(\d+)$/);
  if (m) {
    const whole = parseInt(m[1], 10);
    const num = parseInt(m[2], 10);
    const den = parseInt(m[3], 10);
    if (den === 0) return { error: 'zero-denominator' };
    const sign = whole < 0 ? -1 : 1;
    const value = new Rational(sign * (Math.abs(whole) * den + num), den);
    return { value, form: 'fraction' };
  }

  // Pure fraction: "A/B"
  m = s.match(/^(-?\d+)\/(\d+)$/);
  if (m) {
    const num = parseInt(m[1], 10);
    const den = parseInt(m[2], 10);
    if (den === 0) return { error: 'zero-denominator' };
    return { value: new Rational(num, den), form: 'fraction' };
  }

  // Decimal or integer (comma or dot)
  const norm = s.replace(',', '.');
  m = norm.match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (m) {
    const sign = m[1] === '-' ? -1 : 1;
    const intPart = m[2];
    const fracPart = m[3] || '';
    if (fracPart === '') {
      return { value: Rational.int(sign * parseInt(intPart, 10)), form: 'integer' };
    }
    const den = Math.pow(10, fracPart.length);
    const num = parseInt(intPart + fracPart, 10);
    return { value: new Rational(sign * num, den), form: 'decimal' };
  }

  return { error: 'unparseable' };
}

/**
 * Strict check.
 * @param {string} raw  user input
 * @param {Rational} trueValue
 * @param {string} resultType  one of RESULT_TYPES
 * @returns {{correct:boolean, reason?:string}}
 */
export function checkAnswer(raw, trueValue, resultType) {
  const parsed = parseAnswer(raw);
  if (parsed.error) return { correct: false, reason: parsed.error };

  // (a) numeric equality (exact)
  if (!parsed.value.equals(trueValue)) return { correct: false, reason: 'wrong-value' };

  // (b) form must match the row's result type
  switch (resultType) {
    case RESULT_TYPES.INTEGER:
      // must be written as a plain integer: form 'integer' only.
      if (parsed.form !== 'integer') return { correct: false, reason: 'wrong-form' };
      break;
    case RESULT_TYPES.DECIMAL:
      // decimal rows: accept decimal form; also accept integer form iff the true
      // value is actually an integer (then there's no decimal to write).
      if (parsed.form === 'fraction') return { correct: false, reason: 'wrong-form' };
      if (parsed.form === 'integer' && !trueValue.isInteger())
        return { correct: false, reason: 'wrong-form' };
      break;
    case RESULT_TYPES.FRACTION:
      // fraction rows: must be written as a fraction, unless the true value is an
      // integer (then a plain integer is the expected form).
      if (trueValue.isInteger()) {
        if (parsed.form !== 'integer') return { correct: false, reason: 'wrong-form' };
      } else {
        if (parsed.form !== 'fraction') return { correct: false, reason: 'wrong-form' };
      }
      break;
    default:
      return { correct: false, reason: 'unknown-result-type' };
  }

  return { correct: true };
}
