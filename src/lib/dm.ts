import { supabase } from "@/integrations/supabase/client";

/**
 * Find or create a direct-message chat between two friends.
 * Uses ordered pairs so every friendship maps to a single DM thread.
 */
export async function getOrCreateDM(meId: string, friendId: string, _friendName: string | null): Promise<string | null> {
  const [userA, userB] = meId < friendId ? [meId, friendId] : [friendId, meId];

  const { data: existing, error: readError } = await supabase
    .from("dm_chats")
    .select("id")
    .eq("user_a", userA)
    .eq("user_b", userB)
    .maybeSingle();

  if (existing?.id) return existing.id;
  if (readError) return null;

  const { data, error } = await supabase
    .from("dm_chats")
    .insert({ user_a: userA, user_b: userB })
    .select("id")
    .single();

  if (data?.id) return data.id;

  const { data: fallback } = await supabase
    .from("dm_chats")
    .select("id")
    .eq("user_a", userA)
    .eq("user_b", userB)
    .maybeSingle();

  return fallback?.id ?? null;
}
