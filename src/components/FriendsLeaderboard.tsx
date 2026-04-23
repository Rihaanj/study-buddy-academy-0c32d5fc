import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { UserAvatar } from "@/components/UserAvatar";
import { Trophy, Flame, Gift } from "lucide-react";
import { cleanText } from "@/lib/sanitize";

type Row = {
  user_id: string;
  score: number; // total lifetime score (XP + focus_min * 2) — measured by the server, not self-reported
  xp: number;
  focus_minutes: number;
  name: string | null;
  avatar_url: string | null;
};

function nextResetCountdown(): string {
  const now = new Date();
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = monday.getUTCDay() || 7;
  monday.setUTCDate(monday.getUTCDate() + (8 - dow));
  monday.setUTCHours(0, 0, 0, 0);
  const ms = monday.getTime() - now.getTime();
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  return `${days}d ${hours}h`;
}

export function FriendsLeaderboard() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);

      // My friends
      const { data: fs } = await supabase
        .from("friendships")
        .select("user_a, user_b")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);
      const friendIds = (fs ?? []).map((f: any) => (f.user_a === user.id ? f.user_b : f.user_a));
      const allIds = [user.id, ...friendIds];

      // Server-measured totals: lifetime XP from profiles, lifetime focus minutes from focus_sessions.
      // Users CANNOT inflate this — every XP gain & focus session is recorded server-side.
      const [{ data: profs }, { data: sessions }] = await Promise.all([
        supabase.from("profiles").select("user_id, name, avatar_url, xp").in("user_id", allIds),
        supabase.from("focus_sessions").select("user_id, duration_minutes").in("user_id", allIds),
      ]);

      // Sum focus minutes per user
      const focusMap = new Map<string, number>();
      for (const s of sessions ?? []) {
        focusMap.set(s.user_id, (focusMap.get(s.user_id) ?? 0) + (s.duration_minutes ?? 0));
      }

      const profMap = new Map((profs ?? []).map((p: any) => [p.user_id, p]));

      const merged: Row[] = allIds.map((id) => {
        const p: any = profMap.get(id);
        const xp = p?.xp ?? 0;
        const fm = focusMap.get(id) ?? 0;
        return {
          user_id: id,
          xp,
          focus_minutes: fm,
          score: xp + fm * 2, // computed server-side from real activity
          name: p?.name ?? null,
          avatar_url: p?.avatar_url ?? null,
        };
      }).sort((a, b) => b.score - a.score);

      setRows(merged);
      setLoading(false);
    })();
  }, [user?.id]);

  if (!user) return null;

  function packsForRank(rank: number, total: number): number {
    if (rank === total) return 0;
    if (rank === 1) return 10;
    if (rank === 2) return 7;
    if (rank === 3) return 5;
    if (rank === 4) return 4;
    if (rank === 5) return 3;
    return 2;
  }

  if (rows.length <= 1) {
    return (
      <section className="glass p-5">
        <h2 className="font-semibold mb-2 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-400" /> All-time leaderboard
        </h2>
        <p className="text-sm text-muted-foreground">
          Add friends to compete! 🥇 1st gets <strong className="text-amber-400">10 packs</strong>, 2nd 7, 3rd 5, 4th 4, 5th 3, everyone else 2 — <strong>last place gets nothing</strong>.
        </p>
      </section>
    );
  }

  return (
    <section className="glass p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="font-semibold flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-400" /> All-time leaderboard
        </h2>
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Flame className="h-3 w-3" /> Pack rewards in {nextResetCountdown()}
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r, i) => {
            const rank = i + 1;
            const packs = packsForRank(rank, rows.length);
            const isMe = r.user_id === user.id;
            const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank;
            const tagClass = packs >= 10
              ? "bg-amber-500/20 text-amber-300"
              : packs >= 5
              ? "bg-primary/20 text-primary"
              : packs > 0
              ? "bg-white/10 text-muted-foreground"
              : "bg-destructive/15 text-destructive";
            return (
              <li
                key={r.user_id}
                className={`flex items-center gap-3 p-2 rounded-lg transition ${
                  isMe ? "bg-primary/10 ring-1 ring-primary/30" : "bg-white/5"
                }`}
              >
                <div className="w-6 text-center font-bold text-sm">{medal}</div>
                <UserAvatar url={r.avatar_url} name={r.name} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {cleanText(r.name) || "Unnamed"} {isMe && <span className="text-xs text-muted-foreground">(you)</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {Math.round(r.score)} pts · {r.xp} XP · {r.focus_minutes}m focus
                  </div>
                </div>
                <span className={`text-[10px] flex items-center gap-1 px-2 py-0.5 rounded whitespace-nowrap ${tagClass}`}>
                  {packs > 0 ? <><Gift className="h-3 w-3" /> {packs} pack{packs === 1 ? "" : "s"}</> : "no packs"}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">
        Ranked by total <strong>lifetime</strong> XP + focus minutes × 2 — measured automatically by the app from your actual activity. No self-reported scores.
      </p>
    </section>
  );
}
