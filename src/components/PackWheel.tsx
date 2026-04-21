import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

type Rarity = "common" | "rare" | "epic" | "legendary" | "mythic";

const RARITY_COLOR: Record<Rarity, string> = {
  common:    "hsl(215 15% 55%)",
  rare:      "hsl(217 91% 60%)",
  epic:      "hsl(280 80% 60%)",
  legendary: "hsl(38 95% 55%)",
  mythic:    "hsl(310 95% 65%)",
};

const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  mythic: "Mythic",
};

interface Props {
  /** Pre-determined rarity (revealed after spin completes). Kept for API compatibility but
   * intentionally NOT shown anywhere on the wheel — players were complaining the center
   * color was leaking the result. */
  targetRarity: Rarity;
  /** Called when the spin animation completes. */
  onDone: () => void;
}

/**
 * Continuous color-flow wheel — no fixed sections. Spins fast then decelerates,
 * lands on a random angle, then calls onDone so the parent can reveal the card.
 * Center cap is neutral so the rarity is genuinely a surprise.
 */
export const PackWheel = ({ targetRarity: _targetRarity, onDone }: Props) => {
  const [rotation, setRotation] = useState(0);
  const SIZE = 280;

  useEffect(() => {
    // Random landing angle so each spin feels different
    const finalRotation = 360 * (8 + Math.random() * 4) + Math.random() * 360;
    requestAnimationFrame(() => setRotation(finalRotation));
    const t = window.setTimeout(onDone, 4200);
    return () => window.clearTimeout(t);
  }, [onDone]);

  return (
    <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
      {/* Pointer */}
      <div className="absolute left-1/2 -translate-x-1/2 -top-2 z-10">
        <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-primary drop-shadow-[0_0_8px_hsl(var(--primary))]" />
      </div>

      {/* Continuous flowing color wheel — all rarities blend into one ring */}
      <div
        className="w-full h-full rounded-full ring-4 ring-white/10 shadow-glow overflow-hidden relative"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: "transform 4s cubic-bezier(0.17, 0.67, 0.21, 0.99)",
          background: `conic-gradient(
            ${RARITY_COLOR.common} 0deg,
            ${RARITY_COLOR.rare} 72deg,
            ${RARITY_COLOR.epic} 144deg,
            ${RARITY_COLOR.legendary} 216deg,
            ${RARITY_COLOR.mythic} 288deg,
            ${RARITY_COLOR.common} 360deg
          )`,
          filter: "saturate(1.4) blur(0.5px)",
        }}
      >
        {/* Center cap — NEUTRAL so it doesn't spoil the rarity mid-spin */}
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div
            className="h-20 w-20 rounded-full grid place-items-center ring-2 ring-background bg-background/90 shadow-xl"
          >
            <Sparkles className="h-8 w-8 text-foreground/80 drop-shadow-lg animate-pulse" />
          </div>
        </div>
      </div>

      {/* Color legend (no letters / sections) */}
      <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
        {(Object.keys(RARITY_COLOR) as Rarity[]).map((r) => (
          <div key={r} className="flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded-full ring-1 ring-white/20"
              style={{ backgroundColor: RARITY_COLOR[r], boxShadow: `0 0 10px ${RARITY_COLOR[r]}` }}
            />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{RARITY_LABEL[r]}</span>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground mt-3">Spinning...</p>
    </div>
  );
};
