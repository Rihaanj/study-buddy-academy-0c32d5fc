import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Clock, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import { awardXp } from "@/lib/gamification";

type InvBuff = {
  id: string;
  item_key: string;
  rarity: string;
  metadata: {
    label?: string;
    description?: string;
    emoji?: string;
    multiplier?: number;
    durationMin?: number;
    category?: string;
    instant?: boolean;
    xpAmount?: number;
  };
};

type ActiveBuff = {
  id: string;
  buff_key: string;
  rarity: string;
  multiplier: number;
  category: string;
  expires_at: string | null;
  activated_at: string;
};

const rarityText: Record<string, string> = {
  common: "text-slate-200",
  rare: "text-primary",
  epic: "text-accent",
  legendary: "text-warning",
  mythic: "text-fuchsia-300",
};

const rarityRing: Record<string, string> = {
  common: "ring-white/10",
  rare: "ring-primary/40",
  epic: "ring-accent/50",
  legendary: "ring-warning/60",
  mythic: "ring-fuchsia-400/70",
};

function timeLeft(expires_at: string | null) {
  if (!expires_at) return "Permanent";
  const ms = new Date(expires_at).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
}

function prettyKey(k: string) {
  return k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Buffs() {
  const { user } = useAuth();
  const [inventory, setInventory] = useState<InvBuff[]>([]);
  const [active, setActive] = useState<ActiveBuff[]>([]);
  const [, setTick] = useState(0);

  const load = async () => {
    if (!user) return;
    const [{ data: inv }, { data: ab }] = await Promise.all([
      supabase.from("inventory").select("*").eq("user_id", user.id).eq("item_type", "buff").order("acquired_at", { ascending: false }),
      supabase.from("active_buffs").select("*").eq("user_id", user.id).order("activated_at", { ascending: false }),
    ]);
    setInventory((inv ?? []) as any);
    setActive((ab ?? []) as any);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel(`buffs-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory", filter: `user_id=eq.${user.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "active_buffs", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    const t = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => { supabase.removeChannel(ch); window.clearInterval(t); };
  }, [user?.id]);

  // Auto-cleanup expired buffs
  useEffect(() => {
    const expired = active.filter((b) => b.expires_at && new Date(b.expires_at).getTime() <= Date.now());
    if (expired.length === 0) return;
    (async () => {
      for (const b of expired) {
        await supabase.from("active_buffs").delete().eq("id", b.id);
      }
    })();
  }, [active]);

  const COOLDOWN_MS = 30_000;
  const COOLDOWN_KEY = "sba_buff_last_activate_v1";
  const getLastActivate = () => Number(localStorage.getItem(COOLDOWN_KEY) || 0);
  const setLastActivate = (t: number) => localStorage.setItem(COOLDOWN_KEY, String(t));

  const activate = async (b: InvBuff) => {
    if (!user) return;
    const m = b.metadata ?? {};
    // 30-second cooldown between any two buff activations (anti-spam, prevents +25 farming)
    const last = getLastActivate();
    const remainingMs = last + COOLDOWN_MS - Date.now();
    if (remainingMs > 0) {
      toast.error(`Wait ${Math.ceil(remainingMs / 1000)}s before activating another buff.`);
      return;
    }
    // Instant consumable: directly grant XP
    if (m.instant && m.xpAmount) {
      await awardXp(user.id, m.xpAmount);
      await supabase.from("inventory").delete().eq("id", b.id);
      setLastActivate(Date.now());
      toast.success(`+${m.xpAmount} XP instantly! ⚡`);
      return;
    }
    // Time Warp: extend all active buff expirations by 50%
    if (b.item_key === "time_warp") {
      const now = Date.now();
      for (const ab of active) {
        if (!ab.expires_at) continue;
        const remaining = new Date(ab.expires_at).getTime() - now;
        if (remaining <= 0) continue;
        const extended = new Date(now + remaining * 1.5).toISOString();
        await supabase.from("active_buffs").update({ expires_at: extended }).eq("id", ab.id);
      }
      await supabase.from("inventory").delete().eq("id", b.id);
      setLastActivate(Date.now());
      toast.success("Time Warp: active buffs extended ⏳");
      return;
    }
    // Cap of 3 active buffs (re-fetch to avoid stale-state bypass)
    const { data: live } = await supabase
      .from("active_buffs")
      .select("id, expires_at")
      .eq("user_id", user.id);
    const liveActive = (live ?? []).filter((ab: any) => !ab.expires_at || new Date(ab.expires_at).getTime() > Date.now());
    if (liveActive.length >= 3) {
      toast.error("Max 3 active buffs. Wait for one to expire.");
      return;
    }
    const expires_at = m.durationMin ? new Date(Date.now() + m.durationMin * 60_000).toISOString() : null;
    const { error } = await supabase.from("active_buffs").insert({
      user_id: user.id,
      buff_key: b.item_key,
      rarity: b.rarity,
      multiplier: m.multiplier ?? 1,
      category: m.category ?? "xp",
      expires_at,
    });
    if (error) { toast.error(error.message); return; }
    await supabase.from("inventory").delete().eq("id", b.id);
    setLastActivate(Date.now());
    toast.success(`Buff active: ${m.label ?? prettyKey(b.item_key)} 🚀`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold gradient-text flex items-center gap-2"><Sparkles className="h-6 w-6" /> Buffs</h1>
        <p className="text-muted-foreground text-sm">Activate buffs to multiply XP. Max 3 active · 30-second cooldown between activations.</p>
      </div>

      <section>
        <h2 className="font-semibold mb-3">Active ({active.length}/3)</h2>
        {active.length === 0 ? (
          <div className="glass p-6 text-center text-muted-foreground text-sm">No active buffs. Activate one from your inventory below.</div>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {active.map((b) => (
              <div key={b.id} className={`glass-strong p-4 rounded-xl ring-1 ${rarityRing[b.rarity] ?? "ring-white/10"}`}>
                <div className={`text-[10px] uppercase tracking-wider font-semibold ${rarityText[b.rarity] ?? "text-foreground"}`}>{b.rarity}</div>
                <div className="text-sm font-medium mt-1">{prettyKey(b.buff_key)}</div>
                <div className="text-2xl font-bold gradient-text mt-1">×{Number(b.multiplier).toFixed(2)}</div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                  <Clock className="h-3 w-3" /> {timeLeft(b.expires_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-3">Inventory ({inventory.length})</h2>
        {inventory.length === 0 ? (
          <div className="glass p-8 text-center text-muted-foreground">No buffs yet. Open a pack from the Packs tab.</div>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {inventory.map((b) => {
              const m = b.metadata ?? {};
              return (
                <div key={b.id} className={`glass p-4 rounded-xl flex flex-col ring-1 ${rarityRing[b.rarity] ?? "ring-white/10"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className={`text-[10px] uppercase tracking-wider font-semibold ${rarityText[b.rarity] ?? "text-foreground"}`}>{b.rarity}</div>
                    {m.emoji && <div className="text-lg leading-none">{m.emoji}</div>}
                  </div>
                  <div className="text-sm font-semibold mt-1">{m.label ?? prettyKey(b.item_key)}</div>
                  {m.description && <div className="text-xs text-muted-foreground mt-1">{m.description}</div>}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2 mb-3">
                    <Zap className="h-3 w-3" /> {m.instant ? "Instant" : m.durationMin ? `${m.durationMin} min` : "Permanent"}
                    {m.category && <span className="ml-auto text-[10px] uppercase tracking-wider opacity-70">{m.category}</span>}
                  </div>
                  <Button onClick={() => activate(b)} className="mt-auto bg-gradient-primary text-primary-foreground" size="sm">Activate</Button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
