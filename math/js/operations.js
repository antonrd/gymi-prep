// operations.js — the operation catalog.
// Each operation knows: which group it belongs to, how to render itself in German,
// and how to enumerate the *valid operands* for a given running value under the
// current constraints (range + allowed result types). The generator picks from
// these candidate operands; if a candidate list is empty, that operation can't be
// used at this step.

import { Rational } from './rational.js';

// Operation group ids (also the settings-checkbox ids).
export const GROUPS = {
  ADD: 'add',
  SUB: 'sub',
  MUL: 'mul',
  DIV: 'div',
  FRACMUL: 'fracmul', // daraus A/B, die Hälfte
  COMPLEMENT: 'complement', // Rest bis N
  POWER: 'power', // quadriert
};

export const GROUP_LABELS = {
  [GROUPS.ADD]: 'Addition (+)',
  [GROUPS.SUB]: 'Subtraktion (−)',
  [GROUPS.MUL]: 'Multiplikation (×, doppelt, das N-fache)',
  [GROUPS.DIV]: 'Division (:)',
  [GROUPS.FRACMUL]: 'Bruchteile (daraus A/B, die Hälfte)',
  [GROUPS.COMPLEMENT]: 'Rest bis N',
  [GROUPS.POWER]: 'Quadrieren',
};

const REST_TARGETS = [200, 500, 1000, 1200, 2000];
const N_FACHE = [10, 100]; // das 10-fache, das 100-fache
// "daraus A/B" menu — proper fractions A/B < 1, matching the exam book's variety
// (halves through twelfths, incl. fifths, sevenths, eighths, ninths, tenths).
const SMALL_FRACTIONS = [
  [1, 2],
  [1, 3], [2, 3],
  [1, 4], [3, 4],
  [1, 5], [2, 5], [3, 5], [4, 5],
  [1, 6], [5, 6],
  [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7],
  [1, 8], [3, 8], [5, 8], [7, 8],
  [1, 9], [2, 9], [4, 9], [5, 9], [7, 9], [8, 9],
  [1, 10], [3, 10], [7, 10], [9, 10],
  [1, 12], [5, 12], [7, 12], [11, 12],
]; // used by "daraus A/B"

// A candidate is { render(): string, apply(V): Rational }.

// Each candidate is built from a spec so generation records serializable steps.
function cand(spec) {
  return {
    spec,
    render: () => renderSpec(spec),
    apply: (v) => applySpec(spec, v),
  };
}

function candidatesAdd(V, ctx) {
  const out = [];
  for (let n = 1; n <= ctx.maxOperand; n++) {
    if (ctx.accept(V.add(Rational.int(n)))) out.push(cand({ kind: 'add', n }));
  }
  return out;
}

function candidatesSub(V, ctx) {
  const out = [];
  for (let n = 1; n <= ctx.maxOperand; n++) {
    if (ctx.accept(V.sub(Rational.int(n)))) out.push(cand({ kind: 'sub', n }));
  }
  return out;
}

function candidatesMul(V, ctx) {
  const out = [];
  if (V.equals(Rational.int(0))) return out; // ×n on 0 is pointless / trivial
  for (let n = 2; n <= ctx.maxMultiplier; n++) {
    if (ctx.accept(V.mul(Rational.int(n)))) out.push(cand({ kind: 'mul', n }));
  }
  // doppelt (× 2)
  if (ctx.accept(V.mul(Rational.int(2)))) out.push(cand({ kind: 'mul', n: 2, style: 'doppelt' }));
  // das N-fache
  for (const n of N_FACHE) {
    if (ctx.accept(V.mul(Rational.int(n)))) out.push(cand({ kind: 'mul', n, style: 'nfache' }));
  }
  return out;
}

function candidatesDiv(V, ctx) {
  const out = [];
  if (V.equals(Rational.int(0))) return out;
  for (let n = 2; n <= ctx.maxOperand; n++) {
    if (ctx.accept(V.div(Rational.int(n)))) out.push(cand({ kind: 'div', n }));
  }
  return out;
}

function candidatesFracMul(V, ctx) {
  const out = [];
  if (V.equals(Rational.int(0))) return out;
  // die Hälfte
  if (ctx.accept(V.mul(new Rational(1, 2)))) out.push(cand({ kind: 'fracmul', a: 1, b: 2, style: 'haelfte' }));
  // daraus A/B
  for (const [a, b] of SMALL_FRACTIONS) {
    if (ctx.accept(V.mul(new Rational(a, b)))) out.push(cand({ kind: 'fracmul', a, b }));
  }
  return out;
}

function candidatesComplement(V, ctx) {
  const out = [];
  for (const N of REST_TARGETS) {
    if (V.gte(Rational.int(N))) continue; // need N > V for a positive remainder
    if (ctx.accept(Rational.int(N).sub(V))) out.push(cand({ kind: 'complement', N }));
  }
  return out;
}

function candidatesPower(V, ctx) {
  const out = [];
  // quadriert — skip trivial 0/1, must stay valid.
  if (!V.equals(Rational.int(0)) && !V.equals(Rational.int(1)) && ctx.accept(V.mul(V))) {
    out.push(cand({ kind: 'square' }));
  }
  return out;
}

export const OPERATION_GENERATORS = {
  [GROUPS.ADD]: candidatesAdd,
  [GROUPS.SUB]: candidatesSub,
  [GROUPS.MUL]: candidatesMul,
  [GROUPS.DIV]: candidatesDiv,
  [GROUPS.FRACMUL]: candidatesFracMul,
  [GROUPS.COMPLEMENT]: candidatesComplement,
  [GROUPS.POWER]: candidatesPower,
};

// --- Serializable step specs -------------------------------------------------
// A candidate carries a `spec` (plain JSON) so a chain can be stored in IndexedDB
// and later re-rendered / re-applied without holding closures. Each spec has a
// `kind` and its operands. `applySpec` / `renderSpec` are the pure interpreters.

export function applySpec(spec, V) {
  switch (spec.kind) {
    case 'add': return V.add(Rational.int(spec.n));
    case 'sub': return V.sub(Rational.int(spec.n));
    case 'mul': return V.mul(Rational.int(spec.n));
    case 'div': return V.div(Rational.int(spec.n));
    case 'fracmul': return V.mul(new Rational(spec.a, spec.b));
    case 'complement': return Rational.int(spec.N).sub(V);
    case 'square': return V.mul(V);
    default: throw new Error(`applySpec: unknown kind ${spec.kind}`);
  }
}

export function renderSpec(spec) {
  switch (spec.kind) {
    case 'add': return `+ ${spec.n}`;
    case 'sub': return `− ${spec.n}`;
    case 'mul':
      if (spec.style === 'doppelt') return 'doppelt';
      if (spec.style === 'nfache') return `das ${spec.n}-fache`;
      return `× ${spec.n}`;
    case 'div': return `: ${spec.n}`;
    case 'fracmul':
      if (spec.style === 'haelfte') return 'die Hälfte';
      return `daraus ${spec.a}/${spec.b}`;
    case 'complement': return `Rest bis ${spec.N}`;
    case 'square': return 'quadriert';
    default: throw new Error(`renderSpec: unknown kind ${spec.kind}`);
  }
}

// --- Repetition classification ----------------------------------------------
// The "regular" (basic) operations are + − × : as plain forms. Everything else —
// daraus, die Hälfte, doppelt, das N-fache, Rest bis N, quadriert — is "special".
// (A `mul` with a `style` is a special word-form, not a plain × n.)

export function isRegular(spec) {
  if (spec.kind === 'add' || spec.kind === 'sub' || spec.kind === 'div') return true;
  if (spec.kind === 'mul' && !spec.style) return true; // plain × n
  return false;
}

/**
 * A key identifying a step's *type* for the "no repeats" rules. Two steps with the
 * same key are considered the same operation type:
 *   + → 'add', − → 'sub', × n → 'mul', : → 'div',
 *   daraus → 'daraus', die Hälfte → 'haelfte', doppelt → 'doppelt',
 *   das N-fache → 'nfache', Rest bis N → 'complement', quadriert → 'square'.
 */
export function typeKey(spec) {
  switch (spec.kind) {
    case 'mul':
      if (spec.style === 'doppelt') return 'doppelt';
      if (spec.style === 'nfache') return 'nfache';
      return 'mul';
    case 'fracmul':
      return spec.style === 'haelfte' ? 'haelfte' : 'daraus';
    default:
      return spec.kind; // add | sub | div | complement | square
  }
}

export { REST_TARGETS, SMALL_FRACTIONS };
