import { useEffect, useMemo, useRef, useState } from "react";
import { secureRandom } from "@/lib/random";

type Rarity = "common" | "rare" | "epic" | "legendary" | "mythic";

type Segment = {
  rarity: Rarity;
  color: string;
  label: string;
  start: number; // degrees
  end: number;   // degrees
};

/**
 * 5 evenly-spaced rarity segments (72° each) so visually balanced.
 * The pre-determined target rarity decides where the wheel lands.
 */
const SEGMENT_COLORS: Array<{ rarity: Rarity; color: string; label: string }> = [
  { rarity: "common",    color: "hsl(215 18% 60%)",  label: "Common" },
  { rarity: "rare",      color: "hsl(220 100% 60%)", label: "Rare" },
  { rarity: "epic",      color: "hsl(280 85% 62%)",  label: "Epic" },
  { rarity: "legendary", color: "hsl(38 95% 58%)",   label: "Legendary" },
  { rarity: "mythic",    color: "hsl(310 95% 65%)",  label: "Mythic" },
];

function buildSegments(): Segment[] {
  const slice = 360 / SEGMENT_COLORS.length;
  return SEGMENT_COLORS.map((seg, i) => ({
    ...seg,
    start: i * slice,
    end: (i + 1) * slice,
  }));
}

/** Build a hard-stop conic gradient so each rarity is its own clean wedge. */
function buildSegmentGradient(segments: Segment[]) {
  const stops = segments.map((s) => `${s.color} ${s.start}deg ${s.end}deg`).join(", ");
  return `conic-gradient(from 0deg, ${stops})`;
}

/** Pick a deterministic landing angle inside a target wedge (with safe padding). */
function pickLandingAngle(target: Segment) {
  const padding = 8; // degrees of padding from wedge edges so the pointer is clearly inside
  const min = target.start + padding;
  const max = target.end - padding;
  return min + secureRandom() * (max - min);
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
  const gradient = useMemo(() => buildSegmentGradient(segments), [segments]);
  const finishedRef = useRef(false);

  useEffect(() => {
    const targetSegment = segments.find((s) => s.rarity === targetRarity) ?? segments[0];
    // Center of target wedge -> pointer at top (0°) means the wheel rotates so that wedge midpoint sits at 0deg.
    const landingMid = pickLandingAngle(targetSegment);
    // Pointer is at top (0deg). Conic gradient starts at top going clockwise. To land target wedge under pointer,
    // we rotate the wheel by (360 - landingMid) plus extra full turns for drama.
    const fullSpins = 360 * (8 + Math.floor(secureRandom() * 3));
    const finalRotation = fullSpins + (360 - landingMid);
    requestAnimationFrame(() => {
      setSpinning(true);
      setRotation(finalRotation);
    });
    const t = window.setTimeout(() => {
      if (!finishedRef.current) {
        finishedRef.current = true;
        onDone();
      }
    }, 4600);
    return () => window.clearTimeout(t);
  }, [onDone, segments, targetRarity]);

  return (
    <div className="relative mx-auto" style={{ width: size, height: size + 24 }}>
      {/* Outer ambient glow */}
      <div className="absolute inset-[-24px] rounded-full bg-gradient-to-br from-primary/25 via-fuchsia-500/15 to-amber-400/20 blur-3xl opacity-70 animate-pulse pointer-events-none" />

      {/* Vertical pointer pole at top */}
      <div className="absolute left-1/2 -translate-x-1/2 -top-1 z-30 flex flex-col items-center pointer-events-none" style={{ height: size / 2 + 14 }}>
        <div className="w-[3px] flex-1 bg-gradient-to-b from-white/95 to-white/40 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.7)]" />
        <div className="h-3.5 w-3.5 rounded-full bg-white shadow-[0_0_14px_rgba(255,255,255,0.95)]" />
      </div>

      {/* Wheel body */}
      <div
        className="relative rounded-full ring-[6px] ring-white/15 shadow-[0_25px_70px_-15px_hsl(var(--primary)/0.7)] overflow-hidden"
        style={{
          width: size,
          height: size,
          transform: `rotate(${rotation}deg)`,
          transition: spinning ? "transform 4.4s cubic-bezier(0.15, 0.7, 0.18, 1)" : "none",
          background: gradient,
        }}
      >
        {/* Spoke separators between wedges */}
        {segments.map((s) => (
          <div
            key={`spoke-${s.rarity}`}
            className="absolute left-1/2 top-1/2 h-1/2 w-px bg-white/30 origin-top"
            style={{ transform: `translate(-0.5px, 0) rotate(${s.start}deg)` }}
          />
        ))}

        {/* Inner ring for depth */}
        <div className="absolute inset-[6px] rounded-full ring-1 ring-white/15 pointer-events-none" />

        {/* Rarity labels — placed on each wedge, counter-rotated to stay readable */}
        {segments.map((s) => {
          const mid = (s.start + s.end) / 2;
          return (
            <div
              key={`label-${s.rarity}`}
              className="absolute left-1/2 top-1/2 pointer-events-none"
              style={{
                transform: `rotate(${mid}deg) translateY(-${size / 2 - 38}px) rotate(-${mid}deg) rotate(-${rotation}deg)`,
                transition: spinning ? "transform 4.4s cubic-bezier(0.15, 0.7, 0.18, 1)" : "none",
              }}
            >
              <span
                className="text-[10px] uppercase tracking-[0.18em] font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
                style={{ color: "white" }}
              >
                {s.label}
              </span>
            </div>
          );
        })}

        {/* Center hub — counter-rotates so SPIN stays upright */}
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div
            className="relative grid place-items-center"
            style={{
              width: 96,
              height: 96,
              transform: `rotate(${-rotation}deg)`,
              transition: spinning ? "transform 4.4s cubic-bezier(0.15, 0.7, 0.18, 1)" : "none",
            }}
          >
            <div className="absolute inset-0 rounded-full bg-background/85 backdrop-blur-md ring-2 ring-white/25 shadow-2xl" />
            <span className="relative text-foreground font-bold tracking-[0.3em] text-xs select-none">
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
      <p className="text-center text-xs text-muted-foreground mt-2">The wheel knows its destiny. Watch it land. ✨</p>
    </div>
  );
};
