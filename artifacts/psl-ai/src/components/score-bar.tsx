import { Progress } from "@/components/ui/progress";

export function ScoreBar({ score, label, className }: { score: number; label?: string; className?: string }) {
  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <div className="flex justify-between text-xs uppercase tracking-wider">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium text-foreground">{score.toFixed(1)}</span>
        </div>
      )}
      <Progress value={score} className="h-1.5 [&>div]:bg-primary bg-secondary" />
    </div>
  );
}
