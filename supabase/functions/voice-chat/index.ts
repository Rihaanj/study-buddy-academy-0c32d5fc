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

const SYS = `You are Study Bud, a friendly voice buddy for students. This is a spoken chat, NOT a lesson.
Rules:
- Reply in 1-3 short sentences, conversational and warm, like a friend talking back.
- If greeted ("hi", "hello", "what's up"), greet back naturally and ask what they want to do.
- If the user asks a factual/study question, give a brief spoken answer and offer to open a full lesson if they want.
- No lists, no markdown, no headings, no code fences. Plain ASCII only.
- Never write essays, homework, or graded work. Politely refuse and offer to teach the concept instead.
- Refuse explicit/violent/hateful/illegal content briefly and redirect to studying.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const uid = await requireUser(req);
  if (!uid) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { message, history } = await req.json();
    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "message required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");

    const msgs = [
      { role: "system", content: SYS },
      ...(Array.isArray(history) ? history.slice(-6).map((m: any) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 500) })) : []),
      { role: "user", content: message.slice(0, 1000) },
    ];

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: msgs }),
    });
    if (!r.ok) {
      const err = await r.text().catch(() => "");
      console.error("voice-chat gateway", r.status, err);
      return new Response(JSON.stringify({ reply: "I'm having trouble hearing right now. Try again in a moment." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const j = await r.json();
    const reply = String(j.choices?.[0]?.message?.content || "Hey! What do you want to study?").trim().slice(0, 500);
    return new Response(JSON.stringify({ reply }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("voice-chat", e);
    return new Response(JSON.stringify({ reply: "Hey! I couldn't process that. Try again?" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
