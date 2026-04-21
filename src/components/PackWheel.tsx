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
  const size = 280;
  const segments = useMemo(() => buildSegments(), []);
  const gradient = useMemo(() => buildGradient(segments), [segments]);

  useEffect(() => {
    const targetSegment = segments.find((segment) => segment.rarity === targetRarity) ?? segments[0];
    const landingAngle = pickLandingAngle(targetSegment);
    const finalRotation = 360 * (8 + Math.floor(secureRandom() * 4)) + (360 - landingAngle);
    requestAnimationFrame(() => setRotation(finalRotation));
    const t = window.setTimeout(onDone, 4200);
    return () => window.clearTimeout(t);
  }, [onDone, segments, targetRarity]);

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <div className="absolute left-1/2 -translate-x-1/2 -top-2 z-10">
        <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-primary drop-shadow-[0_0_8px_hsl(var(--primary))]" />
      </div>

      <div
        className="w-full h-full rounded-full ring-4 ring-white/10 shadow-glow overflow-hidden relative"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: "transform 4s cubic-bezier(0.17, 0.67, 0.21, 0.99)",
          background: gradient,
        }}
      >
        <div className="absolute inset-[18px] rounded-full ring-1 ring-white/10 bg-background/20 backdrop-blur-[1px]" />
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="h-20 w-20 rounded-full grid place-items-center ring-2 ring-background bg-background/90 shadow-xl">
            <Sparkles className="h-8 w-8 text-foreground/80 drop-shadow-lg animate-pulse" />
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
        {segments.map((segment) => (
          <div key={segment.rarity} className="flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded-full ring-1 ring-white/20"
              style={{ backgroundColor: segment.color, boxShadow: `0 0 10px ${segment.color}` }}
            />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{segment.label}</span>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground mt-3">Wheel result matches the reward rarity.</p>
    </div>
  );
};
