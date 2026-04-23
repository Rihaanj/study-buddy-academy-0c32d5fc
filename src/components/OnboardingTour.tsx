import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Brain, Target, Trophy, Package, ChevronRight, Check, Gift } from "lucide-react";
import { toast } from "sonner";
import { secureRandom } from "@/lib/random";

const ONBOARDING_FLAG = "_onboarded_v1";

const STEPS = [
  {
    icon: Sparkles,
    title: "Welcome to Study Bud AI ✨",
    body: "Your cosmic Student OS — AI tutor, planner, focus timer, and rewards. Let's give you a 30-second tour so you don't get lost.",
  },
  {
    icon: Brain,
    title: "AI Tutor — your study sidekick",
    body: "Open the AI tab to get help with ANY school subject. The tutor teaches the concept, then quizzes you with 3 questions. Get them right → earn XP.",
  },
  {
    icon: Target,
    title: "Focus Mode = serious XP",
    body: "Hit the Focus tab and start a timer. Deep work earns the most XP in the app. Stay on the page — we'll know if you cheat 😉",
  },
  {
    icon: Package,
    title: "Packs & Buffs",
    body: "Level up to earn loot packs. Open them on the Packs tab to win XP buffs. Activate buffs from the Buffs tab to multiply your gains.",
  },
  {
    icon: Trophy,
    title: "Friends & Leaderboard",
    body: "Add friends in the Friends tab to chat 1-on-1. Climb the weekly leaderboard with the most XP + focus time.",
  },
  {
    icon: Gift,
    title: "Welcome gift: 3 free packs! 🎁",
    body: "We just dropped 3 mystery packs into your inventory. Head to Packs whenever you want to open them. Now go crush it.",
    cta: "Claim my packs",
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
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [granting, setGranting] = useState(false);

  useEffect(() => {
    if (!user || !profile) return;
    const visited = (profile as any).visited_tabs as string[] | undefined;
    const onboarded = visited?.includes(ONBOARDING_FLAG);
    if (!onboarded) {
      // Slight delay so the app paints first
      const t = window.setTimeout(() => setOpen(true), 600);
      return () => window.clearTimeout(t);
    }
  }, [user?.id, profile?.user_id]);

  const finish = async () => {
    if (!user || granting) return;
    setGranting(true);
    try {
      // 1. Mark onboarded
      const visited = ((profile as any)?.visited_tabs ?? []) as string[];
      const next = Array.from(new Set([...visited, ONBOARDING_FLAG]));
      await supabase.from("profiles").update({ visited_tabs: next } as any).eq("user_id", user.id);

      // 2. Grant 3 packs
      const packs = Array.from({ length: 3 }).map(() => ({
        user_id: user.id,
        item_type: "pack",
        item_key: "buff_pack",
        rarity: rollRarity(),
        metadata: { opened: false, source: "onboarding_gift" },
      }));
      const { error } = await supabase.from("inventory").insert(packs as any);
      if (error) throw error;

      toast.success("🎁 3 mystery packs added to your inventory!");
      setOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e?.message || "Could not grant packs. Try again later.");
    } finally {
      setGranting(false);
    }
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else finish();
  };

  const skip = async () => {
    // Still grant packs even if skipped — first-day delight matters
    await finish();
  };

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !granting) skip(); }}>
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
          {/* Progress dots */}
          <div className="flex justify-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-6 bg-primary" : i < step ? "w-1.5 bg-primary/60" : "w-1.5 bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>

          <h2 className="text-2xl font-bold gradient-text text-center leading-tight">{current.title}</h2>
          <p className="text-sm text-muted-foreground text-center leading-relaxed">{current.body}</p>

          <div className="flex items-center gap-2 pt-2">
            {!isLast && (
              <Button variant="ghost" onClick={skip} className="flex-1" disabled={granting}>
                Skip tour
              </Button>
            )}
            <Button
              onClick={next}
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
            Step {step + 1} of {STEPS.length} · Press Esc anytime to skip
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
