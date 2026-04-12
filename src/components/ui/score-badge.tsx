import { cn } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number;
  showScore?: boolean;
  className?: string;
}

export function ScoreBadge({ score, showScore = false, className }: ScoreBadgeProps) {
  const isCritico = score >= 75;
  const isMedio = score >= 50 && score < 75;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold",
        isCritico && "bg-red-100 text-red-700",
        isMedio && "bg-amber-100 text-amber-700",
        !isCritico && !isMedio && "bg-green-100 text-green-700",
        className
      )}
    >
      {showScore && <span className="font-bold">{score}</span>}
      {isCritico ? "CRÍTICO" : isMedio ? "MÉDIO" : "BAIXO"}
    </span>
  );
}
