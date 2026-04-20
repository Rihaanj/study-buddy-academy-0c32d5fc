import { xpProgress } from "@/lib/gamification";

type Props = { xp: number; compact?: boolean };

export function XpBar({ xp, compact }: Props) {
  const p = xpProgress(xp);
  return (
    <div className={compact ? "min-w-[140px]" : "w-full"}>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
        <span>Lv {p.level}</span>
        <span>{p.into}/{p.needed} XP</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full bg-gradient-primary transition-all duration-500"
          style={{ width: `${p.pct}%` }}
          aria-label={`${p.toNext} XP to level ${p.level + 1}`}
        />
      </div>
    </div>
  );
}
