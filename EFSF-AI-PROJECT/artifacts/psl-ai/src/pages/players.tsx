import { useState } from "react";
import { Link } from "wouter";
import { useGetPlayers, useGetVenues } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const TIER_COLOR: Record<string, string> = {
  Great:   "text-primary border-primary/40",
  Good:    "text-emerald-400 border-emerald-400/40",
  Average: "text-muted-foreground border-muted-foreground/30",
  Poor:    "text-destructive border-destructive/40",
};

const ROLE_FILTERS = [
  { value: "All",    label: "All Roles" },
  { value: "bat",    label: "Batters" },
  { value: "all",    label: "All-Rounders" },
  { value: "wicket", label: "Wicketkeepers" },
  { value: "fast",   label: "Fast Bowlers" },
  { value: "spin",   label: "Spinners" },
];

function cleanRole(role: string): string {
  const r = role.toLowerCase();
  if (r.includes("wicket"))                                       return "Wicketkeeper";
  if (r.includes("all"))                                          return "All-Rounder";
  if (r.includes("open"))                                         return "Opener";
  if (r.includes("middle"))                                       return "Middle Order";
  if (r.includes("fast") || r.includes("pace") || r.includes("medium")) return "Fast Bowler";
  if (r.includes("spin"))                                         return "Spinner";
  if (r.includes("bat"))                                          return "Batter";
  return role;
}

function isBowlerRole(role: string): boolean {
  const r = role.toLowerCase();
  return r.includes("fast") || r.includes("pace") || r.includes("medium") || r.includes("spin") || r.includes("bowl");
}

function aiConfidence(player: any): number {
  const matchScore = Math.min(50, (player.matches / 40) * 50);
  const scoreBonus = Math.min(30, (player.finalScore / 100) * 30);
  const formBonus  = Math.min(20, ((player.recentForm ?? 0) / 100) * 20);
  return Math.round(matchScore + scoreBonus + formBonus);
}

function confidenceColor(pct: number): string {
  if (pct >= 80) return "bg-primary";
  if (pct >= 60) return "bg-emerald-500";
  if (pct >= 40) return "bg-yellow-500";
  return "bg-red-500";
}

function getPrediction(player: any): { label: string; emoji: string; color: string } | null {
  const isBowler = isBowlerRole(player.role);
  const avg     = player.battingAvg      ?? 0;
  const sr      = player.strikeRate      ?? 0;
  const wpm     = player.wicketsPerMatch ?? 0;
  const eco     = player.economy         ?? 0;
  const matches = player.matches         ?? 0;
  const form    = player.recentForm      ?? 0;
  const score   = player.finalScore      ?? 0;

  if (matches < 5) return null;

  if (isBowler) {
    if (wpm <= 0 && eco <= 0) return null;
    if (wpm >= 2.0 && eco < 7.5 && score >= 65)
      return { label: "3+ wickets likely",           emoji: "🔥", color: "text-primary" };
    if (wpm >= 1.5 && eco < 8.0)
      return { label: "2+ wickets expected",          emoji: "🎯", color: "text-emerald-400" };
    if (wpm >= 1.0 && eco < 8.5)
      return { label: "1–2 wickets expected",         emoji: "🎳", color: "text-yellow-400" };
    if (wpm < 0.5 && eco > 10)
      return { label: "Wicketless likely (eco 10+)",  emoji: "📉", color: "text-red-400" };
    if (eco > 9)
      return { label: "Expensive spell expected",     emoji: "⚠️", color: "text-orange-400" };
    return   { label: "1 wicket expected",            emoji: "🎯", color: "text-muted-foreground" };
  } else {
    if (avg <= 0 && sr <= 0) return null;
    if (avg >= 40 && sr >= 150 && form >= 70 && score >= 70)
      return { label: "50+ runs predicted",           emoji: "🔥", color: "text-primary" };
    if (avg >= 35 && sr >= 140)
      return { label: "45+ runs expected",            emoji: "⚡", color: "text-emerald-400" };
    if (avg >= 28 && sr >= 130)
      return { label: "30+ runs expected",            emoji: "🏏", color: "text-yellow-400" };
    if (avg >= 20 && sr >= 110)
      return { label: "20–30 runs expected",          emoji: "📊", color: "text-muted-foreground" };
    if (avg < 15 || (form < 30 && matches > 15))
      return { label: "Under 15 runs likely",         emoji: "📉", color: "text-red-400" };
    return   { label: "15–25 runs expected",          emoji: "📈", color: "text-muted-foreground" };
  }
}

export default function Players() {
  const [search, setSearch] = useState("");
  const [role,   setRole]   = useState<string>("All");
  const [venue,  setVenue]  = useState<string>("All");
  const [sortBy, setSortBy] = useState<"finalScore"|"roleScore"|"battingAvg"|"strikeRate"|"wicketsPerMatch"|"economy">("finalScore");
  const [tab,    setTab]    = useState("explorer");

  const { data: venuesData } = useGetVenues();
  const queryParams: Record<string, string> = {};
  if (role  !== "All") queryParams.role  = role;
  if (venue !== "All") queryParams.venue = venue;

  const { data: playersData, isLoading } = useGetPlayers(queryParams as any);
  const isBowlerFilter = role === "fast" || role === "spin";
  const isBatterFilter = role === "bat"  || role === "wicket";

  const allPlayers: any[] = playersData?.players ?? [];

  const filteredPlayers = allPlayers
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "roleScore")       return (b.roleScore ?? 0) - (a.roleScore ?? 0);
      if (sortBy === "finalScore")      return b.finalScore - a.finalScore;
      if (sortBy === "battingAvg")      return (b.battingAvg ?? 0) - (a.battingAvg ?? 0);
      if (sortBy === "strikeRate")      return (b.strikeRate ?? 0) - (a.strikeRate ?? 0);
      if (sortBy === "wicketsPerMatch") return (b.wicketsPerMatch ?? 0) - (a.wicketsPerMatch ?? 0);
      if (sortBy === "economy")         return (a.economy ?? 99) - (b.economy ?? 99);
      return 0;
    });

  const predictionPlayers = allPlayers
    .filter((p) => (p.matches ?? 0) >= 5 && getPrediction(p) !== null)
    .sort((a, b) => b.finalScore - a.finalScore);

  const Filters = (
    <div className="flex flex-col md:flex-row gap-3 bg-card p-4 rounded-lg border border-border flex-wrap">
      <div className="relative flex-1 min-w-48">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search players..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-background" />
      </div>
      <Select value={role} onValueChange={(v) => { setRole(v); setSortBy("finalScore"); }}>
        <SelectTrigger className="w-full md:w-44 bg-background"><SelectValue placeholder="Role" /></SelectTrigger>
        <SelectContent>{ROLE_FILTERS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={venue} onValueChange={setVenue}>
        <SelectTrigger className="w-full md:w-44 bg-background"><SelectValue placeholder="Venue" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="All">All Venues</SelectItem>
          {venuesData?.venues?.map((v) => <SelectItem key={v.name} value={v.name}>{v.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
        <SelectTrigger className="w-full md:w-44 bg-background"><SelectValue placeholder="Sort by" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="finalScore">AI Score ↓</SelectItem>
          <SelectItem value="roleScore">Role Score ↓</SelectItem>
          <SelectItem value="battingAvg">Batting Avg ↓</SelectItem>
          <SelectItem value="strikeRate">Strike Rate ↓</SelectItem>
          <SelectItem value="wicketsPerMatch">Wickets/Game ↓</SelectItem>
          <SelectItem value="economy">Economy ↑</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Player Explorer</h1>
        <p className="text-muted-foreground">AI metrics for all PSL Pakistani players — ranked by AI Score by default.</p>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-secondary border border-border">
          <TabsTrigger value="explorer">Player Table</TabsTrigger>
          <TabsTrigger value="prediction">AI Form Prediction</TabsTrigger>
        </TabsList>

        {/* EXPLORER */}
        <TabsContent value="explorer" className="space-y-4 mt-4">
          {Filters}
          {role !== "All" && (
            <div className="text-xs text-muted-foreground bg-secondary/30 rounded-md px-4 py-2 border border-border">
              {isBowlerFilter ? "Bowlers ranked by: wickets/game (50%) + economy (35%) + recent form (15%)."
                : isBatterFilter ? "Batters ranked by: batting average (45%) + strike rate (35%) + recent form (20%)."
                : "All-Rounders ranked by equal weight of batting and bowling performance."}
            </div>
          )}
          <div className="border border-border rounded-lg bg-card overflow-hidden">
            <Table>
              <TableHeader className="bg-secondary/50">
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">M</TableHead>
                  {isBowlerFilter ? (<><TableHead className="text-right">Wkts/G</TableHead><TableHead className="text-right">Eco</TableHead></>) : (<><TableHead className="text-right">Avg</TableHead><TableHead className="text-right">SR</TableHead></>)}
                  <TableHead className="text-right">Role Score</TableHead>
                  <TableHead className="text-right">AI Score</TableHead>
                  <TableHead className="min-w-[150px]">AI Confidence</TableHead>
                  <TableHead>Tier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 10 }).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                )) : filteredPlayers.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No players found.</TableCell></TableRow>
                ) : filteredPlayers.map((player, idx) => {
                  const showBowling = isBowlerFilter || (!isBatterFilter && isBowlerRole(player.role));
                  const conf = aiConfidence(player);
                  return (
                    <TableRow key={player.name} className="hover:bg-secondary/20 transition-colors">
                      <TableCell className="text-muted-foreground text-xs font-bold">{idx + 1}</TableCell>
                      <TableCell className="font-medium">
                        <Link href={`/player/${encodeURIComponent(player.name)}`} className="hover:text-primary transition-colors">{player.name}</Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs uppercase tracking-wider">{cleanRole(player.role)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{player.matches}</TableCell>
                      {showBowling ? (<><TableCell className="text-right text-muted-foreground">{player.wicketsPerMatch?.toFixed(2) ?? "—"}</TableCell><TableCell className="text-right text-muted-foreground">{player.economy?.toFixed(1) ?? "—"}</TableCell></>) : (<><TableCell className="text-right text-muted-foreground">{player.battingAvg?.toFixed(1) ?? "—"}</TableCell><TableCell className="text-right text-muted-foreground">{player.strikeRate?.toFixed(0) ?? "—"}</TableCell></>)}
                      <TableCell className="text-right font-bold text-emerald-400">{(player.roleScore ?? 0).toFixed(1)}</TableCell>
                      <TableCell className="text-right font-bold text-primary">{player.finalScore.toFixed(1)}</TableCell>
                      <TableCell className="min-w-[150px]">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="space-y-1 cursor-help">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-muted-foreground">AI Confidence</span>
                                <span className="font-bold text-foreground">{conf}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${confidenceColor(conf)}`} style={{ width: `${conf}%` }} />
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs max-w-[200px]">
                            Based on {player.matches} matches, AI score {player.finalScore.toFixed(1)}, and recent form.
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${TIER_COLOR[player.performanceClass] ?? "text-muted-foreground"} bg-transparent text-[10px] uppercase`}>
                          {player.performanceClass ?? "—"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground text-right">{filteredPlayers.length} player{filteredPlayers.length !== 1 ? "s" : ""} shown</p>
        </TabsContent>

        {/* PREDICTION TAB */}
        <TabsContent value="prediction" className="space-y-4 mt-4">
          <div className="text-sm text-muted-foreground bg-secondary/30 rounded-md px-4 py-3 border border-border">
            Next-match predictions derived from career batting average, strike rate, wickets per game, economy, and recent form score.
            Players with fewer than 5 matches are excluded. Batters only get batting predictions; bowlers only get bowling predictions.
          </div>
          <div className="border border-border rounded-lg bg-card overflow-hidden">
            <Table>
              <TableHeader className="bg-secondary/50">
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">M</TableHead>
                  <TableHead className="text-right">AI Score</TableHead>
                  <TableHead className="min-w-[150px]">AI Confidence</TableHead>
                  <TableHead className="min-w-[220px]">Next Match Prediction</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 7 }).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                )) : predictionPlayers.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No predictions available.</TableCell></TableRow>
                ) : predictionPlayers.map((player, idx) => {
                  const pred = getPrediction(player)!;
                  const conf = aiConfidence(player);
                  return (
                    <TableRow key={player.name} className="hover:bg-secondary/20 transition-colors">
                      <TableCell className="text-muted-foreground text-xs font-bold">{idx + 1}</TableCell>
                      <TableCell className="font-medium">
                        <Link href={`/player/${encodeURIComponent(player.name)}`} className="hover:text-primary transition-colors">{player.name}</Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs uppercase tracking-wider">{cleanRole(player.role)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{player.matches}</TableCell>
                      <TableCell className="text-right font-bold text-primary">{player.finalScore.toFixed(1)}</TableCell>
                      <TableCell className="min-w-[150px]">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-muted-foreground">Confidence</span>
                            <span className="font-bold text-foreground">{conf}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${confidenceColor(conf)}`} style={{ width: `${conf}%` }} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`text-sm font-semibold ${pred.color}`}>{pred.emoji} {pred.label}</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground text-right">{predictionPlayers.length} player{predictionPlayers.length !== 1 ? "s" : ""} with predictions</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
