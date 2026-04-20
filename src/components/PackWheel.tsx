import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

type Rarity = "common" | "rare" | "epic" | "legendary" | "mythic";

const RARITY_META: Record<Rarity, { label: string; color: string; weight: number }> = {
  common:    { label: "Common",    color: "hsl(215 15% 55%)",  weight: 50 },
  rare:      { label: "Rare",      color: "hsl(217 91% 60%)",  weight: 28 },
  epic:      { label: "Epic",      color: "hsl(280 80% 60%)",  weight: 15 },
  legendary: { label: "Legendary", color: "hsl(38 95% 55%)",   weight: 5 },
  mythic:    { label: "Mythic",    color: "hsl(310 95% 65%)",  weight: 2 },
};

// Build a randomized 20-slice ring with rarity distribution by weight
const buildSegments = (seed: number) => {
  const segs: { rarity: Rarity }[] = [];
  (Object.keys(RARITY_META) as Rarity[]).forEach((r) => {
    const n = Math.max(1, Math.round(RARITY_META[r].weight / 5));
    for (let i = 0; i < n; i++) segs.push({ rarity: r });
  });
  // Fisher-Yates with deterministic-ish seed so wheel reshuffles each spin
  let s = seed;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = segs.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [segs[i], segs[j]] = [segs[j], segs[i]];
  }
  return segs;
};

interface Props {
  /** The rarity that has already been determined (server-decided pack rarity). */
  targetRarity: Rarity;
  /** Called when the spin animation completes. */
  onDone: () => void;
}

export const PackWheel = ({ targetRarity, onDone }: Props) => {
  const [rotation, setRotation] = useState(0);
  const wheelRef = useRef<HTMLDivElement>(null);
  // Reshuffle slice positions each mount
  const segments = useMemo(() => buildSegments(Math.floor(Math.random() * 1_000_000) + 1), []);
  const sliceAngle = 360 / segments.length;
  const SIZE = 280;

  useEffect(() => {
    const matching = segments.map((s, i) => ({ s, i })).filter(({ s }) => s.rarity === targetRarity);
    const pick = matching[Math.floor(Math.random() * matching.length)];
    const targetAngle = pick.i * sliceAngle + sliceAngle / 2;
    const finalRotation = 360 * 6 + (360 - targetAngle);
    requestAnimationFrame(() => setRotation(finalRotation));
    const t = window.setTimeout(onDone, 4200);
    return () => window.clearTimeout(t);
  }, [targetRarity, segments, sliceAngle, onDone]);

  return (
    <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
      {/* Pointer */}
      <div className="absolute left-1/2 -translate-x-1/2 -top-2 z-10">
        <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-primary drop-shadow-[0_0_8px_hsl(var(--primary))]" />
      </div>
      <div
        ref={wheelRef}
        className="w-full h-full rounded-full ring-4 ring-white/10 shadow-glow overflow-hidden relative"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: "transform 4s cubic-bezier(0.17, 0.67, 0.21, 0.99)",
          background: `conic-gradient(${segments
            .map((s, i) => {
              const start = (i * 100) / segments.length;
              const end = ((i + 1) * 100) / segments.length;
              return `${RARITY_META[s.rarity].color} ${start}% ${end}%`;
            })
            .join(",")})`,
        }}
      >
        {/* Center cap */}
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="h-16 w-16 rounded-full bg-gradient-primary grid place-items-center shadow-glow ring-2 ring-background">
            <Sparkles className="h-7 w-7 text-primary-foreground" />
          </div>
        </div>
      </div>

      {/* Color-only legend */}
      <div className="mt-4 grid grid-cols-5 gap-1 text-center">
        {(Object.keys(RARITY_META) as Rarity[]).map((r) => (
          <div key={r} className="flex flex-col items-center gap-1">
            <span
              className="h-3 w-3 rounded-full ring-1 ring-white/20"
              style={{ backgroundColor: RARITY_META[r].color, boxShadow: `0 0 10px ${RARITY_META[r].color}` }}
            />
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{RARITY_META[r].label}</span>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground mt-2">Spinning the rarity wheel...</p>
    </div>
  );
};
