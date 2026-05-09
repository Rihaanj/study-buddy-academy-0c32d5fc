import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { awardXp, getActiveXpMultiplier } from "@/lib/gamification";
import { rollRarity } from "@/lib/streakPacks";
import { toast } from "sonner";

type FocusCtx = {
  running: boolean;
  /** seconds elapsed since session start (count-up). */
  elapsed: number;
  /** Convenience aliases kept for any older callers. */
  remaining: number;
  duration: number;
  start: (_minutes?: number) => void;
  stop: (completed?: boolean) => Promise<void>;
};

const Ctx = createContext<FocusCtx | undefined>(undefined);

const KEY_START = "focus-start-at";
const KEY_PACK_LAST = "focus-pack-last-min";
const PACK_INTERVAL_MIN = 5;

/**
 * Online-time count-up timer.
 * - Auto-starts on first mount per session and persists across reloads via localStorage.
 * - Awards a pack every 5 minutes of online time.
 * - Awards XP at stop based on elapsed minutes (2 XP/min × buff multiplier).
 */
export const FocusProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const startAtRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const lastPackMinRef = useRef<number>(0);
  const grantingRef = useRef(false);

  const grantPackIfDue = useCallback(async (mins: number) => {
    if (!user) return;
    if (mins <= 0) return;
    const due = Math.floor(mins / PACK_INTERVAL_MIN);
    if (due <= lastPackMinRef.current) return;
    if (grantingRef.current) return;
    grantingRef.current = true;
    try {
      const newMilestones = due - lastPackMinRef.current;
      const rows = Array.from({ length: newMilestones }, () => ({
        user_id: user.id,
        item_type: "pack",
        item_key: "buff_pack",
        rarity: rollRarity(),
        metadata: { opened: false, source: "online_timer" } as any,
      }));
      const { error } = await supabase.from("inventory").insert(rows as any);
      if (!error) {
        lastPackMinRef.current = due;
        localStorage.setItem(KEY_PACK_LAST, String(due));
        toast.success(newMilestones === 1 ? "+1 Pack 🎁" : `+${newMilestones} Packs 🎁`, {
          description: `Earned for staying focused ${due * PACK_INTERVAL_MIN} minutes.`,
        });
      }
    } finally {
      grantingRef.current = false;
    }
  }, [user]);

  const tick = useCallback(() => {
    const start = startAtRef.current;
    if (start == null) return;
    const e = Math.max(0, Math.floor((Date.now() - start) / 1000));
    setElapsed(e);
    grantPackIfDue(Math.floor(e / 60));
  }, [grantPackIfDue]);

  const start = useCallback((_mins?: number) => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    const startAt = Date.now();
    startAtRef.current = startAt;
    localStorage.setItem(KEY_START, String(startAt));
    localStorage.setItem(KEY_PACK_LAST, "0");
    lastPackMinRef.current = 0;
    setElapsed(0);
    setRunning(true);
    intervalRef.current = window.setInterval(tick, 1000);
  }, [tick]);

  const stop = useCallback(async (completed = false) => {
    if (intervalRef.current) { window.clearInterval(intervalRef.current); intervalRef.current = null; }
    const start = startAtRef.current;
    const totalSec = start ? Math.floor((Date.now() - start) / 1000) : elapsed;
    const minutes = Math.max(0, Math.round(totalSec / 60));
    startAtRef.current = null;
    localStorage.removeItem(KEY_START);
    localStorage.removeItem(KEY_PACK_LAST);
    lastPackMinRef.current = 0;
    setRunning(false);
    setElapsed(0);
    if (!user || minutes < 1) return;
    const baseXp = minutes * 2;
    const mult = await getActiveXpMultiplier(user.id);
    const xp = Math.round(baseXp * mult);
    await supabase.from("focus_sessions").insert({
      user_id: user.id, duration_minutes: minutes, integrity_score: 100, xp_earned: xp,
    });
    await awardXp(user.id, xp);
    toast.success(`+${xp} XP`, { description: `${minutes}m online` });
  }, [elapsed, user]);

  // Resume across reloads + auto-start on first launch
  useEffect(() => {
    const stored = localStorage.getItem(KEY_START);
    const lastPack = Number(localStorage.getItem(KEY_PACK_LAST) ?? "0");
    if (stored) {
      const startAt = Number(stored);
      if (!Number.isNaN(startAt)) {
        startAtRef.current = startAt;
        lastPackMinRef.current = lastPack;
        setRunning(true);
        if (intervalRef.current) window.clearInterval(intervalRef.current);
        intervalRef.current = window.setInterval(tick, 1000);
        tick();
        return;
      }
    }
    // auto-start fresh
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-bind grant when user becomes available
  useEffect(() => {
    if (user && running) {
      grantPackIfDue(Math.floor(elapsed / 60));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <Ctx.Provider value={{ running, elapsed, remaining: 0, duration: 0, start, stop }}>
      {children}
    </Ctx.Provider>
  );
};

export const useFocus = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFocus needs FocusProvider");
  return v;
};
