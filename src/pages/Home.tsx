import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { priorityLevel, stageLabel } from "@/lib/gamification";
import { Button } from "@/components/ui/button";
import { Timer, ListChecks, Sparkles, Calendar, Flame, Zap, Trophy } from "lucide-react";
import { useFocus } from "@/hooks/useFocus";
import { format } from "date-fns";
import { BadgeGrid } from "@/components/BadgeGrid";

export default function Home() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const focus = useFocus();
  const [topTask, setTopTask] = useState<any>(null);
  const [todayTasks, setTodayTasks] = useState<any[]>([]);
  const [nextEvent, setNextEvent] = useState<any>(null);
  const [buffs, setBuffs] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: tasks } = await supabase
        .from("tasks").select("*").eq("user_id", user.id).eq("completed", false)
        .order("priority_score", { ascending: false }).limit(8);
      setTopTask(tasks?.[0] ?? null);
      setTodayTasks(tasks ?? []);
      const { data: ev } = await supabase
        .from("events").select("*").eq("user_id", user.id).gte("date", new Date().toISOString())
        .order("date", { ascending: true }).limit(1).maybeSingle();
      setNextEvent(ev);
      const { data: ab } = await supabase.from("active_buffs").select("*").eq("user_id", user.id).limit(3);
      setBuffs(ab ?? []);
    })();
  }, [user]);

  return (
    <div className="space-y-6">
      <section className="glass-strong p-5 sm:p-8 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-gradient-primary opacity-30 blur-3xl" />
        <h1 className="text-2xl sm:text-3xl font-bold">
          Welcome back, <span className="gradient-text">{profile?.name?.split(" ")[0] ?? "Student"}</span> 👋
        </h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          Lv {profile?.level ?? 1} · {stageLabel(profile?.avatar?.evolutionStage ?? "student")} · ⚡ {profile?.xp ?? 0} XP
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={() => focus.start(25)} className="bg-gradient-primary text-primary-foreground shadow-glow">
            <Timer className="h-4 w-4 mr-2" /> Quick Focus 25m
          </Button>
          <Link to="/planner"><Button variant="outline"><ListChecks className="h-4 w-4 mr-2" />Plan</Button></Link>
          <Link to="/ai"><Button variant="outline"><Sparkles className="h-4 w-4 mr-2" />Ask AI</Button></Link>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="glass p-4 sm:p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2"><Zap className="h-3.5 w-3.5"/> XP</div>
          <div className="text-2xl sm:text-3xl font-bold mt-1">{profile?.xp ?? 0}</div>
          <div className="text-xs text-muted-foreground mt-1">Level {profile?.level ?? 1}</div>
        </div>
        <div className="glass p-4 sm:p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2"><Flame className="h-3.5 w-3.5"/> Streak</div>
          <div className="text-2xl sm:text-3xl font-bold mt-1">{profile?.streak ?? 0} 🔥</div>
          <div className="text-xs text-muted-foreground mt-1">Focus streak: {profile?.focus_streak ?? 0}</div>
        </div>
        <div className="glass p-4 sm:p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2"><Calendar className="h-3.5 w-3.5"/> Next event</div>
          <div className="text-base sm:text-lg font-semibold mt-1 truncate">{nextEvent?.title ?? "Nothing scheduled"}</div>
          <div className="text-xs text-muted-foreground mt-1">{nextEvent ? format(new Date(nextEvent.date), "MMM d, p") : "Add one in Calendar"}</div>
        </div>
      </section>

      {/* Badges showcase */}
      <section className="glass-strong p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2"><Trophy className="h-4 w-4 text-warning" /> Your badges</h2>
          <Link to="/profile" className="text-xs text-primary hover:underline">View all</Link>
        </div>
        <BadgeGrid unlockedOnly limit={8} />
      </section>

      {topTask && (
        <section className="glass-strong p-5 sm:p-6 border-l-4 border-destructive">
          <div className="text-xs uppercase tracking-wider text-destructive font-semibold">Do this first today</div>
          <div className="mt-2 text-lg sm:text-xl font-bold">{topTask.title}</div>
          <div className="text-sm text-muted-foreground mt-1">{topTask.subject ?? "General"} · Priority {Math.round(topTask.priority_score)}</div>
          <Link to="/planner"><Button className="mt-4" variant="secondary">Open in planner</Button></Link>
        </section>
      )}

      <section className="grid md:grid-cols-2 gap-4">
        <div className="glass p-5">
          <h2 className="font-semibold mb-3">Today's tasks</h2>
          {todayTasks.length === 0 && <p className="text-sm text-muted-foreground">No open tasks. Enjoy the cosmos. 🌠</p>}
          <ul className="space-y-2">
            {todayTasks.map((t) => {
              const p = priorityLevel(Number(t.priority_score));
              return (
                <li key={t.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5">
                  <span className={`h-2 w-2 rounded-full ${p.dot}`} />
                  <span className="flex-1 truncate text-sm">{t.title}</span>
                  <span className={`text-xs ${p.color}`}>{p.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="glass p-5">
          <h2 className="font-semibold mb-3">Active buffs</h2>
          {buffs.length === 0 && <p className="text-sm text-muted-foreground">No buffs active. Earn packs by completing tasks & focus sessions.</p>}
          <ul className="space-y-2">
            {buffs.map((b) => (
              <li key={b.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                <span className="text-sm">{b.buff_key.replace(/_/g, " ")}</span>
                <span className="text-xs text-accent">×{b.multiplier}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <p className="text-center text-xs text-muted-foreground py-4">
        Made by <span className="gradient-text font-bold">Rihaan Yeswant Jain</span> 🌌
      </p>
    </div>
  );
}
