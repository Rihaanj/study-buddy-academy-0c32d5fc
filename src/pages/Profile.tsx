import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { UserAvatar } from "@/components/UserAvatar";
import { AvatarUpload } from "@/components/AvatarUpload";
import { BadgeGrid } from "@/components/BadgeGrid";
import { XpBar } from "@/components/XpBar";
import { Timer, ListChecks, Flame, Zap, Trophy } from "lucide-react";
import { stageLabel } from "@/lib/gamification";

export default function Profile() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [todayMin, setTodayMin] = useState(0);
  const [todaySessions, setTodaySessions] = useState(0);
  const [totalMin, setTotalMin] = useState(0);
  const [tasksDone, setTasksDone] = useState(0);
  const [badgeCount, setBadgeCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const [{ data: todaySess }, { data: allSess }, { count: doneCount }, { count: bCount }] = await Promise.all([
        supabase.from("focus_sessions").select("duration_minutes")
          .eq("user_id", user.id).gte("completed_at", startOfDay.toISOString()),
        supabase.from("focus_sessions").select("duration_minutes").eq("user_id", user.id),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("completed", true),
        supabase.from("user_badges").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      setTodayMin((todaySess ?? []).reduce((s, x: any) => s + x.duration_minutes, 0));
      setTodaySessions((todaySess ?? []).length);
      setTotalMin((allSess ?? []).reduce((s, x: any) => s + x.duration_minutes, 0));
      setTasksDone(doneCount ?? 0);
      setBadgeCount(bCount ?? 0);
    })();
  }, [user?.id]);

  if (!profile) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="glass-strong p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-gradient-primary opacity-25 blur-3xl" />
        <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
          <div className="flex-shrink-0">
            <UserAvatar url={profile.avatar_url} name={profile.name} className="h-24 w-24 ring-2 ring-primary/40 shadow-glow" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold truncate">
              {profile.name ?? "Student"}
            </h1>
            <p className="text-muted-foreground text-sm truncate">Lv {profile.level} · {profile.xp} XP</p>
            <p className="text-sm mt-1">
              <span className="gradient-text font-bold">Lv {profile.level}</span> · {stageLabel(profile.avatar?.evolutionStage ?? "student")} · ⚡ {profile.xp} XP
            </p>
            <div className="mt-3 max-w-md"><XpBar xp={profile.xp} /></div>
          </div>
          <div className="w-full sm:w-auto"><AvatarUpload /></div>
        </div>
      </section>

      {/* Stats grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Timer} label="Today's focus" value={`${todayMin}m`} sub={`${todaySessions} sessions`} />
        <Stat icon={Timer} label="All-time focus" value={`${Math.round(totalMin / 60 * 10) / 10}h`} sub={`${totalMin} min`} />
        <Stat icon={ListChecks} label="Tasks done" value={String(tasksDone)} sub="completed" />
        <Stat icon={Flame} label="Day streak" value={`${profile.streak} 🔥`} sub={`Focus ${profile.focus_streak}`} />
      </section>

      {/* Badges */}
      <section className="glass-strong p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2"><Trophy className="h-5 w-5 text-warning" /> Badges</h2>
          <span className="text-sm text-muted-foreground">{badgeCount}/25 unlocked</span>
        </div>
        <BadgeGrid />
      </section>
    </div>
  );
}

const Stat = ({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub: string }) => (
  <div className="glass p-4 rounded-xl">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
      <Icon className="h-3 w-3" />{label}
    </div>
    <div className="text-2xl font-bold mt-1">{value}</div>
    <div className="text-[10px] text-muted-foreground">{sub}</div>
  </div>
);
