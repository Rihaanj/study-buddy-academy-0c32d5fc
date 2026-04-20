import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type Profile = {
  user_id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  xp: number;
  level: number;
  streak: number;
  focus_streak: number;
  last_active_date: string | null;
  avatar: { outfit: string; accessories: string[]; effects: string[]; evolutionStage: string };
};

export const useProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async (uid: string) => {
    let { data } = await supabase.from("profiles").select("*").eq("user_id", uid).maybeSingle();
    // Self-heal: if no profile row exists (trigger missed), create one from auth metadata
    if (!data && user) {
      const meta = (user.user_metadata ?? {}) as any;
      const fallbackName = meta.full_name || meta.name || (user.email ? user.email.split("@")[0] : null);
      const insert = await supabase.from("profiles").insert({
        user_id: uid,
        name: fallbackName,
        email: user.email ?? null,
        avatar_url: meta.avatar_url ?? null,
      }).select("*").maybeSingle();
      data = insert.data ?? null;
    }
    setProfile(data as any);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) { setProfile(null); setLoading(false); return; }
    load(user.id);
    const channel = supabase
      .channel(`profile-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.new) setProfile((prev) => ({ ...(prev as any), ...(payload.new as any) }));
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` },
        () => load(user.id)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  return { profile, loading, reload: () => user && load(user.id) };
};
