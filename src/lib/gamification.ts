import { supabase } from "@/integrations/supabase/client";

// Progression: every 100 XP = next level. Level 1 reached at 100 XP, lvl 5 at 500 XP, etc.
// (xp 0..99 = lvl 1 still, but you "reach" lvl N when xp >= N*100)
export const XP_PER_LEVEL = 100;
// XP needed to BE at level N (level 1 = 0 xp, level 2 = 100 xp, etc.)
export const xpForLevel = (level: number) => Math.max(0, (level - 1) * XP_PER_LEVEL);
export const levelFromXp = (xp: number) => Math.max(1, Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1);
export const xpProgress = (xp: number) => {
  const safeXp = Math.max(0, xp || 0);
  const level = levelFromXp(safeXp);
  // XP earned within the current level (0..XP_PER_LEVEL-1).
  // Level 1 spans xp 0..99, Level 2 spans 100..199, etc.
  const into = Math.max(0, safeXp - (level - 1) * XP_PER_LEVEL);
  const needed = XP_PER_LEVEL;
  const pct = Math.max(0, Math.min(100, Math.round((into / needed) * 100)));
  return { level, into, needed, pct, toNext: Math.max(0, needed - into) };
};
export const evolutionStage = (level: number) => {
  if (level >= 50) return "cosmic_genius";
  if (level >= 25) return "mastermind";
  if (level >= 10) return "scholar";
  return "student";
};
export const stageLabel = (s: string) =>
  ({ student: "Student", scholar: "Scholar", mastermind: "Mastermind", cosmic_genius: "Cosmic Genius 🌌" } as const)[
    s as "student"
  ] ?? "Student";

export const difficultyPoints = (d: "low" | "medium" | "high") => ({ low: 10, medium: 20, high: 30 }[d]);

export const computePriority = (gradeImportance: number, difficulty: "low" | "medium" | "high", confidence: number) =>
  gradeImportance * 0.5 + difficultyPoints(difficulty) + (100 - confidence * 10);

export const priorityLevel = (score: number) => {
  if (score >= 80) return { label: "Urgent", color: "text-destructive", dot: "bg-destructive" };
  if (score >= 50) return { label: "Medium", color: "text-warning", dot: "bg-warning" };
  return { label: "Low", color: "text-success", dot: "bg-success" };
};

export const DAILY_LEVEL_CAP = 4;
export const REDUCED_GAIN_RATIO = 0.25;
export const TASK_XP_COOLDOWN_MS = 2 * 60 * 1000; // 2 min
// Hard cap: max 1000 XP per day for any user (= 10 levels)
export const DAILY_XP_HARD_CAP = 1000;

// Test XP base by difficulty (max XP at 100% score)
export const TEST_BASE_XP = { easy: 10, medium: 20, hard: 30 } as const;
export type TestDifficulty = keyof typeof TEST_BASE_XP;

/**
 * Compute XP delta for a test result.
 * - Gain = base × (score/total) (rounded), so 4/5 on easy = round(10*0.8) = 8.
 * - At level 5+, if ratio < 50% the user LOSES a small amount: -round(base × (1 - ratio) × 0.5).
 *   Example: 1/5 on medium at level 7 → -round(20 × 0.8 × 0.5) = -8.
 * - At level < 5, the floor is 0 (never negative).
 */
export function computeTestXpDelta(
  difficulty: TestDifficulty,
  score: number,
  total: number,
  currentLevel: number
): number {
  if (total <= 0) return 0;
  const base = TEST_BASE_XP[difficulty];
  const ratio = Math.max(0, Math.min(1, score / total));
  const gain = Math.round(base * ratio);
  if (ratio >= 0.5 || currentLevel < 5) return gain;
  // Sub-50% at level 5+: small loss
  return -Math.round(base * (1 - ratio) * 0.5);
}

export async function awardXp(userId: string, amount: number) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("xp, level, streak, last_active_date")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile) return;

  const today = new Date().toISOString().slice(0, 10);
  const oldLevel = profile.level ?? 1;

  // Pull today's level-gain counter AND xp-gained counter
  const { data: dp } = await supabase
    .from("daily_xp_progress")
    .select("levels_gained, xp_gained")
    .eq("user_id", userId)
    .eq("day", today)
    .maybeSingle();
  const levelsToday = dp?.levels_gained ?? 0;
  const xpToday = (dp as any)?.xp_gained ?? 0;

  // Reduce gain if already at level cap (only for gains)
  const capped = levelsToday >= DAILY_LEVEL_CAP;
  let effectiveAmount = amount;
  if (amount > 0 && capped) {
    effectiveAmount = Math.max(1, Math.round(amount * REDUCED_GAIN_RATIO));
  }
  // HARD daily XP cap: never exceed 1000 XP per day in gains
  if (effectiveAmount > 0) {
    const remaining = Math.max(0, DAILY_XP_HARD_CAP - xpToday);
    effectiveAmount = Math.min(effectiveAmount, remaining);
  }

  // XP can never go below 0
  const newXp = Math.max(0, (profile.xp ?? 0) + effectiveAmount);
  const newLevel = levelFromXp(newXp);

  // Streak — only update on positive XP gain
  const last = profile.last_active_date ? String(profile.last_active_date) : null;
  let streak = profile.streak ?? 0;
  let streakDate: string | null = last;
  if (effectiveAmount > 0 && last !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    streak = last === yesterday ? streak + 1 : 1;
    streakDate = today;
  }

  await supabase.from("profiles")
    .update({ xp: newXp, level: newLevel, streak, last_active_date: streakDate })
    .eq("user_id", userId);

  // Refresh weekly leaderboard score (best-effort)
  supabase.rpc("refresh_weekly_score", { _user_id: userId }).then(() => {}, () => {});

  // Streak badges
  try {
    const mod = await import("./badges");
    await mod.checkStreakBadges(userId, streak);
    if (last && last !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      if (last !== yesterday && (profile.streak ?? 0) > 0) {
        await mod.awardBadge(userId, "comeback_kid");
      }
    }
  } catch {}

  // Update today's progress (xp + level counters)
  const gainedNow = Math.max(0, newLevel - oldLevel);
  const xpGainedThisCall = Math.max(0, effectiveAmount);
  if (gainedNow > 0 || xpGainedThisCall > 0) {
    await (supabase.from("daily_xp_progress") as any).upsert(
      {
        user_id: userId,
        day: today,
        levels_gained: levelsToday + gainedNow,
        xp_gained: xpToday + xpGainedThisCall,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,day" }
    );
  }

  return {
    xp: newXp,
    level: newLevel,
    leveledUp: newLevel > oldLevel,
    streak,
    capped,
    levelsToday: levelsToday + gainedNow,
    awardedAmount: effectiveAmount,
    requestedAmount: amount,
    dailyXpCapped: amount > 0 && effectiveAmount < amount,
  };
}

export async function getActiveXpMultiplier(userId: string): Promise<number> {
  const { data } = await supabase
    .from("active_buffs")
    .select("multiplier, category, expires_at")
    .eq("user_id", userId)
    .eq("category", "xp");
  const now = Date.now();
  let mult = 1;
  for (const b of data ?? []) {
    if (!b.expires_at || new Date(b.expires_at).getTime() > now) {
      mult *= Number(b.multiplier);
    }
  }
  return mult;
}
