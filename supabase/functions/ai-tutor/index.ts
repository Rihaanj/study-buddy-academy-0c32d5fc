import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// CHEAP MODEL: gemini-2.5-flash-lite is the cheapest, fast Gemini model — ideal for ~1000 chats/$1
const MODEL = "google/gemini-2.5-flash-lite";

const SYSTEM_PROMPTS: Record<string, string> = {
  tutor:
    "You are a friendly AI tutor for grade 6–8 students. Explain topics in simple language, with a real-world example, and a clear step-by-step breakdown. Use markdown headings and bullet points. Keep responses concise (under 300 words). NEVER write a student's essay, paragraph, paper, report, story, speech, or homework assignment for them. If asked to do so, politely refuse and instead offer to: (1) explain the topic, (2) outline the structure, (3) give writing tips, or (4) review what the student wrote themselves.",
  practice:
    "You are an adaptive practice generator. Create 3-5 short, varied questions on the requested topic with increasing difficulty. After each question include a hidden answer in this exact form: 'Answer: ...'.",
  image:
    "You will analyze an image of study material. Extract the key concepts, summarize as concise notes, then generate 3 quick-check questions with answers.",
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
          { role: "system", content: "You are a LENIENT exam grader for a 6th–8th grade student. Mark the answer correct if the MAIN POINT or KEY IDEA matches the expected answer, even if wording, spelling, capitalization, punctuation, or extra detail differs. Do NOT grade word-by-word. Minor errors, missing supporting details, or rephrasing are fine — only mark wrong if the core concept is missing or incorrect." },
          { role: "user", content: `Question: ${question}\nExpected answer: ${expected}\nStudent answer: ${userAnswer}\n\nIs the main point of the student's answer correct?` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "grade_answer",
            description: "Return grading verdict.",
            parameters: {
              type: "object",
              properties: {
                correct: { type: "boolean", description: "True if the student's answer captures the same idea." },
                feedback: { type: "string", description: "One-sentence explanation of why." },
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
          { role: "system", content: "You are an expert exam author. Produce balanced, accurate questions appropriate to the requested difficulty." },
          { role: "user", content: `Create a ${difficulty ?? "medium"} difficulty test on: ${topic}. Include ${count ?? 5} mixed questions: MCQs (4 choices), short-answer, and one problem-solving.` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "build_test",
            description: "Return a structured test.",
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
        const t = await r.text();
        console.error("AI error", r.status, t);
        return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const data = await r.json();
      const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      const parsed = args ? JSON.parse(args) : { title: "Test", questions: [] };
      return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== STREAMING (tutor / practice / image / generic) =====
    const systemMsg = SYSTEM_PROMPTS[mode] ?? "You are a helpful study assistant.";
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
      const t = await r.text();
      console.error("AI error", r.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(r.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("ai-tutor error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
