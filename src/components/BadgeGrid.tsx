import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Badge = {
  key: string; title: string; description: string; category: string; icon: string; sort_order: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  onboarding: "🚀 Onboarding",
  streak: "🔥 Streak",
  focus: "⏱ Focus",
  ai: "🧠 AI / Study",
  social: "👥 Social",
  special: "🎮 Special",
};

interface Props {
  /** When true, show only unlocked badges (compact). */
  unlockedOnly?: boolean;
  /** Limit number shown. */
  limit?: number;
}

export const BadgeGrid = ({ unlockedOnly = false, limit }: Props) => {
  const { user } = useAuth();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const { data: all } = await supabase.from("badges").select("*").order("sort_order");
      setBadges((all ?? []) as Badge[]);
      if (user) {
        const { data: mine } = await supabase.from("user_badges").select("badge_key").eq("user_id", user.id);
        setUnlocked(new Set((mine ?? []).map((b: any) => b.badge_key)));
      }
    })();
  }, [user?.id]);

  const visible = unlockedOnly ? badges.filter((b) => unlocked.has(b.key)) : badges;
  const sliced = limit ? visible.slice(0, limit) : visible;

  if (unlockedOnly && sliced.length === 0) {
    return <p className="text-sm text-muted-foreground">No badges yet — start completing tasks & focus sessions! 🚀</p>;
  }

  if (unlockedOnly) {
    return (
      <div className="flex flex-wrap gap-2">
        {sliced.map((b) => (
          <div key={b.key} title={`${b.title} — ${b.description}`}
            className="glass px-3 py-2 rounded-xl flex items-center gap-2 hover:scale-105 transition">
            <span className="text-lg">{b.icon}</span>
            <span className="text-xs font-semibold">{b.title}</span>
          </div>
        ))}
      </div>
    );
  }

  // Grouped full view
  const grouped = sliced.reduce<Record<string, Badge[]>>((acc, b) => {
    (acc[b.category] ??= []).push(b);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([cat, list]) => (
        <div key={cat}>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
            {CATEGORY_LABELS[cat] ?? cat}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
            {list.map((b) => {
              const has = unlocked.has(b.key);
              return (
                <div key={b.key}
                  className={`glass p-3 rounded-xl flex flex-col items-center text-center transition ${
                    has ? "ring-1 ring-primary/40 shadow-glow" : "opacity-50 grayscale"
                  }`}>
                  <div className="text-3xl mb-1">{b.icon}</div>
                  <div className="text-xs font-bold leading-tight">{b.title}</div>
                  <div className="text-[10px] text-muted-foreground mt-1 leading-tight">{b.description}</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
