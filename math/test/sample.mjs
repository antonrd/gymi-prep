// Pretty-print a few generated exercises to eyeball the book-style output.
import { generateChain, RESULT_TYPES } from '../js/generator.js';
import { GROUPS } from '../js/operations.js';

function show(cfg, title) {
  console.log(`\n=== ${title} ===`);
  for (let i = 0; i < 4; i++) {
    const c = generateChain(cfg);
    if (!c) { console.log('(generation failed)'); continue; }
    const lines = [];
    lines.push(`  ${c.start.toMixedString()}`); // start value
    for (const s of c.steps) lines.push(`  ${s.render()}`);
    lines.push(`  = ${c.result.toMixedString()}   [${c.resultType}]`);
    console.log(`\n Aufgabe ${i + 1}.`);
    console.log(lines.join('\n'));
  }
}

show(
  { rows: 8, rangeMin: 0, rangeMax: 100, allowedTypes: new Set([RESULT_TYPES.INTEGER]), opGroups: new Set(Object.values(GROUPS)) },
  'Default: integers, all ops, 0–100'
);
show(
  { rows: 6, rangeMin: 0, rangeMax: 500, allowedTypes: new Set([RESULT_TYPES.INTEGER, RESULT_TYPES.FRACTION]), opGroups: new Set(Object.values(GROUPS)) },
  'Common fractions allowed, 0–500'
);
