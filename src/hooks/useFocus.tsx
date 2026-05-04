import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { awardXp, getActiveXpMultiplier } from "@/lib/gamification";
import { checkFocusBadges } from "@/lib/badges";
import { toast } from "sonner";

type FocusCtx = {
  running: boolean;
  remaining: number; // seconds
  duration: number; // seconds
  start: (minutes: number) => void;
  stop: (completed?: boolean) => Promise<void>;
};

const Ctx = createContext<FocusCtx | undefined>(undefined);

/**
 * Focus provider — timer only, NO integrity tracking.
 * Users can switch tabs freely (they need to for studying).
 * XP = minutes × 2, applied at session end.
 */
export const FocusProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [duration, setDuration] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const endAtRef = useRef<number | null>(null); // wall-clock ms when timer ends

  const stop = useCallback(async (completed = false) => {
    setRunning(false);
    if (intervalRef.current) { window.clearInterval(intervalRef.current); intervalRef.current = null; }
    endAtRef.current = null;
    const elapsedSec = duration - remaining;
    const minutes = Math.max(1, Math.round(elapsedSec / 60));
    if (!user) { setDuration(0); setRemaining(0); return; }
    // Clear in-flight focus marker
    await supabase.from("profiles").update({ current_focus_started_at: null } as any).eq("user_id", user.id);
    if (completed || elapsedSec >= 60) {
      const baseXp = minutes * 2;
      const buffMult = await getActiveXpMultiplier(user.id);
      const xp = Math.round(baseXp * buffMult);
      await supabase.from("focus_sessions").insert({
        user_id: user.id, duration_minutes: minutes, integrity_score: 100, xp_earned: xp,
      });
      const { data: p } = await supabase.from("profiles").select("focus_streak").eq("user_id", user.id).maybeSingle();
      await supabase.from("profiles").update({ focus_streak: (p?.focus_streak ?? 0) + 1 }).eq("user_id", user.id);
      await awardXp(user.id, xp);
      await checkFocusBadges(user.id, minutes, 100);
      toast.success(`+${xp} XP earned 🚀`, { description: `${minutes}m focus session` });
    }
    setDuration(0); setRemaining(0);
  }, [duration, remaining, user]);

  const start = useCallback((minutes: number) => {
    const sec = minutes * 60;
    setDuration(sec); setRemaining(sec); setRunning(true);
    // Mark in-flight focus so buff cooldown counts in real time
    if (user) {
      supabase.from("profiles").update({ current_focus_started_at: new Date().toISOString() } as any).eq("user_id", user.id);
    }
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { window.clearInterval(intervalRef.current!); intervalRef.current = null; setRunning(false); stop(true); return 0; }
        return r - 1;
      });
    }, 1000);
  }, [stop, user]);

  return (
    <Ctx.Provider value={{ running, remaining, duration, start, stop }}>
      {children}
    </Ctx.Provider>
  );
};

export const useFocus = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFocus needs FocusProvider");
  return v;
};
