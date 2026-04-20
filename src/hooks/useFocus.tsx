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
  integrity: number;
  start: (minutes: number) => void;
  stop: (completed?: boolean) => Promise<void>;
};

const Ctx = createContext<FocusCtx | undefined>(undefined);

export const FocusProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [duration, setDuration] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const [integrity, setIntegrity] = useState(100);
  const intervalRef = useRef<number | null>(null);
  const blurCountRef = useRef(0);

  const stop = useCallback(async (completed = false) => {
    setRunning(false);
    if (intervalRef.current) { window.clearInterval(intervalRef.current); intervalRef.current = null; }
    const elapsedSec = duration - remaining;
    const minutes = Math.max(1, Math.round(elapsedSec / 60));
    if (!user) { setDuration(0); setRemaining(0); setIntegrity(100); blurCountRef.current = 0; return; }
    if (completed || elapsedSec >= 60) {
      const baseXp = minutes * 2;
      const integrityBonus = integrity >= 90 ? 0.5 : 0;
      const buffMult = await getActiveXpMultiplier(user.id);
      const xp = Math.round(baseXp * (1 + integrityBonus) * buffMult);
      await supabase.from("focus_sessions").insert({
        user_id: user.id, duration_minutes: minutes, integrity_score: integrity, xp_earned: xp,
      });
      const { data: p } = await supabase.from("profiles").select("focus_streak").eq("user_id", user.id).maybeSingle();
      await supabase.from("profiles").update({ focus_streak: (p?.focus_streak ?? 0) + 1 }).eq("user_id", user.id);
      await awardXp(user.id, xp);
      await checkFocusBadges(user.id, minutes, integrity);
      toast.success(`+${xp} XP earned 🚀`, { description: `Focus integrity ${integrity}%` });
    }
    setDuration(0); setRemaining(0); setIntegrity(100); blurCountRef.current = 0;
  }, [duration, remaining, integrity, user]);

  const start = useCallback((minutes: number) => {
    const sec = minutes * 60;
    setDuration(sec); setRemaining(sec); setIntegrity(100); blurCountRef.current = 0; setRunning(true);
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { window.clearInterval(intervalRef.current!); intervalRef.current = null; setRunning(false); stop(true); return 0; }
        return r - 1;
      });
    }, 1000);
  }, [stop]);

  // If hidden < 60s = real tab switch (penalize). If >= 60s = phone lock (no penalty).
  const hiddenAtRef = useRef<number | null>(null);
  useEffect(() => {
    const onVis = () => {
      if (!running) return;
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
      } else if (hiddenAtRef.current) {
        const awayMs = Date.now() - hiddenAtRef.current;
        hiddenAtRef.current = null;
        if (awayMs < 60_000) {
          blurCountRef.current += 1;
          setIntegrity((i) => Math.max(0, i - 15));
        }
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [running]);

  return (
    <Ctx.Provider value={{ running, remaining, duration, integrity, start, stop }}>
      {children}
    </Ctx.Provider>
  );
};

export const useFocus = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFocus needs FocusProvider");
  return v;
};
