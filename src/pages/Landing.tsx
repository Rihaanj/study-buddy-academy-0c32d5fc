import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Starfield } from "@/components/Starfield";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import {
  ArrowRight, Brain, Timer, ListChecks, Users, Package, Trophy,
  Sparkles, ShieldCheck, Calendar,
} from "lucide-react";

const logoUrl = "/icons/icon-512.png";

type Stats = { visitors: number; focus_hours: number; ai_uses: number; students: number };

const pillars = [
  { icon: Brain, title: "AI tutor that teaches", body: "Full lessons with examples, key takeaways, common mistakes, quizzes and flashcards — never answers stolen homework." },
  { icon: Timer, title: "Focus timer that pays", body: "Deep-work sessions earn the most XP in the app, plus a mystery pack every 5 minutes when a buff is live." },
  { icon: ListChecks, title: "Planner + calendar", body: "Assignments sorted by smart priority, deadlines on a calendar, and nudges before anything is due." },
  { icon: Users, title: "Study with friends", body: "Group chats, DMs, images, stickers and meet links — study sessions that actually happen." },
  { icon: Package, title: "Packs, buffs & badges", body: "Open packs, activate XP buffs, unlock badges and evolve your avatar as you level up." },
  { icon: Trophy, title: "Weekly leaderboard", body: "Ranked on how much you grew this week, not on who started first. Top 3 win bonus packs." },
];

function useCountUp(target: number, duration = 1200) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!target) { setV(0); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}

const StatCard = ({ value, label, suffix }: { value: number; label: string; suffix?: string }) => {
  const shown = useCountUp(value);
  return (
    <div className="glass-strong rounded-2xl p-5 text-center">
      <div className="text-3xl sm:text-4xl font-bold gradient-text tabular-nums">
        {shown.toLocaleString()}{suffix ?? ""}
      </div>
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mt-2">{label}</div>
    </div>
  );
};

export default function Landing() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ visitors: 222, focus_hours: 37, ai_uses: 500, students: 0 });

  useEffect(() => {
    (async () => {
      try {
        if (!sessionStorage.getItem("sb_visit_counted")) {
          sessionStorage.setItem("sb_visit_counted", "1");
          await supabase.rpc("bump_visitor" as any);
        }
        const { data } = await supabase.rpc("public_stats" as any);
        if (data) setStats(data as any as Stats);
      } catch {
        /* stats are decorative — never block the page */
      }
    })();
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden">
      <SeoHead
        title="Study Bud AI — AI Tutor, Focus Timer & Planner for Students"
        description="Study Bud AI is the student operating system: an AI tutor that teaches, a focus timer that rewards deep work, a smart planner, study friends, and gamified XP."
        path="/"
      />
      <Starfield />

      <div className="absolute top-0 -left-32 w-[28rem] h-[28rem] rounded-full bg-primary/20 blur-[140px] animate-pulse" />
      <div className="absolute bottom-0 -right-32 w-[28rem] h-[28rem] rounded-full bg-accent/20 blur-[140px] animate-pulse" style={{ animationDelay: "1.5s" }} />

      {/* Nav */}
      <header className="relative z-10 max-w-6xl mx-auto px-5 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <img src={logoUrl} alt="Study Bud AI orbit logo" className="h-10 w-10 object-contain" width={40} height={40} />
          <span className="font-bold text-lg tracking-tight gradient-text truncate">Study Bud AI</span>
        </div>
        <Button asChild variant="ghost" className="text-sm">
          <Link to={user ? "/app" : "/login"}>{user ? "Open app" : "Sign in"}</Link>
        </Button>
      </header>

      {/* Hero */}
      <section className="relative z-10 max-w-6xl mx-auto px-5 pt-6 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-muted-foreground animate-fade-in">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          The Student Operating System
        </div>

        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mt-6 animate-fade-in">
          Chart your whole study life<br className="hidden sm:block" /> in <span className="gradient-text">one orbit.</span>
        </h1>
        <p className="text-muted-foreground mt-5 max-w-2xl mx-auto text-base sm:text-lg animate-fade-in" style={{ animationDelay: "120ms" }}>
          AI lessons, a focus timer that rewards deep work, a planner that knows what is due,
          and friends to study with — all in one glowing dashboard.
        </p>

        {/* Orbit graphic */}
        <div className="relative mx-auto mt-12 h-64 w-64 sm:h-80 sm:w-80 animate-fade-in" style={{ animationDelay: "200ms" }}>
          <div className="absolute inset-0 rounded-full bg-gradient-primary blur-[70px] opacity-40" />
          <div className="absolute inset-0 rounded-full border border-white/10" />
          <div className="absolute inset-6 rounded-full border border-white/5" />
          <img
            src={logoUrl}
            alt="Study Bud AI glowing orbit emblem"
            className="relative h-full w-full object-contain float drop-shadow-[0_0_60px_hsl(var(--primary)/0.6)]"
            width={320}
            height={320}
          />
          {[
            { icon: Brain, label: "AI tutor", cls: "-top-2 left-0" },
            { icon: Timer, label: "Focus", cls: "top-6 -right-4" },
            { icon: Calendar, label: "Planner", cls: "bottom-8 -left-8" },
            { icon: Trophy, label: "Ranks", cls: "-bottom-2 right-2" },
          ].map((b) => (
            <div key={b.label} className={`absolute ${b.cls} glass rounded-full px-3 py-1.5 text-[11px] flex items-center gap-1.5 border border-white/10`}>
              <b.icon className="h-3.5 w-3.5 text-primary" />
              {b.label}
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col sm:flex-row gap-3 justify-center animate-fade-in" style={{ animationDelay: "260ms" }}>
          <Button asChild className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow h-12 px-8 text-base font-semibold group">
            <Link to={user ? "/app" : "/login"}>
              Open app
              <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-12 px-8 text-base border-white/15 bg-white/5">
            <Link to="/login">Create a free account</Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-14 max-w-3xl mx-auto animate-fade-in" style={{ animationDelay: "320ms" }}>
          <StatCard value={stats.visitors} label="Visitors" />
          <StatCard value={stats.focus_hours} label="Hours studied" />
          <StatCard value={stats.ai_uses} label="AI lessons used" />
        </div>
      </section>

      {/* Pillars */}
      <section className="relative z-10 max-w-6xl mx-auto px-5 pb-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-center">Everything a student needs, in one place</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
          {pillars.map((p) => (
            <article key={p.title} className="glass rounded-2xl p-6 hover:-translate-y-1 transition-transform">
              <div className="h-10 w-10 rounded-xl grid place-items-center bg-gradient-primary/20 border border-white/10">
                <p.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold mt-4">{p.title}</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Integrity */}
      <section className="relative z-10 max-w-4xl mx-auto px-5 pb-20">
        <div className="glass-strong rounded-2xl p-8 text-center">
          <ShieldCheck className="h-8 w-8 mx-auto text-primary" />
          <h2 className="text-xl font-bold mt-4">Built for learning, not cheating</h2>
          <p className="text-sm text-muted-foreground mt-3 max-w-2xl mx-auto leading-relaxed">
            Study Bud AI teaches you how to solve it — it will never write your essay or hand you an answer key.
            Every lesson comes with practice, and flagged requests are reviewed.
          </p>
          <Button asChild className="mt-6 bg-gradient-primary text-primary-foreground shadow-glow h-11 px-7">
            <Link to={user ? "/app" : "/login"}>Start studying free</Link>
          </Button>
        </div>
      </section>

      <footer className="relative z-10 text-center text-xs text-muted-foreground pb-10">
        Made by <span className="gradient-text font-semibold">Rihaan Yeswant Jain</span>
      </footer>
    </div>
  );
}
