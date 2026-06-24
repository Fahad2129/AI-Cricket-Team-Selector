import { useState, useCallback } from "react";
import { useGetVenues, useRecommendTeam, useGetAlternatives } from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScoreBar } from "@/components/score-bar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Info, Target, Settings, Zap, RefreshCw, Check, LayoutGrid, Volleyball } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const PSL_TEAMS = [
  "Islamabad United",
  "Lahore Qalandars",
  "Karachi Kings",
  "Quetta Gladiators",
  "Peshawar Zalmi",
  "Multan Sultans",
];

const TIER_COLOR: Record<string, string> = {
  Great:   "text-primary",
  Good:    "text-emerald-400",
  Average: "text-muted-foreground",
  Poor:    "text-destructive",
};

const TEAM_ROLE_ORDER = ["Wicketkeeper", "Opener", "Middle Order", "All-Rounder", "Fast Bowler", "Spin Bowler"];

// Pitch positions for 11 players [row, col] in a 5-row grid (top = bowling end)
// Row 0 = fielding deep, Row 4 = batting crease
const PITCH_SLOTS: Array<{ role: string; label: string; row: number; col: number }> = [
  { role: "Fast Bowler",  label: "FB",  row: 0, col: 0 },
  { role: "Fast Bowler",  label: "FB",  row: 0, col: 2 },
  { role: "Spin Bowler",  label: "SB",  row: 0, col: 4 },
  { role: "Spin Bowler",  label: "SB",  row: 1, col: 1 },
  { role: "All-Rounder",  label: "AR",  row: 1, col: 3 },
  { role: "Middle Order", label: "MO",  row: 2, col: 0 },
  { role: "Middle Order", label: "MO",  row: 2, col: 2 },
  { role: "Middle Order", label: "MO",  row: 2, col: 4 },
  { role: "Opener",       label: "OP",  row: 3, col: 1 },
  { role: "Opener",       label: "OP",  row: 3, col: 3 },
  { role: "Wicketkeeper", label: "WK",  row: 4, col: 2 },
];

type TeamPlayer = NonNullable<ReturnType<typeof useRecommendTeam>["data"]>["team"][number];

function isBowlerSlot(teamRole?: string) {
  return teamRole === "Fast Bowler" || teamRole === "Spin Bowler";
}

// ─── Form badge helper ─────────────────────────────────────────────────────────

function FormBadge({ form }: { form?: number }) {
  if (form == null || form === 0) return null;
  const pct = Math.min(Math.max(form, 0), 100);
  const color =
    pct >= 70 ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
    pct >= 45 ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
                "bg-red-500/20 text-red-400 border-red-500/30";
  const label = pct >= 70 ? "In Form" : pct >= 45 ? "Average Form" : "Out of Form";
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold border rounded-full px-2 py-0.5 ${color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${pct >= 70 ? "bg-emerald-400" : pct >= 45 ? "bg-yellow-400" : "bg-red-400"} animate-pulse`} />
      {label} ({pct.toFixed(0)}%)
    </span>
  );
}

// ─── Home Page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [venue, setVenue] = useState<string>("");
  const [fromYear, setFromYear] = useState<number>(2016);
  const [toYear, setToYear] = useState<number>(2026);
  const [opposition, setOpposition] = useState<string>("");
  const [viewMode, setViewMode] = useState<"grid" | "pitch">("grid");

  const { data: venuesData, isLoading: loadingVenues } = useGetVenues();
  const recommendTeam = useRecommendTeam();

  const [localTeam, setLocalTeam] = useState<(TeamPlayer & { teamRole: string })[]>([]);
  const [swapTarget, setSwapTarget] = useState<{ player: TeamPlayer & { teamRole: string }; idx: number } | null>(null);

  const handleGenerate = () => {
    if (!venue) return;
    recommendTeam.mutate(
      { data: { venue, opposition: opposition === "any" ? "" : opposition, from_year: fromYear, to_year: toYear } },
      { onSuccess: (data) => setLocalTeam(data.team as any) }
    );
  };

  const handleSwap = useCallback((newPlayer: TeamPlayer, slotIdx: number, teamRole: string) => {
    setLocalTeam((prev) => prev.map((p, i) => i === slotIdx ? { ...newPlayer, teamRole } : p));
    setSwapTarget(null);
  }, []);

  const orderedTeam = [...localTeam].sort((a, b) => {
    const ai = TEAM_ROLE_ORDER.indexOf(a.teamRole ?? "");
    const bi = TEAM_ROLE_ORDER.indexOf(b.teamRole ?? "");
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const currentTeamNames = orderedTeam.map((p) => p.name).join(",");

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight gold-shimmer">Team Recommender</h1>
        <p className="text-muted-foreground max-w-2xl text-lg">
          Select a PSL venue and opposition to generate an AI-optimized playing XI. Use the swap button on any card to explore alternatives.
        </p>
      </header>

      {/* ── Context Inputs ── */}
      <div className="flex flex-col sm:flex-row items-end gap-4 p-6 bg-card rounded-lg border border-border">
        <div className="w-full sm:w-64 space-y-2">
          <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">PSL Venue</label>
          <Select value={venue} onValueChange={setVenue}>
            <SelectTrigger>
              <SelectValue placeholder={loadingVenues ? "Loading..." : "Select venue"} />
            </SelectTrigger>
            <SelectContent>
              {venuesData?.venues?.map((v) => (
                <SelectItem key={v.name} value={v.name}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full sm:w-64 space-y-2">
          <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            Opposition <span className="text-primary/60">(Bayesian context)</span>
          </label>
          <Select value={opposition} onValueChange={setOpposition}>
            <SelectTrigger>
              <SelectValue placeholder="Select opposition (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any / Not specified</SelectItem>
              {PSL_TEAMS.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end gap-2 w-full sm:w-auto">
          <div className="space-y-2 flex-1 sm:w-28">
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">From Year</label>
            <Select value={String(fromYear)} onValueChange={(v) => { const y = Number(v); setFromYear(y); if (toYear < y) setToYear(y); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[2016,2017,2018,2019,2020,2021,2022,2023,2024,2025,2026].map((yr) => (
                  <SelectItem key={yr} value={String(yr)}>{yr}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="pb-2 text-muted-foreground text-sm font-bold">–</div>
          <div className="space-y-2 flex-1 sm:w-28">
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">To Year</label>
            <Select value={String(toYear)} onValueChange={(v) => { const y = Number(v); setToYear(y); if (fromYear > y) setFromYear(y); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[2016,2017,2018,2019,2020,2021,2022,2023,2024,2025,2026].map((yr) => (
                  <SelectItem key={yr} value={String(yr)}>{yr}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={!venue || recommendTeam.isPending}
          size="lg"
          className="w-full sm:w-auto hover-elevate font-medium tracking-wide uppercase text-sm"
        >
          {recommendTeam.isPending ? "Computing..." : "Generate Optimal XI"}
        </Button>
      </div>

      {/* ── Bayesian context hint ── */}
      {opposition && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-primary/5 border border-primary/20 rounded-md px-4 py-2">
          <Info className="w-3.5 h-3.5 text-primary shrink-0" />
          Naive Bayes will weight P(Good | Venue=<span className="text-primary font-medium">{venue || "..."}</span>, Opposition=<span className="text-primary font-medium">{opposition}</span>, Form) · Era: <span className="text-primary font-medium">{fromYear}–{toYear}</span>
        </div>
      )}

      {/* ── Loading skeletons ── */}
      {recommendTeam.isPending && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 11 }).map((_, i) => <Skeleton key={i} className="h-52 w-full" />)}
        </div>
      )}

      {/* ── Results ── */}
      {recommendTeam.data && orderedTeam.length > 0 && (
        <div className="space-y-8">
          {/* Model Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="gold-glow border-primary/20 md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  Model Intelligence
                </CardTitle>
                <CardDescription>
                  5 algorithms · Venue: <span className="text-foreground font-medium">{venue}</span>
                  {opposition && <> · vs <span className="text-foreground font-medium">{opposition}</span></>}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs uppercase text-muted-foreground">LR Confidence (R²)</div>
                  <div className="text-xl font-bold">{(recommendTeam.data.modelInfo.regressionR2 * 100).toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Players Analysed</div>
                  <div className="text-xl font-bold">{recommendTeam.data.modelInfo.totalPlayersAnalyzed}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Venue Matches</div>
                  <div className="text-xl font-bold">{recommendTeam.data.modelInfo.venueMatchesUsed || 0}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Clusters (K-Means)</div>
                  <div className="text-xl font-bold">{recommendTeam.data.modelInfo.clusterCount}</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary" />
                  Score Weights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ScoreBar score={(recommendTeam.data.modelInfo.weights as any).impactScore * 100} label="Linear Regression" />
                <ScoreBar score={(recommendTeam.data.modelInfo.weights as any).bayesianScore * 100} label="Naive Bayes" />
                <ScoreBar score={(recommendTeam.data.modelInfo.weights as any).venueScore * 100} label="Venue Stats" />
              </CardContent>
            </Card>
          </div>

          {/* View toggle + title */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Zap className="w-6 h-6 text-primary" />
                Recommended XI — {venue}
                {opposition && <span className="text-muted-foreground font-normal text-lg"> vs {opposition}</span>}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Optimised by Genetic Algorithm · Click <RefreshCw className="inline w-3 h-3" /> on any player to explore alternatives
              </p>
            </div>
            <div className="flex items-center gap-1 bg-secondary rounded-md p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
                  viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="w-4 h-4" /> Cards
              </button>
              <button
                onClick={() => setViewMode("pitch")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
                  viewMode === "pitch" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Volleyball className="w-4 h-4" /> Formation
              </button>
            </div>
          </div>

          {/* Grid view */}
          {viewMode === "grid" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {orderedTeam.map((player, idx) => (
                <PlayerCard
                  key={player.name + idx}
                  player={player}
                  idx={idx}
                  venue={venue}
                  onSwap={() => setSwapTarget({ player, idx })}
                />
              ))}
            </div>
          )}

          {/* Pitch formation view */}
          {viewMode === "pitch" && (
            <PitchFormation team={orderedTeam} onSwap={(player, idx) => setSwapTarget({ player, idx })} />
          )}

          {/* Team Balance */}
          <div className="p-4 bg-secondary/50 rounded-lg flex flex-wrap gap-4 text-sm justify-center border border-border">
            <span className="text-muted-foreground font-medium">Team Balance:</span>
            <span>{recommendTeam.data.teamBalance.wicketkeeper} WK</span>
            <span className="text-border">·</span>
            <span>{recommendTeam.data.teamBalance.batsmen} Batters</span>
            <span className="text-border">·</span>
            <span>{recommendTeam.data.teamBalance.allRounders} All-Rounders</span>
            <span className="text-border">·</span>
            <span>{recommendTeam.data.teamBalance.fastBowlers} Pacers</span>
            <span className="text-border">·</span>
            <span>{recommendTeam.data.teamBalance.spinBowlers} Spinners</span>
          </div>
        </div>
      )}

      {/* Swap Dialog */}
      {swapTarget && (
        <SwapDialog
          player={swapTarget.player}
          slotIdx={swapTarget.idx}
          venue={venue}
          exclude={currentTeamNames}
          onSwap={handleSwap}
          onClose={() => setSwapTarget(null)}
        />
      )}
    </div>
  );
}

// ─── Player Card ───────────────────────────────────────────────────────────────

function PlayerCard({
  player, idx, venue, onSwap
}: {
  player: TeamPlayer & { teamRole: string };
  idx: number;
  venue: string;
  onSwap: () => void;
}) {
  const isBowler = isBowlerSlot(player.teamRole);
  const isAR = player.teamRole === "All-Rounder";

  const stat1 = isBowler
    ? { label: (player as any).venueBowlingAvg > 0 ? "Bowl Avg@Venue" : "Career Bowl Avg", value: (player as any).venueBowlingAvg > 0 ? (player as any).venueBowlingAvg.toFixed(1) : (player.economy ?? 0).toFixed(1) }
    : { label: (player as any).venueBattingAvg > 0 ? "Bat Avg@Venue" : "Career Avg", value: (player as any).venueBattingAvg > 0 ? (player as any).venueBattingAvg.toFixed(0) : player.battingAvg?.toFixed(0) ?? "—" };

  const stat2 = isBowler
    ? { label: (player as any).venueBowlingSR > 0 ? "Bowl SR@Venue" : "Economy", value: (player as any).venueBowlingSR > 0 ? (player as any).venueBowlingSR.toFixed(1) : (player.economy ?? 0).toFixed(1) }
    : { label: (player as any).venueStrikeRate > 0 ? "Bat SR@Venue" : "Career SR", value: (player as any).venueStrikeRate > 0 ? (player as any).venueStrikeRate.toFixed(0) : player.strikeRate?.toFixed(0) ?? "—" };

  const stat3 = (isBowler || isAR) && player.wicketsPerMatch > 0
    ? { label: "Wkts/Game", value: ((player as any).venueWickets > 0 ? (player as any).venueWickets : player.wicketsPerMatch).toFixed(1) }
    : { label: "Matches", value: String(player.matches) };

  // Form score — try common field names from the API
  const formScore: number | undefined =
    (player as any).recentForm;

  return (
    <Card className="relative overflow-hidden group hover:border-primary/50 transition-colors">
      <div className="absolute top-3 left-3 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
        {idx + 1}
      </div>
      <button
        onClick={onSwap}
        className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-secondary transition-colors"
        title="Swap player"
      >
        <RefreshCw className="w-3.5 h-3.5" />
      </button>
      <CardContent className="p-5 pt-4 pl-12 pr-10 space-y-3">
        <div>
          <h4 className="font-bold text-lg leading-tight truncate">{player.name}</h4>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider text-primary border-primary/30">
              {player.teamRole ?? "Player"}
            </Badge>
            <FormBadge form={formScore} />
          </div>
        </div>
        <ScoreBar score={player.finalScore} label="AI Rating" />
        <div className="flex items-center justify-between text-xs">
          <span className={`font-semibold ${TIER_COLOR[player.performanceClass ?? ""] ?? "text-muted-foreground"}`}>
            {player.performanceClass}
          </span>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="cursor-help flex items-center gap-1 hover:bg-secondary">
                <Info className="w-3 h-3" />
                Why picked
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs bg-popover border-border text-popover-foreground">
              <p>{player.selectionReason}</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="grid grid-cols-3 gap-1 pt-1 border-t border-border text-center">
          <div>
            <div className="text-[10px] text-muted-foreground">{stat1.label}</div>
            <div className="text-xs font-bold text-primary">{stat1.value}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground">{stat2.label}</div>
            <div className="text-xs font-bold text-primary">{stat2.value}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground">{stat3.label}</div>
            <div className="text-xs font-bold">{stat3.value}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Pitch Formation ──────────────────────────────────────────────────────────

function PitchFormation({
  team,
  onSwap,
}: {
  team: (TeamPlayer & { teamRole: string })[];
  onSwap: (player: TeamPlayer & { teamRole: string }, idx: number) => void;
}) {
  // Map role → players (in order)
  const byRole: Record<string, (TeamPlayer & { teamRole: string; _globalIdx: number })[]> = {};
  team.forEach((p, i) => {
    const r = p.teamRole ?? "Unknown";
    if (!byRole[r]) byRole[r] = [];
    byRole[r].push({ ...p, _globalIdx: i });
  });

  // Assign a player to each pitch slot
  const roleCounters: Record<string, number> = {};
  const assigned = PITCH_SLOTS.map((slot) => {
    const key = slot.role;
    const pool = byRole[key] ?? [];
    const c = roleCounters[key] ?? 0;
    roleCounters[key] = c + 1;
    return { slot, player: pool[c] ?? null };
  });

  // Grid: 5 rows × 5 cols
  const rows = [0, 1, 2, 3, 4];

  return (
    <div className="relative w-full max-w-2xl mx-auto select-none">
      {/* Pitch background */}
      <div className="relative rounded-2xl overflow-hidden border border-border bg-[#1a3a1a]" style={{ aspectRatio: "3/4" }}>
        {/* Grass texture stripes */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="absolute left-0 right-0"
            style={{
              top: `${i * 10}%`,
              height: "10%",
              background: i % 2 === 0 ? "rgba(255,255,255,0.025)" : "transparent",
            }}
          />
        ))}
        {/* Centre pitch strip */}
        <div className="absolute left-1/2 -translate-x-1/2 top-[10%] bottom-[10%] w-[18%] rounded-sm bg-[#c8a96e]/30 border border-[#c8a96e]/20" />

        {/* Bowling end label */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest text-white/30 font-semibold">
          Bowling End
        </div>
        {/* Batting end label */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest text-white/30 font-semibold">
          Batting End
        </div>

        {/* Player nodes — 5 rows × 5 cols */}
        <div
          className="absolute inset-0 grid"
          style={{
            display: "grid",
            gridTemplateRows: "repeat(5, 1fr)",
            gridTemplateColumns: "repeat(5, 1fr)",
            padding: "8% 4%",
          }}
        >
          {assigned.map(({ slot, player }, i) => (
            <div
              key={i}
              style={{ gridRow: slot.row + 1, gridColumn: slot.col + 1 }}
              className="flex items-center justify-center"
            >
              {player ? (
                <PitchNode player={player} globalIdx={player._globalIdx} onSwap={onSwap} />
              ) : (
                <div className="w-12 h-12 rounded-full border border-dashed border-white/10 flex items-center justify-center">
                  <span className="text-[10px] text-white/20">{slot.label}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-4 justify-center text-[11px] text-muted-foreground">
        {[
          { label: "Wicketkeeper", color: "bg-amber-500" },
          { label: "Opener", color: "bg-sky-500" },
          { label: "Middle Order", color: "bg-violet-500" },
          { label: "All-Rounder", color: "bg-emerald-500" },
          { label: "Fast Bowler", color: "bg-red-500" },
          { label: "Spin Bowler", color: "bg-orange-400" },
        ].map(({ label, color }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

const ROLE_COLORS: Record<string, string> = {
  "Wicketkeeper": "bg-amber-500 border-amber-400",
  "Opener":       "bg-sky-500 border-sky-400",
  "Middle Order": "bg-violet-500 border-violet-400",
  "All-Rounder":  "bg-emerald-500 border-emerald-400",
  "Fast Bowler":  "bg-red-500 border-red-400",
  "Spin Bowler":  "bg-orange-400 border-orange-300",
};

function PitchNode({
  player,
  globalIdx,
  onSwap,
}: {
  player: TeamPlayer & { teamRole: string; _globalIdx: number };
  globalIdx: number;
  onSwap: (p: TeamPlayer & { teamRole: string }, idx: number) => void;
}) {
  const colorClass = ROLE_COLORS[player.teamRole] ?? "bg-gray-500 border-gray-400";
  const formScore: number | undefined =
    (player as any).recentForm;

  const formDot =
    formScore == null ? null :
    formScore >= 70 ? "ring-2 ring-emerald-400" :
    formScore >= 45 ? "ring-2 ring-yellow-400" :
                      "ring-2 ring-red-400";

  // Short name: first initial + last name
  const nameParts = player.name.trim().split(" ");
  const shortName = nameParts.length > 1
    ? `${nameParts[0][0]}. ${nameParts.slice(-1)[0]}`
    : player.name;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => onSwap(player, globalIdx)}
          className={`
            relative flex flex-col items-center justify-center
            w-14 h-14 rounded-full border-2 text-white font-bold text-[10px]
            transition-all hover:scale-110 hover:z-10 active:scale-95 shadow-lg
            ${colorClass} ${formDot ?? ""}
          `}
          title={`${player.name} — click to swap`}
        >
          <span className="text-[9px] leading-tight text-center px-0.5 truncate w-full text-center">
            {shortName}
          </span>
          <span className="text-[8px] opacity-70 font-normal">{player.finalScore?.toFixed(0)}</span>
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-background rounded-full flex items-center justify-center border border-border text-[8px] font-bold text-foreground">
            {globalIdx + 1}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent className="bg-popover border-border text-popover-foreground max-w-[200px]">
        <div className="space-y-1">
          <div className="font-semibold text-sm">{player.name}</div>
          <div className="text-[11px] text-muted-foreground">{player.teamRole} · AI Score: {player.finalScore?.toFixed(1)}</div>
          {formScore != null && (
            <div className="text-[11px]">
              Form: <span className={formScore >= 70 ? "text-emerald-400" : formScore >= 45 ? "text-yellow-400" : "text-red-400"}>
                {formScore.toFixed(0)}%
              </span>
            </div>
          )}
          <div className="text-[10px] text-muted-foreground">{player.selectionReason}</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Swap Dialog ───────────────────────────────────────────────────────────────

function SwapDialog({
  player, slotIdx, venue, exclude, onSwap, onClose,
}: {
  player: TeamPlayer & { teamRole: string };
  slotIdx: number;
  venue: string;
  exclude: string;
  onSwap: (p: TeamPlayer, idx: number, role: string) => void;
  onClose: () => void;
}) {
  const { data, isLoading } = useGetAlternatives({
    position: player.teamRole,
    venue,
    exclude,
  } as any);

  const isBowler = isBowlerSlot(player.teamRole);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Replace <span className="text-primary">{player.name}</span>
          </DialogTitle>
          <DialogDescription>
            Top alternatives for <span className="uppercase text-xs tracking-wider">{player.teamRole}</span> at {venue || "All Venues"} ranked by AI score
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        )}

        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {data?.alternatives?.map((alt) => {
            const isCurrentPlayer = alt.name === player.name;
            const stat1Val = isBowler
              ? ((alt as any).venueBowlingAvg > 0 ? `Bowl avg ${(alt as any).venueBowlingAvg.toFixed(1)}` : `${alt.wicketsPerMatch?.toFixed(2)} wkts/game`)
              : ((alt as any).venueBattingAvg > 0 ? `Avg ${(alt as any).venueBattingAvg.toFixed(0)} at ${venue}` : `Avg ${alt.battingAvg?.toFixed(1)}`);
            const stat2Val = isBowler
              ? `Eco ${alt.economy?.toFixed(1)}`
              : `SR ${alt.strikeRate?.toFixed(0)}`;
            const altForm: number | undefined =
              (alt as any).recentForm;

            return (
              <button
                key={alt.name}
                disabled={isCurrentPlayer}
                onClick={() => onSwap(alt as any, slotIdx, player.teamRole)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                  isCurrentPlayer
                    ? "border-primary/40 bg-primary/5 cursor-default"
                    : "border-border hover:border-primary/40 hover:bg-secondary/40 cursor-pointer"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate">{alt.name}</span>
                    {isCurrentPlayer && <Check className="w-3 h-3 text-primary shrink-0" />}
                    <Badge variant="outline" className={`text-[9px] uppercase ml-auto shrink-0 ${TIER_COLOR[alt.performanceClass ?? ""] ?? ""}`}>
                      {alt.performanceClass}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>{stat1Val} · {stat2Val} · {alt.matches} matches</span>
                    {altForm != null && <FormBadge form={altForm} />}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-primary">{alt.finalScore?.toFixed(1)}</div>
                  <div className="text-[9px] text-muted-foreground uppercase">AI</div>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
