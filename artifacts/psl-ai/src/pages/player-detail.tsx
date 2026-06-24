import { useRoute } from "wouter";
import { useGetPlayerDetail, getGetPlayerDetailQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreBar } from "@/components/score-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ChevronLeft } from "lucide-react";
import { Link } from "wouter";

export default function PlayerDetail() {
  const [, params] = useRoute("/player/:name");
  const name = params?.name ? decodeURIComponent(params.name) : "";

  const { data: player, isLoading, error } = useGetPlayerDetail(name, { 
    query: { 
      enabled: !!name,
      queryKey: getGetPlayerDetailQueryKey(name)
    } 
  });

  if (isLoading) return <div className="space-y-4 p-8"><Skeleton className="h-12 w-64" /><Skeleton className="h-64 w-full" /></div>;
  if (error || !player) return <div className="p-8 text-destructive">Error loading player details.</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/players" className="text-muted-foreground hover:text-foreground transition-colors p-2 -ml-2 rounded-full hover:bg-secondary">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-4xl font-bold tracking-tight">{player.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <Badge variant="outline" className="text-primary border-primary/30 uppercase tracking-wider">{player.role}</Badge>
            {player.clusterLabel && <span className="text-sm text-muted-foreground">{player.clusterLabel}</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="gold-glow border-primary/20 md:col-span-1">
          <CardHeader>
            <CardTitle>AI Evaluation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center py-4 border-b border-border">
              <div className="text-5xl font-black text-primary mb-1">{player.finalScore.toFixed(1)}</div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Final Score</div>
            </div>
            <div className="space-y-4">
              <ScoreBar score={player.impactScore} label="Impact Score" />
              {player.bayesianScore !== undefined && (
                <ScoreBar score={player.bayesianScore} label="Bayesian Prior" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Career Stats</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <StatBox label="Matches" value={player.matches} />
            <StatBox label="Batting Avg" value={player.battingAvg} />
            <StatBox label="Strike Rate" value={player.strikeRate} />
            <StatBox label="Wickets/Match" value={player.wicketsPerMatch} />
            <StatBox label="Economy" value={player.economy} />
            <StatBox label="Recent Form" value={player.recentForm} />
          </CardContent>
        </Card>
      </div>

      {player.matchHistory && player.matchHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Match Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={player.matchHistory.slice(0, 10).reverse()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(t) => t.substring(0,5)} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                    itemStyle={{ color: 'hsl(var(--primary))' }}
                  />
                  <Bar dataKey="runs" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  {player.role.includes("Bowler") || player.role.includes("All-Rounder") ? (
                    <Bar dataKey="wickets" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  ) : null}
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Opposition</TableHead>
                    <TableHead className="text-right">Runs</TableHead>
                    <TableHead className="text-right">SR</TableHead>
                    <TableHead className="text-right">Wickets</TableHead>
                    <TableHead className="text-right">Econ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {player.matchHistory.slice(0, 10).map((match, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground text-xs">{match.date}</TableCell>
                      <TableCell>{match.venue}</TableCell>
                      <TableCell>{match.opposition}</TableCell>
                      <TableCell className="text-right font-medium">{match.runs ?? '-'}</TableCell>
                      <TableCell className="text-right">{match.strikeRate ? match.strikeRate.toFixed(1) : '-'}</TableCell>
                      <TableCell className="text-right font-medium text-primary">{match.wickets ?? '-'}</TableCell>
                      <TableCell className="text-right">{match.economy ? match.economy.toFixed(2) : '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string, value?: number }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="text-2xl font-bold text-foreground">
        {value !== undefined && value !== null ? (Number.isInteger(value) ? value : value.toFixed(2)) : '-'}
      </div>
    </div>
  );
}
