import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Starfield } from "@/components/Starfield";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import {
  ArrowUpRight, Brain, Timer, ListChecks, Users, Package, Trophy,
  Sparkles, ShieldCheck, Calendar, MessageCircle, Zap, Star, BookOpen,
} from "lucide-react";

const logoUrl = "/icons/icon-512.png";

type Stats = { visitors: number; focus_hours: number; ai_uses: number; students: number };

const orbitChips = [
  { icon: Brain, label: "AI tutor", cls: "left-1/2 -translate-x-1/2 -top-3" },
  { icon: ListChecks, label: "Planner", cls: "-left-6 sm:-left-10 top-[26%]" },
  { icon: Calendar, label: "Calendar", cls: "-right-6 sm:-right-12 top-[26%]" },
  { icon: Timer, label: "Focus", cls: "-left-6 sm:-left-12 bottom-[26%]" },
  { icon: Trophy, label: "Ranks", cls: "-right-6 sm:-right-10 bottom-[26%]" },
  { icon: Users, label: "Friends", cls: "left-1/2 -translate-x-1/2 -bottom-3" },
];

const pillars = [
  { icon: Brain, title: "AI tutor", body: "Lessons, quizzes, flashcards." },
  { icon: Timer, title: "Focus timer", body: "Deep work that pays XP." },
  { icon: ListChecks, title: "Planner", body: "Smart-priority assignments." },
  { icon: Calendar, title: "Calendar", body: "Deadlines and nudges." },
  { icon: MessageCircle, title: "Chats & DMs", body: "Study together, live." },
  { icon: Package, title: "Packs & buffs", body: "Spin, boost, collect." },
  { icon: Trophy, title: "Leaderboard", body: "Ranked on weekly growth." },
  { icon: BookOpen, title: "Notebook", body: "Spaced-repetition review." },
  { icon: ShieldCheck, title: "Integrity", body: "Teaches, never cheats." },
];


function useCountUp(target: number, duration = 1400) {
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

const Stat = ({ value, label, suffix }: { value: number; label: string; suffix?: string }) => {
  const shown = useCountUp(value);
  return (
    <div>
      <div className="text-3xl sm:text-4xl font-bold gradient-text tabular-nums">
        {shown.toLocaleString()}{suffix ?? ""}
      </div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
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

      {/* Ambient nebula wash */}
      <div aria-hidden className="pointer-events-none absolute -top-40 -left-40 w-[38rem] h-[38rem] rounded-full bg-primary/25 blur-[160px]" />
      <div aria-hidden className="pointer-events-none absolute top-1/3 -right-40 w-[34rem] h-[34rem] rounded-full bg-accent/25 blur-[160px]" />
      <div aria-hidden className="pointer-events-none absolute bottom-0 left-1/3 w-[30rem] h-[30rem] rounded-full bg-secondary/20 blur-[150px]" />

      {/* Nav */}
      <header className="relative z-10 max-w-6xl mx-auto px-5 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <img src={logoUrl} alt="Study Bud AI orbit logo" className="h-10 w-10 object-contain drop-shadow-[0_0_18px_hsl(var(--primary)/0.65)]" width={40} height={40} />
          <span className="font-bold text-lg tracking-tight gradient-text truncate">Study Bud AI</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" className="text-sm">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild className="rounded-full bg-gradient-primary text-primary-foreground shadow-glow h-10 px-5 text-sm font-semibold">
            <Link to={user ? "/app" : "/login"}>Open app</Link>
          </Button>
        </div>
      </header>

      {/* Hero — split layout */}
      <section className="relative z-10 max-w-6xl mx-auto px-5 pt-6 pb-20 grid lg:grid-cols-[1.05fr_1fr] gap-14 lg:gap-8 items-center">
        {/* Left column */}
        <div className="animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Student Operating System
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mt-6 leading-[0.95]">
            Chart your
            <br />
            <span className="gradient-text">whole study life</span>
            <br />
            in one orbit.
          </h1>

          <p className="text-muted-foreground mt-6 max-w-xl text-base sm:text-lg leading-relaxed">
            Study Bud AI pulls lessons, flashcards, assignments, deadlines, focus sessions,
            friends and rewards into a single glowing dashboard built around how you actually study.
          </p>

          <div className="mt-9 flex items-center gap-5 flex-wrap">
            <Button asChild className="group rounded-full bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow h-14 px-8 text-lg font-semibold">
              <Link to={user ? "/app" : "/login"}>
                Open app
                <span className="ml-3 grid place-items-center h-8 w-8 rounded-full bg-white/20 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </Link>
            </Button>
            <Link to="/login" className="text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline">
              Create a free account
            </Link>
          </div>

          <div className="mt-10 h-px bg-gradient-to-r from-white/20 via-white/10 to-transparent" />

          <div className="grid grid-cols-3 gap-6 mt-8 max-w-lg">
            <Stat value={stats.visitors} label="Visitors" />
            <Stat value={stats.focus_hours} label="Hours studied" />
            <Stat value={stats.ai_uses} label="AI lessons built" />
          </div>

          <p className="text-xs text-muted-foreground mt-8 max-w-lg">
            No email needed. Sign up with your first and last name plus a password — that name is your account.
          </p>
        </div>

        {/* Right column — orbit */}
        <div className="relative mx-auto w-full max-w-[26rem] aspect-square animate-fade-in" style={{ animationDelay: "160ms" }}>
          <div aria-hidden className="absolute inset-0 rounded-full bg-gradient-primary blur-[90px] opacity-40" />
          <div aria-hidden className="absolute inset-0 rounded-full border border-white/10 bg-white/[0.02]" />
          <div aria-hidden className="absolute inset-[12%] rounded-full border border-white/[0.08] bg-white/[0.02]" />
          <div aria-hidden className="absolute inset-[24%] rounded-full border border-white/[0.06]" />
          <img
            src={logoUrl}
            alt="Study Bud AI glowing orbit emblem"
            className="absolute inset-[26%] h-[48%] w-[48%] object-contain float drop-shadow-[0_0_70px_hsl(var(--primary)/0.7)]"
            width={420}
            height={420}
            fetchPriority="high"
          />
          {orbitChips.map((c) => (
            <div
              key={c.label}
              className={`absolute ${c.cls} glass-strong rounded-full px-3.5 py-2 text-xs flex items-center gap-2 border border-white/10 whitespace-nowrap shadow-glow`}
            >
              <c.icon className="h-3.5 w-3.5 text-primary" />
              {c.label}
            </div>
          ))}
        </div>
      </section>

      {/* Pillars */}
      <section className="relative z-10 max-w-6xl mx-auto px-5 pb-24">
        <h2 className="text-3xl sm:text-4xl font-bold text-center tracking-tight">
          Everything you need, <span className="gradient-text">in one orbit</span>
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mt-10">
          {pillars.map((p) => (
            <article
              key={p.title}
              className="group relative overflow-hidden rounded-2xl p-5 sm:p-6 border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_10px_40px_-16px_hsl(var(--primary)/0.5)] transition-all duration-300 hover:-translate-y-2 hover:border-primary/50 hover:shadow-[0_24px_60px_-18px_hsl(var(--primary)/0.85)]"
            >
              <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-60" />
              <div aria-hidden className="absolute -top-20 -right-16 h-44 w-44 rounded-full bg-primary/30 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative h-12 w-12 rounded-2xl grid place-items-center bg-gradient-primary shadow-glow ring-1 ring-white/25 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                <p.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <h3 className="font-semibold mt-4 relative text-base sm:text-lg tracking-tight">{p.title}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 relative">{p.body}</p>
            </article>
          ))}
        </div>
      </section>


      <footer className="relative z-10 text-center text-xs text-muted-foreground pb-10">
        Made by <span className="gradient-text font-semibold">Rihaan Yeswant Jain</span>
      </footer>
    </div>
  );
}
