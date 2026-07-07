import { supabase } from "@/integrations/supabase/client";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tutor`;

/**
 * Regex quick-check for the obvious cheat phrasings. We still call the AI
 * classifier for the ambiguous ones, but this saves a roundtrip when it's clear.
 */
const OBVIOUS: RegExp[] = [
  /\bwrite\s+(?:me\s+)?(?:a|an|my)\s+(?:\d+\s*[-\s]?word\s+)?(?:essay|paragraph|paper|report|story|article|speech|letter|poem|song)\b/i,
  /\b(?:do|complete|finish|solve)\s+(?:all\s+)?(?:my|the|these)\s+(?:homework|assignment|worksheet|test|exam|quiz|problems?)\b/i,
  /\bwrite\s+(?:my|the)\s+(?:homework|assignment|paper|essay)\b/i,
];

/** Off-topic / non-academic keyword sniff (catches Diddy-style requests fast). */
const OFF_TOPIC: RegExp[] = [
  /\b(diddy|p\W?diddy|kanye|drake|taylor swift|kardashian|tiktok|instagram|snapchat|fortnite|roblox|minecraft|gta)\b/i,
  /\b(rizz|sigma|gyatt|skibidi|ohio|fanum tax|mewing)\b/i,
  /\b(dating|crush|girlfriend|boyfriend|hook ?up|sexy|nude|porn)\b/i,
  /\b(joke|roast|meme|gossip|tea|drama)\s+(about|on)\b/i,
  /\b(who\s+is\s+better|rank\s+(?:these|them)|rate\s+(?:this|me|them)|celebrity\s+gossip)\b/i,
];

const ACADEMIC_SIGNALS: RegExp[] = [
  /\b(explain|teach|learn|lesson|define|meaning|history|science|math|english|grammar|language|biology|chemistry|physics|geography|civics|economics|coding|programming|study|school|homework help|example|why|how)\b/i,
];

function obviousCheat(prompt: string): string | null {
  const p = (prompt || "").trim();
  if (!p) return null;
  for (const re of OBVIOUS) if (re.test(p)) return "Asked the AI to write homework/essay for them";
  for (const re of OFF_TOPIC) if (re.test(p)) return "Off-topic / non-academic request";
  return null;
}

/**
 * Combined check: fast regex first, then AI classifier for the grey area.
 * Returns reason string if flagged, null otherwise.
 */
export async function classifyCheatIntent(prompt: string): Promise<string | null> {
  const obvious = obviousCheat(prompt);
  if (obvious) return obvious;
  if ((prompt || "").trim().length < 3) return null;
  try {
    const { data: sess } = await supabase.auth.getSession();
    let token = sess.session?.access_token;
    if (!token) {
      const refreshed = await supabase.auth.refreshSession();
      token = refreshed.data.session?.access_token;
    }
    if (!token) return null;
    const r = await fetch(FN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify({ mode: "check-cheat", prompt }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    if (j?.cheat) return String(j.reason || "AI detected assignment-writing request");
  } catch { /* ignore */ }
  return null;
}

export async function classifyLessonViolation(prompt: string): Promise<string | null> {
  const p = (prompt || "").trim();
  if (!p) return null;
  const obvious = obviousCheat(p);
  if (obvious) return obvious;
  if (ACADEMIC_SIGNALS.some((re) => re.test(p))) return null;
  // Single words and short phrases can be valid language lessons, e.g. "hello".
  if (/^[\p{L}\p{N}' -]{1,40}$/u.test(p) && p.split(/\s+/).length <= 4) return null;
  return await classifyCheatIntent(p);
}

export async function fileCheatReport(opts: { userId: string; reason: string; context: string }) {
  const { data: profile } = await supabase
    .from("profiles").select("name").eq("user_id", opts.userId).maybeSingle();
  const { error } = await supabase.from("cheat_reports").insert({
    user_id: opts.userId,
    user_name: profile?.name ?? null,
    reason: opts.reason,
    context: opts.context.slice(0, 2000),
  });
  if (error) console.warn("Could not file report", error.message);
}

// Re-export synchronous API for backward compat
export function detectCheatingIntent(prompt: string): { suspected: boolean; reason: string } {
  const reason = obviousCheat(prompt);
  return reason ? { suspected: true, reason } : { suspected: false, reason: "" };
}
