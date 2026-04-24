// Curated unique buff catalog. Each buff stores enough metadata for the Buffs UI
// to display its effect and for awardXp / future systems to apply its mechanics.

export type BuffCategory = "xp" | "streak" | "focus" | "rng" | "meta" | "ultra";

export type BuffDef = {
  key: string;
  category: BuffCategory;
  multiplier: number;       // generic multiplier (XP unless category specifies otherwise)
  durationMin: number;      // 0 = instant consumable
  instant?: boolean;
  xpAmount?: number;        // for instant XP grants
  label: string;
  description: string;
  emoji: string;
};

// Tier weights (sum to 1.0):
// common 50% · rare 28% · epic 15% · legendary 5% · mythic 2%
// (Pack drop weighting is enforced server-side in grant_packs_on_level_up.)

// FAIRNESS PASS: tier multipliers were too snowbally. Trimmed so even mythics
// can't break the 1000 XP/day cap quickly when stacked.
export const BUFF_POOL: Record<string, BuffDef[]> = {
  common: [
    { key: "micro_sprint",    category: "xp",    multiplier: 1,    durationMin: 0,  instant: true, xpAmount: 15,  label: "Micro Sprint",        description: "Instant +15 XP burst.",                                emoji: "⚡" },
    { key: "early_bird",      category: "xp",    multiplier: 1.15, durationMin: 30,                                  label: "Early Bird",          description: "+15% XP for the next 30 minutes.",                     emoji: "🌅" },
    { key: "night_owl",       category: "xp",    multiplier: 1.15, durationMin: 30,                                  label: "Night Owl",           description: "+15% XP for the next 30 minutes.",                     emoji: "🌙" },
    { key: "flow_state",      category: "focus", multiplier: 1.2,  durationMin: 45,                                  label: "Flow State",          description: "+20% XP from focus sessions for 45 minutes.",          emoji: "🌊" },
  ],
  rare: [
    { key: "combo_chain",     category: "xp",    multiplier: 1.3,  durationMin: 30,                                  label: "Combo Chain",         description: "+30% XP for 30 min.",                                  emoji: "🔗" },
    { key: "subject_special", category: "xp",    multiplier: 1.5,  durationMin: 30,                                  label: "Subject Specialist", description: "+50% XP — but only one subject. Pick wisely.",         emoji: "📘" },
    { key: "deep_work_shield",category: "focus", multiplier: 1.3,  durationMin: 30,                                  label: "Deep Work Shield",    description: "+30% focus XP for 30 minutes.",                        emoji: "🛡️" },
    { key: "mistake_rewind",  category: "meta",  multiplier: 1,    durationMin: 60,                                  label: "Mistake Rewind",      description: "Wrong answers won't lower XP for 60 minutes.",         emoji: "↩️" },
  ],
  epic: [
    { key: "under_pressure",  category: "xp",    multiplier: 1.75, durationMin: 30,                                  label: "Under Pressure",      description: "+75% XP on hard difficulty tasks for 30 min.",         emoji: "🔥" },
    { key: "comeback_mode",   category: "streak",multiplier: 1.75, durationMin: 360,                                 label: "Comeback Mode",       description: "+75% XP for 6h — perfect after a bad day.",            emoji: "💪" },
    { key: "distraction_pun", category: "focus", multiplier: 2,    durationMin: 60,                                  label: "Distraction Punisher",description: "+100% XP if you stay focused; -50% if you leave. 60 min.", emoji: "🎯" },
  ],
  legendary: [
    { key: "jackpot_mode",    category: "rng",   multiplier: 1,    durationMin: 60,                                  label: "Jackpot Mode",        description: "Pack rewards may upgrade by one tier. 1h.",            emoji: "🎰" },
    { key: "buff_amplifier",  category: "meta",  multiplier: 1.5,  durationMin: 30,                                  label: "Buff Amplifier",      description: "+50% effect on all your active buffs. 30 min.",        emoji: "✨" },
    { key: "time_warp",       category: "meta",  multiplier: 1.25, durationMin: 0,  instant: true,                  label: "Time Warp",           description: "Instantly extends every active buff by 25%.",          emoji: "⏳" },
    { key: "pack_multiplier", category: "rng",   multiplier: 2,    durationMin: 60,                                  label: "Pack Multiplier",     description: "Next opened pack guaranteed Rare or higher. 1h window.", emoji: "🎁" },
  ],
  mythic: [
    { key: "infinite_focus",  category: "ultra", multiplier: 2.5,  durationMin: 15,                                  label: "Infinite Focus",      description: "2.5× XP for 15 minutes. Go all in.",                   emoji: "🌌" },
    { key: "god_mode",        category: "ultra", multiplier: 3,    durationMin: 5,                                   label: "God Mode",            description: "3× everything for 5 minutes. Reality bends.",          emoji: "👑" },
  ],
};
