# Gymi-Prep

A German-language, static web app for children preparing for the Zurich Gymnasium
entrance exam (ZAP). A small hub links to several practice trainers, grouped by
subject. Tablet- and phone-friendly, with a playful, child-friendly design.

No backend, no build step for the site itself — just static files.

## Trainers

**Mathematik**
- **Zahlenreihen** — a *Kopfrechnen* chain-arithmetic drill: solve a column of
  operations where each row's result feeds the next (Swiss *"Zahlenraum beliebig"*
  style). Exercises are generated on the fly; set the number range, length, and
  operation types.

**Deutsch**
- **Bindewörter** — fill the right connector (Konjunktionen, Subjunktionen,
  Konjunktionaladverbien, Paarkonjunktionen) into gap sentences. Each sentence
  accepts every connector that genuinely fits it. Sessions are picked by category
  and difficulty and scored with a Swiss Note (1–6).

More trainers per subject are planned — the hub has room for them.

## Structure

```
/index.html            hub / landing page
/math/                 Mathematik trainers
  zahlenreihen.html
  js/                  arithmetic trainer logic
  test/                self-tests for the arithmetic engine
/deutsch/              Deutsch trainers
  connectors.html
/css/styles.css        shared child-friendly theme
```

The two subject folders each hold their own pages; both reuse the shared theme so
the whole site reads as one.

## Run it locally

The pages use ES modules, which must be served over http (not opened via
`file://`). From the project root:

```sh
python3 -m http.server 8000
```

then open <http://localhost:8000>. Any static server works.

## Deploy

It's a static site — push the repo to GitHub Pages, Netlify, or any static host and
serve `index.html`. No configuration needed.

## Notes for contributors

- **Arithmetic** exercises are generated procedurally (see `math/js/`). Self-tests
  live in `math/test/` and run with plain Node
  (`node math/test/engine.test.mjs`, etc.).
- **Connectors** come from two CSVs in `deutsch/` (the word list and the sentence
  bank). These are compiled to a JS data file by a dev-only build step
  (`node deutsch/build_data.mjs`) — re-run it after editing a CSV.

Design docs: [math/DESIGN.md](math/DESIGN.md) (arithmetic) and
[deutsch/DESIGN_CONNECTORS.md](deutsch/DESIGN_CONNECTORS.md) (connectors).
