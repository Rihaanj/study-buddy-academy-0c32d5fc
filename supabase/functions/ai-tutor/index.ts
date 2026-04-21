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
    "You are a fast, friendly AI tutor for grade 6-8 students. Keep answers SHORT (under 200 words). Use markdown bullets, 1 example. Never write a student's essay, paragraph, paper, report, story, speech, or homework for them.",
  practice:
    "You are an adaptive practice generator. Create 3-5 short questions on the requested topic with increasing difficulty. For EACH question, provide a step-by-step solution FIRST (2-4 numbered steps) that walks through how to solve it, then a final line 'Answer: ...' with the final answer. Keep the whole response tight.",
  image:
    "You analyze study material images. Extract key concepts as concise bullets, then 3 quick-check questions with answers.",
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
          { role: "system", content: "Decide if a student's request to an AI is academic cheating. Cheating = asking the AI to WRITE their essay/paragraph/paper/speech/homework, DO their math/problem sets, or complete an assignment for them. NOT cheating = asking for explanations, examples, study help, or feedback on work the student wrote. Be strict but fair." },
          { role: "user", content: `Student request: """${prompt}"""` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "classify",
            parameters: {
              type: "object",
              properties: {
                cheat: { type: "boolean" },
                reason: { type: "string", description: "Short reason phrase, e.g. 'Asked AI to write an essay'." },
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
