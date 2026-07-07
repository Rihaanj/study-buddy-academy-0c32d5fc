import { supabase } from "@/integrations/supabase/client";
import { awardXp, getActiveXpMultiplier } from "@/lib/gamification";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tutor`;

export type FollowUpQ = { question: string; expected: string };

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  let token = data.session?.access_token;
  if (!token) {
    const refreshed = await supabase.auth.refreshSession();
    token = refreshed.data.session?.access_token;
  }
  if (!token) throw new Error("Please sign in again to use the AI.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

export async function streamAI({ body, onDelta }: { body: any; onDelta: (s: string) => void }) {
  const headers = await authHeaders();
  const resp = await fetch(FN_URL, { method: "POST", headers, body: JSON.stringify(body) });
  if (resp.status === 401) throw new Error("Please sign in again to use the AI.");
  if (resp.status === 429) throw new Error("The AI is busy — try again in a moment.");
  if (resp.status === 402 || resp.status === 503) throw new Error("The AI is taking a quick break — try again in a moment.");
  if (!resp.ok || !resp.body) throw new Error("AI request failed");
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let done = false;
  while (!done) {
    const { done: d, value } = await reader.read();
    if (d) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") { done = true; break; }
      try {
        const p = JSON.parse(json);
        const c = p.choices?.[0]?.delta?.content;
        if (c) onDelta(c);
      } catch { buf = line + "\n" + buf; break; }
    }
  }
}

export async function generateFollowUps(topic: string, context: string): Promise<FollowUpQ[]> {
  const headers = await authHeaders();
  const r = await fetch(FN_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ mode: "followups", topic, prompt: context }),
  });
  if (!r.ok) return [];
  const data = await r.json();
  return (data.questions || []).slice(0, 3);
}

/**
 * Grade a single answer. Returns {correct, feedback} on success, or
 * {error: true} when grading itself failed (do NOT count this as wrong).
 */
export async function gradeAnswer(question: string, expected: string, userAnswer: string): Promise<{ correct: boolean; feedback?: string; error?: boolean }> {
  if (!userAnswer.trim()) return { correct: false, feedback: "No answer given." };
  try {
    const headers = await authHeaders();
    const r = await fetch(FN_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ mode: "grade", question, expected, userAnswer }),
    });
    if (r.status === 429 || r.status === 402 || !r.ok) return { correct: false, error: true, feedback: "Couldn't grade — try again." };
    const j = await r.json();
    if (typeof j.correct !== "boolean") return { correct: false, error: true, feedback: "Couldn't grade — try again." };
    return { correct: !!j.correct, feedback: j.feedback };
  } catch {
    return { correct: false, error: true, feedback: "Couldn't grade — try again." };
  }
}

export function gateXp(correctCount: number): number {
  return [0, 5, 10, 20][Math.max(0, Math.min(3, correctCount))] ?? 0;
}

/** XP penalty for wrong answers in the 3-question gate. */
export function gatePenalty(wrongCount: number): number {
  // -3 XP per wrong answer (max -9)
  return -3 * Math.max(0, Math.min(3, wrongCount));
}

export async function awardGateXp(userId: string, correctCount: number) {
  const base = gateXp(correctCount);
  const wrong = 3 - Math.max(0, Math.min(3, correctCount));
  const penalty = gatePenalty(wrong); // negative or 0
  let awarded = 0;
  let capped: boolean | undefined = undefined;
  if (base > 0) {
    const mult = await getActiveXpMultiplier(userId);
    awarded = Math.round(base * mult);
    const result = await awardXp(userId, awarded);
    awarded = result?.awardedAmount ?? awarded;
    capped = (result as any)?.dailyXpCapped;
  }
  if (penalty < 0) {
    const result = await awardXp(userId, penalty);
    // awardedAmount for negative is the actual delta applied (clamped to floor 0)
    awarded += result?.awardedAmount ?? penalty;
  }
  return { awarded, base, penalty, capped };
}

export async function logAiHistory(userId: string, kind: string, topic: string | null, prompt: string | null, metadata: Record<string, unknown> = {}) {
  await (supabase.from("ai_history") as any).insert({ user_id: userId, kind, topic, prompt, metadata });
}

export async function addToBurnList(userId: string, topic: string | null, question: string, expected: string, userAnswer: string) {
  await (supabase.from("burn_list") as any).insert({
    user_id: userId, topic, question, expected_answer: expected, user_answer: userAnswer,
  });
}

export async function bumpMastery(userId: string, topic: string, subject: string | null, correct: boolean) {
  const { data: existing } = await (supabase.from("topic_mastery") as any)
    .select("attempts, correct").eq("user_id", userId).eq("topic", topic).maybeSingle();
  const attempts = (existing?.attempts ?? 0) + 1;
  const correctCount = (existing?.correct ?? 0) + (correct ? 1 : 0);
  const mastery_pct = Math.round((correctCount / Math.max(1, attempts)) * 100);
  const intervalDays = correct ? Math.min(14, Math.ceil(attempts * 1.5)) : 1;
  const next_review_at = new Date(Date.now() + intervalDays * 86400000).toISOString();
  await (supabase.from("topic_mastery") as any).upsert({
    user_id: userId, topic, subject,
    attempts, correct: correctCount, mastery_pct,
    last_practiced_at: new Date().toISOString(),
    next_review_at,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,topic" });
}
