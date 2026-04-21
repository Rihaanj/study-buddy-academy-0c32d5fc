import { supabase } from "@/integrations/supabase/client";
import { secureRandom } from "./random";

export type Rarity = "common" | "rare" | "epic" | "legendary" | "mythic";

/** Weighted random rarity using crypto-secure randomness for true fairness. */
export function rollRarity(): Rarity {
  const r = secureRandom();
  if (r < 0.02) return "mythic";
  if (r < 0.07) return "legendary";
  if (r < 0.20) return "epic";
  if (r < 0.50) return "rare";
  return "common";
}

/**
 * Grant streak-based bonus packs.
 * - Streak >= 5: +1 pack per day
 * - Streak hits multiple of 25 (25, 50, 75, ...): +3 packs total that day
 * Idempotent per (user, day): we record the day in daily_pack_grants.
 */
export async function grantStreakPacks(userId: string, streak: number): Promise<number> {
  if (!userId || streak < 5) return 0;
  const today = new Date().toISOString().slice(0, 10);

  // Already granted today?
  const { data: existing } = await (supabase.from("daily_pack_grants") as any)
    .select("packs_granted")
    .eq("user_id", userId)
    .eq("day", today)
    .maybeSingle();
  if (existing) return 0;

  const isMilestone = streak > 0 && streak % 25 === 0;
  const packCount = isMilestone ? 3 : 1;

  const rows = Array.from({ length: packCount }, () => ({
    user_id: userId,
    item_type: "pack",
    item_key: "buff_pack",
    rarity: rollRarity(),
    metadata: {
      opened: false,
      source: isMilestone ? "streak_milestone" : "streak_daily",
      streak_at_grant: streak,
    } as any,
  }));

  const { error: insErr } = await supabase.from("inventory").insert(rows as any);
  if (insErr) return 0;

  await (supabase.from("daily_pack_grants") as any).upsert(
    { user_id: userId, day: today, packs_granted: packCount, milestone_streak: isMilestone ? streak : null },
    { onConflict: "user_id,day" }
  );

  return packCount;
}
