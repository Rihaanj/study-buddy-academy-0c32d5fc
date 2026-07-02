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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 28_000);
  return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Lovable-API-Key": KEY || "",
      "X-Lovable-AIG-SDK": "raw-edge-function",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));
}

function cleanAscii(input: unknown): string {
  return String(input ?? "")
    .normalize("NFKC")
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u00D7/g, "x")
    .replace(/\u00F7/g, "/")
    .replace(/\u2265/g, ">=")
    .replace(/\u2264/g, "<=")
    .replace(/\u2260/g, "!=")
    .replace(/\u2192/g, "->")
    .replace(/[\u0000-\u001F\u007F]/g, (c) => (c === "\n" || c === "\t" ? c : ""))
    .trim();
}

function fallbackLesson(question: string) {
  const topic = cleanAscii(question).slice(0, 80) || "Study Topic";
  return {
    topic,
    explanation: `Let's turn this into a clear lesson. The main goal is to understand what the question is asking, identify the key idea, and connect it to an example you can remember. Start by writing the topic in your own words, then ask: what do I know, what is missing, and what rule or concept connects them?\n\nA strong student answer explains the idea, shows one example, and checks whether the result makes sense. Focus on the process instead of memorizing one final answer.`,
    example: `Example: if the topic is a math or science idea, name the rule, plug in simple numbers, and explain each step. If the topic is history, English, or social studies, define the idea, give evidence, and explain why it matters. This makes your answer easier to remember and easier to defend on a quiz.`,
    key_takeaways: [
      "Restate the question in your own words.",
      "Find the main concept before trying to answer.",
      "Use one clear example to test your understanding.",
      "Explain why the answer makes sense.",
    ],
    mistakes: [
      "Jumping to the final answer without explaining the idea.",
      "Memorizing words without checking what they mean.",
      "Skipping units, evidence, or reasoning steps.",
    ],
    notes: `## Quick Study Notes\n\n- Topic: ${topic}\n- Main move: define the concept, apply it, then check it.\n- Best study method: make one example, solve it, then explain it out loud.\n- If you get stuck, ask what rule, evidence, or definition connects the information.`,
    quiz: [
      { question: "What should you do first when a question feels confusing?", choices: ["Guess fast", "Restate it in your own words", "Skip every hard word", "Copy an example"], correct_index: 1, explanation: "Restating the question helps you identify the real task." },
      { question: "Why is an example useful?", choices: ["It replaces learning", "It makes the concept concrete", "It removes all studying", "It always gives the same answer"], correct_index: 1, explanation: "Examples make abstract ideas easier to test and remember." },
      { question: "What makes an answer stronger?", choices: ["Only the final answer", "Reasoning and evidence", "Longer sentences only", "Random vocabulary"], correct_index: 1, explanation: "Reasoning and evidence show that you understand the concept." },
      { question: "What should you check at the end?", choices: ["If it looks fancy", "If it makes sense", "If it is the shortest", "If it uses slang"], correct_index: 1, explanation: "Checking reasonableness catches many mistakes." },
    ],
    flashcards: [
      { front: "First step", back: "Restate the question in your own words." },
      { front: "Main concept", back: "The rule, definition, or idea the question is testing." },
      { front: "Good example", back: "A simple case that shows how the concept works." },
      { front: "Strong answer", back: "Claim plus reasoning plus evidence or steps." },
      { front: "Final check", back: "Ask whether the answer makes sense." },
    ],
    next_topic: "Practice with a harder example",
  };
}

function normalizeLesson(raw: any, question: string) {
  const base = fallbackLesson(question);
  const lesson = { ...base, ...(raw && typeof raw === "object" ? raw : {}) };
  lesson.topic = cleanAscii(lesson.topic).slice(0, 100) || base.topic;
  lesson.explanation = cleanAscii(lesson.explanation) || base.explanation;
  lesson.example = cleanAscii(lesson.example) || base.example;
  lesson.notes = cleanAscii(lesson.notes) || base.notes;
  lesson.next_topic = cleanAscii(lesson.next_topic) || base.next_topic;
  lesson.key_takeaways = (Array.isArray(lesson.key_takeaways) ? lesson.key_takeaways : base.key_takeaways).slice(0, 6).map(cleanAscii).filter(Boolean);
  lesson.mistakes = (Array.isArray(lesson.mistakes) ? lesson.mistakes : base.mistakes).slice(0, 5).map(cleanAscii).filter(Boolean);
  lesson.quiz = (Array.isArray(lesson.quiz) ? lesson.quiz : base.quiz).slice(0, 4).map((q: any, i: number) => ({
    question: cleanAscii(q?.question) || base.quiz[i]?.question || "Review question",
    choices: (Array.isArray(q?.choices) ? q.choices : base.quiz[i]?.choices || ["A", "B", "C", "D"]).slice(0, 4).map(cleanAscii),
    correct_index: Number.isInteger(q?.correct_index) && q.correct_index >= 0 && q.correct_index < 4 ? q.correct_index : 0,
    explanation: cleanAscii(q?.explanation) || "Review the lesson above, then try again.",
  }));
  while (lesson.quiz.length < 4) lesson.quiz.push(base.quiz[lesson.quiz.length]);
  lesson.flashcards = (Array.isArray(lesson.flashcards) ? lesson.flashcards : base.flashcards).slice(0, 5).map((c: any, i: number) => ({
    front: cleanAscii(c?.front) || base.flashcards[i]?.front || "Key idea",
    back: cleanAscii(c?.back) || base.flashcards[i]?.back || "Explain it in your own words.",
  }));
  while (lesson.flashcards.length < 5) lesson.flashcards.push(base.flashcards[lesson.flashcards.length]);
  return lesson;
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
    if (!Deno.env.get("LOVABLE_API_KEY")) {
      const lesson = normalizeLesson(null, question);
      lesson.youtube_videos = [];
      return new Response(JSON.stringify({ lesson }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sys = `You are an expert student tutor who returns a FULL STRUCTURED LESSON, never a short answer.
${levelHint(grade_level)}

${SAFETY}`;
    const videosPromise = fetchVideos(question, user.jwt);
    const r = await callGateway({
      model: MODEL,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: `Student question: ${question.slice(0, 2000)}\n\nReturn only one JSON object for a complete lesson. No markdown fence. The JSON must match this schema: ${JSON.stringify(LESSON_SCHEMA)}` },
      ],
      response_format: { type: "json_object" },
    });
    if (!r.ok) {
      const err = await r.text().catch(() => "");
      console.error("ai-lesson gateway", r.status, err);
      const lesson = normalizeLesson(null, question);
      lesson.youtube_videos = await videosPromise.catch(() => []);
      return new Response(JSON.stringify({ error: msg }), {
        status: r.status === 402 ? 503 : r.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await r.json();
    const msg = data.choices?.[0]?.message;
    let lesson: any;
    const raw = msg?.content || "";
    const cleaned = String(raw).replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    try { lesson = JSON.parse(cleaned); } catch {
      const s = cleaned.indexOf("{"); const e = cleaned.lastIndexOf("}");
      if (s !== -1 && e > s) { try { lesson = JSON.parse(cleaned.slice(s, e + 1)); } catch {} }
    }

    lesson = normalizeLesson(lesson, question);
    const videos = await videosPromise.catch(() => []);
    lesson.youtube_videos = videos;

    return new Response(JSON.stringify({ lesson }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-lesson", e);
    const question = (() => { try { return new URL(req.url).searchParams.get("q") || "Study Topic"; } catch { return "Study Topic"; } })();
    const lesson = normalizeLesson(null, question);
    lesson.youtube_videos = [];
    return new Response(JSON.stringify({ lesson }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
