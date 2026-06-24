import { useGetStatsSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, Database, CheckCircle2, GitBranch, Dna, ArrowRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function About() {
  const { data: stats, isLoading } = useGetStatsSummary();

  if (isLoading) {
    return <div className="space-y-6 p-8"><Skeleton className="h-12 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!stats) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <header className="space-y-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground gold-shimmer">Model Intelligence</h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Inside the probabilistic models and machine learning architecture powering the PSL AI platform.
        </p>
      </header>

      {/* Dataset + accuracy */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              Training Dataset
            </CardTitle>
            <CardDescription>Historical data underpinning the models</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-6">
            <Stat label="Total Players" value={stats.totalPlayers} />
            <Stat label="Total Matches" value={stats.totalMatches} />
            <Stat label="Data Records" value={stats.totalRecords} />
            <Stat label="Venues Covered" value={stats.venueCount} />
          </CardContent>
        </Card>

        <Card className="bg-card border-border gold-glow border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              Model Accuracy
            </CardTitle>
            <CardDescription>Validation metrics across algorithms</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Stat label="Regression R²" value={`${(stats.modelAccuracy.regressionR2 * 100).toFixed(1)}%`} />
            <Stat label="Classifier Acc" value={`${(stats.modelAccuracy.classifierAccuracy * 100).toFixed(1)}%`} />
            <Stat label="Cluster Silhouette" value={stats.modelAccuracy.clusterSilhouette.toFixed(2)} />
          </CardContent>
        </Card>
      </div>

      {/* Pipeline flow */}
      <Card className="bg-secondary/20 border-border">
        <CardHeader>
          <CardTitle className="text-base">End-to-End Pipeline</CardTitle>
          <CardDescription>How the 5 algorithms connect from raw data to recommended XI</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {[
              { label: "Raw PSL Data", color: "bg-secondary text-foreground" },
              { label: "Linear Regression → Impact Score", color: "bg-primary/20 text-primary border border-primary/30" },
              { label: "K-Means → Role Archetype", color: "bg-violet-500/20 text-violet-400 border border-violet-500/30" },
              { label: "Naive Bayes → P(Good | Context)", color: "bg-sky-500/20 text-sky-400 border border-sky-500/30" },
              { label: "Decision Tree → Performance Tier", color: "bg-orange-500/20 text-orange-400 border border-orange-500/30" },
              { label: "Genetic Algorithm → Best XI", color: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" },
            ].map((step, i, arr) => (
              <span key={i} className="flex items-center gap-2">
                <span className={`px-3 py-1.5 rounded-md text-xs font-semibold ${step.color}`}>{step.label}</span>
                {i < arr.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* K-Means cluster chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Performance Clusters (K-Means)
          </CardTitle>
          <CardDescription>How the AI categorizes player styles — feeds into role-matching</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.clusters} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={true} vertical={false} />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis dataKey="label" type="category" stroke="hsl(var(--foreground))" fontSize={12} width={120} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
                  itemStyle={{ color: "hsl(var(--primary))" }}
                  cursor={{ fill: "hsl(var(--secondary))" }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Algorithm cards — all 5 with explicit proposal mapping */}
      <div className="space-y-2">
        <h2 className="text-lg font-bold tracking-tight">Algorithm Breakdown</h2>
        <p className="text-sm text-muted-foreground">Each algorithm maps directly to a section in the project proposal (Section 4).</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-muted-foreground">

        <AlgoCard
          icon={<Brain className="w-4 h-4 text-primary" />}
          number="1"
          title="Linear Regression"
          tag="§4.1 — Produces: Impact Score"
          tagColor="text-primary bg-primary/10 border-primary/20"
          formula="ŷ = β₀ + β₁·avg + β₂·SR + β₃·form + β₄·venue"
          description="Gradient-descent regression trained on batting avg, strike rate, recent form, wickets/game, economy⁻¹, and boundary rate. Produces a continuous Impact Score per player. Implemented from scratch — no Scikit-learn."
          output="Output → impactScore (0–100)"
        />

        <AlgoCard
          icon={<Brain className="w-4 h-4 text-violet-400" />}
          number="2"
          title="K-Means Clustering"
          tag="§4.2 — Produces: Role Archetype"
          tagColor="text-violet-400 bg-violet-500/10 border-violet-500/20"
          formula="J = Σₖ Σ xᵢ∈Cₖ ‖xᵢ − μₖ‖²"
          description="Unsupervised clustering assigns every player to one of 4 archetypes — Aggressive Hitter, Anchor Batter, Powerplay Bowler, Allround Threat — purely from statistics. Cluster label is used to match players to required team roles. Elbow Method + Silhouette Score used to confirm k=4."
          output="Output → cluster label → RoleMatch score"
        />

        <AlgoCard
          icon={<Brain className="w-4 h-4 text-sky-400" />}
          number="3"
          title="Naive Bayes"
          tag="§4.3 — Produces: P(Good | Context)"
          tagColor="text-sky-400 bg-sky-500/10 border-sky-500/20"
          formula="P(Good | V, F, O) ∝ P(Good) × P(V|Good) × P(F|Good) × P(O|Good)"
          description="The core innovation. Rather than career averages, Naive Bayes estimates the probability of a good performance given the current venue, recent form, and opposition. Laplace smoothing handles unseen venue-player combinations. This is what makes the system context-aware."
          output="Output → bayesianScore (probability × 100)"
        />

        <AlgoCard
          icon={<GitBranch className="w-4 h-4 text-orange-400" />}
          number="4"
          title="Decision Tree — CART"
          tag="§4.1 — Produces: Performance Tier"
          tagColor="text-orange-400 bg-orange-500/10 border-orange-500/20"
          formula="Split on Gini impurity, max depth = 6"
          description="A CART decision tree classifies each player into a performance tier (Great / Good / Average / Poor) using Gini impurity as the splitting criterion. Training labels are derived from Linear Regression score percentiles — demonstrating model chaining. Displayed as the coloured tier badge on each player card."
          output="Output → performanceClass badge"
        />

        <AlgoCard
          icon={<Dna className="w-4 h-4 text-emerald-400" />}
          number="5"
          title="Genetic Algorithm"
          tag="§4.4 — Produces: Optimal XI"
          tagColor="text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
          formula="FinalScore(p) = w₁·Impact + w₂·P(Good|ctx) + w₃·RoleMatch"
          description="A population of 40 candidate XIs evolves over 80 generations. Tournament selection picks parents; single-point crossover recombines slot assignments; 15% mutation rate introduces diversity. Elitism preserves top 2 each generation. Enforces role constraints (min 5 batters, 3 bowlers, 1 WK) and venue-specific composition rules."
          output="Output → recommended 11-player team"
          wide
        />
      </div>

      {/* Score formula */}
      <Card className="bg-secondary/20 border-border">
        <CardHeader>
          <CardTitle className="text-base">Final Score Formula (§4.4)</CardTitle>
        </CardHeader>
        <CardContent className="font-mono text-sm text-foreground space-y-1">
          <p className="text-primary">With venue stats:    0.45 × Impact + 0.25 × Bayesian + 0.30 × VenueScore</p>
          <p className="text-muted-foreground">Without venue stats: 0.60 × Impact + 0.40 × Bayesian</p>
          <p className="mt-2 text-xs text-muted-foreground normal-case font-sans">
            Role Score (player explorer page) is computed separately — batters ranked on batting-only metrics, bowlers on bowling-only metrics — for fair cross-role comparison in the leaderboard.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function AlgoCard({
  icon, number, title, tag, tagColor, formula, description, output, wide,
}: {
  icon: React.ReactNode;
  number: string;
  title: string;
  tag: string;
  tagColor: string;
  formula: string;
  description: string;
  output: string;
  wide?: boolean;
}) {
  return (
    <div className={`space-y-3 p-5 bg-secondary/20 rounded-lg border border-border ${wide ? "sm:col-span-2" : ""}`}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <h3 className="text-foreground font-bold uppercase tracking-wider text-xs flex items-center gap-2">
          {icon}
          {number}. {title}
        </h3>
        <span className={`text-[10px] font-semibold border rounded-full px-2 py-0.5 ${tagColor}`}>
          {tag}
        </span>
      </div>
      <div className="font-mono text-[11px] text-primary bg-primary/5 border border-primary/10 rounded px-3 py-2">
        {formula}
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      <div className="text-[11px] font-semibold text-foreground/70 border-t border-border pt-2">
        {output}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="text-2xl font-black text-foreground">{value}</div>
    </div>
  );
}
