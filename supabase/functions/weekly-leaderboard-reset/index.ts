// Resets the weekly friends leaderboard. Called by pg_cron Mondays 00:00 UTC.
// For each user: finds their friend circle, awards 10 packs to highest scorer
// and 5 packs to lowest scorer in that circle, then resets every user's snapshot
// to the friend-group AVERAGE so some can gain and some can lose next week.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function isoMonday(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = x.getUTCDay() || 7; // 1..7, Mon..Sun
  x.setUTCDate(x.getUTCDate() - (dow - 1));
  return x.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Require a shared secret so only the scheduled pg_cron job can trigger this reset.
  const expected = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-cron-secret");
  if (!expected || provided !== expected) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(url, key);

    const now = new Date();
    const lastWeekStart = isoMonday(new Date(now.getTime() - 7 * 24 * 3600 * 1000));
    const thisWeekStart = isoMonday(now);

    // 1) Pull every weekly_scores row for the just-ended week
    const { data: scores, error: scoresErr } = await sb
      .from("weekly_scores")
      .select("user_id, score, xp_delta, focus_delta")
      .eq("week_start", lastWeekStart);
    if (scoresErr) throw scoresErr;

    // 2) Pull all friendships
    const { data: friendships, error: fErr } = await sb
      .from("friendships")
      .select("user_a, user_b");
    if (fErr) throw fErr;

    // Build adjacency
    const adj = new Map<string, Set<string>>();
    (friendships ?? []).forEach((f: any) => {
      if (!adj.has(f.user_a)) adj.set(f.user_a, new Set());
      if (!adj.has(f.user_b)) adj.set(f.user_b, new Set());
      adj.get(f.user_a)!.add(f.user_b);
      adj.get(f.user_b)!.add(f.user_a);
    });

    const scoreMap = new Map<string, number>();
    (scores ?? []).forEach((s: any) => scoreMap.set(s.user_id, Number(s.score) || 0));

    // Reward tiers by rank within friend circle (1-indexed)
    // 1st=10, 2nd=7, 3rd=5, 4th=4, 5th=3, others=2, last=0
    function rewardForRank(rank: number, total: number): number {
      if (rank === total) return 0; // last place gets nothing
      if (rank === 1) return 10;
      if (rank === 2) return 7;
      if (rank === 3) return 5;
      if (rank === 4) return 4;
      if (rank === 5) return 3;
      return 2;
    }

    let usersRewarded = 0;
    let totalPacksAwarded = 0;
    const processedRewards = new Set<string>(); // user_id rewarded already

    // 3) For each user with friends, compute their personal circle (self + friends)
    for (const [userId, friendSet] of adj.entries()) {
      const circle = [userId, ...Array.from(friendSet)];
      if (circle.length < 2) continue;

      const ranked = circle
        .map((u) => ({ user_id: u, score: scoreMap.get(u) ?? 0 }))
        .sort((a, b) => b.score - a.score);

      for (let i = 0; i < ranked.length; i++) {
        const entry = ranked[i];
        const rank = i + 1;
        const packs = rewardForRank(rank, ranked.length);
        if (packs <= 0) continue;
        if (processedRewards.has(entry.user_id)) continue;
        processedRewards.add(entry.user_id);

        // Skip if this user was already rewarded for this week (a friend's circle processed first)
        const { data: existing } = await sb
          .from("weekly_leaderboard_rewards")
          .select("id")
          .eq("user_id", entry.user_id)
          .eq("week_start", lastWeekStart)
          .maybeSingle();
        if (existing) continue;

        const rewardType = rank === 1 ? "winner" : rank <= 5 ? `top_${rank}` : "participant";
        await sb.from("weekly_leaderboard_rewards").insert({
          user_id: entry.user_id,
          week_start: lastWeekStart,
          reward_type: rewardType,
          packs_awarded: packs,
        });
        const packRows = Array.from({ length: packs }).map(() => ({
          user_id: entry.user_id,
          item_type: "pack",
          item_key: "buff_pack",
          rarity: rollRarity(),
          metadata: { opened: false, source: `weekly_rank_${rank}`, week: lastWeekStart },
        }));
        await sb.from("inventory").insert(packRows);
        usersRewarded++;
        totalPacksAwarded += packs;
      }
    }

    // 4) For the new week, seed each user's snapshot so their starting "score" reflects the friend-circle average.
    const avgByUser = new Map<string, number>();
    for (const [userId, friendSet] of adj.entries()) {
      const circle = [userId, ...Array.from(friendSet)];
      if (circle.length < 2) continue;
      const sum = circle.reduce((acc, u) => acc + (scoreMap.get(u) ?? 0), 0);
      const avg = Math.round(sum / circle.length);
      avgByUser.set(userId, avg);
    }

    // Get current xp + focus totals for everyone with a friend
    const allUsers = Array.from(adj.keys());
    if (allUsers.length > 0) {
      const { data: profs } = await sb
        .from("profiles")
        .select("user_id, xp")
        .in("user_id", allUsers);
      const xpMap = new Map<string, number>();
      (profs ?? []).forEach((p: any) => xpMap.set(p.user_id, p.xp ?? 0));

      const { data: focus } = await sb
        .from("focus_sessions")
        .select("user_id, duration_minutes")
        .in("user_id", allUsers);
      const focusMap = new Map<string, number>();
      (focus ?? []).forEach((f: any) => {
        focusMap.set(f.user_id, (focusMap.get(f.user_id) ?? 0) + (f.duration_minutes ?? 0));
      });

      for (const u of allUsers) {
        const avg = avgByUser.get(u) ?? 0;
        const curXp = xpMap.get(u) ?? 0;
        const curFocus = focusMap.get(u) ?? 0;
        // Seed delta = avg (so everyone starts at the average), score = avg
        await sb.from("weekly_scores").upsert({
          user_id: u,
          week_start: thisWeekStart,
          xp_start: curXp,
          focus_start: curFocus,
          xp_delta: avg,
          focus_delta: 0,
          score: avg,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,week_start" });
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      lastWeek: lastWeekStart,
      thisWeek: thisWeekStart,
      usersRewarded,
      totalPacksAwarded,
      circles: adj.size,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("weekly-leaderboard-reset error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function rollRarity(): string {
  const r = Math.random();
  if (r < 0.02) return "mythic";
  if (r < 0.07) return "legendary";
  if (r < 0.20) return "epic";
  if (r < 0.50) return "rare";
  return "common";
}
