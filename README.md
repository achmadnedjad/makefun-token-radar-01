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

## Verified locally

The entry's own run on the sealed snapshot writes 226 rows, and a local replica of the sealed seven-row gate (dashboard files, board, sorted order, watchlist coverage, farm steps, screenshots, dossier) passes 7/7. The dashboard's source is 35 KB (cap 64 KB) and the dossier text is 35,419 bytes; the three screenshots are 1440x900 PNGs under 512 KB each. The dashboard page recomputes every row's implied value from the snapshot figures and checks it against the number board.json carries.
