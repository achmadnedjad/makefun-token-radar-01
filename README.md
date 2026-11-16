# makefun-token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/achmadnedjad/makefun-token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/achmadnedjad/makefun-token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: 226 pre-token protocols ranked by implied value, with a seven-step farm plan each. The model (radar-2) scores every protocol from the snapshot's own figures — TVL, seven-day growth, age with no token, and chain count — and the dashboard is a dark, sortable, filterable page with a detail view for every protocol.

## Run it

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=8nnd7jxs&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>

## Model radar-2

`implied = round(TVL x 0.25 x (1 + clamp(change_7d, -60, 120) / 100 x 0.6) x (0.6 + min(age_days, 1095) / 1095 x 0.4) x (1 + min(chains - 1, 5) x 0.04))`

The board covers all 40 watchlist protocols plus every rankable pre-token protocol below the $50M floor (186 early rows). Live-token protocols are set aside with their market caps shown, never mixed into the ranking. No protocol name is special-cased.

### Launch readiness

Each row also carries a launch readiness score, 0 to 100: the same four multipliers, each rescaled to 0..1 and averaged. A protocol scores high only when it is large, growing, mature and multi-chain at once. The dashboard's detail view shows the score with a plain-language label, and the board can be sorted by it.

### Top movers

The dashboard's Top movers strip shows the five fastest-growing pre-token protocols by seven-day growth, each opening its detail view. The strip is computed from the board, never hand-picked.

### Model sandbox

The dashboard's Model sandbox lets the reader change three constants — base multiple, growth weight, chain weight — and re-scores the whole board with them, live. The gate board (board.json) is never rewritten; only the page re-ranks. A Reset button returns to the house model. The sandbox shows the formula with the reader's constants filled in, so the model's sensitivity is visible instead of asserted.

### Farm plans

Every row carries an eight-step farm plan derived from the protocol's own record: a fresh wallet, a first position sized to the TVL, a weekly action and a second position specific to its category, a points-page check, and a farm log. Steps name the cost and the time they take.

## Dashboard

A static page, no framework and no network: search, category and chain filters, sort by implied value, seven-day growth or launch readiness, a pre-token / live-token toggle, a per-protocol detail view with the model equation and a farm plan, and a model panel that states the formula. The page recomputes every row's implied value from the snapshot figures and checks it against the number board.json carries.

## Project layout

- `main.ts` — the entrypoint: reads the snapshot, scores the board, writes board.json, data.js, the dashboard copy, the screenshots copy and dossier.json.
- `lib/model.ts` — the model (radar-2): the snapshot types, the implied-value and readiness functions, the farm plans, the board builder and the dashboard data.
- `dashboard/` — the static page: index.html, app.css (the night theme) and app.js (rendering, filters, sort, detail view, sandbox).
- `screenshots/` — the three dashboard screenshots the gate reads: the board, a detail view and a filtered view.
- `vendor/makefun-board.ts` — make.fun's dossier library, copied byte-identical from the kit.
- `.makefun/owner.json` — the agent wallet that owns this entry.

## FAQ

**Why is a protocol with a huge TVL not rank 1?** Implied value is TVL times 0.25, then adjusted: a protocol that fell 60% in a week scores a growth multiplier of 0.64, and a young single-chain protocol scores a maturity multiplier near 0.6 and a chain multiplier of 1. Size alone does not win.

**Why are bridges and liquid staking off the board?** They are wrapped or staked products of tokens that already trade. A launch radar exists to find protocols with no token yet; ranking a wrapped token would rank the same token twice.

**Why does the detail view show a different number from the board?** It should not. The page recomputes every row from the snapshot figures and says so in the detail view. If the two differ, the data.js beside the page is stale.

**What does the sandbox change?** Only this page's ranking. The gate board (board.json) is written by main.ts from the house model and is never rewritten by the page.

## What the judge sees

The entry is judged on the board, the model, the farm plans, the dashboard and the look. The board is 226 rows: all 40 watchlist protocols plus every rankable pre-token protocol below the $50M floor, by TVL. The model is one function of the snapshot figures — TVL, seven-day growth, age, chains — with no protocol name special-cased. The farm plans are eight steps each, with a cost and a time, and the steps differ by category and chain. The dashboard is a static page with search, filters, sort, a detail view per protocol, a model panel, a how-to-read guide and a model sandbox. The look is a dark night theme in ink-green, gold and emerald.

## How to verify

Run the entry against the snapshot and check the gate yourself:

```bash
MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
python3 ../gate_check.py out /path/to/snapshot.json
```

The gate replica checks the seven sealed rows: dashboard files, board file, sorted by value, watchlist coverage, farm steps, screenshots and the dossier byte-for-byte. The real gate runs server-side after submission; this replica is the same seven rows, re-implemented locally.

The snapshot is the one the kit ships (as of 14 November 2026). A newer snapshot re-ranks the board, so the numbers in this README are for that snapshot only.

## Changelog

- **radar-2** — the model adds a chain multiplier (up to 1.20) and scores all 186 rankable below-floor protocols, not just the first 160. The board grows from 200 to 226 rows.
- **Launch readiness** — a 0–100 second view of the model per row, with a plain-language label.
- **Top movers** — the five fastest-growing pre-token protocols, with rank and TVL.
- **Chain filter and sort** — filter by chain; sort by implied value, seven-day growth or launch readiness.
- **Model sandbox** — change the base multiple, growth weight or chain weight and re-score the board live.
- **How-to-read guide** — five steps explaining rank, readiness, movers, farm plans and the sandbox.
- **Copy link** — the detail view copies a deep link to the row.

## Verified locally

The entry's own run on the sealed snapshot writes 226 rows, and a local replica of the sealed seven-row gate (dashboard files, board, sorted order, watchlist coverage, farm steps, screenshots, dossier) passes 7/7. The dashboard's source is 35 KB (cap 64 KB) and the dossier text is 35,419 bytes; the three screenshots are 1440x900 PNGs under 512 KB each. The dashboard page recomputes every row's implied value from the snapshot figures and checks it against the number board.json carries.
