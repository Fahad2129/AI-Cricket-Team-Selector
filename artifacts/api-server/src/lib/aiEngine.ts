/**
 * AI Engine — implements from scratch:
 * 1. Linear Regression  (gradient descent — Impact Score)
 * 2. K-Means Clustering (player archetype grouping)
 * 3. Naive Bayes        (venue-aware performance probability, separate batter/bowler models)
 * 4. Decision Tree CART (performance tier classification: Great/Good/Average/Poor)
 * 5. Genetic Algorithm  (optimal team selection — replaces greedy optimizer)
 */

import { loadDataset, type MasterRecord } from "./dataLoader.js";

// ─── BLACKLIST ─────────────────────────────────────────────────────────────────
const BLACKLISTED_PLAYERS = new Set([
  "Bilawal Bhatti",
  "Nahid Rana",
  "Amad Butt",
  "Mohammad Imran (1)",
]);

// ─── VENUE COMPOSITION CONFIG ─────────────────────────────────────────────────
const VENUE_COMPOSITION: Record<
  string,
  { openers: number; middleOrder: number; allRounders: number; fastBowlers: number; spinBowlers: number }
> = {
  karachi:    { openers: 2, middleOrder: 1, allRounders: 3, fastBowlers: 2, spinBowlers: 2 },
  lahore:     { openers: 2, middleOrder: 2, allRounders: 2, fastBowlers: 3, spinBowlers: 1 },
  multan:     { openers: 2, middleOrder: 2, allRounders: 2, fastBowlers: 3, spinBowlers: 1 },
  rawalpindi: { openers: 2, middleOrder: 2, allRounders: 2, fastBowlers: 4, spinBowlers: 0 },
};

const PSL_VENUES = ["karachi", "lahore", "multan", "rawalpindi"];

// ─── INTERFACES ────────────────────────────────────────────────────────────────

export interface PlayerFeatures {
  name: string;
  role: string;
  bowlingType: string;
  battingAvg: number;
  strikeRate: number;
  recentForm: number;
  boundaryRate: number;
  wicketsPerMatch: number;
  economy: number;
  recentBowlingForm: number;
  matches: number;
  avgBattingPosition: number;
  venueBattingAvg: number;
  venueStrikeRate: number;
  venueWickets: number;
  venueEconomy: number;
  venueBowlingAvg: number;
  venueBowlingSR: number;
}

export interface ScoredPlayer extends PlayerFeatures {
  impactScore: number;
  bayesianScore: number;
  finalScore: number;
  roleScore: number;
  cluster: number;
  clusterLabel: string;
  performanceClass: string;
  venueScore: number;
  selectionReason?: string;
  teamRole?: string;
}

// ─── 1. LINEAR REGRESSION (gradient descent, from scratch) ────────────────────

function normalise(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map((v) => (v - min) / range);
}

function lrPredict(X: number[][], w: number[], b: number): number[] {
  return X.map((row) => row.reduce((s, x, i) => s + x * w[i], b));
}

function lrTrain(
  X: number[][],
  y: number[],
  lr = 0.01,
  epochs = 500
): { weights: number[]; bias: number; r2: number } {
  const m = X.length;
  const n = X[0].length;
  const w = new Array<number>(n).fill(0);
  let b = 0;
  for (let ep = 0; ep < epochs; ep++) {
    const pred = lrPredict(X, w, b);
    const err = pred.map((p, i) => p - y[i]);
    for (let j = 0; j < n; j++) {
      w[j] -= (lr * err.reduce((s, e, i) => s + e * X[i][j], 0)) / m;
    }
    b -= (lr * err.reduce((s, e) => s + e, 0)) / m;
  }
  const yMean = y.reduce((s, v) => s + v, 0) / m;
  const ssTot = y.reduce((s, v) => s + (v - yMean) ** 2, 0);
  const pred = lrPredict(X, w, b);
  const ssRes = pred.reduce((s, p, i) => s + (p - y[i]) ** 2, 0);
  return { weights: w, bias: b, r2: 1 - ssRes / (ssTot || 1) };
}

// ─── 2. K-MEANS CLUSTERING (from scratch) ─────────────────────────────────────

function dist(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
}

function kMeans(X: number[][], k: number, maxIter = 100): { assignments: number[]; centroids: number[][] } {
  const m = X.length;
  const n = X[0].length;
  const centroids: number[][] = [];
  const used = new Set<number>();
  const mean = Array.from({ length: n }, (_, j) => X.reduce((s, r) => s + r[j], 0) / m);
  let maxD = -1, firstIdx = 0;
  for (let i = 0; i < m; i++) {
    const d = dist(X[i], mean);
    if (d > maxD) { maxD = d; firstIdx = i; }
  }
  centroids.push([...X[firstIdx]]); used.add(firstIdx);
  for (let c = 1; c < k; c++) {
    let bestIdx = 0, bestD = -Infinity;
    for (let i = 0; i < m; i++) {
      if (used.has(i)) continue;
      const minD = Math.min(...centroids.map((cen) => dist(X[i], cen)));
      if (minD > bestD) { bestD = minD; bestIdx = i; }
    }
    centroids.push([...X[bestIdx]]); used.add(bestIdx);
  }
  let assignments = new Array<number>(m).fill(0);
  for (let iter = 0; iter < maxIter; iter++) {
    const next = X.map((pt) => {
      let best = 0, bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d = dist(pt, centroids[c]);
        if (d < bestD) { bestD = d; best = c; }
      }
      return best;
    });
    if (next.every((a, i) => a === assignments[i])) break;
    assignments = next;
    for (let c = 0; c < k; c++) {
      const members = X.filter((_, i) => assignments[i] === c);
      if (!members.length) continue;
      for (let j = 0; j < n; j++) {
        centroids[c][j] = members.reduce((s, r) => s + r[j], 0) / members.length;
      }
    }
  }
  return { assignments, centroids };
}

// ─── 3. NAIVE BAYES (separate batter + bowler models, from scratch) ────────────

interface NBModel {
  priorGood: number; priorAvg: number; priorPoor: number;
  venueCondGood: Map<string, number>;
  venueCondAvg: Map<string, number>;
  venueCondPoor: Map<string, number>;
  threshGood: number; threshPoor: number;
}

function trainNB(records: { venue: string; perfMetric: number; isGood: boolean; isPoor: boolean }[]): NBModel {
  const total = records.length;
  const good = records.filter((r) => r.isGood);
  const avg  = records.filter((r) => !r.isGood && !r.isPoor);
  const poor = records.filter((r) => r.isPoor);
  const venues = [...new Set(records.map((r) => r.venue))];
  const S = 1;
  const venueCondGood = new Map<string, number>();
  const venueCondAvg  = new Map<string, number>();
  const venueCondPoor = new Map<string, number>();
  for (const v of venues) {
    venueCondGood.set(v, (good.filter((r) => r.venue === v).length + S) / (good.length + venues.length * S));
    venueCondAvg.set(v,  (avg.filter((r) => r.venue === v).length  + S) / (avg.length  + venues.length * S));
    venueCondPoor.set(v, (poor.filter((r) => r.venue === v).length + S) / (poor.length + venues.length * S));
  }
  const metrics = records.map((r) => r.perfMetric).filter((v) => v > 0).sort((a, b) => a - b);
  return {
    priorGood: good.length / total,
    priorAvg:  avg.length  / total,
    priorPoor: poor.length / total,
    venueCondGood, venueCondAvg, venueCondPoor,
    threshGood: metrics[Math.floor(metrics.length * 0.67)] ?? 20,
    threshPoor: metrics[Math.floor(metrics.length * 0.33)] ?? 5,
  };
}

function trainBatterNB(records: MasterRecord[]): NBModel {
  return trainNB(records.map((r) => ({
    venue: r.venue, perfMetric: r.runs, isGood: r.runs >= 30, isPoor: r.runs < 10,
  })));
}

function trainBowlerNB(records: MasterRecord[]): NBModel {
  const bowl = records.filter((r) => r.ballsBowled > 0);
  return trainNB(bowl.map((r) => ({
    venue: r.venue, perfMetric: r.wickets,
    isGood: r.wickets >= 2 || (r.wickets >= 1 && r.economy <= 7),
    isPoor: r.wickets === 0 && r.economy > 9,
  })));
}

function nbPredict(model: NBModel, venue: string, formValue: number): number {
  const fGood = formValue >= model.threshGood ? 0.7 : formValue >= model.threshPoor ? 0.4 : 0.2;
  const fAvg  = formValue >= model.threshGood ? 0.2 : formValue >= model.threshPoor ? 0.4 : 0.3;
  const vG = model.venueCondGood.get(venue) ?? 0.05;
  const vA = model.venueCondAvg.get(venue)  ?? 0.05;
  const vP = model.venueCondPoor.get(venue) ?? 0.05;
  const sG = model.priorGood * vG * fGood;
  const sA = model.priorAvg  * vA * fAvg;
  const sP = model.priorPoor * vP * (1 - fGood - fAvg + 0.1);
  return sG / (sG + sA + sP || 1);
}

// ─── 4. DECISION TREE — CART (Gini impurity, from scratch) ───────────────────
// Used for player performance tier classification (Great / Good / Average / Poor)

interface DTNode {
  feature?: number;
  threshold?: number;
  left?: DTNode;
  right?: DTNode;
  label?: string;
}

function giniImpurity(labels: string[]): number {
  const total = labels.length;
  const counts = new Map<string, number>();
  for (const l of labels) counts.set(l, (counts.get(l) ?? 0) + 1);
  let g = 1;
  for (const c of counts.values()) g -= (c / total) ** 2;
  return g;
}

function majorityLabel(labels: string[]): string {
  const counts = new Map<string, number>();
  for (const l of labels) counts.set(l, (counts.get(l) ?? 0) + 1);
  let best = labels[0] ?? "Average", bestCount = 0;
  for (const [l, c] of counts) if (c > bestCount) { best = l; bestCount = c; }
  return best;
}

function buildDecisionTree(X: number[][], y: string[], depth = 0, maxDepth = 6): DTNode {
  if (!y.length) return { label: "Average" };
  const unique = new Set(y);
  if (unique.size === 1 || depth >= maxDepth || y.length < 3) return { label: majorityLabel(y) };

  let bestGini = Infinity, bestFeat = -1, bestThresh = 0;
  const n = X[0]?.length ?? 0;
  for (let f = 0; f < n; f++) {
    const vals = [...new Set(X.map((r) => r[f]))].sort((a, b) => a - b);
    for (let ti = 0; ti < vals.length - 1; ti++) {
      const thresh = (vals[ti] + vals[ti + 1]) / 2;
      const leftY  = y.filter((_, i) => X[i][f] <= thresh);
      const rightY = y.filter((_, i) => X[i][f] > thresh);
      if (!leftY.length || !rightY.length) continue;
      const g = (leftY.length * giniImpurity(leftY) + rightY.length * giniImpurity(rightY)) / y.length;
      if (g < bestGini) { bestGini = g; bestFeat = f; bestThresh = thresh; }
    }
  }
  if (bestFeat === -1) return { label: majorityLabel(y) };

  const leftX  = X.filter((_, i) => X[i][bestFeat] <= bestThresh);
  const leftY  = y.filter((_, i) => X[i][bestFeat] <= bestThresh);
  const rightX = X.filter((_, i) => X[i][bestFeat] > bestThresh);
  const rightY = y.filter((_, i) => X[i][bestFeat] > bestThresh);
  return {
    feature: bestFeat,
    threshold: bestThresh,
    left:  buildDecisionTree(leftX,  leftY,  depth + 1, maxDepth),
    right: buildDecisionTree(rightX, rightY, depth + 1, maxDepth),
  };
}

function dtPredict(node: DTNode, x: number[]): string {
  if (node.label !== undefined) return node.label;
  return x[node.feature!] <= node.threshold!
    ? dtPredict(node.left!, x)
    : dtPredict(node.right!, x);
}

// ─── 5. GENETIC ALGORITHM — Team Optimizer (from scratch) ─────────────────────
// Population of valid 11-player teams evolves over generations.
// Fitness = total finalScore; constraints enforced via role-specific pools.

type VenueComp = { openers: number; middleOrder: number; allRounders: number; fastBowlers: number; spinBowlers: number };

function gaTeamOptimizer(
  scoredPlayers: ScoredPlayer[],
  comp: VenueComp,
  popSize = 40,
  generations = 80
): number[] {
  // Build role-filtered index pools
  const pool = (fn: (p: ScoredPlayer) => boolean) =>
    scoredPlayers.map((p, i) => ({ p, i })).filter(({ p }) => fn(p)).map(({ i }) => i);

  const wkPool = pool((p) => p.role.toLowerCase().includes("wicket"));
  const opPool = pool((p) => isOpenerGA(p));
  const moPool = pool((p) => isMiddleOrderGA(p));
  const arPool = pool((p) => p.role.toLowerCase().includes("all"));
  const fbPool = pool((p) => isFastBowlerGA(p));
  const sbPool = pool((p) => isSpinBowlerGA(p));
  const anyPool = scoredPlayers.map((_, i) => i);

  const safe = (arr: number[]) => (arr.length ? arr : anyPool);

  // Slot layout: [WK×1, Opener×N, MiddleOrder×N, AR×N, Fast×N, Spin×N]
  const pools: number[][] = [
    safe(wkPool),
    ...Array.from({ length: comp.openers },     () => safe(opPool)),
    ...Array.from({ length: comp.middleOrder },  () => safe(moPool)),
    ...Array.from({ length: comp.allRounders },  () => safe(arPool)),
    ...Array.from({ length: comp.fastBowlers },  () => safe(fbPool)),
    ...Array.from({ length: comp.spinBowlers },  () => safe(sbPool)),
  ];
  const nSlots = pools.length;

  const fitness = (slots: number[]): number => {
    if (new Set(slots).size < nSlots) return -9999;
    return slots.reduce((s, i) => s + (scoredPlayers[i]?.finalScore ?? 0), 0);
  };

  const randomChrom = (): number[] => {
    const used = new Set<number>();
    return pools.map((p) => {
      const avail = p.filter((i) => !used.has(i));
      const idx = avail.length
        ? avail[Math.floor(Math.random() * avail.length)]
        : (anyPool.find((i) => !used.has(i)) ?? 0);
      used.add(idx); return idx;
    });
  };

  // After crossover: fix duplicate player assignments
  const fixChrom = (slots: number[]): number[] => {
    const seen = new Set<number>();
    const out = [...slots];
    for (let s = 0; s < nSlots; s++) {
      if (!seen.has(out[s])) { seen.add(out[s]); continue; }
      const alt = pools[s].find((i) => !seen.has(i))
                ?? anyPool.find((i) => !seen.has(i))
                ?? out[s];
      out[s] = alt; seen.add(alt);
    }
    return out;
  };

  type Ind = { slots: number[]; fit: number };
  let pop: Ind[] = Array.from({ length: popSize }, () => {
    const slots = randomChrom();
    return { slots, fit: fitness(slots) };
  });

  const MUTATION_RATE = 0.15;
  for (let gen = 0; gen < generations; gen++) {
    pop.sort((a, b) => b.fit - a.fit);
    const next: Ind[] = pop.slice(0, 2); // elitism

    while (next.length < popSize) {
      const p1 = pop[Math.floor(Math.random() * Math.min(8, pop.length))].slots;
      const p2 = pop[Math.floor(Math.random() * Math.min(8, pop.length))].slots;
      const pt = 1 + Math.floor(Math.random() * (nSlots - 1));
      let child = fixChrom([...p1.slice(0, pt), ...p2.slice(pt)]);
      if (Math.random() < MUTATION_RATE) {
        const s = Math.floor(Math.random() * nSlots);
        const others = new Set(child.filter((_, i) => i !== s));
        const avail = pools[s].filter((i) => !others.has(i));
        if (avail.length) child[s] = avail[Math.floor(Math.random() * avail.length)];
      }
      next.push({ slots: child, fit: fitness(child) });
    }
    pop = next;
  }

  pop.sort((a, b) => b.fit - a.fit);
  return pop[0].slots;
}

// GA role classifiers (mirrors buildOptimalTeam classifiers)
function isOpenerGA(p: ScoredPlayer): boolean {
  const rl = p.role.toLowerCase();
  return !rl.includes("wicket") && !rl.includes("all") && !isPureBowlerStrict(p) &&
    (p.avgBattingPosition <= 2.5 || rl.includes("open"));
}
function isMiddleOrderGA(p: ScoredPlayer): boolean {
  const rl = p.role.toLowerCase();
  return !rl.includes("wicket") && !rl.includes("all") && !isPureBowlerStrict(p) && !isOpenerGA(p) &&
    (rl.includes("bat") || rl.includes("middle") || rl.includes("finisher") ||
     (p.avgBattingPosition > 2.5 && p.avgBattingPosition <= 7));
}
// Strict role check: player must NOT be primarily a batter/opener/middle-order to fill a bowling slot.
// Uses ROLE field as primary signal — bowlingType alone is NOT enough (batters who bowl part-time
// get a bowlingType set from the bowlers dataset but their primary role is batting).
function isNotPrimaryBatter(p: ScoredPlayer): boolean {
  const rl = p.role.toLowerCase();
  return !rl.includes("bat") && !rl.includes("open") && !rl.includes("middle") &&
    !rl.includes("finisher") && !rl.includes("wicket");
}
function isFastBowlerGA(p: ScoredPlayer): boolean {
  const rl = p.role.toLowerCase();
  if (rl.includes("wicket") || rl.includes("all")) return false;
  // Must NOT be a primary batting role — e.g. "Opening Batter" with bowlingType "Fast Medium" must NOT qualify
  if (!isNotPrimaryBatter(p)) return false;
  const bt = p.bowlingType.toLowerCase();
  return bt.includes("fast") || bt.includes("medium") || bt.includes("pace") ||
    rl.includes("fast") || rl.includes("medium") || rl.includes("pace") || rl.includes("bowl");
}
function isSpinBowlerGA(p: ScoredPlayer): boolean {
  const rl = p.role.toLowerCase();
  if (rl.includes("wicket") || rl.includes("all")) return false;
  // Must NOT be a primary batting role — e.g. "Opening Batter" with bowlingType "Spinner" must NOT qualify
  if (!isNotPrimaryBatter(p)) return false;
  const bt = p.bowlingType.toLowerCase();
  return bt.includes("spin") || bt.includes("off") || bt.includes("leg") || bt.includes("slow") ||
    rl.includes("spin") || rl.includes("off break") || rl.includes("leg break");
}
// Strict pure-bowler check (for excluding from opener/middle-order pools)
function isPureBowlerStrict(p: { role: string; bowlingType: string }): boolean {
  const rl = p.role.toLowerCase();
  const bt = p.bowlingType.toLowerCase();
  // Only classify as pure bowler if role explicitly says so — NOT based on bowlingType alone
  return (rl.includes("fast") || rl.includes("pace") || rl.includes("spin") ||
    rl.includes("bowl") || rl.includes("medium")) &&
    !rl.includes("all") && !rl.includes("bat") && !rl.includes("wicket") && !rl.includes("open") &&
    !rl.includes("middle") && (bt.length > 0);
}

// ─── PLAYER FEATURE HELPERS ───────────────────────────────────────────────────

function computeRecentForm(records: MasterRecord[], playerName: string, isBatter: boolean): number {
  const sorted = records
    .filter((r) => r.player === playerName)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);
  if (!sorted.length) return 0;
  if (isBatter) return sorted.reduce((s, r) => s + r.runs, 0) / sorted.length;
  const bowl = sorted.filter((r) => r.ballsBowled > 0);
  return bowl.length ? bowl.reduce((s, r) => s + r.wickets, 0) / bowl.length : 0;
}

function computeAvgBattingPosition(records: MasterRecord[], playerName: string): number {
  const positions = records
    .filter((r) => r.player === playerName && r.battingPosition > 0 && r.balls > 0)
    .map((r) => r.battingPosition);
  if (!positions.length) return 5;
  return positions.reduce((s, p) => s + p, 0) / positions.length;
}

function normTo100(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map((v) => ((v - min) / range) * 100);
}

// ─── ROLE SCORE (role-specific ranking metric, separate from finalScore) ───────
// Batters/WK: weighted batting-only stats
// Pure Bowlers: weighted bowling-only stats
// All-Rounders: balanced combination

function computeRoleScores(players: PlayerFeatures[], isBowlerFlags: boolean[]): number[] {
  const raw = players.map((p, i) => {
    const isBowler = isBowlerFlags[i];
    const isAR = p.role.toLowerCase().includes("all");
    const batRaw = p.battingAvg * 0.45 + p.strikeRate * 0.35 + p.recentForm * 0.20;
    const ecoScore = p.economy > 0 ? Math.max(0, 12 - p.economy) : 0;
    const bowlRaw = p.wicketsPerMatch * 30 + ecoScore * 4 + p.recentBowlingForm * 8;
    if (isAR) return batRaw * 0.5 + bowlRaw * 0.5;
    if (isBowler) return bowlRaw;
    return batRaw;
  });
  return normTo100(raw);
}

// ─── OUTPUT INTERFACES ────────────────────────────────────────────────────────

export interface TeamResult {
  team: ScoredPlayer[];
  venue: string;
  opposition: string;
  teamBalance: { batsmen: number; allRounders: number; fastBowlers: number; spinBowlers: number; wicketkeeper: number };
  modelInfo: {
    regressionR2: number; clusterCount: number;
    totalPlayersAnalyzed: number; venueMatchesUsed: number;
    weights: { impactScore: number; bayesianScore: number; venueScore: number };
  };
}

export interface EngineOutput {
  players: ScoredPlayer[];
  modelInfo: {
    regressionR2: number; clusterCount: number;
    totalPlayersAnalyzed: number;
    weights: { impactScore: number; bayesianScore: number; venueScore: number };
  };
}

// ─── MAIN ENGINE ──────────────────────────────────────────────────────────────

const MIN_MATCHES = 5;

export function runAIEngine(venueFilter?: string): EngineOutput {
  const data = loadDataset();
  const { masterRecords, playerRoles, groundBowling, groundBatting, allRounders, wicketkeepers, bowlers } = data;

  const playerMap = new Map<string, PlayerFeatures>();

  for (const pr of playerRoles) {
    if (!pr.player) continue;
    const isBatter = pr.role.toLowerCase().includes("bat") || pr.role.toLowerCase().includes("wicket");
    const recentForm = computeRecentForm(masterRecords, pr.player, isBatter);
    const recentBowlingForm = computeRecentForm(masterRecords, pr.player, false);
    const avgBattingPosition = computeAvgBattingPosition(masterRecords, pr.player);
    const totalBalls = pr.ballsFaced || 1;
    const boundaryRate = (pr.fours * 4 + pr.sixes * 6) / totalBalls;
    playerMap.set(pr.player, {
      name: pr.player, role: pr.role, bowlingType: "",
      battingAvg: pr.batAverage, strikeRate: pr.batStrikeRate,
      recentForm, boundaryRate,
      wicketsPerMatch: pr.batMatches > 0 ? pr.wickets / pr.batMatches : 0,
      economy: pr.economyRate, recentBowlingForm,
      matches: Math.max(pr.batMatches, pr.bowlMatches),
      avgBattingPosition,
      venueBattingAvg: 0, venueStrikeRate: 0,
      venueWickets: 0, venueEconomy: 0,
      venueBowlingAvg: 0, venueBowlingSR: 0,
    });
  }

  for (const b of bowlers) {
    const p = playerMap.get(b.player);
    if (p) {
      p.bowlingType = b.bowlerType;
      if (b.wickets > 0) { p.economy = b.economy; p.wicketsPerMatch = b.matches > 0 ? b.wickets / b.matches : 0; }
    }
  }

  for (const wk of wicketkeepers) {
    const p = playerMap.get(wk.player);
    if (p && !p.role.toLowerCase().includes("wicket")) p.role = "Wicketkeeper Batter";
  }

  for (const ar of allRounders) {
    const p = playerMap.get(ar.player);
    if (p) {
      if (!p.role.toLowerCase().includes("all")) p.role = "All-Rounder";
      if (ar.wickets > 0 && ar.matches > 0) {
        const arWPM = ar.wickets / ar.matches;
        if (arWPM > p.wicketsPerMatch) { p.wicketsPerMatch = arWPM; p.economy = ar.bowlEco; }
      }
    }
  }

  for (const rec of masterRecords) {
    const p = playerMap.get(rec.player);
    if (p && !p.bowlingType && rec.bowlingType) p.bowlingType = rec.bowlingType;
  }

  if (venueFilter) {
    const venueKey = mapToGroundKey(venueFilter);
    const battingRecs = groundBatting.get(venueKey) ?? [];
    for (const rec of battingRecs) {
      const p = playerMap.get(rec.player);
      if (p && rec.innings >= 2) { p.venueBattingAvg = rec.average; p.venueStrikeRate = rec.strikeRate; }
    }

    const bowlingRecs = groundBowling.filter((g) => {
      const gLower = g.ground.toLowerCase();
      const vLower = venueKey.toLowerCase();
      return gLower.includes(vLower) || vLower.includes(gLower.split(",")[0].toLowerCase());
    });
    for (const rec of bowlingRecs) {
      const p = playerMap.get(rec.player);
      if (p && rec.matches >= 2) {
        p.venueWickets  = rec.matches > 0 ? rec.wickets / rec.matches : 0;
        p.venueEconomy  = rec.economy;
        p.venueBowlingAvg = rec.average;
        p.venueBowlingSR  = rec.strikeRate;
      }
    }
  }

  // Apply blacklist + min-matches filter
  const players = [...playerMap.values()].filter(
    (p) => p.matches >= MIN_MATCHES && !BLACKLISTED_PLAYERS.has(p.name)
  );

  // ─── LINEAR REGRESSION: Impact Score ────────────────────────────────────────
  const featureNames = ["battingAvg", "strikeRate", "recentForm", "wicketsPerMatch", "economyInv", "boundaryRate"];
  const rawFeatures = players.map((p) => [
    p.battingAvg, p.strikeRate, p.recentForm, p.wicketsPerMatch,
    p.economy > 0 ? 1 / p.economy : 0, p.boundaryRate,
  ]);
  const normalized: number[][] = rawFeatures[0].map((_, colIdx) =>
    normalise(rawFeatures.map((r) => r[colIdx]))
  );
  const X = rawFeatures.map((_, rowIdx) => normalized.map((col) => col[rowIdx]));

  const rawTargets = players.map((p) => {
    const batScore  = p.battingAvg * 0.4 + p.strikeRate * 0.3 + p.recentForm * 0.3;
    const bowlScore = p.wicketsPerMatch * 30 + (p.economy > 0 ? (12 - p.economy) * 2 : 0);
    const rl = p.role.toLowerCase();
    const isAR = rl.includes("all");
    const isBowlerR = !rl.includes("bat") && !rl.includes("wicket") && !rl.includes("all") && !rl.includes("open") && !rl.includes("middle") &&
      (rl.includes("bowl") || rl.includes("fast") || rl.includes("pace") || rl.includes("spin") ||
       p.bowlingType.toLowerCase().includes("fast") || p.bowlingType.toLowerCase().includes("medium"));
    if (isAR) return (batScore + bowlScore) / 2;
    if (isBowlerR) return batScore * 0.25 + bowlScore * 0.75;
    return batScore * 0.85 + bowlScore * 0.15;
  });

  const { weights: lrWeights, bias: lrBias, r2 } = lrTrain(X, rawTargets, 0.05, 1000);
  const rawPredictions = lrPredict(X, lrWeights, lrBias);
  const impactScores = normTo100(rawPredictions);

  // ─── K-MEANS CLUSTERING ─────────────────────────────────────────────────────
  const K = 4;
  const { assignments, centroids } = kMeans(X, K);

  // ─── NAIVE BAYES (separate models) ──────────────────────────────────────────
  const batterNB = trainBatterNB(masterRecords);
  const bowlerNB = trainBowlerNB(masterRecords);
  const psLVenueNames = [...new Set(masterRecords.map((r) => r.venue))];
  const venueForBayes = venueFilter
    ? psLVenueNames.find((v) => v.toLowerCase().includes(venueFilter.toLowerCase())) ?? psLVenueNames[0]
    : psLVenueNames[0];

  // ─── VENUE SCORES ────────────────────────────────────────────────────────────
  const isBowlerRoleFlags = players.map((p) => {
    const rl = p.role.toLowerCase();
    return !rl.includes("bat") && !rl.includes("wicket") && !rl.includes("all") &&
      !rl.includes("open") && !rl.includes("middle") &&
      (rl.includes("bowl") || rl.includes("fast") || rl.includes("pace") || rl.includes("spinner") ||
       p.bowlingType.toLowerCase().includes("fast") || p.bowlingType.toLowerCase().includes("medium"));
  });

  const rawVenueScores = players.map((p, i) => {
    if (isBowlerRoleFlags[i]) {
      if (p.venueWickets > 0 || p.venueEconomy > 0) {
        return p.venueWickets * 25 + (p.venueEconomy > 0 ? Math.max(0, (10 - p.venueEconomy) * 4) : 0);
      }
      return -1;
    } else {
      if (p.venueBattingAvg > 0 || p.venueStrikeRate > 0) {
        return p.venueBattingAvg * 0.6 + p.venueStrikeRate * 0.15;
      }
      return -1;
    }
  });

  const withVenueIdx = rawVenueScores.map((v, i) => (v >= 0 ? i : -1)).filter((i) => i >= 0);
  const venueScoresNorm = new Array<number>(players.length).fill(0);
  if (withVenueIdx.length > 1) {
    const venueSub = withVenueIdx.map((i) => rawVenueScores[i]);
    const normSub = normTo100(venueSub);
    withVenueIdx.forEach((playerIdx, subIdx) => { venueScoresNorm[playerIdx] = normSub[subIdx]; });
  }

  // ─── FINAL SCORING ───────────────────────────────────────────────────────────
  const W = { impactScore: 0.45, bayesianScore: 0.25, venueScore: 0.30 };

  const scoredPlayers: ScoredPlayer[] = players.map((p, i) => {
    const impactScore = impactScores[i];
    const rl = p.role.toLowerCase();
    const isBowlerRole =
      !rl.includes("bat") && !rl.includes("wicket") && !rl.includes("all") &&
      !rl.includes("open") && !rl.includes("middle") &&
      (rl.includes("bowl") || rl.includes("fast") || rl.includes("pace") || rl.includes("spinner") ||
       (!rl.includes("bat") && (p.bowlingType.toLowerCase().includes("fast") || p.bowlingType.toLowerCase().includes("medium"))));
    const formForBayes = isBowlerRole ? p.recentBowlingForm : p.recentForm;
    const nbModel = isBowlerRole ? bowlerNB : batterNB;
    const bayesianScore = nbPredict(nbModel, venueForBayes, formForBayes) * 100;
    const venueScore = venueScoresNorm[i];
    const hasVenueData = rawVenueScores[i] >= 0;

    let finalScore: number;
    if (hasVenueData && venueFilter && PSL_VENUES.includes(venueFilter.toLowerCase())) {
      finalScore = W.venueScore * venueScore + W.impactScore * impactScore + W.bayesianScore * bayesianScore;
    } else {
      finalScore = (W.impactScore + W.venueScore * 0.5) * impactScore + (W.bayesianScore + W.venueScore * 0.5) * bayesianScore;
    }

    return {
      ...p,
      impactScore: Math.round(impactScore * 10) / 10,
      bayesianScore: Math.round(bayesianScore * 10) / 10,
      finalScore: Math.round(finalScore * 10) / 10,
      venueScore: Math.round(venueScore * 10) / 10,
      roleScore: 0,
      cluster: assignments[i],
      clusterLabel: getClusterLabel(assignments[i], centroids, featureNames),
      performanceClass: "",
    };
  });

  // ─── ROLE SCORES (role-specific ranking) ─────────────────────────────────────
  const roleScoresNorm = computeRoleScores(players, isBowlerRoleFlags);
  scoredPlayers.forEach((p, i) => { p.roleScore = Math.round(roleScoresNorm[i] * 10) / 10; });

  // ─── DECISION TREE: Performance Tier Classification ──────────────────────────
  // Step 1: Compute percentile-based tier labels as training ground truth
  const sortedFS = [...scoredPlayers.map((p) => p.finalScore)].sort((a, b) => a - b);
  const p80 = sortedFS[Math.floor(sortedFS.length * 0.80)];
  const p50 = sortedFS[Math.floor(sortedFS.length * 0.50)];
  const p20 = sortedFS[Math.floor(sortedFS.length * 0.20)];
  const trainLabels = scoredPlayers.map((p) =>
    p.finalScore >= p80 ? "Great" : p.finalScore >= p50 ? "Good" : p.finalScore >= p20 ? "Average" : "Poor"
  );
  // Step 2: Train Decision Tree on normalised raw features → tier labels
  const dtTree = buildDecisionTree(X, trainLabels, 0, 6);
  // Step 3: Apply DT to classify every player
  for (let i = 0; i < scoredPlayers.length; i++) {
    scoredPlayers[i].performanceClass = dtPredict(dtTree, X[i]);
  }

  return {
    players: scoredPlayers,
    modelInfo: { regressionR2: Math.round(r2 * 1000) / 1000, clusterCount: K, totalPlayersAnalyzed: scoredPlayers.length, weights: W },
  };
}

// ─── BUILD OPTIMAL TEAM (Genetic Algorithm) ────────────────────────────────────

export function buildOptimalTeam(
  scoredPlayers: ScoredPlayer[],
  venue: string,
  opposition: string,
  modelInfo: EngineOutput["modelInfo"]
): TeamResult {
  const venueKey = venue.toLowerCase().trim();
  const comp = VENUE_COMPOSITION[venueKey] ?? VENUE_COMPOSITION.karachi;

  // Role labels per slot
  const roleLabels: string[] = [
    "Wicketkeeper",
    ...Array(comp.openers).fill("Opener"),
    ...Array(comp.middleOrder).fill("Middle Order"),
    ...Array(comp.allRounders).fill("All-Rounder"),
    ...Array(comp.fastBowlers).fill("Fast Bowler"),
    ...(comp.spinBowlers > 0 ? Array(comp.spinBowlers).fill("Spin Bowler") : []),
  ];

  const selectedIdxs = gaTeamOptimizer(scoredPlayers, comp);

  const selected = selectedIdxs.map((idx, slotIdx) => {
    const p = scoredPlayers[idx];
    const teamRole = roleLabels[slotIdx] ?? getTRRole(p);
    return { ...p, teamRole, selectionReason: buildReason(p, venue, teamRole) };
  });

  const balance = {
    batsmen: selected.filter((p) => ["Wicketkeeper", "Opener", "Middle Order"].includes(p.teamRole)).length,
    allRounders: selected.filter((p) => p.teamRole === "All-Rounder").length,
    fastBowlers: selected.filter((p) => p.teamRole === "Fast Bowler").length,
    spinBowlers: selected.filter((p) => p.teamRole === "Spin Bowler").length,
    wicketkeeper: selected.filter((p) => p.teamRole === "Wicketkeeper").length,
  };

  return { team: selected, venue, opposition, teamBalance: balance, modelInfo: { ...modelInfo, venueMatchesUsed: 0 } };
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

export function isPureBowler(p: { role: string; bowlingType: string }): boolean {
  return (
    (p.bowlingType.toLowerCase().includes("fast") || p.bowlingType.toLowerCase().includes("medium") ||
     p.bowlingType.toLowerCase().includes("spin") || p.role.toLowerCase().includes("fast") ||
     p.role.toLowerCase().includes("spin") || p.role.toLowerCase().includes("pace")) &&
    !p.role.toLowerCase().includes("all") &&
    !p.role.toLowerCase().includes("bat") &&
    !p.role.toLowerCase().includes("wicket")
  );
}

function getTRRole(p: ScoredPlayer): string {
  if (p.role.toLowerCase().includes("wicket")) return "Wicketkeeper";
  if (p.role.toLowerCase().includes("all")) return "All-Rounder";
  const bt = p.bowlingType.toLowerCase();
  const r  = p.role.toLowerCase();
  if (bt.includes("fast") || bt.includes("medium") || r.includes("fast") || r.includes("pace")) return "Fast Bowler";
  if (bt.includes("spin") || bt.includes("off") || bt.includes("leg") || r.includes("spin")) return "Spin Bowler";
  if (p.avgBattingPosition <= 2.5 || r.includes("open")) return "Opener";
  return "Middle Order";
}

function getClusterLabel(cluster: number, centroids: number[][], featureNames: string[]): string {
  const srIdx  = featureNames.indexOf("strikeRate");
  const wpmIdx = featureNames.indexOf("wicketsPerMatch");
  const c = centroids[cluster];
  const sr  = c[srIdx]  ?? 0;
  const wpm = c[wpmIdx] ?? 0;
  if (wpm > 0.6 && sr < 0.4) return "Powerplay Bowler";
  if (sr > 0.6  && wpm < 0.3) return "Aggressive Hitter";
  if (wpm > 0.4 && sr > 0.4)  return "Allround Threat";
  return "Anchor Batter";
}

function buildReason(p: ScoredPlayer, venue: string, teamRole: string): string {
  const isBowlerSlot = teamRole === "Fast Bowler" || teamRole === "Spin Bowler";
  const parts: string[] = [];

  if (isBowlerSlot) {
    // Bowling-focused reason
    if (p.venueBowlingAvg > 0 && p.venueBowlingAvg < 35)  parts.push(`Bowl avg ${p.venueBowlingAvg.toFixed(1)} at ${venue}`);
    if (p.venueBowlingSR > 0  && p.venueBowlingSR < 20)   parts.push(`Bowl SR ${p.venueBowlingSR.toFixed(1)} at ${venue}`);
    if (p.venueEconomy > 0    && p.venueEconomy < 8)       parts.push(`Eco ${p.venueEconomy.toFixed(1)} at ${venue}`);
    if (p.venueWickets > 1)                                parts.push(`${p.venueWickets.toFixed(1)} wkts/match at ${venue}`);
    if (p.wicketsPerMatch > 1.2)                           parts.push(`${p.wicketsPerMatch.toFixed(1)} wkts/game overall`);
    if (p.economy > 0 && p.economy < 7.5 && p.wicketsPerMatch > 0.5) parts.push(`${p.economy.toFixed(1)} career eco`);
  } else {
    // Batting-focused reason
    if (p.venueBattingAvg > 25)   parts.push(`Avg ${p.venueBattingAvg.toFixed(0)} at ${venue}`);
    if (p.venueStrikeRate > 130)  parts.push(`SR ${p.venueStrikeRate.toFixed(0)} at ${venue}`);
    if (p.battingAvg > 30)        parts.push(`${p.battingAvg.toFixed(1)} career avg`);
    if (p.strikeRate > 135)       parts.push(`${p.strikeRate.toFixed(0)} career SR`);
    // AR: also add bowling
    if (teamRole === "All-Rounder" && p.wicketsPerMatch > 0.5) parts.push(`${p.wicketsPerMatch.toFixed(1)} wkts/game`);
  }

  if (p.finalScore >= 60) parts.push(`AI score ${p.finalScore.toFixed(1)}`);
  if (!parts.length) parts.push(`Strong ${teamRole} — AI rated ${p.finalScore.toFixed(1)}`);
  return parts.join(" · ");
}

function mapToGroundKey(venue: string): string {
  const l = venue.toLowerCase();
  if (l.includes("karachi"))    return "Karachi";
  if (l.includes("multan"))     return "Multan";
  if (l.includes("lahore"))     return "Lahore";
  if (l.includes("rawalpindi")) return "Rawalpindi";
  return venue;
}
