import { supabase } from "@/integrations/supabase/client";

/**
 * Find or create a direct-message chat between two friends.
 * Uses the new `dm_chats` table with ordered (user_a < user_b) pairs.
 * Returns the dm_chat id, or null on failure.
 */
export async function getOrCreateDM(meId: string, friendId: string, _friendName: string | null): Promise<string | null> {
  const [a, b] = meId < friendId ? [meId, friendId] : [friendId, meId];

  const { data: existing } = await supabase
    .from("dm_chats").select("id").eq("user_a", a).eq("user_b", b).maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("dm_chats").insert({ user_a: a, user_b: b }).select("id").single();
  if (error || !data) return null;
  return data.id;
}
