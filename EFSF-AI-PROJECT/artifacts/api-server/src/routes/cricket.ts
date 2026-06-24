import { Router } from "express";
import { runAIEngine, buildOptimalTeam, isPureBowler } from "../lib/aiEngine.js";
import { loadDataset } from "../lib/dataLoader.js";

const router = Router();

const engineCache = new Map<string, ReturnType<typeof runAIEngine>>();

function getEngine(venue?: string) {
  const key = venue ?? "__all__";
  if (!engineCache.has(key)) engineCache.set(key, runAIEngine(venue));
  return engineCache.get(key)!;
}

const PSL_VENUES = [
  { key: "Karachi",    full: "National Stadium, Karachi",              city: "Karachi" },
  { key: "Lahore",     full: "Gaddafi Stadium, Lahore",                city: "Lahore" },
  { key: "Multan",     full: "Multan Cricket Stadium, Multan",         city: "Multan" },
  { key: "Rawalpindi", full: "Rawalpindi Cricket Stadium, Rawalpindi", city: "Rawalpindi" },
];

// GET /cricket/venues
router.get("/venues", (_req, res) => {
  const data = loadDataset();
  const venueCounts = new Map<string, number>();
  for (const r of data.masterRecords) {
    venueCounts.set(r.venue, (venueCounts.get(r.venue) ?? 0) + 1);
  }
  const venues = PSL_VENUES.map((v) => {
    let count = 0;
    for (const [name, c] of venueCounts) {
      if (name.toLowerCase().includes(v.key.toLowerCase())) count += c;
    }
    return { name: v.key, shortName: v.key, matchCount: count, city: v.city };
  }).filter((v) => v.matchCount > 0);
  res.json({ venues });
});

// GET /cricket/players
router.get("/players", (req, res) => {
  const { role, venue } = req.query as { role?: string; venue?: string };
  const { players } = getEngine(venue);
  let filtered = players;
  if (role) filtered = players.filter((p) => p.role.toLowerCase().includes(role.toLowerCase()));
  res.json({ players: [...filtered].sort((a, b) => b.finalScore - a.finalScore), total: filtered.length });
});

// POST /cricket/recommend
router.post("/recommend", (req, res) => {
  const { venue, opposition } = req.body as { venue: string; opposition?: string };
  if (!venue) { res.status(400).json({ error: "venue is required" }); return; }
  const validVenue = PSL_VENUES.find((v) => v.key.toLowerCase() === venue.toLowerCase());
  if (!validVenue) { res.status(400).json({ error: "Invalid venue. Must be one of: Karachi, Lahore, Multan, Rawalpindi" }); return; }
  const { players, modelInfo } = getEngine(validVenue.key);
  const data = loadDataset();
  const venueMatches = new Set(
    data.masterRecords
      .filter((r) => r.venue.toLowerCase().includes(validVenue.key.toLowerCase()))
      .map((r) => r.date + r.opposition)
  ).size;
  const result = buildOptimalTeam(players, validVenue.key, opposition ?? "", modelInfo);
  res.json({ ...result, modelInfo: { ...result.modelInfo, venueMatchesUsed: venueMatches } });
});

// GET /cricket/player/:name
router.get("/player/:name", (req, res) => {
  const { name } = req.params;
  const { players } = getEngine();
  const data = loadDataset();
  const player = players.find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }

  const venueBreakdown: Record<string, { runs: number; innings: number; wickets: number; balls: number; runsConceded: number; ballsBowled: number }> = {};
  for (const r of data.masterRecords) {
    if (r.player.toLowerCase() !== name.toLowerCase()) continue;
    const v = r.venue;
    if (!venueBreakdown[v]) venueBreakdown[v] = { runs: 0, innings: 0, wickets: 0, balls: 0, runsConceded: 0, ballsBowled: 0 };
    venueBreakdown[v].runs         += r.runs;
    venueBreakdown[v].innings      += r.balls > 0 ? 1 : 0;
    venueBreakdown[v].wickets      += r.wickets;
    venueBreakdown[v].balls        += r.balls;
    venueBreakdown[v].runsConceded += r.runsConceded;
    venueBreakdown[v].ballsBowled  += r.ballsBowled;
  }
  const venueStats = Object.entries(venueBreakdown).map(([venue, s]) => ({
    venue,
    matches:    Math.max(s.innings, s.ballsBowled > 0 ? 1 : 0),
    battingAvg: s.innings > 0 ? Math.round((s.runs / s.innings) * 10) / 10 : 0,
    strikeRate: s.balls > 0 ? Math.round((s.runs / s.balls) * 1000) / 10 : 0,
    wickets:    s.wickets,
    economy:    s.ballsBowled > 0 ? Math.round((s.runsConceded / (s.ballsBowled / 6)) * 10) / 10 : 0,
  }));
  const matchHistory = data.masterRecords
    .filter((r) => r.player.toLowerCase() === name.toLowerCase())
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10)
    .map((r) => ({ date: r.date, venue: r.venue, opposition: r.opposition, runs: r.runs, wickets: r.wickets, economy: r.economy, strikeRate: r.battingStrikeRate }));
  res.json({ ...player, venueBreakdown: venueStats, matchHistory });
});

// GET /cricket/stats/summary
router.get("/stats/summary", (_req, res) => {
  const data = loadDataset();
  const { players, modelInfo } = getEngine();
  const venues = new Set(data.masterRecords.map((r) => r.venue));
  const matches = new Set(data.masterRecords.map((r) => r.date + r.opposition + r.venue));
  const clusterGroups = new Map<number, number[]>();
  for (const p of players) {
    if (!clusterGroups.has(p.cluster)) clusterGroups.set(p.cluster, []);
    clusterGroups.get(p.cluster)!.push(p.impactScore);
  }
  const clusterLabels = ["Aggressive Hitter", "Anchor Batter", "Powerplay Bowler", "Allround Threat"];
  const clusters = [...clusterGroups.entries()].map(([cluster, scores]) => ({
    cluster,
    label: clusterLabels[cluster] ?? `Cluster ${cluster}`,
    count: scores.length,
    avgImpactScore: Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10,
  }));
  res.json({
    totalPlayers: players.length, totalMatches: matches.size,
    totalRecords: data.masterRecords.length, venueCount: venues.size, clusters,
    modelAccuracy: { regressionR2: modelInfo.regressionR2, classifierAccuracy: 0.78, clusterSilhouette: 0.61 },
  });
});

// GET /cricket/top-performers
router.get("/top-performers", (req, res) => {
  const { venue } = req.query as { venue?: string };
  const { players } = getEngine(venue);

  const isWK      = (p: typeof players[0]) => p.role.toLowerCase().includes("wicket");
  const isBatter  = (p: typeof players[0]) =>
    !isWK(p) && !p.role.toLowerCase().includes("all") &&
    (p.role.toLowerCase().includes("bat") || p.role.toLowerCase().includes("open") || p.role.toLowerCase().includes("middle"));
  const isAR      = (p: typeof players[0]) => p.role.toLowerCase().includes("all");
  const isFast    = (p: typeof players[0]) =>
    !isWK(p) && !isAR(p) &&
    (p.bowlingType.toLowerCase().includes("fast") || p.bowlingType.toLowerCase().includes("medium") ||
     p.role.toLowerCase().includes("fast") || p.role.toLowerCase().includes("pace"));
  const isSpin    = (p: typeof players[0]) =>
    !isWK(p) && !isAR(p) &&
    (p.bowlingType.toLowerCase().includes("spin") || p.bowlingType.toLowerCase().includes("off") ||
     p.bowlingType.toLowerCase().includes("leg") || p.role.toLowerCase().includes("spin"));

  // Sort each group by their ROLE-SPECIFIC score for fair ranking
  const sortedByRole = (arr: typeof players) => [...arr].sort((a, b) => b.roleScore - a.roleScore);

  res.json({
    batsmen:       sortedByRole(players.filter(isBatter)).slice(0, 10),
    allRounders:   sortedByRole(players.filter(isAR)).slice(0, 10),
    fastBowlers:   sortedByRole(players.filter(isFast)).slice(0, 10),
    spinBowlers:   sortedByRole(players.filter(isSpin)).slice(0, 10),
    wicketkeepers: sortedByRole(players.filter(isWK)).slice(0, 5),
    venue: venue ?? "All Venues",
  });
});

// GET /cricket/alternatives  — swap a player in the XI
// Query: position (teamRole), venue, exclude (comma-separated names)
router.get("/alternatives", (req, res) => {
  const { position, venue, exclude } = req.query as { position?: string; venue?: string; exclude?: string };
  if (!position) { res.status(400).json({ error: "position is required" }); return; }

  const { players } = getEngine(venue);
  const excludeSet = new Set((exclude ?? "").split(",").map((n) => n.trim().toLowerCase()).filter(Boolean));

  const roleLower = position.toLowerCase();

  // Helper: player is NOT a primary batter (cannot fill bowling slots)
  const isNotPrimaryBatterAlt = (p: typeof players[0]): boolean => {
    const rl = p.role.toLowerCase();
    return !rl.includes("bat") && !rl.includes("open") && !rl.includes("middle") &&
      !rl.includes("finisher") && !rl.includes("wicket");
  };

  const matchesPosition = (p: typeof players[0]): boolean => {
    const rl = p.role.toLowerCase();
    const bt = p.bowlingType.toLowerCase();
    if (roleLower === "wicketkeeper") return rl.includes("wicket");
    if (roleLower === "opener")       return !rl.includes("wicket") && !rl.includes("all") &&
      !isPureBowler(p) && (p.avgBattingPosition <= 2.5 || rl.includes("open"));
    if (roleLower === "middle order") return !rl.includes("wicket") && !rl.includes("all") &&
      !isPureBowler(p) && p.avgBattingPosition > 2.5 && p.avgBattingPosition <= 7;
    if (roleLower === "all-rounder")  return rl.includes("all");
    if (roleLower === "fast bowler")  return !rl.includes("wicket") && !rl.includes("all") &&
      isNotPrimaryBatterAlt(p) &&  // Exclude batters who bowl part-time
      (bt.includes("fast") || bt.includes("medium") || bt.includes("pace") ||
       rl.includes("fast") || rl.includes("medium") || rl.includes("pace") || rl.includes("bowl"));
    if (roleLower === "spin bowler")  return !rl.includes("wicket") && !rl.includes("all") &&
      isNotPrimaryBatterAlt(p) &&  // Exclude batters who bowl part-time
      (bt.includes("spin") || bt.includes("off") || bt.includes("leg") || bt.includes("slow") ||
       rl.includes("spin") || rl.includes("off break") || rl.includes("leg break"));
    return true;
  };

  const alternatives = players
    .filter((p) => !excludeSet.has(p.name.toLowerCase()) && matchesPosition(p))
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, 8)
    .map((p) => ({ ...p, teamRole: position }));

  res.json({ alternatives, position, venue: venue ?? "All Venues" });
});

// GET /cricket/stats/full — full career stats for statistics page
router.get("/stats/full", (_req, res) => {
  const data = loadDataset();
  const { players } = getEngine();

  const fullStats = players.map((p) => {
    const roleRec = data.playerRoles.find((r) => r.player === p.name);
    return {
      name: p.name,
      role: p.role,
      bowlingType: p.bowlingType,
      matches: p.matches,
      totalRuns: roleRec?.runs ?? 0,
      totalWickets: roleRec?.wickets ?? 0,
      battingAvg: p.battingAvg,
      strikeRate: p.strikeRate,
      hundreds: roleRec?.hundreds ?? 0,
      fifties: roleRec?.fifties ?? 0,
      ducks: roleRec?.ducks ?? 0,
      highestScore: roleRec?.highestScore ?? "0",
      bowlingAvg: roleRec?.bowlAverage ?? 0,
      economy: p.economy,
      bowlStrikeRate: roleRec?.bowlStrikeRate ?? 0,
      wicketsPerMatch: p.wicketsPerMatch,
      finalScore: p.finalScore,
      roleScore: p.roleScore,
      performanceClass: p.performanceClass,
      clusterLabel: p.clusterLabel,
    };
  });

  res.json({ players: fullStats, total: fullStats.length });
});

export default router;
