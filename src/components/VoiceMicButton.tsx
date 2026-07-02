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
      // Proactive permission check for clearer errors
      if (navigator.permissions) {
        try {
          const st = await navigator.permissions.query({ name: "microphone" as PermissionName });
          if (st.state === "denied") {
            toast.error("Microphone blocked — enable it in your browser settings.");
            return;
          }
        } catch { /* not all browsers support this query */ }
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Pick a mimeType the browser actually supports (Safari = mp4, others = webm)
      const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/mpeg"];
      const supported = candidates.find((t) =>
        typeof MediaRecorder !== "undefined" && (MediaRecorder as any).isTypeSupported?.(t)
      );
      const rec = supported ? new MediaRecorder(stream, { mimeType: supported }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        const dur = (Date.now() - startedAt.current) / 1000;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        if (dur < 0.6 || blob.size < 2048) { toast.error("Too short — hold and speak clearly"); return; }
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
          const j = await r.json().catch(() => ({} as any));
          if (!r.ok || j.error) { toast.error(j.error || "Couldn't hear you — try again"); return; }
          const text = (j.transcript || "").trim();
          if (!text) { toast.error("No speech detected — speak a bit louder"); return; }
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
    } catch (e: any) {
      if (e?.name === "NotAllowedError") toast.error("Mic access denied — enable it in browser settings");
      else if (e?.name === "NotFoundError") toast.error("No microphone found");
      else if (e?.name === "NotReadableError") toast.error("Mic is being used by another app");
      else toast.error(e?.message || "Mic access denied");
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
