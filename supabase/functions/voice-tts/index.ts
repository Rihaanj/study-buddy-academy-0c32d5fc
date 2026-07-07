import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    const { data, error } = await sb.auth.getClaims(jwt);
    if (error || !data?.claims?.sub) return null;
    return data.claims.sub;
  } catch { return null; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const userId = await requireUser(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const { text } = await req.json();
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) throw new Error("LOVABLE_API_KEY missing");
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const trimmed = text.trim().slice(0, 3500);

    const r = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
      method: "POST",
      headers: {
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "raw-edge-function",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini-tts",
        input: trimmed,
        voice: "alloy",
        response_format: "mp3",
        stream_format: "audio",
        instructions: "Speak warmly and naturally like a friendly study buddy. Use a moderate pace, not slow and not rushed.",
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      console.error("lovable tts error", r.status, err);
      return new Response(JSON.stringify({ error: `TTS failed: ${r.status}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const buf = await r.arrayBuffer();
    return new Response(buf, { headers: { ...corsHeaders, "Content-Type": "audio/mpeg" } });
  } catch (e) {
    console.error("voice-tts", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
