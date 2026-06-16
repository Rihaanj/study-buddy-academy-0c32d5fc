import { createContext, ReactNode, useCallback, useContext, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { awardXp, getActiveXpMultiplier } from "@/lib/gamification";
import { checkFocusBadges } from "@/lib/badges";
import { toast } from "sonner";

type FocusCtx = {
  running: boolean;
  remaining: number;
  duration: number;
  start: (minutes: number) => void;
  stop: (completed?: boolean) => Promise<void>;
};

const Ctx = createContext<FocusCtx | undefined>(undefined);

/**
 * Focus timer — XP = 2 × elapsed minutes × buff multiplier.
 * Elapsed is measured from wall-clock refs so the value is correct
 * whether the user stops early OR the timer auto-completes from
 * an interval closure.
 */
export const FocusProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [duration, setDuration] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const endAtRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const durationRef = useRef<number>(0);
  const userRef = useRef(user);
  userRef.current = user;

  const stop = useCallback(async (completed = false) => {
    setRunning(false);
    if (intervalRef.current) { window.clearInterval(intervalRef.current); intervalRef.current = null; }

    const startedAt = startedAtRef.current;
    const totalSec = durationRef.current;
    endAtRef.current = null;
    startedAtRef.current = null;
    durationRef.current = 0;

    // Compute elapsed from wall clock — accurate even when stop() is called
    // from a stale closure inside setInterval at completion time.
    let elapsedSec = 0;
    if (startedAt != null) {
      elapsedSec = Math.round((Date.now() - startedAt) / 1000);
    }
    if (completed && totalSec > 0) elapsedSec = totalSec;
    elapsedSec = Math.max(0, Math.min(totalSec || elapsedSec, elapsedSec));

    const u = userRef.current;
    if (!u) { setDuration(0); setRemaining(0); return; }

    await supabase.from("profiles").update({ current_focus_started_at: null } as any).eq("user_id", u.id);

    if (elapsedSec >= 60 || (completed && elapsedSec > 0)) {
      const minutes = Math.max(1, Math.round(elapsedSec / 60));
      const baseXp = minutes * 2;
      const buffMult = await getActiveXpMultiplier(u.id);
      const xp = Math.round(baseXp * buffMult);
      await supabase.from("focus_sessions").insert({
        user_id: u.id, duration_minutes: minutes, integrity_score: 100, xp_earned: xp,
      });
      const { data: p } = await supabase.from("profiles").select("focus_streak").eq("user_id", u.id).maybeSingle();
      await supabase.from("profiles").update({ focus_streak: (p?.focus_streak ?? 0) + 1 }).eq("user_id", u.id);
      await awardXp(u.id, xp);
      await checkFocusBadges(u.id, minutes, 100);
      toast.success(`+${xp} XP earned 🚀`, { description: `${minutes}m focus session` });
    }
    setDuration(0); setRemaining(0);
  }, []);

  const start = useCallback((minutes: number) => {
    const sec = Math.max(1, Math.floor(minutes)) * 60;
    setDuration(sec); setRemaining(sec); setRunning(true);
    const now = Date.now();
    endAtRef.current = now + sec * 1000;
    startedAtRef.current = now;
    durationRef.current = sec;

    const u = userRef.current;
    if (u) {
      supabase.from("profiles").update({ current_focus_started_at: new Date().toISOString() } as any).eq("user_id", u.id);
    }
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(() => {
      const end = endAtRef.current;
      if (end == null) return;
      const left = Math.max(0, Math.round((end - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        window.clearInterval(intervalRef.current!);
        intervalRef.current = null;
        stop(true);
      }
    }, 250);
  }, [stop]);

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
