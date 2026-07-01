import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "google/gemini-3-flash-preview";

const SAFETY = `
SAFETY & SCOPE:
- Allow any topic with a learning angle. Default to teaching.
- Neutral on people: only verifiable facts, never opinions/rankings.
- No academic dishonesty: teach the concept, don't write essays or hand over graded answers.
- Refuse ONLY: explicit/sexual/violent/hateful/illegal/self-harm content. Reply: "I can only help with learning. Let's get back to your studies."
- PLAIN ASCII ONLY: no em/en dashes, smart quotes, math unicode (× ÷ ≥ ≤ ≠ →), fractions, or decorative glyphs. Use -, ", ', ..., x, /, >=, <=, !=, ->, 1/2. Emojis allowed only when meaningful.
`.trim();

function levelHint(g?: string | null): string {
  const s = (g || "").toLowerCase();
  if (s.startsWith("mid")) return "The student is in MIDDLE SCHOOL (grades 6-8). Use simple language, short sentences, concrete examples. Aim for grade-7 vocabulary.";
  if (s.startsWith("col")) return "The student is in COLLEGE. You may use technical vocabulary, deeper theory, and rigorous examples.";
  return "The student is in HIGH SCHOOL (grades 9-12). Use clear language with a bit of academic vocabulary and one worked example.";
}

async function requireUser(req: Request): Promise<{ id: string; jwt: string } | null> {
  const auth = req.headers.get("Authorization") || "";
  const jwt = auth.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return null;
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data, error } = await sb.auth.getUser(jwt);
    if (error || !data?.user) return null;
    return { id: data.user.id, jwt };
  } catch { return null; }
}

async function callGateway(body: any) {
  const KEY = Deno.env.get("LOVABLE_API_KEY");
  return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const LESSON_SCHEMA = {
  type: "object",
  properties: {
    topic: { type: "string", description: "Short 2-6 word topic name" },
    explanation: { type: "string", description: "Clear teacher-style explanation. 2-4 short paragraphs. Simple then deeper." },
    example: { type: "string", description: "One real-world worked example, 1-3 short paragraphs." },
    key_takeaways: { type: "array", items: { type: "string" }, description: "4-6 short exam-ready bullets." },
    mistakes: { type: "array", items: { type: "string" }, description: "3-5 common student mistakes with a quick fix each." },
    notes: { type: "string", description: "Compact study notes in markdown with headings and bullets. 150-300 words." },
    quiz: {
      type: "array",
      description: "Exactly 4 multiple-choice questions with 4 choices each and the correct answer index (0-3).",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          choices: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
          correct_index: { type: "integer", minimum: 0, maximum: 3 },
          explanation: { type: "string" },
        },
        required: ["question", "choices", "correct_index", "explanation"],
        additionalProperties: false,
      },
      minItems: 4, maxItems: 4,
    },
    flashcards: {
      type: "array",
      description: "Exactly 5 flashcards (short front, short back).",
      items: {
        type: "object",
        properties: { front: { type: "string" }, back: { type: "string" } },
        required: ["front", "back"], additionalProperties: false,
      },
      minItems: 5, maxItems: 5,
    },
    next_topic: { type: "string", description: "One concrete topic the student should learn next." },
  },
  required: ["topic", "explanation", "example", "key_takeaways", "mistakes", "notes", "quiz", "flashcards", "next_topic"],
  additionalProperties: false,
};

async function fetchVideos(topic: string, jwt: string): Promise<any[]> {
  try {
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/youtube-search`;
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: JSON.stringify({ topic }),
    });
    if (!r.ok) return [];
    const j = await r.json();
    return j.videos || [];
  } catch { return []; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const user = await requireUser(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const { question, grade_level } = await req.json();
    if (!question || typeof question !== "string") {
      return new Response(JSON.stringify({ error: "question required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Deno.env.get("LOVABLE_API_KEY")) throw new Error("LOVABLE_API_KEY missing");

    const sys = `You are an expert student tutor who returns a FULL STRUCTURED LESSON, never a short answer.
${levelHint(grade_level)}

${SAFETY}`;
    const r = await callGateway({
      model: MODEL,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: `Student question: ${question.slice(0, 2000)}\n\nBuild a complete lesson using the build_lesson tool.` },
      ],
      tools: [{ type: "function", function: { name: "build_lesson", parameters: LESSON_SCHEMA } }],
      tool_choice: { type: "function", function: { name: "build_lesson" } },
    });
    if (!r.ok) {
      const msg = r.status === 429
        ? "The AI is busy right now — try again in a moment."
        : r.status === 402
        ? "The AI is taking a quick break — try again in a moment."
        : "AI is having trouble — try again.";
      return new Response(JSON.stringify({ error: msg }), {
        status: r.status === 402 ? 503 : r.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await r.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("No lesson content returned");
    let lesson: any;
    try { lesson = JSON.parse(args); } catch { throw new Error("Bad lesson JSON"); }

    // Enforce sizes just in case
    lesson.key_takeaways = (lesson.key_takeaways || []).slice(0, 8);
    lesson.mistakes = (lesson.mistakes || []).slice(0, 6);
    lesson.quiz = (lesson.quiz || []).slice(0, 4);
    lesson.flashcards = (lesson.flashcards || []).slice(0, 5);

    const videos = await fetchVideos(lesson.topic || question, user.jwt);
    lesson.youtube_videos = videos;

    return new Response(JSON.stringify({ lesson }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-lesson", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
