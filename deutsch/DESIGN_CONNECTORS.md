# Gymi-Prep: Bindewörter (German Connectors) Trainer — Design Doc

**Status:** Draft for review
**Scope:** A static HTML page for testing German connectors (Konjunktionen,
Subjunktionen, Konjunktionaladverbien, Paarkonjunktionen), styled to match the
arithmetic trainer (`/index.html`) so the whole thing reads as one child-friendly
site.

---

## 1. Product summary

A German-language, static, offline-capable page. The student fills connectors into
gap sentences ("Setze das passende Bindewort ein."). Each sentence may have **several
correct answers**, and the app accepts all of them. Sessions are assembled by
level/category, checked, reported, and mistakes can be retried — same shape as the
arithmetic trainer.

This becomes a sibling page of the arithmetic trainer. The site will grow into a
small multi-page hub (a landing page linking to each trainer).

---

## 2. Key decisions (locked)

| Decision | Choice |
|---|---|
| Stack | Plain HTML + CSS + JS. No framework, no build step. Static. |
| Theme | Reuse `css/styles.css` (the arithmetic trainer's child-friendly theme). |
| Screens | Same flow: Setup → Solving → Report → Retry (+ History later). |
| **Accepted answers** | **Per-sentence, curated.** Each sentence lists its own accepted alternatives. Word-level equivalence groups are only a *fallback default* when a sentence doesn't specify. |
| Session assembly | Student picks level/category + number of questions; app samples sentences. |
| Primary grouping | **Semantic category** (Reason, Contrast, Time, Condition, Addition, Alternative…). |
| Multi-gap | Paired connectors (`weder … noch`) render one inline input per gap (as in the current prototype). |
| Language | German UI. |

---

## 3. Why per-sentence accepted answers (the core rule)

Acceptability depends on the *sentence*, not just the connector. From the data:

- `Wenn ich am Abend Zeit habe, …` — accepts **Falls** ✓
- `Immer wenn Lukas … besucht, …` — accepts **only wenn** (❌ "Immer falls" is wrong)
- `Du darfst …, wenn du … fertig hast` — accepts **wenn / falls** ✓

A single global "wenn ↔ falls ↔ sofern" group would wrongly accept `falls` in the
`Immer wenn` sentence. Therefore:

1. Each sentence record carries an explicit `accepted` list (its correct answer plus
   the alternatives that work *in that sentence*).
2. A word-level `EQUIV_GROUPS`-style table exists only as a **fallback**: if a
   sentence's `accepted` is missing/empty, fall back to the connector's group. For
   curated sentences (all of ours) the per-sentence list wins and the fallback is
   never consulted.

This keeps authoring honest: the CSV's `Accepted alternatives` column is the source
of truth, sentence by sentence.

### 3.1 Avoiding ambiguous paired-connector sentences (authoring rule)

A two-gap sentence can be **structurally ambiguous**: a different paired connector
may fit the same two blanks and produce a valid but *opposite* sentence. Example:

> `Das Rezept braucht ___ Mehl ___ Zucker.`
> — intended `sowohl … als auch` (both), but `weder … noch` (neither) fits too.

Since only one pair is in the `accepted` list, the sentence must be written so **only
the intended pair makes sense**. Disambiguation techniques used:

- **`sowohl … als auch`** (both) — add positive/existential context that a "neither"
  reading contradicts: *"Sie ist sehr musikalisch und spielt sowohl Klavier als auch
  Geige."* ("weder … noch" contradicts "musikalisch").
- **`weder … noch`** (neither) — the verb **inversion after the second part**
  (`noch habe ich …`) already blocks `sowohl`/`entweder`; where there's no inversion
  (two nouns), add a **negative consequence**: *"Weder … noch … hat den Schlüssel,
  deshalb kommen wir nicht ins Haus."*
- **`entweder … oder`** (one of two) — assert an exclusive choice: *"…immer eines von
  beiden: entweder Milch oder Orangensaft."* (rules out "neither").
- **`nicht nur … sondern auch` / `zwar … aber`** — the **comma before the second
  blank** (required by these) makes `weder … noch` punctuationally wrong, so they're
  self-disambiguating.

Rule for new two-gap sentences: before adding one, mentally substitute the *other*
paired connectors; if any fits grammatically, add context until only the intended one
does.

---

## 4. Data model

Two data files, mirroring the two CSVs. Converted to JS (or JSON) so the page needs
no CSV parser at runtime, but kept in a shape that's trivially regenerable from the
CSVs by a small build script (dev-only, not part of the static site).

### 4.1 Connectors (the word inventory) — from `german_connectors_level1.csv`

```js
{
  id: 'S04',
  word: 'wenn',
  meaning: 'if / when',
  type: 'Subjunktion',          // Konjunktion | Subjunktion | Paarkonjunktion | Konjunktionaladverb
  category: 'Bedingung / Zeit', // semantic group (German label)
  wordOrder: 'Verb ans Ende',   // short German rule label
  cefr: 'A1',
  zapStars: 5,
  gapCount: 1,                  // 1 or 2
  confusedWith: ['als'],
}
```

### 4.2 Sentences (the exercise bank) — from `german_connectors_exercises_level2.csv`

```js
{
  connectorId: 'S04',
  gapSentence: '______ ich am Abend Zeit habe, lese ich ein Buch.',
  fullSentence: 'Wenn ich am Abend Zeit habe, lese ich ein Buch.',
  accepted: ['Wenn', 'Falls'],   // ALL answers correct *in this sentence*
  gapCount: 1,                    // number of blanks (2 for paired)
  parts: null,                    // for 2-gap: e.g. ['weder','noch'] display split
  context: 'Hobbies',
  difficulty: 'Medium',          // Easy | Medium | Challenging
  skill: 'Sentence-initial subordinator',
}
```

**Normalization for checking:** answers compared case-insensitively, umlauts folded
(ä→ae…), punctuation/`...`-stripped, whitespace-collapsed — same `norm()` as the
prototype. So `Wenn`/`wenn` match, and paired answers are the joined blank values.

**Two-gap sentences:** the gap sentence has two `______`; we render one inline input
per gap. The joined value (blank1 + " " + blank2) is normalized and matched against
the normalized `accepted` entries (each stored as e.g. `"weder noch"`). This reuses
the fix already in the prototype.

### 4.3 Deriving the data from the CSVs

A dev script (`deutsch/build_data.mjs`, Node, not shipped) reads the two CSVs and
emits `deutsch/connectors_data.js` (an ES module exporting `CONNECTORS` and
`SENTENCES`). Re-run it whenever the CSVs change. The `Accepted alternatives` column
is split on `/` and combined with `Correct answer`; capitalization from the actual
sentence is preserved for the display, but checking is case-insensitive.

---

## 5. Session assembly (setup screen)

Student chooses:
- **Kategorie(n)** — semantic categories (multi-select chips): Grund/Verknüpfung,
  Gegensatz, Grund/Folge, Zeit, Bedingung, Alternative, Aufzählung … (derived from
  the `category` values). "Alle" default.
- **Schwierigkeit** — Easy / Medium / Challenging (multi-select). Default all.
- **Anzahl Aufgaben** — default e.g. 15.
- **Zeit (Minuten)** — optional timer, default 15 (reusing the arithmetic timer, or
  off — see Open Question Q2).
- **Start** → samples that many sentences from the filtered pool (no connector
  repeated until the pool is exhausted; shuffle within).

If a category/difficulty filter yields fewer sentences than requested, use what's
available (and tell the student).

---

## 6. Screens & flow (same as arithmetic)

```
Setup ──▶ Solving (one sentence at a time) ──▶ Report (grid ✓/✗) ──▶ Retry
```

- **Solving:** the gap sentence with inline input(s), a "Prüfen"/"Weiter" button, and
  after checking, feedback showing ✓/✗ plus the accepted answers ("auch möglich: …")
  and the full correct sentence. Auto-focus first blank; Enter moves between blanks /
  submits (already implemented in the prototype).
- **Report:** grid of all sentences with ✓/✗; click a ✗ to retry it.
- **Retry:** one sentence, check, show correct/incorrect, back to report.
- **History (later):** reuse the arithmetic IndexedDB pattern to store attempts.

Scoring: mirror the arithmetic trainer (3/2/1 per item + completion bonus), OR a
simpler correct-count + Note. **Open Question Q1.**

---

## 7. Grouping in the UI

Primary grouping = **semantic category**. Concretely:
- Setup chips are the categories.
- The report can subhead by category ("Gegensatz: 3/4 richtig").
- After a wrong answer, the feedback can note the category and the confusion partner
  ("wenn vs. als: 'als' nur für ein einmaliges Ereignis in der Vergangenheit"), using
  `confusedWith` + a short German hint. (Nice-to-have; **Open Question Q3.**)

---

## 8. File structure

```
/deutsch/
  connectors.html            # the trainer page (was konjunktionen_bindewoerter_app.html)
  connectors_data.js         # generated: CONNECTORS + SENTENCES
  connectors_app.js          # UI logic (or inline <script> to start)
  build_data.mjs             # dev-only CSV → data.js
  german_connectors_level1.csv
  german_connectors_exercises_level2.csv
/css/styles.css              # shared theme (already exists)
/index.html                  # arithmetic trainer (unchanged)
```

The existing `konjunktionen_bindewoerter_app.html` prototype is superseded by this;
we keep it until the new page reaches parity, then remove it.

---

## 9. Content: we need more sentences

Current `level2.csv` covers only S04, S05, P01, P02, A01, A05 (~5 each). The word
inventory has 43 connectors. Target: **≥ 5 sentences per connector**, each with a
correct answer and any accepted alternatives *for that sentence*.

**Open Question Q4 — how do we produce the missing sentences?** Options:
- You author/extend the CSV (most control over quality & Swiss context).
- I draft candidate sentences per connector for you to review/correct (fast, but you
  must vet German correctness — I can get grammar wrong, and ZAP nuance matters).
- A mix: I draft, you approve in batches.

Whatever the source, every sentence's `accepted` list must be verified by a human —
this is the part where correctness really matters for a test.

---

## 10. Resolved / open questions

1. **Scoring model** — ✅ **Simple: correct-count + Swiss Note (1–6).** Show X/N correct
   and a Note. Fix the prototype's average-Note bug (it re-applies the points→grade map
   to already-computed grades); use a plain average instead.
2. **Timer** — open. Lean toward **optional/off by default** for a language drill (Q).
3. **Confusion hints** — open. Nice-to-have: surface `confusedWith` on wrong answers.
4. **Sentence sourcing** — ✅ **I draft candidates per connector; user verifies in
   batches** before they go live. Build the app first on the current 6 connectors.
5. **Landing page** — open; build the small `/` hub later.

---

## 11. Suggested build order

1. `build_data.mjs` + generate `connectors_data.js` from the current CSVs (proves the
   pipeline; small data set is fine).
2. New `connectors.html` using the shared theme + the Setup→Solving→Report→Retry flow,
   driven by the generated data, with **per-sentence accepted answers**.
3. Verify in a browser (single- and two-gap sentences, alternatives accepted/rejected
   correctly per sentence).
4. Expand the sentence bank to ≥5 per connector (§9, Q4).
5. Scoring + optional history + landing page.
```
