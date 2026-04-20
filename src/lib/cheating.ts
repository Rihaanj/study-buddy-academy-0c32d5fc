import { supabase } from "@/integrations/supabase/client";

/**
 * Heuristic detection: is this prompt asking the AI to write the user's
 * homework / essay / assignment for them? We allow help / explanation,
 * but block "write a 500-word essay on..." and similar.
 */
const CHEAT_PATTERNS: RegExp[] = [
  /\bwrite\s+(?:me\s+)?(?:a|an|my)\s+(?:\d+\s*[-\s]?word\s+)?(?:essay|paragraph|paper|report|story|article|speech|letter)\b/i,
  /\b(?:do|complete|finish|solve)\s+(?:my|the)\s+(?:homework|assignment|worksheet|test|exam|quiz)\b/i,
  /\bwrite\s+(?:my|the)\s+(?:homework|assignment|paper)\b/i,
  /\b(?:essay|paragraph|paper)\s+about\b.*\b(?:for me|for my class)\b/i,
];

export function detectCheatingIntent(prompt: string): { suspected: boolean; reason: string } {
  const p = (prompt || "").trim();
  if (!p) return { suspected: false, reason: "" };
  for (const re of CHEAT_PATTERNS) {
    if (re.test(p)) return { suspected: true, reason: "Asked the AI to write homework/essay for them" };
  }
  // Also flag huge prompts that look like "write this for me"
  if (p.length > 600 && /\bwrite\b/i.test(p) && /\b(essay|paragraph|paper|report)\b/i.test(p)) {
    return { suspected: true, reason: "Long write-this-for-me request" };
  }
  return { suspected: false, reason: "" };
}

export async function fileCheatReport(opts: {
  userId: string;
  reason: string;
  context: string;
}) {
  // Pull display fields for the admin's review
  const { data: profile } = await supabase
    .from("profiles")
    .select("name,email")
    .eq("user_id", opts.userId)
    .maybeSingle();

  await supabase.from("cheat_reports").insert({
    user_id: opts.userId,
    user_name: profile?.name ?? null,
    user_email: profile?.email ?? null,
    reason: opts.reason,
    context: opts.context.slice(0, 2000),
  });
}
