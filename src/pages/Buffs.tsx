import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Clock, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";


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
      .channel(`buffs-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory", filter: `user_id=eq.${user.id}` }, (payload) => {
        const next = payload.new as any;
        const old = payload.old as any;
        setInventory((current) => {
          if (payload.eventType === "DELETE") {
            return current.filter((item) => item.id !== old?.id);
          }
          if (!next || next.item_type !== "buff") return current;
          const without = current.filter((item) => item.id !== next.id);
          return [next, ...without].sort((a, b) => new Date(b.acquired_at).getTime() - new Date(a.acquired_at).getTime());
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "active_buffs", filter: `user_id=eq.${user.id}` }, (payload) => {
        const next = payload.new as any;
        const old = payload.old as any;
        setActive((current) => {
          if (payload.eventType === "DELETE") {
            return current.filter((item) => item.id !== old?.id);
          }
          if (!next) return current;
          const without = current.filter((item) => item.id !== next.id);
          return [next, ...without].sort((a, b) => new Date(b.activated_at).getTime() - new Date(a.activated_at).getTime());
        });
      })
      .subscribe();
    const t = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => { supabase.removeChannel(ch); window.clearInterval(t); };
  }, [user?.id]);

  useEffect(() => {
    const expired = active.filter((b) => b.expires_at && new Date(b.expires_at).getTime() <= Date.now());
    if (expired.length === 0) return;
    (async () => {
      for (const b of expired) {
        await supabase.from("active_buffs").delete().eq("id", b.id);
      }
    })();
  }, [active]);

  // Cooldowns: per-card 10s lockout after click, single in-flight guard.
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({}); // id -> unlockMs

  const activate = async (b: InvBuff) => {
    if (!user || activatingId) return;
    if ((cooldowns[b.id] ?? 0) > Date.now()) return;
    setActivatingId(b.id);
    setCooldowns((c) => ({ ...c, [b.id]: Date.now() + 10_000 }));
    try {
      const { data, error } = await supabase.rpc("activate_inventory_buff", { _buff_id: b.id });
      if (error) {
        toast.error(error.message || "Could not activate buff");
        return;
      }
      const result = (data ?? {}) as { kind?: string; message?: string };
      toast.success(result.message ?? "Buff activated");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not activate buff");
    } finally {
      setActivatingId(null);
    }
  };

  // Reward: every 5 minutes of having any active timed buff, grant a free pack.
  // Uses localStorage to persist last-grant timestamp across reloads, and only fires
  // while at least one active_buff exists for the user.
  useEffect(() => {
    if (!user) return;
    const key = `buff-pack-reward:${user.id}`;
    const tryGrant = async () => {
      const hasActive = active.some((b) => !b.expires_at || new Date(b.expires_at).getTime() > Date.now());
      if (!hasActive) return;
      const last = Number(localStorage.getItem(key) || "0");
      const now = Date.now();
      if (now - last < 5 * 60_000) return;
      localStorage.setItem(key, String(now));
      const rarities: Array<"common" | "rare" | "epic" | "legendary" | "mythic"> = ["common","common","rare","rare","epic","legendary","mythic"];
      const rarity = rarities[Math.floor(Math.random() * rarities.length)];
      const { error } = await supabase.from("inventory").insert({
        user_id: user.id, item_type: "pack", item_key: "buff_pack", rarity,
        metadata: { opened: false, source: "active_buff_reward" } as any,
      } as any);
      if (!error) toast.success("🎁 Active-buff reward: +1 pack!", { description: "Open it in the Packs tab." });
    };
    tryGrant();
    const t = window.setInterval(tryGrant, 30_000);
    return () => window.clearInterval(t);
  }, [user?.id, active]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold gradient-text flex items-center gap-2"><Sparkles className="h-6 w-6" /> Buffs</h1>
        <p className="text-muted-foreground text-sm">Activate buffs to multiply XP. Max 3 active · 10-second cooldown between activations · While a buff is active you earn a free pack every 5 minutes.</p>
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
                  <Button onClick={() => activate(b)} disabled={activatingId === b.id} className="mt-auto bg-gradient-primary text-primary-foreground" size="sm">{activatingId === b.id ? "Activating…" : "Activate"}</Button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
