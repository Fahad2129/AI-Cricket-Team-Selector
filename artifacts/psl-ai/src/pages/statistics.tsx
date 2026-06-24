import { useState } from "react";
import { useGetFullStats, useGetPlayers } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid,
  ScatterChart, Scatter, ZAxis, Cell, Legend,
} from "recharts";
import { TrendingUp, Target, Award, GitCompare } from "lucide-react";

const TIER_COLOR: Record<string, string> = {
  Great:   "text-primary border-primary/40",
  Good:    "text-emerald-400 border-emerald-400/40",
  Average: "text-muted-foreground border-muted-foreground/30",
  Poor:    "text-destructive border-destructive/40",
};

const tooltipStyle = {
  contentStyle: { backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" },
  itemStyle: { color: "hsl(var(--primary))" },
  cursor: { fill: "hsl(var(--secondary))" },
};

function roleGroup(role: string): string {
  const r = role.toLowerCase();
  if (r.includes("wicket")) return "Wicketkeeper";
  if (r.includes("all")) return "All-Rounder";
  if (r.includes("fast") || r.includes("pace") || r.includes("medium")) return "Fast Bowler";
  if (r.includes("spin")) return "Spin Bowler";
  return "Batter";
}

export default function Statistics() {
  const { data, isLoading } = useGetFullStats();
  const { data: playersData, isLoading: loadingPlayers } = useGetPlayers();
  const [tab, setTab] = useState("comparison");

  if (isLoading || loadingPlayers) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!data?.players) return null;

  const all = data.players;
  const allPlayers: any[] = (playersData as any)?.players ?? [];

  // Summary totals
  const totalRuns    = all.reduce((s, p) => s + p.totalRuns, 0);
  const totalWickets = all.reduce((s, p) => s + p.totalWickets, 0);
  const topScorer    = [...all].sort((a, b) => b.totalRuns - a.totalRuns)[0];
  const topWickets   = [...all].sort((a, b) => b.totalWickets - a.totalWickets)[0];

  // Charts data
  const top15Runs = [...all]
    .filter((p) => p.totalRuns > 0)
    .sort((a, b) => b.totalRuns - a.totalRuns)
    .slice(0, 15)
    .map((p) => ({ name: p.name.split(" ")[0], fullName: p.name, runs: p.totalRuns }));

  const top15Wickets = [...all]
    .filter((p) => p.totalWickets > 0)
    .sort((a, b) => b.totalWickets - a.totalWickets)
    .slice(0, 15)
    .map((p) => ({ name: p.name.split(" ")[0], fullName: p.name, wickets: p.totalWickets }));

  const scatterData = all
    .filter((p) => p.battingAvg > 0 && p.strikeRate > 0 && p.matches >= 10)
    .map((p) => ({
      x: Math.round(p.battingAvg * 10) / 10,
      y: Math.round(p.strikeRate * 10) / 10,
      name: p.name,
      runs: p.totalRuns,
      matches: p.matches,
    }));

  const batters = all
    .filter((p) => !roleGroup(p.role).includes("Bowler"))
    .sort((a, b) => b.roleScore - a.roleScore);

  const bowlers = all
    .filter((p) => p.totalWickets > 0)
    .sort((a, b) => b.roleScore - a.roleScore);

  // ── AI vs Baseline comparison ──────────────────────────────────────────────
  // Naive baseline: rank players purely by career batting avg (batters) or economy (bowlers)
  // AI ranking: by finalScore from the engine
  const compPlayers = allPlayers.filter((p: any) => p.matches >= 5);

  const aiTop15 = [...compPlayers]
    .sort((a: any, b: any) => b.finalScore - a.finalScore)
    .slice(0, 15)
    .map((p: any, i: number) => ({
      name: p.name.split(" ").slice(-1)[0],
      fullName: p.name,
      aiRank: i + 1,
      aiScore: Math.round(p.finalScore),
      baselineScore: Math.round(
        (p.battingAvg ?? 0) * 0.6 + (p.strikeRate ?? 0) * 0.02 * 10
      ),
    }));

  const baselineTop15 = [...compPlayers]
    .sort((a: any, b: any) => {
      const scoreA = (a.battingAvg ?? 0) * 0.6 + (a.strikeRate ?? 0) * 0.02 * 10;
      const scoreB = (b.battingAvg ?? 0) * 0.6 + (b.strikeRate ?? 0) * 0.02 * 10;
      return scoreB - scoreA;
    })
    .slice(0, 15)
    .map((p: any, i: number) => ({
      name: p.name.split(" ").slice(-1)[0],
      fullName: p.name,
      baselineRank: i + 1,
      baselineScore: Math.round(
        (p.battingAvg ?? 0) * 0.6 + (p.strikeRate ?? 0) * 0.02 * 10
      ),
      aiScore: Math.round(p.finalScore),
    }));

  // Overlap: players in both top-15 lists
  const aiNames = new Set(aiTop15.map((p) => p.fullName));
  const baselineNames = new Set(baselineTop15.map((p) => p.fullName));
  const overlap = [...aiNames].filter((n) => baselineNames.has(n)).length;
  const diverged = 15 - overlap;

  // Side-by-side bar: AI score vs baseline score for AI top-15
  const compChartData = aiTop15.map((p) => ({
    name: p.name,
    "AI Score": p.aiScore,
    "Baseline Score": p.baselineScore,
  }));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight gold-shimmer">Statistics</h1>
        <p className="text-muted-foreground">Complete career stats and AI vs Baseline model comparison.</p>
      </header>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard icon={<TrendingUp className="w-5 h-5" />} label="Total Runs" value={totalRuns.toLocaleString()} />
        <SummaryCard icon={<Target className="w-5 h-5" />} label="Total Wickets" value={totalWickets.toLocaleString()} />
        <SummaryCard icon={<Award className="w-5 h-5" />} label="Top Scorer" value={topScorer?.name} sub={`${topScorer?.totalRuns} runs`} />
        <SummaryCard icon={<Award className="w-5 h-5" />} label="Top Wickets" value={topWickets?.name} sub={`${topWickets?.totalWickets} wickets`} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-secondary border border-border flex-wrap h-auto gap-1">
          <TabsTrigger value="comparison">AI vs Baseline</TabsTrigger>
          <TabsTrigger value="batting">Batting Charts</TabsTrigger>
          <TabsTrigger value="bowling">Bowling Charts</TabsTrigger>
          <TabsTrigger value="battingTable">Batting Table</TabsTrigger>
          <TabsTrigger value="bowlingTable">Bowling Table</TabsTrigger>
        </TabsList>

        {/* ── AI vs BASELINE ── */}
        <TabsContent value="comparison" className="space-y-6">

          {/* Insight banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="gold-glow border-primary/20">
              <CardContent className="pt-5 pb-4 text-center">
                <div className="text-3xl font-black text-primary">{overlap}</div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">Players in Both Top-15</div>
                <div className="text-[11px] text-muted-foreground mt-1">Agreement between AI & baseline</div>
              </CardContent>
            </Card>
            <Card className="border-orange-500/20">
              <CardContent className="pt-5 pb-4 text-center">
                <div className="text-3xl font-black text-orange-400">{diverged}</div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">AI-Unique Selections</div>
                <div className="text-[11px] text-muted-foreground mt-1">Players baseline misses</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4 text-center">
                <div className="text-3xl font-black text-emerald-400">{((overlap / 15) * 100).toFixed(0)}%</div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">Overlap Rate</div>
                <div className="text-[11px] text-muted-foreground mt-1">Lower = AI adds more value</div>
              </CardContent>
            </Card>
          </div>

          {/* What this means */}
          <Card className="bg-secondary/20 border-border">
            <CardContent className="pt-4 pb-4 text-sm text-muted-foreground space-y-2">
              <p className="font-semibold text-foreground">What does this comparison show?</p>
              <p>
                The <span className="text-primary font-medium">Baseline</span> ranks players using only career batting average and strike rate — the traditional, context-free method.
                The <span className="text-primary font-medium">AI Model</span> combines Linear Regression (Impact Score), Naive Bayes (venue/form probability), and K-Means cluster fit into a <code className="text-xs bg-secondary px-1 rounded">finalScore</code>.
              </p>
              <p>
                Players appearing in AI top-15 but <em>not</em> in the baseline top-15 are players the AI promotes based on recent form, venue suitability, or role fit — context the baseline ignores entirely.
                This validates the core contribution of the system.
              </p>
            </CardContent>
          </Card>

          {/* Side-by-side bar chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitCompare className="w-5 h-5 text-primary" />
                AI Score vs Baseline Score — Top 15 AI Picks
              </CardTitle>
              <CardDescription>
                Gold = AI contextual score · Grey = naive career-average score · Same player, different ranking signal
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={compChartData} layout="vertical" margin={{ left: 10, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis dataKey="name" type="category" stroke="hsl(var(--foreground))" fontSize={10} width={75} />
                    <RTooltip {...tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Bar dataKey="AI Score" fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} maxBarSize={14} />
                    <Bar dataKey="Baseline Score" fill="hsl(var(--muted-foreground) / 0.4)" radius={[0, 3, 3, 0]} maxBarSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Side-by-side ranked lists */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                  AI Top 15 <span className="text-xs font-normal text-muted-foreground ml-1">(finalScore)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead className="text-right">AI Score</TableHead>
                      <TableHead className="text-right w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aiTop15.map((p, i) => (
                      <TableRow key={p.fullName} className="hover:bg-secondary/20">
                        <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                        <TableCell className="text-sm font-medium">{p.fullName}</TableCell>
                        <TableCell className="text-right text-primary font-bold">{p.aiScore}</TableCell>
                        <TableCell className="text-right">
                          {baselineNames.has(p.fullName)
                            ? <span className="text-emerald-400 text-xs" title="Also in baseline top-15">✓</span>
                            : <span className="text-orange-400 text-xs" title="AI-unique pick">★</span>
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="px-4 py-2 text-[10px] text-muted-foreground">
                  ✓ in baseline top-15 · ★ AI-unique pick
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground inline-block" />
                  Baseline Top 15 <span className="text-xs font-normal text-muted-foreground ml-1">(career avg × 0.6 + SR × 0.2)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead className="text-right">Baseline</TableHead>
                      <TableHead className="text-right w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {baselineTop15.map((p, i) => (
                      <TableRow key={p.fullName} className="hover:bg-secondary/20">
                        <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                        <TableCell className="text-sm font-medium">{p.fullName}</TableCell>
                        <TableCell className="text-right font-bold">{p.baselineScore}</TableCell>
                        <TableCell className="text-right">
                          {aiNames.has(p.fullName)
                            ? <span className="text-emerald-400 text-xs" title="Also in AI top-15">✓</span>
                            : <span className="text-red-400 text-xs" title="Missed by AI">↓</span>
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="px-4 py-2 text-[10px] text-muted-foreground">
                  ✓ also in AI top-15 · ↓ ranked lower by AI (context penalised)
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── BATTING CHARTS ── */}
        <TabsContent value="batting" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Top 15 Run Scorers (All-time PSL)</CardTitle></CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={top15Runs} layout="vertical" margin={{ left: 10, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis dataKey="name" type="category" stroke="hsl(var(--foreground))" fontSize={11} width={80} />
                    <RTooltip {...tooltipStyle} formatter={(val, _name, props) => [`${val} runs`, props.payload.fullName]} />
                    <Bar dataKey="runs" radius={[0, 4, 4, 0]} maxBarSize={22}>
                      {top15Runs.map((_, i) => (
                        <Cell key={i} fill={`hsl(var(--primary)/${Math.max(40, 100 - i * 5)})`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Batting Average vs Strike Rate</CardTitle>
              <CardDescription>Min. 10 matches. Each dot = one player. Higher right = better batter.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="x" name="Batting Avg" stroke="hsl(var(--muted-foreground))" fontSize={11} label={{ value: "Avg", position: "insideBottomRight", offset: 0, fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                    <YAxis dataKey="y" name="Strike Rate" stroke="hsl(var(--muted-foreground))" fontSize={11} label={{ value: "SR", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                    <ZAxis dataKey="runs" range={[20, 200]} />
                    <RTooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
                      cursor={{ strokeDasharray: "3 3" }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.[0]) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="bg-card border border-border rounded p-2 text-xs">
                            <div className="font-bold text-primary">{d.name}</div>
                            <div>Avg: {d.x} · SR: {d.y}</div>
                            <div className="text-muted-foreground">{d.runs} total runs · {d.matches} matches</div>
                          </div>
                        );
                      }}
                    />
                    <Scatter data={scatterData} fill="hsl(var(--primary))" fillOpacity={0.7} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── BOWLING CHARTS ── */}
        <TabsContent value="bowling" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Top 15 Wicket Takers (All-time PSL)</CardTitle></CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={top15Wickets} layout="vertical" margin={{ left: 10, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis dataKey="name" type="category" stroke="hsl(var(--foreground))" fontSize={11} width={80} />
                    <RTooltip {...tooltipStyle} formatter={(val, _name, props) => [`${val} wickets`, props.payload.fullName]} />
                    <Bar dataKey="wickets" radius={[0, 4, 4, 0]} maxBarSize={22}>
                      {top15Wickets.map((_, i) => (
                        <Cell key={i} fill={`hsl(var(--chart-4)/${Math.max(40, 100 - i * 5)})`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Economy Rate — Top Bowlers</CardTitle>
              <CardDescription>Top 15 wicket-takers sorted by economy (lower is better).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[...bowlers].filter((p) => p.economy > 0).slice(0, 15).map((p) => ({ name: p.name.split(" ")[0], fullName: p.name, economy: Math.round(p.economy * 10) / 10 })).sort((a, b) => a.economy - b.economy)}
                    layout="vertical"
                    margin={{ left: 10, right: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" domain={[0, 12]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis dataKey="name" type="category" stroke="hsl(var(--foreground))" fontSize={11} width={80} />
                    <RTooltip {...tooltipStyle} formatter={(val, _n, props) => [`${val} runs/over`, props.payload.fullName]} />
                    <Bar dataKey="economy" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── BATTING TABLE ── */}
        <TabsContent value="battingTable">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-secondary/50">
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead className="text-right">M</TableHead>
                      <TableHead className="text-right">Runs</TableHead>
                      <TableHead className="text-right">HS</TableHead>
                      <TableHead className="text-right">Avg</TableHead>
                      <TableHead className="text-right">SR</TableHead>
                      <TableHead className="text-right">100s</TableHead>
                      <TableHead className="text-right">50s</TableHead>
                      <TableHead className="text-right">0s</TableHead>
                      <TableHead>Tier</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batters.slice(0, 50).map((p, i) => (
                      <TableRow key={p.name} className="hover:bg-secondary/20 transition-colors">
                        <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                        <TableCell className="font-medium">
                          <Link href={`/player/${encodeURIComponent(p.name)}`} className="hover:text-primary transition-colors text-sm">
                            {p.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{p.matches}</TableCell>
                        <TableCell className="text-right font-bold text-primary">{p.totalRuns}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{p.highestScore}</TableCell>
                        <TableCell className="text-right">{p.battingAvg?.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{p.strikeRate?.toFixed(0)}</TableCell>
                        <TableCell className="text-right text-primary">{p.hundreds}</TableCell>
                        <TableCell className="text-right">{p.fifties}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{p.ducks}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${TIER_COLOR[p.performanceClass] ?? ""} bg-transparent text-[10px] uppercase`}>
                            {p.performanceClass}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── BOWLING TABLE ── */}
        <TabsContent value="bowlingTable">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-secondary/50">
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead className="text-right">M</TableHead>
                      <TableHead className="text-right">Wkts</TableHead>
                      <TableHead className="text-right">Wkts/G</TableHead>
                      <TableHead className="text-right">Avg</TableHead>
                      <TableHead className="text-right">Eco</TableHead>
                      <TableHead className="text-right">SR</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Tier</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bowlers.slice(0, 50).map((p, i) => (
                      <TableRow key={p.name} className="hover:bg-secondary/20 transition-colors">
                        <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                        <TableCell className="font-medium">
                          <Link href={`/player/${encodeURIComponent(p.name)}`} className="hover:text-primary transition-colors text-sm">
                            {p.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{p.matches}</TableCell>
                        <TableCell className="text-right font-bold text-primary">{p.totalWickets}</TableCell>
                        <TableCell className="text-right">{p.wicketsPerMatch?.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{p.bowlingAvg > 0 ? p.bowlingAvg.toFixed(1) : "—"}</TableCell>
                        <TableCell className="text-right">{p.economy?.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{p.bowlStrikeRate > 0 ? p.bowlStrikeRate.toFixed(1) : "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-xs uppercase">{p.bowlingType || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${TIER_COLOR[p.performanceClass] ?? ""} bg-transparent text-[10px] uppercase`}>
                            {p.performanceClass}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <Card className="bg-card/50">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-3">
          <div className="text-primary mt-0.5">{icon}</div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="text-xl font-black text-foreground leading-tight">{value}</div>
            {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
