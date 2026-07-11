# Gymi-Prep: Kopfrechnen (Chain Arithmetic) — Design Doc

**Status:** Draft for review
**Scope:** v1 — a single-page mental-arithmetic trainer, based on the classic Swiss
*"Zahlenraum beliebig"* chain-calculation exercises (see `images/`).

---

## 1. Product summary

A German-language, static, offline-capable web app for students preparing for the
Zurich Gymnasium entrance exam. The first page is a **chain arithmetic trainer**:
the student is shown a column of operations; each row transforms the running value
from the row above; the student computes down to a final `=` result.

The app generates fresh exercises, times the session, checks answers, produces a
report, lets the student retry mistakes, awards points, and stores every attempt in
the browser.

**Non-goals for v1:** accounts/login, server sync, multiplayer, other exercise
types (those become sibling pages later), print/export.

---

## 2. Key decisions (locked)

| Decision | Choice |
|---|---|
| Stack | Plain HTML + CSS + JS. **No framework, no build step.** Deployable as a static site. |
| Storage | IndexedDB (browser-local). No backend. |
| Answer form | **Strict** — the typed answer must match the row's *result type* (an integer row accepts only `5`, not `5.0` or `5/1`). |
| Fraction input syntax | Common fraction = `N A/B` (e.g. `1 1/2`); decimals & integers as one number (`1.5`, `12`). Shown to user as instruction. |
| Visuals | Children-friendly, a bit of color (not flashy), thicker/slightly irregular borders. |
| Language | German UI. |

---

## 3. The operation model (the engine)

Each exercise is a **chain**: a start value, then a list of operations, each applied
to the running value `V`. The final `V` is the answer to the whole example, but the
student conceptually computes each row. (For v1 the student types **only the final
result** per example — matching the images, where only `= 200` is the answer. See
Open Question Q1 if you'd rather grade every row.)

### 3.1 Operation catalog

Grouped as they'll appear in the settings picker:

| Group | Operation | Notation on screen | Effect on `V` |
|---|---|---|---|
| **Addition** | add | `+ n` | `V + n` |
| **Subtraction** | subtract | `− n` | `V − n` |
| **Multiplication** | multiply | `× n` | `V × n` |
| | chained multiply | `× a × b` | `V × a × b` |
| | double | `doppelt` | `V × 2` |
| | N-fold | `das N‑fache` (10, 100…) | `V × N` |
| **Division** | divide | `: n` | `V ÷ n` |
| **Fraction-multiply** | take a fraction of it | `daraus A/B` | `V × A/B` |
| | the half | `die Hälfte` | `V × 1/2` |
| **Complement** | remainder up to N | `Rest bis N` | `N − V` |
| **Power** | square | `quadriert` | `V × V` |
| **Fraction-of** (chain start only) | fraction of a number | `A/B v. n`, `(A/B ± C/D) v. n` | start `V = (A/B) × n` |

Each group is a checkbox in settings. "Fraction-multiply", "Complement", and
"Power" are the "fancy" groups; enabling them makes exercises richer and harder.

### 3.2 Generation strategy — the hard part

Constraints that must all hold simultaneously:
- Every intermediate `V` stays inside the selected **number range** (default 0–100,
  bounds −2000…+2000).
- Every intermediate `V` matches an **allowed result type** (see §3.3).
- Operations are drawn only from **enabled groups**.
- The chain has the requested **row count**.

**Approach: forward generation with rejection + backtracking.**
1. Pick a start value that satisfies the range and result-type rules.
2. For each subsequent row, pick a random enabled operation, then pick its operand
   so the *new* `V` still satisfies range + result-type. (E.g. for `: n`, only choose
   `n` from the divisors of `V`; for `daraus A/B`, only choose `A/B` such that
   `V × A/B` is valid; for `Rest bis N`, only choose `N ≥ V`.)
3. If no operand works for the chosen operation, pick a different operation.
4. If a row is a dead end, backtrack one row. Cap total attempts; regenerate from
   scratch if we exceed the cap.

This is much more reliable than generating a target and working backward, because
the result-type + range rules are checked incrementally.

**No self-cancelling steps.** A step is rejected if it returns the running value to
what it was *two rows earlier* — i.e. it undoes the previous operation (`× 2` then
`die Hälfte`, `+ 5` then `− 5`, even `× 6` then `daraus 1/6`). Otherwise the student
could skip both rows. The check is value-based (`applyB(applyA(V)) === V`), so it
catches every reversal without enumerating operation pairs.

**Repetition limits.** To keep chains varied:
- **Special** operations (daraus, die Hälfte, doppelt, das N-fache, Rest bis N,
  quadriert) may not repeat their *type* on consecutive rows (`daraus 3/8` then
  `daraus 1/2` is forbidden; `die Hälfte` then `daraus 1/2` is fine — different types).
- **Regular** operations (`+ − × :`) may appear at most **twice in a row** of the same
  op (a 3rd consecutive identical one is blocked). Mixing different regular ops is
  unaffected.

Both are enforced via `typeKey(spec)` / `isRegular(spec)` in `operations.js`.

**Important nuance (from you):** fractional operations are allowed even in
integers-only mode, *as long as the row's result is an integer*. So `60 × 1/12 = 5`
is valid in integer mode; `60 × 1/7` is not (not integer) and would be rejected.

### 3.3 Result types

The student selects which result types are allowed for row results:
- **Integers only** (default)
- **Decimal fractions** (e.g. `1.5`) — plus integers
- **Common fractions** incl. mixed (e.g. `3/4`, `1 1/2`) — plus integers

When "common fractions" is on, we keep values as **exact rational numbers**
(numerator/denominator) internally to avoid floating-point error, and only render as
`N A/B` for display/answer-checking. Decimals are also stored as rationals where
possible (`1.5` = `3/2`) so equality is exact.

**Reasonableness caps (enforced in the generator):** to keep results sane for mental
math, decimal row-results are limited to **≤ 2 decimal places**, and common-fraction
results must reduce to a denominator in an explicit menu — **{2,3,4,5,6,7,8,9,10,12}**
(halves through twelfths, for variety, but excluding odd ones like 13ths or 128ths).
Values that don't fit are simply never generated. (The 2-decimal cap was surfaced by
the engine self-test, which caught the generator emitting values like `21.462952`.)

### 3.4 Answer checking (strict mode)

- Parse the student's input according to what they typed:
  - `N A/B` → mixed common fraction
  - `A/B` → common fraction
  - `D.DD` or `-D` → decimal/integer
- The parsed value must (a) equal the true result **and** (b) be written in a form
  **matching the row's result type**. Example: if the row's result type is integer,
  `5` is accepted but `5.0`, `5/1`, `4 4/4` are rejected even though numerically
  equal. If the result type is common-fraction and the true value is `1/2`, then
  `0.5` is rejected but `1/2` is accepted. (This is your "must match result type"
  decision.)
- Whitespace tolerant; comma-as-decimal (`1,5`) — **Open Question Q2**: Swiss/German
  convention often uses comma. Recommend accepting both `.` and `,`.

---

## 4. Screens & flow

```
┌─────────────┐   Start    ┌─────────────┐  Submit/Enter  ┌─────────────┐
│  Setup /    │──────────▶ │  Solving    │───────────────▶│   Report    │
│  Settings   │            │  (one       │  (loop until    │  (grid of   │
│             │            │  example    │   all done)     │  all, ✓/✗)  │
└─────────────┘            │  at a time) │                └──────┬──────┘
                           └─────────────┘                       │ click a ✗
                                  ▲                               ▼
                                  │                        ┌─────────────┐
                                  └────────────────────────│   Retry     │
                                     back to report        │  one problem│
                                                           └─────────────┘
```

### 4.1 Setup screen
Controls (with defaults):
- Number of examples — default **12**
- Rows per example — default **8**
- Number range — slider/inputs, −2000…+2000, default **0–100**
- Result types — checkboxes: Integers (default on), Decimals, Common fractions
- Operation groups — checkboxes, all on by default
- Time limit — default **20 min**
- **Start** button → generates all examples, records `startedAt`, shows first example.

Also on this screen: a small "Resume" affordance if an incomplete exercise exists
(see §6).

### 4.2 Solving screen
- Shows **one example** as a column (the chain), styled like the book.
- A single auto-focused text field for the final result.
- Persistent instruction line: how to write fractions (`N A/B`) / decimals.
- **Submit** button + **Enter** key both advance.
- Timer visible; turns **red** when it passes the limit (student may keep going).
- Progress indicator (e.g. "Aufgabe 3 / 12").
- On submit: store the answer + correctness + whether it was within time, advance.
- **Abbrechen** (cancel) button in the top bar: opens an inline confirmation; on
  confirm it deletes the current attempt from IndexedDB and returns to setup (no
  resumable record left behind).

### 4.3 Report screen
- Grid of all examples with ✓ / ✗.
- Total time shown, **green** if ≤ limit else **red**.
- Score shown (see §5).
- Click any ✗ example → Retry screen.

### 4.4 Retry screen
- Shows just that one example, text field, Submit → shows correct/incorrect.
- "Back to report" to pick another. Retried-correct problems earn 1 pt (§5).

---

## 5. Scoring

Per problem:
- **3 pts** — correct on first try, within the time limit.
- **2 pts** — correct on first try, but after the time limit.
- **1 pt** — was wrong initially (shown ✗ in report), then corrected on retry.

Completion bonus (only if **all** problems were submitted within the time limit):
- 0 incorrect → **+20**
- 1 incorrect → **+15**
- 2 incorrect → **+10**
- 3 incorrect → **+5**
- 4+ incorrect → no bonus

**Open Question Q3:** "submitted all problems in the time limit" — does the bonus
require every problem *submitted* before time ran out, or every problem *solved*?
The 1/2/3-incorrect tiers imply "submitted within time, some wrong" still qualifies.
I'll assume: bonus eligibility = all problems were **submitted before the timer
expired**; the incorrect count is measured at the report (pre-retry). Confirm.

---

## 6. Data model (IndexedDB)

One store: `attempts`. Each record:

```js
{
  id,                       // uuid
  createdAt, startedAt, endedAt,   // ISO datetimes
  status: 'in_progress' | 'completed' | 'abandoned',
  settings: { examples, rows, rangeMin, rangeMax, resultTypes[], opGroups[], timeLimitMin },
  examples: [
    {
      chain: [ /* start + ops, enough to re-render exactly */ ],
      trueResult,           // exact (rational or number)
      resultType,
      firstAnswer,          // what they typed first
      firstCorrect,         // bool
      withinTimeOnFirst,    // bool
      retryCorrect          // bool | null
    }
  ],
  score, bonus,
}
```

- **Resume:** on load, if an `in_progress` attempt exists, offer to resume. The timer
  counts from the **original `startedAt`** (per your spec), so a resumed exercise may
  already be over time.
- **History:** the store gives us every attempt with its datetimes and score, so a
  future "stats" page is cheap. (Not built in v1, but the data is there.)
- We also keep a lightweight running total score across attempts (derived by summing,
  or cached in a `meta` store).

---

## 7. Rendering the chain (visual)

The book renders each example as centered lines. We'll reproduce:
- Centered operation lines (`+ 136`, `daraus 3/8`, `die Hälfte`, `Rest bis 200`…).
- A top rule and a bottom `=` rule.
- Superscript-style fractions (`3/8` shown as a proper stacked or `³⁄₈` fraction).
- Numbered header per example (`73.`, `74.`…).

For the trainer we hide the final `=` value (that's what the student computes) and
put the input field where the result goes.

---

## 8. File structure (no build step)

```
/math/
  zahlenreihen.html
  js/
    app.js            // bootstrap, screen router
    settings.js       // setup screen + reading options
    generator.js      // the chain generator + rationals
    rational.js       // exact fraction arithmetic
    operations.js     // operation catalog + apply/format
    answer.js         // parse + strict equality
    session.js        // solving flow, timer
    report.js         // report + retry + scoring
    db.js             // IndexedDB wrapper
  test/               // Node self-tests (engine, flow)
  images/             // reference screenshots (dev only)
/css/styles.css       // shared theme (site-wide)
```

Loaded as ES modules (`<script type="module">`) — works from a static host, no
bundler. (Note: ES modules need to be served over http, not opened via `file://`;
a one-line `python3 -m http.server` covers local dev.)

---

## 9. Resolved questions

1. **One answer per example** — final `=` result only. ✅ (locked)
2. **Comma as decimal separator** (`1,5`) accepted in addition to `.`. ✅
3. **Bonus eligibility** = all problems **submitted before the timer expired**; the
   incorrect count at report time (0/1/2/3) picks the 20/15/10/5 tier. ✅ (locked)
4. **Number range** bounds the value's magnitude (−2000…2000); fractional parts are
   allowed inside the range when decimal/common-fraction results are enabled. ✅
5. **"Rest bis N"** drawn from a fixed menu (200/500/1000/1200/2000), filtered to
   those ≥ current `V` and within range. ✅
6. **Deployment target** — still open, but affects nothing in the code (static). GitHub
   Pages is the assumed default.

---

## 10. Suggested build order

1. `rational.js` + `operations.js` + `generator.js` with a tiny test harness
   (generate 100 exercises, assert all rows valid) — prove the engine first.
2. `answer.js` strict parsing/equality.
3. Static screens + CSS theme.
4. Session/timer + report + scoring.
5. IndexedDB persistence + resume.
6. Polish visuals (fraction rendering, borders, responsive/touch).
```
