import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Sparkles, Brain, Target, Trophy, Package, ChevronRight, ChevronLeft, Check, Gift,
  Home, ListChecks, Calendar, MessageCircle, Users, Zap, User, HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { secureRandom } from "@/lib/random";

const ONBOARDING_FLAG = "_onboarded_v2";
const SKIP_FLAG = "_onboarding_skip_v2"; // session-only "skip the rest"

type Step = {
  icon: any;
  title: string;
  body: string;
  route?: string;       // navigate before showing
  cta?: string;
};

const STEPS: Step[] = [
  {
    icon: Sparkles,
    title: "Welcome to Study Bud AI ✨",
    body: "Your cosmic Student OS — AI tutor, planner, focus timer, packs, buffs, friends, and more. Take a 60-second guided tour and we'll drop 3 free packs in your inventory at the end.",
    route: "/",
  },
  {
    icon: Home,
    title: "Home — your launchpad",
    body: "Your dashboard. See today's tasks, current streak, weekly XP gains, and quick shortcuts. Always come back here to get oriented.",
    route: "/",
  },
  {
    icon: ListChecks,
    title: "Planner — your task brain",
    body: "Add assignments and tasks. Set difficulty + grade weight + your confidence — Smart Priority sorts them so you always know what to tackle first. Completing tasks earns XP.",
    route: "/planner",
  },
  {
    icon: Calendar,
    title: "Calendar — see the week ahead",
    body: "All your due dates and study sessions in one calendar view. Click a day to add events. Avoid surprises by checking this before bed.",
    route: "/calendar",
  },
  {
    icon: Target,
    title: "Focus — where champions are made 🎯",
    body: "Pomodoro-style focus timer. THIS earns the most XP in the app. Stay on the page — we detect tab-switches and pauses. 25-min sessions = sweet spot.",
    route: "/focus",
  },
  {
    icon: Brain,
    title: "AI Tutor — your study sidekick 🧠",
    body: "Ask anything school-related. The tutor TEACHES the concept (no direct answers — that'd be cheating), then quizzes you with 3 questions. Get them right → earn bonus XP. Try Voice Lab and Image Decoder too!",
    route: "/ai",
  },
  {
    icon: MessageCircle,
    title: "Chat — study together",
    body: "Group chats and 1-on-1 DMs with friends. Send images, stickers, meet links. Group AI can answer questions for the whole crew.",
    route: "/chat",
  },
  {
    icon: Users,
    title: "Friends — build your crew",
    body: "Send friend requests by email or username. Once accepted you can DM, see their stats, and compete on the weekly leaderboard.",
    route: "/friends",
  },
  {
    icon: Trophy,
    title: "Leaderboard — climb the ranks 🏆",
    body: "Weekly rankings reset every Monday. We measure XP gained + focus minutes THIS WEEK only — fair for newcomers. Top 3 win bonus packs.",
    route: "/leaderboard",
  },
  {
    icon: Package,
    title: "Packs — open mystery loot 🎁",
    body: "Earn packs by leveling up, daily streaks, and ranking. Spin the rainbow wheel to reveal Common → Mythic rarity. Higher rarity = stronger buffs.",
    route: "/packs",
  },
  {
    icon: Zap,
    title: "Buffs — multiply your gains ⚡",
    body: "Activate buffs from your inventory to multiply XP. Fair-play rules: 10-min focus required between activations, daily cap to keep it competitive.",
    route: "/buffs",
  },
  {
    icon: User,
    title: "Profile — flex your stats",
    body: "Avatar, mastery heatmap by subject, all badges you've unlocked, and customization. Evolve from Student → Scholar → Mastermind → Cosmic Genius 🌌.",
    route: "/profile",
  },
  {
    icon: HelpCircle,
    title: "Help — never get stuck",
    body: "FAQ, tips, and you can replay this tour anytime. Hover over any sidebar tab to see what it does.",
    route: "/help",
  },
  {
    icon: Gift,
    title: "Welcome gift: 3 free packs! 🎁",
    body: "We're dropping 3 mystery packs into your inventory right now. Head to Packs anytime to spin and reveal your loot. Now go crush it. 🚀",
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

  // Navigate to the step's route when it changes
  useEffect(() => {
    if (!open) return;
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
    // Mark as onboarded + grant packs (we don't punish skippers — first-day delight matters)
    sessionStorage.setItem(SKIP_FLAG, "1");
    await finish();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !granting) handleSkip(); }}>
      <DialogContent className="glass-strong max-w-md p-0 overflow-hidden border-0">
        {/* Animated header band */}
        <div className="relative h-32 bg-gradient-primary grid place-items-center overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,hsl(var(--accent)/0.4),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,hsl(var(--primary)/0.5),transparent_60%)] animate-pulse" />
          <div className="relative h-20 w-20 rounded-3xl bg-background/20 backdrop-blur-md ring-2 ring-white/30 grid place-items-center shadow-glow">
            <Icon className="h-10 w-10 text-primary-foreground" />
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Step {step + 1} of {STEPS.length}</span>
              <span>{Math.round(((step + 1) / STEPS.length) * 100)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-primary transition-all duration-500"
                style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              />
            </div>
          </div>

          <h2 className="text-2xl font-bold gradient-text text-center leading-tight">{current.title}</h2>
          <p className="text-sm text-muted-foreground text-center leading-relaxed">{current.body}</p>

          <div className="flex items-center gap-2 pt-2">
            {step > 0 && !isLast && (
              <Button variant="ghost" size="icon" onClick={handleBack} disabled={granting} aria-label="Back">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            {!isLast && (
              <Button variant="ghost" onClick={handleSkip} className="flex-1" disabled={granting}>
                Skip tour
              </Button>
            )}
            <Button
              onClick={handleNext}
              disabled={granting}
              className={`bg-gradient-primary text-primary-foreground shadow-glow ${isLast ? "w-full h-12 text-base" : "flex-1"}`}
            >
              {granting ? (
                <span className="flex items-center gap-2"><Sparkles className="h-4 w-4 animate-spin" /> Granting…</span>
              ) : isLast ? (
                <span className="flex items-center gap-2"><Check className="h-4 w-4" /> {current.cta}</span>
              ) : (
                <span className="flex items-center gap-2">Next <ChevronRight className="h-4 w-4" /></span>
              )}
            </Button>
          </div>

          <p className="text-[10px] text-center text-muted-foreground">
            Press Esc anytime to skip — you'll still get your 3 packs.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
