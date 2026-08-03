import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Sparkles, Brain, Target, Trophy, Package, ChevronRight, ChevronLeft, Check, Gift,
  Home, ListChecks, Calendar, MessageCircle, Users, Zap, User, HelpCircle, Rocket,
} from "lucide-react";
import { toast } from "sonner";
import { secureRandom } from "@/lib/random";

const ONBOARDING_FLAG = "_onboarded_v2";
const SKIP_FLAG = "_onboarding_skip_v2"; // session-only

type Step = {
  icon: any;
  emoji: string;
  title: string;
  body: string;
  hype?: string;       // little chip above the title
  route?: string;
  cta?: string;
};

const STEPS: Step[] = [
  {
    icon: Rocket, emoji: "🚀",
    hype: "Mission start",
    title: "Welcome aboard, future Cosmic Genius!",
    body: "You just unlocked the most fun way to study. Take a 60-second cosmic tour and we'll drop 3 mystery packs in your inventory at the end. Ready to fly?",
    route: "/",
    cta: "Let's go!",
  },
  {
    icon: Home, emoji: "🏠",
    hype: "Stop #1 — Home",
    title: "Your launchpad",
    body: "This is mission control. Today's tasks, your streak, weekly XP, quick shortcuts — all here. Whenever you're lost, this is home base.",
    route: "/",
  },
  {
    icon: ListChecks, emoji: "📋",
    hype: "Stop #2 — Planner",
    title: "Plan smart, not hard",
    body: "Add assignments. Set difficulty + how much it's worth + your confidence. Smart Priority sorts them so you know EXACTLY what to do first. Finishing tasks = XP. 💪",
    route: "/planner",
  },
  {
    icon: Calendar, emoji: "📅",
    hype: "Stop #3 — Calendar",
    title: "See the future",
    body: "Every deadline and study session in one calendar. Click a day to add events. Check this before bed and never get blindsided again.",
    route: "/calendar",
  },
  {
    icon: Target, emoji: "🎯",
    hype: "Stop #4 — Focus",
    title: "Where champions are made",
    body: "Pomodoro timer = the BIGGEST XP source in the whole app. Stay on the page (we'll know if you cheat 😉). Try a 25-min sprint right after this tour.",
    route: "/focus",
  },
  {
    icon: Brain, emoji: "🧠",
    hype: "Stop #5 — AI Tutor",
    title: "Your study sidekick",
    body: "Ask anything school-related. The tutor TEACHES you (no answer-dumping — that's cheating), then quizzes you with 3 questions. Ace them = bonus XP. Voice Lab + Image Decoder live here too.",
    route: "/ai",
  },
  {
    icon: MessageCircle, emoji: "💬",
    hype: "Stop #6 — Chat",
    title: "Study with friends",
    body: "Group chats + 1-on-1 DMs. Send images, stickers, meet links. Group AI can answer for the whole crew at once. Way better than a study group on a Tuesday night.",
    route: "/chat",
  },
  {
    icon: Users, emoji: "🤝",
    hype: "Stop #7 — Friends",
    title: "Build your crew",
    body: "Add friends by their first and last name. Once they accept, you can DM, see their stats, and battle on the weekly leaderboard.",
    route: "/friends",
  },
  {
    icon: Trophy, emoji: "🏆",
    hype: "Stop #8 — Leaderboard",
    title: "Climb the ranks",
    body: "Resets every Monday. We measure XP gained + focus minutes THIS WEEK only — fresh start for everyone. Top 3 win bonus packs each week.",
    route: "/leaderboard",
  },
  {
    icon: Package, emoji: "📦",
    hype: "Stop #9 — Packs",
    title: "Loot incoming",
    body: "Earn packs from level-ups, daily streaks, and weekly rankings. Spin the rainbow wheel: Common → Rare → Epic → Legendary → Mythic. Higher rarity = stronger buff.",
    route: "/packs",
  },
  {
    icon: Zap, emoji: "⚡",
    hype: "Stop #10 — Buffs",
    title: "Multiply your XP",
    body: "Activate buffs from your inventory to multiply gains. Fair play: 10-min focus required between activations and a daily cap so it stays competitive.",
    route: "/buffs",
  },
  {
    icon: User, emoji: "🌌",
    hype: "Stop #11 — Profile",
    title: "Flex your stats",
    body: "Avatar, mastery heatmap by subject, every badge you've unlocked, customization. Evolve: Student → Scholar → Mastermind → Cosmic Genius 🌌.",
    route: "/profile",
  },
  {
    icon: HelpCircle, emoji: "💡",
    hype: "Stop #12 — Help",
    title: "Never stuck for long",
    body: "FAQ, tips, and you can replay this tour anytime. Hover any sidebar tab to see what it does. Stuck? Help has your back.",
    route: "/help",
  },
  {
    icon: Gift, emoji: "🎁",
    hype: "Tour complete!",
    title: "Here are your 3 free packs!",
    body: "We're dropping 3 mystery packs into your inventory right now. Spin the wheel on the Packs tab whenever you're ready. Now go become a Cosmic Genius. 🌟",
    cta: "Claim my 3 packs",
    route: "/packs",
  },
];

function rollRarity(): "common" | "rare" | "epic" | "legendary" | "mythic" {
  const r = secureRandom();
  if (r < 0.02) return "mythic";
  if (r < 0.07) return "legendary";
  if (r < 0.20) return "epic";
  if (r < 0.50) return "rare";
  return "common";
}

export const OnboardingTour = () => {
  const { user } = useAuth();
  const { profile, reload } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [granting, setGranting] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  // Detect first-time user
  useEffect(() => {
    if (!user || !profile) return;
    if (sessionStorage.getItem(SKIP_FLAG)) return;
    const visited = (profile as any).visited_tabs as string[] | undefined;
    const onboarded = visited?.includes(ONBOARDING_FLAG);
    if (!onboarded) {
      const t = window.setTimeout(() => setOpen(true), 600);
      return () => window.clearTimeout(t);
    }
  }, [user?.id, profile?.user_id]);

  const current = useMemo(() => STEPS[step], [step]);
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  // Navigate when step changes + retrigger entry animation
  useEffect(() => {
    if (!open) return;
    setAnimKey((k) => k + 1);
    if (current.route && location.pathname !== current.route) {
      navigate(current.route);
    }
  }, [step, open]);

  const grantPacks = async () => {
    if (!user) return;
    const packs = Array.from({ length: 3 }).map(() => ({
      user_id: user.id,
      item_type: "pack",
      item_key: "buff_pack",
      rarity: rollRarity(),
      metadata: { opened: false, source: "onboarding_gift" },
    }));
    const { error } = await supabase.from("inventory").insert(packs as any);
    if (error) throw error;
  };

  const markComplete = async () => {
    if (!user) return;
    const visited = ((profile as any)?.visited_tabs ?? []) as string[];
    const next = Array.from(new Set([...visited, ONBOARDING_FLAG, "_onboarded_v1"]));
    await supabase.from("profiles").update({ visited_tabs: next } as any).eq("user_id", user.id);
  };

  const finish = async () => {
    if (!user || granting) return;
    setGranting(true);
    try {
      await markComplete();
      await grantPacks();
      toast.success("🎁 3 mystery packs added to your inventory!", {
        description: "Spin the wheel on the Packs tab to reveal your loot.",
      });
      setOpen(false);
      setStep(0);
      reload();
    } catch (e: any) {
      toast.error(e?.message || "Could not grant packs. Try again later.");
    } finally {
      setGranting(false);
    }
  };

  const handleNext = () => {
    if (isLast) finish();
    else setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };
  const handleBack = () => setStep((s) => Math.max(0, s - 1));
  const handleSkip = async () => {
    sessionStorage.setItem(SKIP_FLAG, "1");
    await finish();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !granting) handleSkip(); }}>
      <DialogContent className="glass-strong max-w-md p-0 overflow-hidden border-0">
        {/* Animated cosmic header band */}
        <div className="relative h-36 bg-gradient-primary grid place-items-center overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,hsl(var(--accent)/0.5),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,hsl(var(--primary)/0.6),transparent_60%)] animate-pulse" />
          {/* Drifting sparkles */}
          {Array.from({ length: 8 }).map((_, i) => (
            <span
              key={`${animKey}-${i}`}
              className="absolute h-1 w-1 rounded-full bg-white/80 animate-pulse"
              style={{
                left: `${(i * 13 + 7) % 100}%`,
                top: `${(i * 23 + 11) % 100}%`,
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
          <div
            key={animKey}
            className="relative h-24 w-24 rounded-3xl bg-background/20 backdrop-blur-md ring-2 ring-white/30 grid place-items-center shadow-glow animate-scale-in"
          >
            <span className="text-5xl">{current.emoji}</span>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Hype chip + progress */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
              {current.hype ?? `Step ${step + 1}`}
            </span>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {step + 1} / {STEPS.length}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-primary transition-all duration-500"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>

          <div key={`text-${animKey}`} className="space-y-2 animate-fade-in">
            <h2 className="text-2xl font-bold gradient-text text-center leading-tight flex items-center justify-center gap-2">
              <Icon className="h-5 w-5 text-primary shrink-0" />
              {current.title}
            </h2>
            <p className="text-sm text-foreground/85 text-center leading-relaxed">{current.body}</p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            {!isFirst && !isLast && (
              <Button variant="ghost" size="icon" onClick={handleBack} disabled={granting} aria-label="Back">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            {!isLast && (
              <Button variant="ghost" onClick={handleSkip} className="flex-1" disabled={granting}>
                Skip · grab packs
              </Button>
            )}
            <Button
              onClick={handleNext}
              disabled={granting}
              className={`bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90 ${isLast ? "w-full h-12 text-base" : "flex-1"}`}
            >
              {granting ? (
                <span className="flex items-center gap-2"><Sparkles className="h-4 w-4 animate-spin" /> Granting…</span>
              ) : isLast ? (
                <span className="flex items-center gap-2"><Check className="h-4 w-4" /> {current.cta}</span>
              ) : (
                <span className="flex items-center gap-2">
                  {current.cta ?? "Next"} <ChevronRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </div>

          <p className="text-[10px] text-center text-muted-foreground">
            Press Esc anytime — your 3 packs are guaranteed. 🎁
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
