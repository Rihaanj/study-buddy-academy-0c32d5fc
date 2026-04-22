import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { secureRandom } from "@/lib/random";

type Rarity = "common" | "rare" | "epic" | "legendary" | "mythic";

type Segment = {
  rarity: Rarity;
  weight: number;
  color: string;
  label: string;
  start: number;
  end: number;
};

const SEGMENT_BASE: Array<Omit<Segment, "start" | "end">> = [
  { rarity: "common", weight: 0.5, color: "hsl(215 15% 55%)", label: "Common" },
  { rarity: "rare", weight: 0.3, color: "hsl(217 91% 60%)", label: "Rare" },
  { rarity: "epic", weight: 0.13, color: "hsl(280 80% 60%)", label: "Epic" },
  { rarity: "legendary", weight: 0.05, color: "hsl(38 95% 55%)", label: "Legendary" },
  { rarity: "mythic", weight: 0.02, color: "hsl(310 95% 65%)", label: "Mythic" },
];

function buildSegments(): Segment[] {
  let start = 0;
  return SEGMENT_BASE.map((segment) => {
    const end = start + segment.weight * 360;
    const out = { ...segment, start, end };
    start = end;
    return out;
  });
}

function buildGradient(segments: Segment[]) {
  const stops: string[] = [];
  for (const segment of segments) {
    stops.push(`${segment.color} ${segment.start}deg ${segment.end}deg`);
  }
  return `conic-gradient(${stops.join(", ")})`;
}

function pickLandingAngle(target: Segment) {
  const padding = Math.min(4, Math.max(1, (target.end - target.start) / 6));
  const min = target.start + padding;
  const max = target.end - padding;
  return min + secureRandom() * Math.max(0.5, max - min);
}

interface Props {
  targetRarity: Rarity;
  onDone: () => void;
}

export const PackWheel = ({ targetRarity, onDone }: Props) => {
  const [rotation, setRotation] = useState(0);
  const size = 300;
  const segments = useMemo(() => buildSegments(), []);
  const gradient = useMemo(() => buildGradient(segments), [segments]);

  useEffect(() => {
    const targetSegment = segments.find((segment) => segment.rarity === targetRarity) ?? segments[0];
    const landingAngle = pickLandingAngle(targetSegment);
    const finalRotation = 360 * (8 + Math.floor(secureRandom() * 4)) + (360 - landingAngle);
    requestAnimationFrame(() => setRotation(finalRotation));
    const t = window.setTimeout(onDone, 4500);
    return () => window.clearTimeout(t);
  }, [onDone, segments, targetRarity]);

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      {/* Outer glow ring */}
      <div className="absolute inset-[-12px] rounded-full bg-gradient-to-br from-primary/30 via-accent/20 to-fuchsia-500/30 blur-2xl opacity-70 animate-pulse" />

      {/* Pointer */}
      <div className="absolute left-1/2 -translate-x-1/2 -top-3 z-20">
        <div className="relative">
          <div className="w-0 h-0 border-l-[14px] border-r-[14px] border-t-[24px] border-l-transparent border-r-transparent border-t-foreground drop-shadow-[0_0_12px_hsl(var(--primary))]" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-foreground shadow-[0_0_8px_hsl(var(--primary))]" />
        </div>
      </div>

      {/* Wheel body */}
      <div
        className="relative w-full h-full rounded-full ring-[6px] ring-white/15 shadow-[0_20px_60px_-15px_hsl(var(--primary)/0.6)] overflow-hidden"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: "transform 4.2s cubic-bezier(0.15, 0.7, 0.18, 1)",
          background: gradient,
        }}
      >
        {/* Tick marks at segment boundaries */}
        {segments.map((s) => (
          <div
            key={`tick-${s.rarity}`}
            className="absolute left-1/2 top-1/2 origin-bottom"
            style={{
              width: 2,
              height: "50%",
              transform: `translateX(-50%) translateY(-100%) rotate(${s.end}deg)`,
              background: "rgba(255,255,255,0.25)",
            }}
          />
        ))}

        {/* Inner ring */}
        <div className="absolute inset-[24px] rounded-full ring-1 ring-white/15 bg-background/30 backdrop-blur-[1px]" />

        {/* Center hub */}
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="h-24 w-24 rounded-full grid place-items-center ring-2 ring-background bg-gradient-to-br from-background/95 to-background/70 shadow-2xl">
            <Sparkles className="h-9 w-9 text-foreground/80 drop-shadow-lg animate-pulse" />
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
        {segments.map((segment) => (
          <div key={segment.rarity} className="flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded-full ring-1 ring-white/30"
              style={{ backgroundColor: segment.color, boxShadow: `0 0 12px ${segment.color}` }}
            />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{segment.label}</span>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground mt-2">Wherever the wheel lands is what you'll get.</p>
    </div>
  );
};
