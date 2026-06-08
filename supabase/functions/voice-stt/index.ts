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

// Receives a base64 audio blob, returns transcript + simple presentation analysis (filler words, pace, words/min).
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const userId = await requireUser(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const { audioBase64, mimeType, durationSec } = await req.json();
    const ELEVEN = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVEN) throw new Error("ELEVENLABS_API_KEY missing");
    if (!audioBase64) {
      return new Response(JSON.stringify({ error: "audioBase64 required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Decode in chunks to avoid stack overflow
    const binary = atob(audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mimeType || "audio/webm" });

    const fd = new FormData();
    fd.append("file", blob, "audio.webm");
    fd.append("model_id", "scribe_v2");
    fd.append("language_code", "eng");
    fd.append("tag_audio_events", "false");
    fd.append("diarize", "false");

    const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": ELEVEN },
      body: fd,
    });

    if (!r.ok) {
      const err = await r.text();
      console.error("eleven stt error", r.status, err);
      return new Response(JSON.stringify({ error: `STT failed: ${r.status}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await r.json();
    const transcript: string = data.text || "";

    const fillerPattern = /\b(um|uh|like|you know|so|basically|literally|actually)\b/gi;
    const fillers = (transcript.match(fillerPattern) || []).length;
    const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
    const minutes = (durationSec && durationSec > 0) ? durationSec / 60 : Math.max(0.1, wordCount / 150);
    const wpm = Math.round(wordCount / minutes);

    let paceLabel = "steady";
    if (wpm < 110) paceLabel = "slow";
    else if (wpm > 170) paceLabel = "fast";

    return new Response(JSON.stringify({
      transcript,
      wordCount,
      fillerCount: fillers,
      wordsPerMinute: wpm,
      paceLabel,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("voice-stt", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
