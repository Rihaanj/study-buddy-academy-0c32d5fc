import { Sparkles } from "lucide-react";

const SECTIONS: { title: string; emoji: string; items: string[] }[] = [
  {
    title: "Getting Started", emoji: "🚀",
    items: [
      "Sign in with Google or email — your data is private to you",
      "Visit every main tab to unlock the Explorer badge",
      "Set up your profile photo from the Profile tab",
    ],
  },
  {
    title: "XP & Leveling", emoji: "⚡",
    items: [
      "Earn XP from completing tasks, focus sessions, and AI study tools",
      "100 XP = 1 level. You evolve at lv 10 (Scholar), 25 (Mastermind), 50 (Cosmic Genius)",
      "Daily cap: max 6 levels per day — beyond that XP is reduced to 25%",
      "Tasks have a 5-minute cooldown between XP awards (anti-spam)",
      "Once a task is completed, it's locked — no re-checking for free XP",
    ],
  },
  {
    title: "Streaks 🔥", emoji: "🔥",
    items: [
      "Use the app daily to build your streak",
      "Earn streak badges at 3, 7, 14, and 30 days",
      "Streak ≥ 5 days → free pack every day",
      "Every 25-day milestone → 3 bonus packs",
    ],
  },
  {
    title: "Planner 📋", emoji: "📋",
    items: [
      "Add tasks with importance, difficulty, and confidence — priority is auto-calculated",
      "Higher priority tasks appear at the top in red",
      "Tap the checkbox to mark done and earn XP",
      "Tasks with due dates also show in your Calendar",
    ],
  },
  {
    title: "Calendar 📅", emoji: "📅",
    items: [
      "View tasks, events, and focus sessions on a monthly grid",
      "Click any event to add notes, descriptions, or remember details",
      "Duration is optional — leave blank for all-day events",
    ],
  },
  {
    title: "Focus Timer ⏱", emoji: "⏱",
    items: [
      "Start a Pomodoro-style session with custom length",
      "Switching tabs lowers your integrity score",
      "Phone screen-off pauses integrity tracking (we know!)",
      "Earn Marathon Mind (50 min), Zen Mode (no tab switches), Time Investor & Focus Beast badges",
    ],
  },
  {
    title: "AI Hub 🧠", emoji: "🧠",
    items: [
      "Tutor: ask any study question and get a clear explanation",
      "Tests: generate quizzes — answers judged by AI for correctness, not exact wording",
      "Practice: get topic-based study plans",
      "Image study: upload notes for OCR + auto-questions",
      "Analytics: see what you've studied — past topics, tests, and practice sessions",
    ],
  },
  {
    title: "Buffs ✨", emoji: "✨",
    items: [
      "Buffs are temporary boosts: extra XP, streak shield, focus integrity, etc.",
      "Activated buffs stack — multiple XP buffs multiply together",
      "Some buffs expire after a set time, others are permanent",
    ],
  },
  {
    title: "Packs 🎁", emoji: "🎁",
    items: [
      "Earn packs by leveling up (every 2 levels) and from streak rewards",
      "Spin the wheel to determine pack rarity: Common → Mythic",
      "Higher rarity = rarer buffs inside",
      "Pity system: every 10th pack is guaranteed Epic, Legendary, or Mythic",
      "After spinning, the pack saves to your inventory — open whenever you want",
    ],
  },
  {
    title: "Friends & Chat 👥", emoji: "👥",
    items: [
      "Add friends by email — they receive a request",
      "Friending someone auto-creates a private DM with them",
      "Group chats are separate — see DMs and groups in different lists",
      "Search bar finds chats fast",
      "You can delete your own messages",
    ],
  },
  {
    title: "Weekly Leaderboard 🏁", emoji: "🏁",
    items: [
      "Compete with your friends every week — score = XP earned + focus minutes × 2",
      "Pack rewards by rank in your friend circle:",
      "🥇 1st place → 10 packs",
      "🥈 2nd place → 7 packs",
      "🥉 3rd place → 5 packs",
      "4th place → 4 packs",
      "5th place → 3 packs",
      "Everyone else → 2 packs",
      "💀 Last place → nothing — don't be last!",
      "Resets every Monday 00:00 UTC — but instead of zero, everyone restarts at the friend-group AVERAGE",
      "This means some can gain ground and some can lose, week to week",
    ],
  },
  {
    title: "Badges 🏆", emoji: "🏆",
    items: [
      "25 unique badges across Onboarding, Streak, Focus, AI, Social, and Special",
      "Auto-unlock as you hit milestones — toast notifies you",
      "View all badges + your progress on the Profile tab",
    ],
  },
];

export default function Help() {
  return (
    <div className="space-y-6">
      <section className="glass-strong p-6 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-gradient-primary opacity-25 blur-3xl" />
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-primary grid place-items-center shadow-glow">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold gradient-text">How to use Study Bud AI</h1>
            <p className="text-muted-foreground text-sm">Quick reference for every feature.</p>
          </div>
        </div>
      </section>

      <div className="grid sm:grid-cols-2 gap-4">
        {SECTIONS.map((s) => (
          <section key={s.title} className="glass p-5 rounded-xl">
            <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
              <span className="text-2xl">{s.emoji}</span>
              {s.title}
            </h2>
            <ul className="space-y-1.5">
              {s.items.map((it, i) => (
                <li key={i} className="text-sm text-muted-foreground flex gap-2">
                  <span className="text-primary mt-0.5">▹</span>
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground py-4">
        Made by <span className="gradient-text font-bold">Rihaan</span>
      </p>
    </div>
  );
}
