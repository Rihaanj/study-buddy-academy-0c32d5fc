import { supabase } from "@/integrations/supabase/client";

/**
 * Find or create a 1:1 direct-message group between two users.
 * DM groups are marked with subject = "__dm__" and named after the friend (from the caller's perspective).
 * Returns the group id, or null on failure.
 */
export async function getOrCreateDM(meId: string, friendId: string, friendName: string | null): Promise<string | null> {
  // Find groups I'm in
  const { data: myMemberships } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", meId);
  const myGroupIds = (myMemberships ?? []).map((m: any) => m.group_id);

  if (myGroupIds.length) {
    // Find groups friend is also in, restricted to DM-marked groups
    const { data: shared } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", friendId)
      .in("group_id", myGroupIds);
    const sharedIds = (shared ?? []).map((m: any) => m.group_id);
    if (sharedIds.length) {
      const { data: dmGroups } = await supabase
        .from("groups")
        .select("id")
        .in("id", sharedIds)
        .eq("subject", "__dm__");
      if (dmGroups && dmGroups.length > 0) {
        // Make sure name reflects the friend's current name for this user perspective
        return dmGroups[0].id;
      }
    }
  }

  // Create the DM group
  const name = (friendName?.trim() || "Direct message");
  const { data: g, error } = await supabase
    .from("groups")
    .insert({ name, subject: "__dm__", created_by: meId })
    .select()
    .single();
  if (error || !g) return null;

  // Add both members (creator first so RLS for inviting friend passes)
  const { error: e1 } = await supabase.from("group_members").insert({ group_id: g.id, user_id: meId });
  if (e1) return null;
  const { error: e2 } = await supabase.from("group_members").insert({ group_id: g.id, user_id: friendId });
  if (e2) return null;

  return g.id;
}
