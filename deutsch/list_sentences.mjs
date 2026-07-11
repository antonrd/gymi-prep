// list_sentences.mjs — dev-only. Emits a plain text file with one filled-in sentence
// per line: for each sentence, one line per accepted answer (the gap filled in).
//   node deutsch/list_sentences.mjs  ->  deutsch/sentences_filled.txt

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SENTENCES } from './connectors_data.js';

const here = dirname(fileURLToPath(import.meta.url));

// Substitute an accepted answer into the gap sentence. 1-gap: whole answer in the
// single blank. 2-gap: split the answer into the two parts that go in each blank.
// Multi-word paired connectors have an explicit split point (keyed by the joined
// accepted phrase, lowercased) so e.g. "nicht nur sondern auch" -> "nicht nur" |
// "sondern auch" rather than "nicht" | "nur sondern auch".
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
function splitParts(accepted, gapCount) {
  const key = accepted.toLowerCase().replace(/\s+/g, ' ').trim();
  if (PAIRED_SPLIT[key]) return PAIRED_SPLIT[key];
  const words = accepted.split(/\s+/);
  if (words.length === gapCount) return words;
  return [words[0], words.slice(1).join(' ')]; // fallback: first word | rest
}
function fill(gapSentence, accepted, gapCount) {
  const blanks = gapSentence.split(/_{2,}/);
  if (gapCount <= 1) return blanks.join(accepted);
  const parts = splitParts(accepted, gapCount);
  let out = '';
  blanks.forEach((seg, i) => {
    out += seg;
    if (i < blanks.length - 1) {
      let part = parts[i] ?? '';
      // Capitalize the word that begins the sentence (blank at very start).
      if (out === '' && part) part = part.charAt(0).toUpperCase() + part.slice(1);
      out += part;
    }
  });
  return out;
}

const lines = [];
for (const s of SENTENCES) {
  for (const a of s.accepted) {
    lines.push(fill(s.gapSentence, a, s.gapCount));
  }
}

const outPath = join(here, 'sentences_filled.txt');
writeFileSync(outPath, lines.join('\n') + '\n');
console.log(`Wrote ${outPath} (${lines.length} lines from ${SENTENCES.length} sentences)`);
