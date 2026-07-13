# Benchmarks

Interactive human-facing versions of the yuwakisa benchmarks. The benchmark
harness itself (runner, suites, scoring, model results) lives in a separate
repo at `/work/yuwakisabenchmarks`.

## Principle benchmark

- Human version: `principle/` (plain `<script>` includes, run from `file://`).
- Pilot run results (7 suites, 10 iterations each, 38 models):
  `/work/yuwakisabenchmarks/principle/2026071212.4jHU/`
  - Aggregated scores: `results/report/scores.json` — source of the
    `MODEL_SCORES` table in `principle/app.js`.
  - Per-model transcripts: `results/<provider>_<model>/s0NN.json`.
- `principle/suites.js` is generated from that run's `suites/*.md`.
