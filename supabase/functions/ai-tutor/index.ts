import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function requireUser(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization") || "";
  const jwt = auth.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return null;
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data, error } = await sb.auth.getUser(jwt);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch { return null; }
}

const MODEL = "google/gemini-2.5-flash-lite";
const VISION_MODEL = "google/gemini-2.5-flash"; // need vision

// Universal safety policy injected into every system prompt
const SAFETY_POLICY = `
SAFETY & SCOPE RULES (apply to every reply):
- ALLOW ANYTHING WITH A LEARNING ANGLE: any topic that helps a student LEARN, GROW, or UNDERSTAND THE WORLD is allowed — academic subjects, study skills, exam prep, productivity, time management, mental wellbeing, careers, college planning, language learning, coding, civics, history, philosophy, sports science, art history, music theory, business, finance literacy, current events, pop culture (when there's an educational angle), even hobbies if you frame it educationally. Default to YES, then teach.
- NEUTRAL ON PEOPLE: when asked about a specific person, state ONLY verifiable, well-sourced facts. NEVER share opinions, judgments, or rankings. If the user offers their opinion, do NOT agree or disagree — acknowledge neutrally and redirect to facts.
- NO ACADEMIC DISHONESTY: NEVER write a student's essay/paper/speech/homework FOR them. NEVER hand over a final answer to a graded problem. TEACH the concept, then GUIDE them with hints and Socratic questions.
- REFUSE ONLY: explicit/sexual/violent/hateful content, illegal activity, self-harm, doxxing, or pure gossip. Reply: "I can only help with learning. Let's get back to your studies."
- LANGUAGE: respond in whatever language the student writes in.
- EXAM PREP REALISM: when asked for SAT / ACT / AP / IB / GCSE / A-Level / state exam questions, generate questions that ACTUALLY MATCH the real test's difficulty, format, length, answer-choice style, and topic distribution. SAT Math: grid-in or 4-choice MC at official SAT difficulty (easy/medium/hard tiers). SAT Reading & Writing: short passage + 4-choice MC in official Bluebook style. Label each question with its difficulty (Easy/Medium/Hard) and the real exam section it would appear in.
- PLAIN TEXT ONLY: write with normal ASCII characters. Do NOT use em-dashes, en-dashes, smart/curly quotes, ellipsis character, bullet glyphs, math unicode (×, ÷, ≥, ≤, ≠, →), fraction glyphs (½, ⅓), or any decorative unicode. Use -, ", ', ..., *, x, /, >=, <=, !=, ->, 1/2 instead. Emojis ARE allowed only when they add clear meaning.
- KEEP IT EDUCATIONAL: even casual questions should end with a learning hook.
`.trim();

const SYSTEM_PROMPTS: Record<string, string> = {
  tutor:
    `You are a friendly, patient AI tutor. TEACH the concept clearly with a short example, then end with: '\\n\\n---\\n_I'll quiz you on this in a moment to lock it in!_'\n\n${SAFETY_POLICY}`,
  socratic:
    `You are a SOCRATIC tutor. NEVER give direct answers. Ask ONE focused, probing question at a time that guides the student to discover the answer. Wait for their response before asking the next. Be warm and encouraging.\n\n${SAFETY_POLICY}`,
  analogy:
    `You explain concepts with vivid ANALOGIES from sports, cooking, gaming, or everyday life. Format: 1) The analogy (1 paragraph). 2) How it maps to the concept (3 bullets). 3) Where the analogy breaks down (1 sentence).\n\n${SAFETY_POLICY}`,
  prereqs:
    `You list FOUNDATIONAL skills a student should know BEFORE studying a topic. Output a numbered list of 3-6 prerequisites with one-line explanations.\n\n${SAFETY_POLICY}`,
  practice:
    `You generate practice questions. Produce 3-5 short questions with increasing difficulty. For EACH, write 2-4 numbered solution STEPS, then a final 'Answer: ...' line so the student can self-check AFTER attempting.\n\n${SAFETY_POLICY}`,
  image:
    `You analyze a study-material image (notes, textbook page, diagram, math problem, handwriting). First TEACH the main concept clearly (3-5 short bullets explaining what's shown and WHY). Then list 3 quick-check questions WITHOUT answers — the app will quiz the student for XP.\n\n${SAFETY_POLICY}`,
  burn:
    `You re-quiz a student on items they previously missed. Reword the question but test the SAME concept. Be encouraging.\n\n${SAFETY_POLICY}`,
  roleplay:
    `You play a HISTORICAL FIGURE or LITERARY CHARACTER for an academic debate. Stay in character with real, verifiable facts. Refuse to break character into anything inappropriate. Keep responses under 150 words.\n\n${SAFETY_POLICY}`,
};

async function callGateway(body: any) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function gatewayErrorResponse(r: Response) {
  if (r.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (r.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const userId = await requireUser(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized — please sign in." }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json();
    const { mode, prompt, imageUrl, topic, count, difficulty, question, expected, userAnswer, sampleQuestion, messages: convo } = payload;

    if (!Deno.env.get("LOVABLE_API_KEY")) throw new Error("LOVABLE_API_KEY missing");

    // ===== AI grading =====
    if (mode === "grade") {
      const r = await callGateway({
        model: MODEL,
        messages: [
          { role: "system", content: "You are a LENIENT grader for a grade 6-12 student. Mark correct if the MAIN POINT matches. Minor errors, missing details, or rephrasing are fine. Only mark wrong if the core concept is missing or incorrect." },
          { role: "user", content: `Question: ${question}\nExpected: ${expected}\nStudent: ${userAnswer}` },
        ],
        tools: [{ type: "function", function: { name: "grade", parameters: { type: "object", properties: { correct: { type: "boolean" }, feedback: { type: "string" } }, required: ["correct", "feedback"], additionalProperties: false } } }],
        tool_choice: { type: "function", function: { name: "grade" } },
      });
      if (!r.ok) return gatewayErrorResponse(r);
      const data = await r.json();
      const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      const parsed = args ? JSON.parse(args) : { correct: false, feedback: "Could not grade." };
      return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== Generate 3 follow-up questions on a topic (used for the XP gate) =====
    if (mode === "followups") {
      const r = await callGateway({
        model: MODEL,
        messages: [
          { role: "system", content: "Generate exactly 3 SHORT comprehension questions about the given topic to verify a student understood it. Vary difficulty (easy → medium → hard). For each question, give a concise expected answer." },
          { role: "user", content: `Topic: ${topic}\nContext: ${(prompt || "").slice(0, 800)}` },
        ],
        tools: [{ type: "function", function: { name: "make_followups", parameters: { type: "object", properties: { questions: { type: "array", items: { type: "object", properties: { question: { type: "string" }, expected: { type: "string" } }, required: ["question", "expected"], additionalProperties: false } } }, required: ["questions"], additionalProperties: false } } }],
        tool_choice: { type: "function", function: { name: "make_followups" } },
      });
      if (!r.ok) return gatewayErrorResponse(r);
      const data = await r.json();
      const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      const parsed = args ? JSON.parse(args) : { questions: [] };
      // Force exactly 3
      parsed.questions = (parsed.questions || []).slice(0, 3);
      return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== Test generation (existing) =====
    if (mode === "test") {
      const r = await callGateway({
        model: MODEL,
        messages: [
          { role: "system", content: "Expert exam author. Produce balanced, accurate questions appropriate to the requested difficulty." },
          { role: "user", content: `Create a ${difficulty ?? "medium"} ${count ?? 5}-question test on: ${topic}. Mix MCQs (4 choices), short-answer, one problem-solving.` },
        ],
        tools: [{ type: "function", function: { name: "build_test", parameters: { type: "object", properties: { title: { type: "string" }, questions: { type: "array", items: { type: "object", properties: { type: { type: "string", enum: ["mcq", "short", "problem"] }, question: { type: "string" }, choices: { type: "array", items: { type: "string" } }, answer: { type: "string" }, explanation: { type: "string" } }, required: ["type", "question", "answer"], additionalProperties: false } } }, required: ["title", "questions"], additionalProperties: false } } }],
        tool_choice: { type: "function", function: { name: "build_test" } },
      });
      if (!r.ok) return gatewayErrorResponse(r);
      const data = await r.json();
      const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      const parsed = args ? JSON.parse(args) : { title: "Test", questions: [] };
      return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== Style-Mimicry exam generation =====
    if (mode === "mimic") {
      const r = await callGateway({
        model: MODEL,
        messages: [
          { role: "system", content: "Analyze a sample exam question (its style, vocabulary, structure, difficulty level, and emphasis), then generate 5 NEW questions on the same topic that match that exact style. Academic only." },
          { role: "user", content: `Sample question:\n${sampleQuestion}\n\nGenerate 5 questions about: ${topic}` },
        ],
        tools: [{ type: "function", function: { name: "build_mimic", parameters: { type: "object", properties: { style_notes: { type: "string", description: "1-2 sentence summary of detected style" }, questions: { type: "array", items: { type: "object", properties: { question: { type: "string" }, answer: { type: "string" } }, required: ["question", "answer"], additionalProperties: false } } }, required: ["style_notes", "questions"], additionalProperties: false } } }],
        tool_choice: { type: "function", function: { name: "build_mimic" } },
      });
      if (!r.ok) return gatewayErrorResponse(r);
      const data = await r.json();
      const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      return new Response(args || JSON.stringify({ style_notes: "", questions: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== Vision: extract diagram labels for blank-out quiz =====
    if (mode === "diagram-quiz" && imageUrl) {
      const r = await callGateway({
        model: VISION_MODEL,
        messages: [
          { role: "system", content: "You analyze academic diagrams (biology, anatomy, chemistry, physics, geography). Identify all labeled parts. If the image isn't an academic diagram, respond with empty labels." },
          { role: "user", content: [
            { type: "text", text: "List the labeled parts in this diagram. For each, give the label, what it is, and a hint." },
            { type: "image_url", image_url: { url: imageUrl } },
          ] },
        ],
        tools: [{ type: "function", function: { name: "extract_labels", parameters: { type: "object", properties: { subject: { type: "string" }, labels: { type: "array", items: { type: "object", properties: { label: { type: "string" }, definition: { type: "string" }, hint: { type: "string" } }, required: ["label", "definition"], additionalProperties: false } } }, required: ["subject", "labels"], additionalProperties: false } } }],
        tool_choice: { type: "function", function: { name: "extract_labels" } },
      });
      if (!r.ok) return gatewayErrorResponse(r);
      const data = await r.json();
      const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      return new Response(args || JSON.stringify({ subject: "", labels: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== Cheat detection — flags ONLY academic dishonesty + harmful content =====
    if (mode === "check-cheat") {
      const r = await callGateway({
        model: MODEL,
        messages: [
          { role: "system", content: "Decide if a student's request should be FLAGGED. Flag = TRUE ONLY if: 1) ACADEMIC DISHONESTY: explicitly asking the AI to WRITE a finished essay/paper/speech/letter/homework FOR them, or to give a final graded answer (not learning the concept). 2) HARMFUL/EXPLICIT: sexual, violent, hateful, illegal, self-harm, drugs. Flag = FALSE for: legitimate learning questions on ANY topic, asking for explanations, asking for help understanding, discussing people factually, study planning, mental wellbeing, careers, current events. Be PERMISSIVE for learning, STRICT for cheating/harm." },
          { role: "user", content: `Student request: """${prompt}"""` },
        ],
        tools: [{ type: "function", function: { name: "classify", parameters: { type: "object", properties: { cheat: { type: "boolean" }, reason: { type: "string" } }, required: ["cheat", "reason"], additionalProperties: false } } }],
        tool_choice: { type: "function", function: { name: "classify" } },
      });
      if (!r.ok) return new Response(JSON.stringify({ cheat: false, reason: "" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const data = await r.json();
      const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      const parsed = args ? JSON.parse(args) : { cheat: false, reason: "" };
      return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== Streaming modes =====
    const systemMsg = SYSTEM_PROMPTS[mode] ?? `You are a helpful study assistant. Keep replies under 250 words.\n\n${SAFETY_POLICY}`;
    const isVision = (mode === "image" || mode === "vision") && imageUrl;
    const userContent: any = isVision
      ? [
          { type: "text", text: prompt || "Analyze this study material image." },
          { type: "image_url", image_url: { url: imageUrl } },
        ]
      : prompt;

    const baseMessages = convo && Array.isArray(convo) && convo.length
      ? [{ role: "system", content: systemMsg }, ...convo]
      : [{ role: "system", content: systemMsg }, { role: "user", content: userContent }];

    const r = await callGateway({
      model: isVision ? VISION_MODEL : MODEL,
      messages: baseMessages,
      stream: true,
    });

    if (!r.ok) return gatewayErrorResponse(r);
    return new Response(r.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("ai-tutor error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
