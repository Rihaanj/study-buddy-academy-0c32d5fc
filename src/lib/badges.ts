import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type BadgeRow = {
  key: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  sort_order: number;
};

export type UserBadgeRow = { badge_key: string; unlocked_at: string };

const BADGE_TITLES: Record<string, string> = {
  first_step: "First Step", getting_started: "Getting Started", locked_in: "Locked In",
  organizer: "Organizer", explorer: "Explorer", on_fire: "On Fire", consistent: "Consistent",
  unstoppable: "Unstoppable", discipline_master: "Discipline Master", comeback_kid: "Comeback Kid",
  deep_focus: "Deep Focus", zen_mode: "Zen Mode", time_investor: "Time Investor",
  focus_beast: "Focus Beast", marathon_mind: "Marathon Mind", curious_mind: "Curious Mind",
  quick_learner: "Quick Learner", test_taker: "Test Taker", knowledge_seeker: "Knowledge Seeker",
  first_friend: "First Friend", squad_member: "Squad Member", collaborator: "Collaborator",
  night_owl: "Night Owl", last_minute_hero: "Last Minute Hero", lucky_break: "Lucky Break",
};

const BADGE_ICONS: Record<string, string> = {
  first_step: "🚀", getting_started: "🤖", locked_in: "🎯", organizer: "📋", explorer: "🧭",
  on_fire: "🔥", consistent: "⚡", unstoppable: "💥", discipline_master: "👑", comeback_kid: "🌅",
  deep_focus: "🧘", zen_mode: "☯️", time_investor: "⏱️", focus_beast: "🦁", marathon_mind: "🏃",
  curious_mind: "🧠", quick_learner: "⚡", test_taker: "📝", knowledge_seeker: "📚",
  first_friend: "🤝", squad_member: "👥", collaborator: "💬",
  night_owl: "🌙", last_minute_hero: "⏰", lucky_break: "🎁",
};

/** Award a badge if not already unlocked. Shows a toast on first unlock. */
export async function awardBadge(userId: string, badgeKey: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from("user_badges").select("badge_key").eq("user_id", userId).eq("badge_key", badgeKey).maybeSingle();
  if (existing) return false;
  const { error } = await supabase.from("user_badges").insert({ user_id: userId, badge_key: badgeKey });
  if (error) return false;
  const title = BADGE_TITLES[badgeKey] ?? badgeKey;
  const icon = BADGE_ICONS[badgeKey] ?? "🏆";
  toast.success(`${icon} Badge unlocked: ${title}`, { duration: 4000 });
  return true;
}

/** Mark a tab as visited and award Explorer when all main tabs visited. */
const MAIN_TABS = ["/", "/planner", "/calendar", "/focus", "/chat", "/friends", "/ai", "/packs", "/buffs"];
export async function markTabVisited(userId: string, route: string) {
  if (!MAIN_TABS.includes(route)) return;
  const { data } = await supabase.from("profiles").select("visited_tabs").eq("user_id", userId).maybeSingle();
  const visited: string[] = (data?.visited_tabs as string[]) ?? [];
  if (visited.includes(route)) return;
  const next = [...visited, route];
  await supabase.from("profiles").update({ visited_tabs: next }).eq("user_id", userId);
  if (MAIN_TABS.every((t) => next.includes(t))) {
    await awardBadge(userId, "explorer");
  }
}

/** Increment AI usage counter and check ai badges. */
export async function trackAIUsage(userId: string, kind: "tutor" | "breakdown" | "test" | "practice") {
  const { data } = await supabase.from("ai_usage").select("count").eq("user_id", userId).eq("kind", kind).maybeSingle();
  const current = data?.count ?? 0;
  const next = current + 1;
  await supabase.from("ai_usage").upsert(
    { user_id: userId, kind, count: next, updated_at: new Date().toISOString() },
    { onConflict: "user_id,kind" }
  );
  if (kind === "tutor" && next >= 10) await awardBadge(userId, "curious_mind");
  if (kind === "breakdown" && next >= 5) await awardBadge(userId, "quick_learner");
  if (kind === "test" && next >= 3) await awardBadge(userId, "test_taker");
  if (kind === "practice" && next >= 20) await awardBadge(userId, "knowledge_seeker");
}

/** Check streak-based badges. */
export async function checkStreakBadges(userId: string, streak: number) {
  if (streak >= 3) await awardBadge(userId, "on_fire");
  if (streak >= 7) await awardBadge(userId, "consistent");
  if (streak >= 14) await awardBadge(userId, "unstoppable");
  if (streak >= 30) await awardBadge(userId, "discipline_master");
}

/** Check task-count badges (organizer = 5 tasks created). */
export async function checkTaskCountBadges(userId: string) {
  const { count } = await supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if ((count ?? 0) >= 5) await awardBadge(userId, "organizer");
}

/** Focus session badges. */
export async function checkFocusBadges(userId: string, sessionDuration: number, integrity: number) {
  const { data } = await supabase.from("focus_sessions").select("duration_minutes").eq("user_id", userId);
  const sessions = data ?? [];
  if (sessions.length >= 1) await awardBadge(userId, "locked_in");
  if (sessions.length >= 5) await awardBadge(userId, "deep_focus");
  const totalMin = sessions.reduce((s, x: any) => s + (x.duration_minutes ?? 0), 0);
  if (totalMin >= 120) await awardBadge(userId, "time_investor");
  if (totalMin >= 600) await awardBadge(userId, "focus_beast");
  if (sessionDuration >= 50) await awardBadge(userId, "marathon_mind");
  if (integrity >= 100) await awardBadge(userId, "zen_mode");
  // Night owl: completing past midnight (00:00 - 04:00)
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 4) await awardBadge(userId, "night_owl");
}
