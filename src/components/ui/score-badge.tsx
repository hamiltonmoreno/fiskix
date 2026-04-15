import { cn } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number;
  showScore?: boolean;
  className?: string;
}

export function ScoreBadge({ score, showScore = false, className }: ScoreBadgeProps) {
  const isCritico = score >= 75;
  const isMedio   = score >= 50 && score < 75;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase",
        isCritico && "bg-[#ffdad6] text-[#ba1a1a]",
        isMedio   && "bg-amber-100 text-amber-700",
        !isCritico && !isMedio && "bg-emerald-100 text-emerald-700",
        className
      )}
    >
      {showScore && <span className="tabular-nums">{score}</span>}
      {isCritico ? "CRÍTICO" : isMedio ? "MÉDIO" : "BAIXO"}
    </span>
  );
}
