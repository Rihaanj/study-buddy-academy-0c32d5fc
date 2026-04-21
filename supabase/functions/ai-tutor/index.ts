import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// CHEAPEST + fastest Gemini model
const MODEL = "google/gemini-2.5-flash-lite";

const SYSTEM_PROMPTS: Record<string, string> = {
  tutor:
    "You are a STRICTLY ACADEMIC AI tutor for grade 6-8 students. ONLY answer questions about school subjects: math, science, history, English, geography, languages, art history, music theory, study skills. " +
    "REFUSE anything else (celebrities, gossip, dating, jokes about people, song lyrics, personal advice, roleplay, fiction writing, anything about 'Diddy' or other public figures, anything not directly tied to schoolwork). " +
    "If asked something off-topic, reply with EXACTLY: 'I can only help with academic schoolwork. Try asking about a subject you're studying.' " +
    "Keep on-topic answers SHORT (under 200 words), markdown bullets, 1 example. NEVER write a student's essay, paragraph, paper, report, story, speech, or homework for them.",
  practice:
    "You are an adaptive practice generator for ACADEMIC SUBJECTS ONLY (math, science, history, English, geography, languages). " +
    "If the topic is non-academic, inappropriate, about a person, or off-school-topic, respond with EXACTLY: 'I can only generate practice for academic subjects.' and nothing else. " +
    "Otherwise create 3-5 short questions on the requested topic with increasing difficulty. For EACH question, provide a step-by-step solution FIRST (2-4 numbered steps), then a final line 'Answer: ...' with the final answer. Keep tight.",
  image:
    "You analyze STUDY MATERIAL images only (textbook pages, notes, diagrams, math problems). " +
    "If the image isn't study material, reply EXACTLY: 'This doesn't look like study material. Please upload notes or a textbook page.' " +
    "Otherwise extract key concepts as concise bullets, then 3 quick-check questions with answers.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mode, prompt, imageUrl, topic, count, difficulty, question, expected, userAnswer } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    // ===== AI-JUDGED GRADING =====
    if (mode === "grade") {
      const body = {
        model: MODEL,
        messages: [
          { role: "system", content: "You are a LENIENT exam grader for a 6th-8th grade student. Mark correct if the MAIN POINT matches. Minor errors, missing details, or rephrasing are fine. Only mark wrong if the core concept is missing or incorrect." },
          { role: "user", content: `Question: ${question}\nExpected answer: ${expected}\nStudent answer: ${userAnswer}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "grade_answer",
            description: "Return grading verdict.",
            parameters: {
              type: "object",
              properties: {
                correct: { type: "boolean" },
                feedback: { type: "string" },
              },
              required: ["correct", "feedback"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "grade_answer" } },
      };
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        if (r.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (r.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const data = await r.json();
      const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      const parsed = args ? JSON.parse(args) : { correct: false, feedback: "Could not grade." };
      return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== TEST GENERATION =====
    if (mode === "test") {
      const body = {
        model: MODEL,
        messages: [
          { role: "system", content: "Expert exam author. Produce balanced, accurate questions appropriate to the requested difficulty. Keep wording tight." },
          { role: "user", content: `Create a ${difficulty ?? "medium"} ${count ?? 5}-question test on: ${topic}. Mix MCQs (4 choices), short-answer, one problem-solving.` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "build_test",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["mcq", "short", "problem"] },
                      question: { type: "string" },
                      choices: { type: "array", items: { type: "string" } },
                      answer: { type: "string" },
                      explanation: { type: "string" },
                    },
                    required: ["type", "question", "answer"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["title", "questions"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "build_test" } },
      };
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        if (r.status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (r.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const data = await r.json();
      const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      const parsed = args ? JSON.parse(args) : { title: "Test", questions: [] };
      return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== AI-JUDGED CHEATING DETECTION =====
    // Client calls this before sending the real prompt. Returns {cheat:boolean, reason:string}
    if (mode === "check-cheat") {
      const body = {
        model: MODEL,
        messages: [
          { role: "system", content:
            "Decide if a student's request to a school AI tutor should be FLAGGED. Flag = TRUE if ANY of these apply:\n" +
            "1. CHEATING: asking the AI to WRITE their essay/paragraph/paper/speech/letter/homework, DO their math problems, finish their assignment, or solve test questions for them.\n" +
            "2. OFF-TOPIC / NON-ACADEMIC: not about a school subject — examples include celebrities, gossip, 'Diddy', music artists, dating, social drama, jokes about people, fiction/roleplay, video games, sports, song lyrics, personal life advice, anything not tied to schoolwork.\n" +
            "3. INAPPROPRIATE: sexual, violent, hateful, drugs, or otherwise unsafe for a 6-8th grader.\n" +
            "Flag = FALSE only when the request is genuinely a study question (explanations, examples, study help, feedback on the student's own academic work).\n" +
            "Be STRICT — when unsure, flag it. The reason should clearly say which category and what specifically." },
          { role: "user", content: `Student request: """${prompt}"""` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "classify",
            parameters: {
              type: "object",
              properties: {
                cheat: { type: "boolean", description: "True if request should be flagged for the teacher to review." },
                reason: { type: "string", description: "Short reason, e.g. 'Asked AI to write an essay' or 'Off-topic: asked about Diddy'." },
              },
              required: ["cheat", "reason"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "classify" } },
      };
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        // If the classifier fails, default to NOT cheating (fail-open for UX).
        return new Response(JSON.stringify({ cheat: false, reason: "" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const data = await r.json();
      const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      const parsed = args ? JSON.parse(args) : { cheat: false, reason: "" };
      return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== STREAMING (tutor / practice / image / generic) =====
    const systemMsg = SYSTEM_PROMPTS[mode] ?? "You are a helpful study assistant. Keep replies under 200 words.";
    const userContent: any =
      mode === "image" && imageUrl
        ? [
            { type: "text", text: prompt || "Analyze this study material image." },
            { type: "image_url", image_url: { url: imageUrl } },
          ]
        : prompt;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: systemMsg }, { role: "user", content: userContent }],
        stream: true,
      }),
    });

    if (!r.ok) {
      if (r.status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (r.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(r.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("ai-tutor error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
