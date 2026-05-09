import { useFocus } from "@/hooks/useFocus";
import { Timer, X } from "lucide-react";
import { Button } from "./ui/button";

const fmt = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
};

export const FloatingFocus = () => {
  const { running, elapsed, stop } = useFocus();
  if (!running) return null;
  // ring fills over each 5-min pack interval
  const cycle = elapsed % 300;
  const pct = (cycle / 300) * 100;
  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-40 glass-strong px-4 py-3 flex items-center gap-3 neon-border animate-fade-in">
      <div className="relative h-10 w-10 grid place-items-center">
        <svg className="absolute inset-0" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="16" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
          <circle cx="18" cy="18" r="16" fill="none" stroke="hsl(var(--primary))" strokeWidth="3"
            strokeDasharray={`${pct} 100`} strokeLinecap="round" transform="rotate(-90 18 18)" pathLength={100} />
        </svg>
        <Timer className="h-4 w-4 text-primary" />
      </div>
      <div className="leading-tight">
        <div className="text-sm font-mono font-semibold tabular-nums">{fmt(elapsed)}</div>
        <div className="text-[11px] text-muted-foreground">Online · pack in {Math.max(1, 5 - Math.floor(cycle / 60))}m</div>
      </div>
      <Button variant="ghost" size="icon" onClick={() => stop(false)} aria-label="Stop focus"><X className="h-4 w-4" /></Button>
    </div>
  );
};
