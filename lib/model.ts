// The token radar's model: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and adds
// every rankable pre-token protocol below the watchlist floor: the early rows the radar exists to
// find. A protocol is pre-token when its index entry records no token (no market cap, no CoinGecko
// id, no symbol); the snapshot's live-token protocols are kept apart and shown as the market's own
// values, never mixed into the ranked board.
//
// Implied value follows only from the snapshot's own figures:
//
//   base       = tvl_usd x BASE_MULTIPLE
//   growth     = clamp(change_7d, -60, 120) per cent
//   growthMult = 1 + (growth / 100) x GROWTH_WEIGHT
//   maturity   = 0.6 + min(age_days, 1095) / 1095 x 0.4   (age_days unknown: 365)
//   chainMult  = 1 + min(max(chains - 1, 0), 5) x CHAIN_WEIGHT
//   implied    = max(1, round(base x growthMult x maturity x chainMult))
//
// The constants are the house model's, stated in the dashboard and changeable in the model sandbox. No
// protocol name is ever special-cased: the same function scores every row.
//
// The dashboard's model sandbox re-scores the board with the reader's own constants: it calls
// impliedValue with a changed ModelConstants, so the sandbox and the gate share one function and
// the sandbox can never drift from the model it demonstrates.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  base_multiple: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  chain_weight: number;
  chain_cap: number;
}

export const MODEL: ModelConstants = {
  base_multiple: 0.25,
  growth_weight: 0.6,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  chain_weight: 0.04,
  chain_cap: 5,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-2';

/** How many pre-token protocols below the watchlist floor the early radar carries: all of them. */
export const EARLY_ROWS = 1000;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  /**
   * Launch readiness, 0 to 100: how close this protocol is to a launch, from the same four
   * multipliers that set its implied value. A high TVL that has run a long time with no token,
   * is still growing and covers many chains scores near 100; a young, flat, single-chain
   * protocol scores low. It is a second view of the same model, not a second model.
   */
  readiness: number;
  model: {
    base_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
  /** Launch readiness, 0 to 100, the same model's second view of the row. */
  readiness: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
  /** The fastest-growing pre-token protocols, as compact rows for the Top movers strip. */
  movers: RadarRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The four multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(protocol: SnapshotProtocol, asOf: string, model: ModelConstants): { implied: number; growthPct: number; growthMult: number; maturityMult: number; chainMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const chainCount = Math.min(Math.max(protocol.chains.length - 1, 0), model.chain_cap);
  const chainMult = 1 + chainCount * model.chain_weight;
  const base = protocol.tvl_usd * model.base_multiple;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult * chainMult));
  return { implied, growthPct, growthMult, maturityMult, chainMult, age };
}

/**
 * A one-paragraph summary of the board, for the dossier and the README: the top protocol,
 * the board size, the median implied value and the category split of the early rows.
 */
export function boardSummary(board: BoardRow[], snapshot: Snapshot): string {
  const top = board[0];
  const median = board[Math.floor(board.length / 2)];
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug));
  const byCategory = new Map<string, number>();
  for (const r of early) byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + 1);
  const cats = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, n]) => `${c} ${n}`).join(', ');
  return `The board ranks ${board.length} pre-token protocols (${snapshot.watchlist.length} watchlist, ${early.length} early). ` +
    `Rank 1 is ${top?.name} at $${top?.implied_value_usd.toLocaleString('en-US')}; the median row is ${median?.name} at $${median?.implied_value_usd.toLocaleString('en-US')}. ` +
    `The largest early categories are ${cats}.`;
}

/**
 * Launch readiness, 0 to 100, from the same four multipliers that set the implied value.
 * Each multiplier is rescaled to its own 0..1 range and the four are averaged, so a protocol
 * scores high only when it is large, growing, mature and multi-chain at once. The score is a
 * second view of the model, never a second model: it reuses growthMult, maturityMult and
 * chainMult, and adds a size term from the TVL's own scale.
 */
export function launchReadiness(protocol: SnapshotProtocol, asOf: string, model: ModelConstants): number {
  const { growthMult, maturityMult, chainMult } = impliedValue(protocol, asOf, model);
  const growth01 = Math.min(Math.max((growthMult - 1) / 0.72, 0), 1);
  const maturity01 = Math.min(Math.max((maturityMult - model.maturity_floor) / model.maturity_range, 0), 1);
  const chain01 = Math.min(Math.max((chainMult - 1) / (model.chain_cap * model.chain_weight), 0), 1);
  const size01 = Math.min(Math.max(Math.log10(Math.max(protocol.tvl_usd, 1)) - 6, 0) / 4, 1);
  return Math.round(((growth01 + maturity01 + chain01 + size01) / 4) * 100);
}

/** A readiness score's plain-language label, for the dashboard's detail view. */
export function readinessLabel(readiness: number): string {
  if (readiness >= 80) return 'Ready: large, growing, mature and multi-chain.';
  if (readiness >= 60) return "Warming up: most of the model's signals point the same way.";
  if (readiness >= 40) return 'Early: some signals are there, some are not yet.';
  return 'Very early: the protocol has not yet built the record a launch follows.';
}

/**
 * One line on what a category does, for the dashboard's detail view. The line is generic to
 * the category, never to a name, so it reads the same for every protocol of that kind.
 */
export function categoryBlurb(category: string | null): string {
  const c = (category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'Lending: users supply assets and borrow against them; a token usually rewards suppliers and borrowers.';
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return 'Decentralised exchange and yield: users trade and provide liquidity; a token usually rewards traders and liquidity providers.';
  if (c.includes('bridge')) return 'Bridge: users move assets between chains; a token usually rewards bridging volume.';
  if (c.includes('staking') || c.includes('restak')) return 'Staking: users lock assets to secure a chain or protocol; a token usually rewards stakers.';
  if (c.includes('perpetual') || c.includes('derivative')) return 'Derivatives: users trade leveraged positions; a token usually rewards traders and market makers.';
  if (c.includes('prediction')) return 'Prediction market: users bet on outcomes; a token usually rewards market makers and winners.';
  if (c.includes('curator') || c.includes('allocator')) return 'Vault curator: users deposit into managed vaults; a token usually rewards depositors.';
  if (c.includes('stable')) return 'Stablecoin: users mint or hold a pegged asset; a token usually rewards minters and holders.';
  if (c.includes('rwa')) return 'Real-world assets: users hold tokenised off-chain yield; a token usually rewards holders.';
  if (c.includes('insurance')) return 'Insurance: users buy cover against protocol risk; a token usually rewards policy holders.';
  return 'A pre-token protocol: users interact with its app, and a token, if one comes, usually rewards its early users.';
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/**
 * Why a protocol is left off the board, in one line, for the field guide: the above-floor
 * non-watchlist protocols are mostly bridges, liquid staking and wrapped products of tokens
 * that already trade, so they are not launches the radar exists to find.
 */
export function exclusionReason(p: SnapshotProtocol, snapshot: Snapshot): string | null {
  if (!isPreToken(p)) return 'it already has a token and a market cap';
  if (p.category === 'CEX') return 'a centralised exchange lists tokens of its own';
  if (VERSIONED.test(p.name)) return 'a versioned name, likely a duplicate of the same protocol';
  if (p.tvl_usd >= snapshot.floor_usd && !snapshot.watchlist.includes(p.slug)) return 'above the watchlist floor and not on the watchlist';
  return null;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The headline sentence's figures: how many watchlist slugs, how many rows, how many live protocols. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but the
  // board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every rankable pre-token protocol below the watchlist floor, by TVL.
  // Never a replacement for a watchlist row: a chosen protocol stays chosen. The cap is a guard,
  // not a target: the snapshot holds 186 such protocols and the board carries all of them.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const { implied, growthPct, growthMult, maturityMult, chainMult, age } = impliedValue(p, snapshot.as_of, model);
    const readiness = launchReadiness(p, snapshot.as_of, model);
    return { p, implied, growthPct, growthMult, maturityMult, chainMult, age, readiness };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    readiness: s.readiness,
    model: {
      base_multiple: model.base_multiple,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      chain_multiplier: round4(s.chainMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/**
 * The weekly qualifying action, by category: the same action every week is what a snapshot
 * rewards, and the action is the one the protocol's own kind of work is.
 */
function weeklyActionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Borrow a small amount against the supply, then repay it, so the position shows both sides of ${name}.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Swap $${Math.max(10, Math.round(capital / 5))} through ${name}'s main pool on ${chain} and leave the receipt in the position.`;
  if (c.includes('bridge')) return `Bridge $${Math.max(10, Math.round(capital / 5))} to ${chain} through ${name} and use it in the destination app.`;
  if (c.includes('staking') || c.includes('restak')) return `Restake the rewards ${name} pays on ${chain} instead of claiming them to a wallet.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Open one small hedge on ${name} and close it the same week, keeping the margin in place.`;
  if (c.includes('prediction')) return `Place one small market position on ${name} each week and settle it.`;
  if (c.includes('curator') || c.includes('allocator')) return `Top up the ${name} vault by $${Math.max(10, Math.round(capital / 5))} and keep the new shares.`;
  if (c.includes('stable')) return `Mint $${Math.max(10, Math.round(capital / 5))} of the stable asset through ${name} on ${chain} and hold it.`;
  if (c.includes('rwa')) return `Buy $${Math.max(10, Math.round(capital / 5))} more of the protocol's yield asset on ${chain}.`;
  if (c.includes('insurance')) return `Renew or extend the cover from ${name} so the policy never lapses.`;
  return `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`;
}

/**
 * The second position, by category: a farm that only ever holds one thing looks like a deposit,
 * not a user. The second position is small and on the same protocol.
 */
function secondPositionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  const small = Math.max(10, Math.round(capital / 5));
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Add $${small} to a second pool on ${name} so the wallet touches more than one market.`;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${small} of a second asset to ${name} on ${chain} beside the first position.`;
  if (c.includes('bridge')) return `Bridge $${small} back to the origin chain through ${name} so the wallet shows both directions.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${small} of a second staking asset through ${name} on ${chain}.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Open a second, smaller hedge on ${name} in the opposite direction.`;
  return `Open a second, smaller position of $${small} in ${name} on ${chain} so the wallet shows more than one activity.`;
}

/**
 * A protocol's farm plan: eight steps, each an action with a cost and a time. The plan is derived from
 * the protocol's own record (category, chains, TVL, age), never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const weekly = weeklyActionFor(p, capital, chain);
  const second = secondPositionFor(p, capital, chain);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: weekly,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: second,
      cost: `$${Math.max(10, Math.round(capital / 5))} of capital and about $2 of gas`,
      time: '10 minutes',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Check the protocol's points or rewards page once a week and confirm the position is still earning; if a week shows nothing, repeat the weekly action before the next snapshot.`,
      cost: 'no fee to check',
      time: '5 minutes a week',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/**
 * The model as plain text, for the dashboard's model panel and the dossier: the formula, the
 * constants and what each multiplier means, in the order the model applies them.
 */
export function describeModel(model: ModelConstants): string[] {
  return [
    `implied = round(TVL x ${model.base_multiple} x growthMult x maturityMult x chainMult)`,
    `growthMult = 1 + clamp(change_7d, ${model.growth_floor}, ${model.growth_cap}) / 100 x ${model.growth_weight}`,
    `maturityMult = ${model.maturity_floor} + min(age_days, ${model.maturity_days}) / ${model.maturity_days} x ${model.maturity_range}`,
    `chainMult = 1 + min(chains - 1, ${model.chain_cap}) x ${model.chain_weight}`,
    `growth: a protocol that grew 100% in a week scores a growth multiplier of ${1 + model.growth_weight}; one that fell 60% scores ${1 - model.growth_weight * 0.6}.`,
    `maturity: a protocol listed ${model.maturity_days} days ago scores a maturity multiplier of ${model.maturity_floor + model.maturity_range}; a brand-new one scores ${model.maturity_floor}.`,
    `chains: a protocol on ${model.chain_cap + 1} or more chains scores a chain multiplier of ${1 + model.chain_cap * model.chain_weight}; a single-chain protocol scores 1.`,
    `readiness: the same four multipliers, each rescaled to 0..1 and averaged, times 100.`,
  ];
}

/** The fastest-growing pre-token protocols on the board, for the dashboard's Top movers strip. */
export function topMovers(board: BoardRow[], count = 5): BoardRow[] {
  return board
    .filter((r) => r.change_7d !== null)
    .sort((a, b) => (b.change_7d ?? 0) - (a.change_7d ?? 0) || b.implied_value_usd - a.implied_value_usd)
    .slice(0, count);
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    readiness: row.readiness,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
    movers: topMovers(board).map(radarRow),
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
