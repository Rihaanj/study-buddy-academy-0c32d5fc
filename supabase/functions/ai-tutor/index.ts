import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "google/gemini-2.5-flash-lite";
const VISION_MODEL = "google/gemini-2.5-flash"; // need vision

const SYSTEM_PROMPTS: Record<string, string> = {
  tutor:
    "You are a STRICTLY ACADEMIC AI tutor for grade 6-12 students. ONLY answer school subjects: math, science, history, English, geography, languages, art history, music theory, study skills, computer science. " +
    "REFUSE anything off-topic (celebrities, gossip, dating, jokes, song lyrics, personal advice, fiction writing). " +
    "If asked off-topic, reply EXACTLY: 'I can only help with academic schoolwork. Try asking about a subject you're studying.' " +
    "First TEACH the concept clearly with a short example, then end with: '\\n\\n---\\n_I'll quiz you on this in a moment to lock it in!_' Never write a student's essay/paper/speech for them.",
  socratic:
    "You are a SOCRATIC academic tutor. NEVER give direct answers. Instead, ask probing questions that guide the student to discover the answer themselves. " +
    "Ask ONE focused question at a time, wait for their response, then ask the next based on what they said. Be encouraging. Academic only.",
  analogy:
    "You explain academic concepts using vivid ANALOGIES. Pick from sports, cooking, gaming, or everyday life — whichever fits best. " +
    "Format: 1) The analogy (1 paragraph). 2) How it maps to the actual concept (3 bullets). 3) Where the analogy breaks down (1 sentence). Academic topics only.",
  prereqs:
    "You list FOUNDATIONAL skills a student should know BEFORE studying a topic. Output a numbered list of 3-6 prerequisites with one-line explanations. Academic only.",
  practice:
    "You generate practice questions for ACADEMIC SUBJECTS ONLY. If non-academic, reply EXACTLY: 'I can only generate practice for academic subjects.' " +
    "Otherwise: 3-5 short questions with increasing difficulty. For EACH, write 2-4 numbered solution steps THEN a final 'Answer: ...' line.",
  image:
    "You analyze STUDY MATERIAL images: textbook pages, notes, diagrams, math problems, handwritten work. " +
    "If not study material, reply EXACTLY: 'This doesn't look like study material. Please upload notes or a textbook page.' " +
    "Otherwise: First TEACH the main concept clearly (3-5 short bullets explaining what's shown). Then list 3 quick-check questions WITHOUT answers (the app will quiz the student).",
  burn:
    "You re-quiz a student on questions they previously got wrong. Use a slightly different wording but test the same concept. Academic only.",
  roleplay:
    "You play a HISTORICAL FIGURE or LITERARY CHARACTER for an academic debate/roleplay. Stay in character but cite real historical facts. Refuse to break character into anything inappropriate or non-academic. Keep responses under 150 words.",
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

    // ===== Cheat detection (existing) =====
    if (mode === "check-cheat") {
      const r = await callGateway({
        model: MODEL,
        messages: [
          { role: "system", content: "Decide if a student's request to a school AI tutor should be FLAGGED. Flag = TRUE if any apply: 1) CHEATING: write essay/paragraph/paper/speech/letter/homework, do their math problems, finish assignments. 2) OFF-TOPIC: celebrities, Diddy, dating, drama, fiction, lyrics, personal advice, anything not schoolwork. 3) INAPPROPRIATE: sexual, violent, hateful, drugs. Flag = FALSE only when genuinely a study question. Be STRICT." },
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
    const systemMsg = SYSTEM_PROMPTS[mode] ?? "You are a helpful study assistant. Keep replies under 200 words. Academic only.";
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
