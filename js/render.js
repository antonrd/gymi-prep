// render.js — turn a chain (start + step specs) into DOM, book-style, with stacked
// fractions where fractions appear.

import { Rational } from './rational.js';
import { renderSpec } from './operations.js';

// Reconstruct a live chain object from a stored plain spec-chain.
// specChain = { start:{n,d}, steps:[spec,...] }
import { applySpec } from './operations.js';

export function rehydrateChain(specChain, allowedTypesArr) {
  const start = new Rational(specChain.start.n, specChain.start.d);
  const values = [start];
  let v = start;
  for (const spec of specChain.steps) {
    v = applySpec(spec, v);
    values.push(v);
  }
  return { start, steps: specChain.steps, values, result: values[values.length - 1] };
}

// Serialize a generated chain (with candidate objects) to a plain spec-chain.
export function toSpecChain(chain) {
  return {
    start: { n: chain.start.n, d: chain.start.d },
    steps: chain.steps.map((s) => s.spec),
    resultType: chain.resultType,
    // store result as plain rational for scoring/report without recompute
    result: { n: chain.result.n, d: chain.result.d },
  };
}

// Build an inline stacked-fraction element from a "A/B" substring inside text.
function fractionSpan(a, b) {
  const frac = document.createElement('span');
  frac.className = 'frac';
  const num = document.createElement('span');
  num.className = 'num';
  num.textContent = a;
  const den = document.createElement('span');
  den.className = 'den';
  den.textContent = b;
  frac.append(num, den);
  return frac;
}

// Render a text line that may contain "N A/B" or "A/B" as a nice fraction.
function lineWithFractions(text) {
  const wrap = document.createElement('span');
  // Match optional whole number then A/B, or a bare A/B.
  const re = /(?:(-?\d+)\s+)?(\d+)\/(\d+)/;
  let rest = text;
  let guard = 0;
  while (guard++ < 10) {
    const m = rest.match(re);
    if (!m) {
      if (rest) wrap.append(document.createTextNode(rest));
      break;
    }
    const before = rest.slice(0, m.index);
    if (before) wrap.append(document.createTextNode(before));
    if (m[1] !== undefined) {
      const whole = document.createElement('span');
      whole.className = 'mixed-whole';
      whole.textContent = m[1];
      wrap.append(whole);
    }
    wrap.append(fractionSpan(m[2], m[3]));
    rest = rest.slice(m.index + m[0].length);
  }
  return wrap;
}

/** Render the whole chain into the given container element. */
export function renderChain(container, chain) {
  container.innerHTML = '';

  const startEl = document.createElement('div');
  startEl.className = 'chain-start';
  startEl.append(lineWithFractions(chain.start.toMixedString()));
  container.append(startEl);

  for (const step of chain.steps) {
    const opEl = document.createElement('div');
    opEl.className = 'chain-op';
    const spec = step.spec || step; // works for live candidate or bare spec
    opEl.append(lineWithFractions(renderSpec(spec)));
    container.append(opEl);
  }
}
