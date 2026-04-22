import { supabase } from "@/integrations/supabase/client";
import { awardXp, getActiveXpMultiplier } from "@/lib/gamification";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tutor`;

export type FollowUpQ = { question: string; expected: string };

const aiHeaders = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
};

export async function streamAI({ body, onDelta }: { body: any; onDelta: (s: string) => void }) {
  const resp = await fetch(FN_URL, { method: "POST", headers: aiHeaders, body: JSON.stringify(body) });
  if (resp.status === 429) throw new Error("Rate limited — try again shortly.");
  if (resp.status === 402) throw new Error("AI credits exhausted. Add funds in Lovable settings.");
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
  const r = await fetch(FN_URL, {
    method: "POST",
    headers: aiHeaders,
    body: JSON.stringify({ mode: "followups", topic, prompt: context }),
  });
  if (!r.ok) return [];
  const data = await r.json();
  return (data.questions || []).slice(0, 3);
}

export async function gradeAnswer(question: string, expected: string, userAnswer: string): Promise<{ correct: boolean; feedback?: string }> {
  if (!userAnswer.trim()) return { correct: false, feedback: "No answer given." };
  const r = await fetch(FN_URL, {
    method: "POST",
    headers: aiHeaders,
    body: JSON.stringify({ mode: "grade", question, expected, userAnswer }),
  });
  if (!r.ok) return { correct: false, feedback: "Could not grade." };
  return await r.json();
}

/**
 * Compute scaled XP based on the 3-question gate result.
 * 0/3 = 0 XP, 1/3 = 5 XP, 2/3 = 10 XP, 3/3 = 20 XP.
 */
export function gateXp(correctCount: number): number {
  return [0, 5, 10, 20][Math.max(0, Math.min(3, correctCount))] ?? 0;
}

export async function awardGateXp(userId: string, correctCount: number) {
  const base = gateXp(correctCount);
  if (base <= 0) return { awarded: 0, base: 0 };
  const mult = await getActiveXpMultiplier(userId);
  const awarded = Math.round(base * mult);
  const result = await awardXp(userId, awarded);
  return { awarded: result?.awardedAmount ?? awarded, base, capped: (result as any)?.dailyXpCapped };
}

export async function logAiHistory(userId: string, kind: string, topic: string | null, prompt: string | null, metadata: Record<string, unknown> = {}) {
  await (supabase.from("ai_history") as any).insert({ user_id: userId, kind, topic, prompt, metadata });
}

/** Push wrong answer onto burn list (for re-quizzing). */
export async function addToBurnList(userId: string, topic: string | null, question: string, expected: string, userAnswer: string) {
  await (supabase.from("burn_list") as any).insert({
    user_id: userId, topic, question, expected_answer: expected, user_answer: userAnswer,
  });
}

/** Update topic mastery: +1 attempt, +1 correct (if correct), recompute mastery_pct. */
export async function bumpMastery(userId: string, topic: string, subject: string | null, correct: boolean) {
  const { data: existing } = await (supabase.from("topic_mastery") as any)
    .select("attempts, correct").eq("user_id", userId).eq("topic", topic).maybeSingle();
  const attempts = (existing?.attempts ?? 0) + 1;
  const correctCount = (existing?.correct ?? 0) + (correct ? 1 : 0);
  const mastery_pct = Math.round((correctCount / Math.max(1, attempts)) * 100);
  // Spaced-repetition: next review intervals (days)
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
