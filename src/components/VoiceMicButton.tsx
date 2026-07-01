import { useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const STT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-stt`;

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function VoiceMicButton() {
  const navigate = useNavigate();
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAt = useRef(0);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        const dur = (Date.now() - startedAt.current) / 1000;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        if (dur < 0.6) { toast.error("Too short — hold and speak"); return; }
        setBusy(true);
        try {
          const ab = await blob.arrayBuffer();
          const bytes = new Uint8Array(ab);
          let bin = "";
          for (let i = 0; i < bytes.length; i += 0x8000)
            bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
          const b64 = btoa(bin);
          const r = await fetch(STT_URL, {
            method: "POST",
            headers: await authHeaders(),
            body: JSON.stringify({ audioBase64: b64, mimeType: blob.type, durationSec: dur }),
          });
          if (!r.ok) { toast.error("Couldn't hear you — try again"); return; }
          const j = await r.json();
          const text = (j.transcript || "").trim();
          if (!text) { toast.error("No speech detected"); return; }
          toast.success("Got it — asking your AI tutor…");
          navigate(`/ai?q=${encodeURIComponent(text)}`);
        } catch (e: any) {
          toast.error(e.message || "Voice failed");
        } finally {
          setBusy(false);
        }
      };
      startedAt.current = Date.now();
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch {
      toast.error("Mic access denied");
    }
  };

  const stop = () => {
    recRef.current?.stop();
    setRecording(false);
  };

  if (busy) {
    return (
      <button
        disabled
        aria-label="Processing voice"
        className="h-9 w-9 sm:h-10 sm:w-10 rounded-full grid place-items-center bg-primary/20 text-primary"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
      </button>
    );
  }

  return recording ? (
    <button
      onClick={stop}
      aria-label="Stop recording"
      className="h-9 w-9 sm:h-10 sm:w-10 rounded-full grid place-items-center bg-destructive text-destructive-foreground animate-pulse shadow-glow"
    >
      <Square className="h-4 w-4" />
    </button>
  ) : (
    <button
      onClick={start}
      aria-label="Ask by voice"
      title="Ask by voice"
      className="h-9 w-9 sm:h-10 sm:w-10 rounded-full grid place-items-center bg-gradient-primary text-primary-foreground shadow-glow hover:scale-105 transition"
    >
      <Mic className="h-4 w-4" />
    </button>
  );
}
