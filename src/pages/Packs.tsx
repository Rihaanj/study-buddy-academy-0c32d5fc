import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sparkles, Package, Zap, Gift } from "lucide-react";
import { toast } from "sonner";
import { BUFF_POOL, type BuffDef } from "@/lib/buffs";
import { PackWheel } from "@/components/PackWheel";
import { rollRarity, grantStreakPacks, type Rarity } from "@/lib/streakPacks";
import { useProfile } from "@/hooks/useProfile";

type Pack = {
  id: string;
  rarity: Rarity;
  metadata: { opened?: boolean; reward?: BuffDef; awarded_at_level?: number; guaranteed?: boolean; source?: string };
  acquired_at: string;
};

const rarityStyles: Record<string, { ring: string; bg: string; text: string; label: string; glow: string }> = {
  common:    { ring: "ring-white/20",     bg: "from-slate-600/40 to-slate-800/40",  text: "text-slate-200",   label: "Common",    glow: "hsl(215 15% 55%)" },
  rare:      { ring: "ring-primary/60",   bg: "from-primary/30 to-primary/10",      text: "text-primary",     label: "Rare",      glow: "hsl(217 91% 60%)" },
  epic:      { ring: "ring-accent/70",    bg: "from-accent/40 to-purple-700/30",    text: "text-accent",      label: "Epic",      glow: "hsl(280 80% 60%)" },
  legendary: { ring: "ring-warning/80",   bg: "from-warning/40 to-orange-600/30",   text: "text-warning",     label: "Legendary", glow: "hsl(38 95% 55%)" },
  mythic:    { ring: "ring-fuchsia-400",  bg: "from-fuchsia-500/50 to-cyan-500/40", text: "text-fuchsia-300", label: "Mythic",    glow: "hsl(310 95% 65%)" },
};

export default function Packs() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [packs, setPacks] = useState<Pack[]>([]);
  const [opening, setOpening] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<{ id: string; reward: BuffDef; rarity: Rarity } | null>(null);
  const [spinning, setSpinning] = useState<{ id: string; rarity: Rarity } | null>(null);
  const [streakBonus, setStreakBonus] = useState<number>(0);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("inventory")
      .select("*")
      .eq("user_id", user.id)
      .eq("item_type", "pack")
      .order("acquired_at", { ascending: false });
    setPacks((data ?? []) as any);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel(`packs-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  // Auto-grant streak packs on visit if eligible
  useEffect(() => {
    if (!user || !profile) return;
    (async () => {
      const granted = await grantStreakPacks(user.id, profile.streak ?? 0);
      if (granted > 0) {
        setStreakBonus(granted);
        toast.success(`🔥 Streak reward: ${granted} new pack${granted > 1 ? "s" : ""}!`);
      }
    })();
  }, [user?.id, profile?.streak]);

  /** Spin the wheel for a brand-new pack (called from "Spin for new pack" button). */
  const spinNewPack = async () => {
    if (!user || spinning) return;
    const rarity = rollRarity();
    const { data, error } = await supabase
      .from("inventory")
      .insert({
        user_id: user.id,
        item_type: "pack",
        item_key: "buff_pack",
        rarity,
        metadata: { opened: false, source: "manual_spin" },
      })
      .select()
      .single();
    if (error || !data) { toast.error(error?.message ?? "Could not spin"); return; }
    setSpinning({ id: data.id, rarity });
  };

  /** Open an existing pack — show wheel for drama, then reveal a buff. */
  const open = async (pack: Pack) => {
    if (!user || opening) return;
    setOpening(pack.id);
    setSpinning({ id: pack.id, rarity: pack.rarity });
  };

  /** Wheel finished spinning — reveal the buff and persist it. */
  const finishSpin = async () => {
    if (!spinning || !user) return;
    const pack = packs.find((p) => p.id === spinning.id);
    // If wheel was for opening an existing pack, grant a buff from the pool
    if (pack && !pack.metadata?.opened) {
      const pool = BUFF_POOL[spinning.rarity] ?? BUFF_POOL.common;
      const reward = pool[Math.floor(Math.random() * pool.length)];
      const { error: invErr } = await supabase.from("inventory").insert({
        user_id: user.id,
        item_type: "buff",
        item_key: reward.key,
        rarity: spinning.rarity,
        metadata: { ...reward, source_pack: pack.id },
      });
      if (!invErr) {
        await supabase
          .from("inventory")
          .update({ metadata: { ...pack.metadata, opened: true, reward } })
          .eq("id", pack.id);
        setRevealed({ id: pack.id, reward, rarity: spinning.rarity });
      } else {
        toast.error(invErr.message);
      }
    } else {
      // Wheel was for "spinNewPack" — pack is already in inventory unopened
      toast.success(`Got a ${rarityStyles[spinning.rarity].label} pack!`);
    }
    setSpinning(null);
    setOpening(null);
  };

  const unopened = packs.filter((p) => !p.metadata?.opened);
  const opened = packs.filter((p) => p.metadata?.opened);
  const streak = profile?.streak ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold gradient-text flex items-center gap-2"><Package className="h-6 w-6"/> Buff Packs</h1>
        <p className="text-muted-foreground text-sm">
          Earn 1 pack every 2 levels · 10th pack is guaranteed Epic+ · 5+ day streak = 1 free pack/day · every 25-day milestone = 3 packs ✨
        </p>
        <div className="mt-3 glass p-3 rounded-xl flex items-center gap-3 text-sm">
          <Gift className="h-4 w-4 text-warning" />
          <span>
            Streak: <strong className="text-warning">{streak} 🔥</strong>
            {streak >= 5 ? " — daily bonus pack active!" : ` — ${5 - streak} more day${5 - streak > 1 ? "s" : ""} for daily packs`}
          </span>
          {streakBonus > 0 && <span className="ml-auto text-success font-semibold">+{streakBonus} pack today!</span>}
        </div>
      </div>

      {spinning && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 backdrop-blur-sm animate-fade-in p-4">
          <div className="glass-strong p-8 rounded-2xl max-w-sm w-full text-center animate-scale-in">
            <div className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-4">
              {packs.find((p) => p.id === spinning.id && !p.metadata?.opened) ? "Revealing your reward" : "Rolling rarity"}
            </div>
            <PackWheel targetRarity={spinning.rarity} onDone={finishSpin} />
          </div>
        </div>
      )}

      {revealed && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm animate-fade-in p-4" onClick={() => setRevealed(null)}>
          <div className={`glass-strong p-8 rounded-2xl ring-2 ${rarityStyles[revealed.rarity].ring} max-w-sm text-center animate-scale-in`} onClick={(e) => e.stopPropagation()}>
            <div className={`mx-auto h-20 w-20 rounded-2xl bg-gradient-to-br ${rarityStyles[revealed.rarity].bg} grid place-items-center mb-4 shadow-glow`}>
              <Sparkles className={`h-10 w-10 ${rarityStyles[revealed.rarity].text}`} />
            </div>
            <div className={`text-xs uppercase tracking-widest font-semibold ${rarityStyles[revealed.rarity].text}`}>{rarityStyles[revealed.rarity].label} Buff</div>
            <div className="text-xl font-bold mt-2">{revealed.reward.label}</div>
            <p className="text-sm text-muted-foreground mt-2">{revealed.reward.description}</p>
            <p className="text-xs text-muted-foreground mt-3">Added to your inventory. Activate it from the Buffs tab.</p>
            <Button onClick={() => setRevealed(null)} className="mt-5 w-full bg-gradient-primary text-primary-foreground">Awesome</Button>
          </div>
        </div>
      )}

      <section>
        <h2 className="font-semibold mb-3">Unopened ({unopened.length})</h2>
        {unopened.length === 0 ? (
          <div className="glass p-8 text-center text-muted-foreground">
            No packs yet. Earn XP and level up — every 2 levels grants a pack. 🎁
          </div>
        ) : (
          <div className="space-y-3">
            {unopened.map((pack, idx) => (
              <div key={pack.id} className="relative">
                {/* Stack shadows behind cards (purely visual) */}
                {idx < unopened.length - 1 && (
                  <div className="absolute inset-x-4 -bottom-1.5 h-2 rounded-b-2xl bg-white/10 ring-1 ring-white/10" />
                )}
                <div className="relative glass-strong p-4 sm:p-5 rounded-2xl ring-1 ring-white/15 overflow-hidden">
                  <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-gradient-primary blur-2xl opacity-30" />
                  <div className="relative flex items-center gap-4">
                    <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl bg-gradient-to-br from-slate-700/50 to-slate-900/60 grid place-items-center shrink-0 ring-1 ring-white/15">
                      <Package className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Mystery Pack</div>
                      <div className="text-sm text-foreground/80 mt-0.5">
                        Spin to reveal what's inside ✨
                      </div>
                    </div>
                    <Button
                      onClick={() => open(pack)}
                      disabled={opening === pack.id}
                      className="bg-gradient-primary text-primary-foreground shrink-0"
                    >
                      {opening === pack.id ? "Opening..." : "Open"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {opened.length > 0 && (
        <section>
          <h2 className="font-semibold mb-3">Opened ({opened.length})</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {opened.map((p) => {
              const s = rarityStyles[p.rarity] ?? rarityStyles.common;
              return (
                <div key={p.id} className="glass p-4 flex items-center gap-3 opacity-70">
                  <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${s.bg} grid place-items-center`}>
                    <Zap className={`h-5 w-5 ${s.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[10px] uppercase tracking-wider font-semibold ${s.text}`}>{s.label}</div>
                    <div className="text-sm truncate">{p.metadata?.reward?.label ?? "Reward claimed"}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
