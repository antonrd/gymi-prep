// review_sentences.mjs — dev-only. Emits a human-readable review list of every
// sentence with every accepted answer substituted in, so each variation can be
// checked for correctness. Writes deutsch/SENTENCE_REVIEW.md.
//   node deutsch/review_sentences.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CONNECTORS, SENTENCES } from './connectors_data.js';

const here = dirname(fileURLToPath(import.meta.url));
const connById = new Map(CONNECTORS.map((c) => [c.id, c]));

// Fill the gap sentence with the parts of an accepted answer. For a 1-gap sentence
// the whole answer goes in the single blank; for a 2-gap sentence the answer is
// split into words distributed across the blanks (weder noch -> weder | noch;
// "sowohl als auch" over 2 blanks -> sowohl | als auch by matching blank count).
// Explicit split points for multi-word paired connectors (keyed by lowercased
// joined phrase) so "nicht nur sondern auch" -> "nicht nur" | "sondern auch".
const PAIRED_SPLIT = {
  'weder noch': ['weder', 'noch'],
  'entweder oder': ['entweder', 'oder'],
  'sowohl als auch': ['sowohl', 'als auch'],
  'nicht nur sondern auch': ['nicht nur', 'sondern auch'],
  'zwar aber': ['zwar', 'aber'],
  'einerseits andererseits': ['einerseits', 'andererseits'],
  'zum einen zum anderen': ['zum einen', 'zum anderen'],
  'je desto': ['je', 'desto'],
};
function fillVariation(gapSentence, accepted, gapCount) {
  const blanks = gapSentence.split(/_{2,}/);
  if (gapCount <= 1) {
    return blanks.join(`**${accepted}**`);
  }
  const key = accepted.toLowerCase().replace(/\s+/g, ' ').trim();
  let parts;
  if (PAIRED_SPLIT[key]) {
    parts = PAIRED_SPLIT[key];
  } else {
    const words = accepted.split(/\s+/);
    parts = words.length === gapCount ? words : [words[0], words.slice(1).join(' ')];
  }
  let out = '';
  blanks.forEach((seg, i) => {
    out += seg;
    if (i < blanks.length - 1) {
      let part = parts[i] ?? '';
      if (out === '' && part) part = part.charAt(0).toUpperCase() + part.slice(1);
      out += `**${part}**`;
    }
  });
  return out;
}

const byConnector = new Map();
for (const s of SENTENCES) {
  if (!byConnector.has(s.connectorId)) byConnector.set(s.connectorId, []);
  byConnector.get(s.connectorId).push(s);
}

const lines = [];
lines.push('# Sätze zur Überprüfung (Bindewörter)');
lines.push('');
lines.push(
  'Jeder Satz zeigt alle akzeptierten Lösungen eingesetzt, damit jede Variante ' +
    'einzeln auf Korrektheit geprüft werden kann. **Fett** = eingesetzte Lösung.'
);
lines.push('');
lines.push(`_Generiert: ${SENTENCES.length} Sätze, ${byConnector.size} Bindewörter._`);
lines.push('');

let sentenceNo = 0;
for (const [id, sentences] of [...byConnector.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const c = connById.get(id);
  lines.push('---');
  lines.push('');
  lines.push(`## ${c ? c.word : id}  ·  \`${id}\``);
  if (c) {
    lines.push('');
    lines.push(
      `**Typ:** ${c.type} · **Kategorie:** ${c.category} · **Wortstellung:** ${c.wordOrder} · ` +
        `**CEFR:** ${c.cefr} · **ZAP:** ${'★'.repeat(c.zapStars)}` +
        (c.confusedWith.length ? ` · **Verwechselbar mit:** ${c.confusedWith.join(', ')}` : '')
    );
  }
  lines.push('');

  sentences.forEach((s) => {
    sentenceNo++;
    lines.push(`### ${sentenceNo}. ${s.difficulty || '—'} · ${s.context || '—'}`);
    lines.push('');
    lines.push(`- **Lückensatz:** ${s.gapSentence}`);
    lines.push(`- **Akzeptiert (${s.accepted.length}):** ${s.accepted.map((a) => `\`${a}\``).join(' · ')}`);
    if (s.altNotes) lines.push(`- **Notiz:** ${s.altNotes}`);
    lines.push('');
    lines.push('  Varianten:');
    s.accepted.forEach((a) => {
      lines.push(`  - ${fillVariation(s.gapSentence, a, s.gapCount)}`);
    });
    lines.push('');
  });
}

const outPath = join(here, 'SENTENCE_REVIEW.md');
writeFileSync(outPath, lines.join('\n'));
console.log(`Wrote ${outPath}`);
console.log(`${SENTENCES.length} sentences, ${byConnector.size} connectors.`);
