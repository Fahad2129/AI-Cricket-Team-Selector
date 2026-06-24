import { useState } from "react";
import { useGetTopPerformers, useGetVenues } from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

export default function Leaderboard() {
  const [venue, setVenue] = useState<string>("All");
  const { data: venuesData } = useGetVenues();
  
  const queryParams = venue !== "All" ? { venue } : undefined;
  const { data: tops, isLoading } = useGetTopPerformers(queryParams);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground gold-shimmer">Top Performers</h1>
          <p className="text-muted-foreground">Ranked by AI impact score across all historical data.</p>
        </div>
        <div className="w-full sm:w-64">
          <Select value={venue} onValueChange={setVenue}>
            <SelectTrigger className="bg-card">
              <SelectValue placeholder="All Venues" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Venues</SelectItem>
              {venuesData?.venues?.map((v) => (
                <SelectItem key={v.name} value={v.name}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      )}

      {tops && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <TopList title="Top Batsmen" items={tops.batsmen} />
          <TopList title="Top Fast Bowlers" items={tops.fastBowlers} />
          <TopList title="Top Spinners" items={tops.spinBowlers} />
          <TopList title="Top All-Rounders" items={tops.allRounders} />
          <TopList title="Top Wicketkeepers" items={tops.wicketkeepers} />
        </div>
      )}
    </div>
  );
}

function TopList({ title, items }: { title: string, items: any[] }) {
  if (!items || items.length === 0) return null;

  return (
    <Card className="bg-card/50 border-border">
      <CardHeader className="pb-3 border-b border-border/50 bg-secondary/20">
        <CardTitle className="text-lg font-medium uppercase tracking-wider text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border/50">
          {items.slice(0, 5).map((player, index) => (
            <li key={player.name} className="flex items-center gap-4 p-4 hover:bg-secondary/30 transition-colors">
              <div className="flex-shrink-0 w-6 text-center font-black text-muted-foreground">
                {index + 1}
              </div>
              <Avatar className="h-10 w-10 border border-border">
                <AvatarFallback className="bg-background text-primary font-bold text-xs">
                  {player.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <Link href={`/player/${encodeURIComponent(player.name)}`} className="text-sm font-bold truncate hover:text-primary transition-colors block">
                  {player.name}
                </Link>
                <p className="text-xs text-muted-foreground truncate">{player.clusterLabel || player.role}</p>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-primary">{player.finalScore.toFixed(1)}</div>
                <div className="text-[10px] uppercase text-muted-foreground">Score</div>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
