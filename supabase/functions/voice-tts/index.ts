import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Default voice = Sarah (conversational, friendly)
const DEFAULT_VOICE = "EXAVITQu4vr4xnSDxMaL";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { text, voiceId } = await req.json();
    const ELEVEN = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVEN) throw new Error("ELEVENLABS_API_KEY missing");
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const trimmed = text.trim().slice(0, 4500); // safety cap
    const voice = voiceId || DEFAULT_VOICE;

    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": ELEVEN, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: trimmed,
        model_id: "eleven_turbo_v2_5",
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      console.error("eleven tts error", r.status, err);
      return new Response(JSON.stringify({ error: `TTS failed: ${r.status}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const buf = await r.arrayBuffer();
    return new Response(buf, { headers: { ...corsHeaders, "Content-Type": "audio/mpeg" } });
  } catch (e) {
    console.error("voice-tts", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
