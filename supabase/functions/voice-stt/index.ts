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
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const userId = await requireUser(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { audioBase64, mimeType, durationSec } = await req.json();
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "Voice AI is not ready yet. Try again in a moment." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!audioBase64 || typeof audioBase64 !== "string") {
      return new Response(JSON.stringify({ error: "audioBase64 required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const binary = atob(audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

    const mt = (mimeType || "audio/wav").split(";")[0];
    const extMap: Record<string, string> = {
      "audio/webm": "webm",
      "audio/mp4": "mp4",
      "audio/mpeg": "mp3",
      "audio/wav": "wav",
      "audio/x-wav": "wav",
      "audio/ogg": "ogg",
    };
    const ext = extMap[mt] || "wav";
    const blob = new Blob([bytes], { type: mt });
    if (blob.size < 1024) {
      return new Response(JSON.stringify({ error: "No speech detected. Hold the mic and speak clearly." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fd = new FormData();
    fd.append("file", blob, `recording.${ext}`);
    fd.append("model", "openai/gpt-4o-transcribe");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const r = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Lovable-API-Key": lovableKey,
        "X-Lovable-AIG-SDK": "raw-edge-function",
      },
      body: fd,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!r.ok) {
      const err = await r.text().catch(() => "");
      console.error("stt error", r.status, err);
      const msg = r.status === 402 || r.status === 429
        ? "Voice AI is busy. Try again in a moment."
        : r.status === 400
        ? "I could not hear clear speech. Try again closer to the mic."
        : "Voice AI is reconnecting. Try again in a moment.";
      return new Response(JSON.stringify({ error: msg }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await r.json();
    const transcript = String(data.text || "").trim();
    if (!transcript) {
      return new Response(JSON.stringify({ error: "No speech detected. Try again a little louder." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fillerPattern = /\b(um|uh|like|you know|so|basically|literally|actually)\b/gi;
    const fillers = (transcript.match(fillerPattern) || []).length;
    const wordCount = transcript.split(/\s+/).filter(Boolean).length;
    const minutes = durationSec && durationSec > 0 ? durationSec / 60 : Math.max(0.1, wordCount / 150);
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
    const msg = e instanceof DOMException && e.name === "AbortError"
      ? "Voice AI took too long. Try a shorter recording."
      : "Voice AI is reconnecting. Try again in a moment.";
    return new Response(JSON.stringify({ error: msg }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});