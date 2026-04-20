import { useState } from "react";
import { useFocus } from "@/hooks/useFocus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

export default function Focus() {
  const { running, remaining, duration, integrity, start, stop } = useFocus();
  const [custom, setCustom] = useState(45);
  const pct = duration ? (1 - remaining / duration) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Focus</h1>
        <p className="text-muted-foreground text-sm">Floats across the app. Stay on tab to keep your XP bonus — no blocking, ever.</p>
      </div>

      <div className="glass-strong p-8 grid place-items-center text-center">
        <div className="relative h-56 w-56">
          <svg viewBox="0 0 36 36" className="absolute inset-0">
            <circle cx="18" cy="18" r="16" fill="none" stroke="hsl(var(--muted))" strokeWidth="2"/>
            <circle cx="18" cy="18" r="16" fill="none" stroke="url(#g)" strokeWidth="2.5" strokeDasharray={`${pct} 100`} strokeLinecap="round" transform="rotate(-90 18 18)" pathLength={100}/>
            <defs>
              <linearGradient id="g" x1="0" x2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))"/>
                <stop offset="100%" stopColor="hsl(var(--secondary))"/>
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div>
              <div className="text-5xl font-mono font-bold gradient-text">{fmt(running ? remaining : custom*60)}</div>
              <div className="text-xs text-muted-foreground mt-2">{running ? `Integrity ${integrity}%` : "Pick a duration"}</div>
            </div>
          </div>
        </div>

        {!running ? (
          <>
            <div className="flex gap-2 mt-6">
              {[25, 50, 90].map((m) => (
                <Button key={m} variant="outline" onClick={()=>start(m)}>{m}m</Button>
              ))}
            </div>
            <div className="mt-6 flex items-end gap-2">
              <div>
                <Label className="text-xs">Custom (minutes)</Label>
                <Input type="number" min={1} max={240} value={custom} onChange={(e)=>setCustom(Number(e.target.value)||25)} className="w-24"/>
              </div>
              <Button onClick={()=>start(custom)} className="bg-gradient-primary text-primary-foreground shadow-glow">Start focus</Button>
            </div>
          </>
        ) : (
          <Button variant="destructive" className="mt-6" onClick={()=>stop(false)}>Stop session</Button>
        )}
      </div>

      <div className="glass p-5 text-sm text-muted-foreground">
        <strong className="text-foreground">XP:</strong> minutes × 2. <strong className="text-foreground">Bonus:</strong> +50% if integrity ≥ 90%. Switching tabs lowers integrity but never blocks you.
      </div>
    </div>
  );
}
