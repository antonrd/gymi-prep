# Gymi-Prep · Zahlenreihen

A German-language, static web app for students preparing for the Zurich Gymnasium
entrance exam. The first page is a **Kopfrechnen chain-arithmetic trainer**: solve a
column of operations where each row's result feeds the next (Swiss *"Zahlenraum
beliebig"* style — see `images/` for the source exam pages).

Tablet- and phone-friendly. No backend, no build step — just static files.

## Run it locally

ES modules must be served over http (not opened via `file://`). From the project
root:

```sh
python3 -m http.server 8000
```

then open <http://localhost:8000>. (Any static server works.)

## Deploy

It's a static site — push the repo to GitHub Pages, Netlify, or any static host and
serve `index.html`. No configuration needed.

## Tests

The generator/rational/answer engine and the scoring flow have self-tests (plain
Node, no framework):

```sh
node test/engine.test.mjs   # ~41k assertions over the chain engine
node test/flow.test.mjs     # exercise flow + scoring/bonus paths
node test/sample.mjs        # prints sample generated exercises
```

## Structure

| File | Role |
|---|---|
| `index.html` | screen shell (setup / solve / report / retry) |
| `css/styles.css` | children-friendly theme |
| `js/rational.js` | exact fraction arithmetic |
| `js/operations.js` | operation catalog (daraus, die Hälfte, Rest bis N, …) |
| `js/generator.js` | chain generation (forward + backtracking) |
| `js/answer.js` | strict answer parsing & checking |
| `js/render.js` | book-style chain rendering + (de)serialization |
| `js/scoring.js` | points & bonus |
| `js/session.js` | solving screen + timer |
| `js/report.js` | report grid + retry |
| `js/history.js` | "Verlauf" screen — past runs (date, correct, time, points) |
| `js/db.js` | IndexedDB persistence (attempts, resume, total score) |
| `js/app.js` | bootstrap + screen router |

See [DESIGN.md](DESIGN.md) for the full design.
