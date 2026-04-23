import { useEffect, useMemo, useState } from "react";
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

/**
 * Smooth rainbow gradient like the user's reference, blended with our theme rarities.
 * Uses many intermediate stops for buttery transitions.
 */
function buildSmoothGradient(segments: Segment[]) {
  const stops: string[] = [];
  // Soft rainbow base layer (matches reference) with theme accent hues
  const rainbow = [
    "hsl(217 91% 60%)",   // blue
    "hsl(280 80% 60%)",   // purple
    "hsl(310 95% 65%)",   // magenta
    "hsl(0 90% 60%)",     // red
    "hsl(38 95% 55%)",    // orange/amber
    "hsl(60 90% 55%)",    // yellow
    "hsl(140 70% 50%)",   // green
    "hsl(180 80% 50%)",   // cyan
    "hsl(217 91% 60%)",   // back to blue (closes loop)
  ];
  const step = 360 / (rainbow.length - 1);
  rainbow.forEach((c, i) => {
    stops.push(`${c} ${i * step}deg`);
  });
  return `conic-gradient(from 0deg, ${stops.join(", ")})`;
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
  const [spinning, setSpinning] = useState(false);
  const size = 320;
  const segments = useMemo(() => buildSegments(), []);
  const gradient = useMemo(() => buildSmoothGradient(segments), [segments]);

  useEffect(() => {
    const targetSegment = segments.find((s) => s.rarity === targetRarity) ?? segments[0];
    const landingAngle = pickLandingAngle(targetSegment);
    const finalRotation = 360 * (8 + Math.floor(secureRandom() * 4)) + (360 - landingAngle);
    requestAnimationFrame(() => {
      setSpinning(true);
      setRotation(finalRotation);
    });
    const t = window.setTimeout(onDone, 4500);
    return () => window.clearTimeout(t);
  }, [onDone, segments, targetRarity]);

  return (
    <div className="relative mx-auto" style={{ width: size, height: size + 24 }}>
      {/* Outer ambient glow */}
      <div className="absolute inset-[-24px] rounded-full bg-gradient-to-br from-primary/20 via-fuchsia-500/15 to-amber-400/20 blur-3xl opacity-70 animate-pulse pointer-events-none" />

      {/* Vertical pointer pole (matches reference) */}
      <div className="absolute left-1/2 -translate-x-1/2 -top-1 z-30 flex flex-col items-center pointer-events-none" style={{ height: size / 2 + 12 }}>
        <div className="w-[3px] flex-1 bg-gradient-to-b from-white/90 to-white/40 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
        <div className="h-3 w-3 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)]" />
      </div>

      {/* Wheel body */}
      <div
        className="relative rounded-full ring-[6px] ring-white/15 shadow-[0_25px_70px_-15px_hsl(var(--primary)/0.7)] overflow-hidden"
        style={{
          width: size,
          height: size,
          transform: `rotate(${rotation}deg)`,
          transition: spinning ? "transform 4.2s cubic-bezier(0.15, 0.7, 0.18, 1)" : "none",
          background: gradient,
          // Subtle radial fade to white-ish center for the soft look in reference
          backgroundImage: `radial-gradient(circle at center, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.05) 35%, transparent 60%), ${gradient}`,
        }}
      >
        {/* Inner darker ring for depth */}
        <div className="absolute inset-[6px] rounded-full ring-1 ring-white/10" />

        {/* Center SPIN drop (teardrop shape like reference) */}
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div
            className="relative grid place-items-center"
            style={{
              width: 96,
              height: 110,
              // Counter-rotate so SPIN stays upright
              transform: `rotate(${-rotation}deg)`,
              transition: spinning ? "transform 4.2s cubic-bezier(0.15, 0.7, 0.18, 1)" : "none",
            }}
          >
            <div
              className="absolute inset-0 bg-foreground/85 backdrop-blur-md ring-2 ring-white/20 shadow-2xl"
              style={{
                // Teardrop: round bottom, pointed top
                borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
                clipPath: "path('M 48 0 L 96 60 A 48 48 0 1 1 0 60 Z')",
              }}
            />
            <span className="relative text-background font-bold tracking-[0.3em] text-xs select-none">
              SPIN
            </span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
        {segments.map((segment) => (
          <div key={segment.rarity} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full ring-1 ring-white/30"
              style={{ backgroundColor: segment.color, boxShadow: `0 0 10px ${segment.color}` }}
            />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{segment.label}</span>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground mt-2">Wherever the wheel lands is your reward.</p>
    </div>
  );
};
