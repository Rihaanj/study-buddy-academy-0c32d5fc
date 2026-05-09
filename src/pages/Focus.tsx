import { useFocus } from "@/hooks/useFocus";
import { Button } from "@/components/ui/button";
import { Timer, Gift, Flame, Play, Square } from "lucide-react";

const fmt = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
};

export default function Focus() {
  const { running, elapsed, start, stop } = useFocus();
  const cycle = elapsed % 300;
  const pct = (cycle / 300) * 100;
  const minsToPack = Math.max(1, 5 - Math.floor(cycle / 60));
  const totalMin = Math.floor(elapsed / 60);
  const packsEarned = Math.floor(elapsed / 300);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Focus</h1>
        <p className="text-muted-foreground text-sm">A live count of how long you've been on Study Bud. Earn a free pack every 5 minutes.</p>
      </div>

      <div className="glass-strong p-8 grid place-items-center text-center relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -top-24 -left-16 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-accent/25 blur-3xl" />
        <div className="relative h-64 w-64">
          <svg viewBox="0 0 36 36" className="absolute inset-0">
            <circle cx="18" cy="18" r="16" fill="none" stroke="hsl(var(--muted))" strokeWidth="2"/>
            <circle cx="18" cy="18" r="16" fill="none" stroke="url(#focusg)" strokeWidth="2.5" strokeDasharray={`${pct} 100`} strokeLinecap="round" transform="rotate(-90 18 18)" pathLength={100}/>
            <defs>
              <linearGradient id="focusg" x1="0" x2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))"/>
                <stop offset="100%" stopColor="hsl(var(--accent))"/>
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div>
              <div className="text-5xl font-mono font-bold gradient-text tabular-nums">{fmt(elapsed)}</div>
              <div className="text-xs text-muted-foreground mt-2">{running ? `Next pack in ${minsToPack}m` : "Paused"}</div>
            </div>
          </div>
        </div>

        <div className="relative mt-6 flex items-center gap-3">
          {!running ? (
            <Button onClick={() => start()} className="bg-gradient-primary text-primary-foreground shadow-glow"><Play className="h-4 w-4 mr-1.5" />Start</Button>
          ) : (
            <Button variant="destructive" onClick={() => stop(false)}><Square className="h-4 w-4 mr-1.5" />Stop & collect XP</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="glass p-4 text-center">
          <Timer className="h-4 w-4 mx-auto text-primary" />
          <div className="text-2xl font-bold mt-1">{totalMin}m</div>
          <div className="text-[11px] text-muted-foreground uppercase">Online</div>
        </div>
        <div className="glass p-4 text-center">
          <Gift className="h-4 w-4 mx-auto text-accent" />
          <div className="text-2xl font-bold mt-1">{packsEarned}</div>
          <div className="text-[11px] text-muted-foreground uppercase">Packs earned</div>
        </div>
        <div className="glass p-4 text-center">
          <Flame className="h-4 w-4 mx-auto text-orange-400" />
          <div className="text-2xl font-bold mt-1">{totalMin * 2}</div>
          <div className="text-[11px] text-muted-foreground uppercase">XP pending</div>
        </div>
      </div>
    </div>
  );
}
