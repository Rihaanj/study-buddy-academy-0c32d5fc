import { useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const STT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-stt`;
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-chat`;
const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-tts`;

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  let token = data.session?.access_token;
  if (!token) {
    const refreshed = await supabase.auth.refreshSession();
    token = refreshed.data.session?.access_token;
  }
  if (!token) throw new Error("Please sign in again to use voice.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

// Persistent short chat memory across mic taps (per session)
const history: { role: "user" | "assistant"; content: string }[] = [];

function mergeAudio(chunks: Float32Array[]) {
  const length = chunks.reduce((s, c) => s + c.length, 0);
  const merged = new Float32Array(length);
  let offset = 0;
  for (const c of chunks) { merged.set(c, offset); offset += c.length; }
  return merged;
}
function downsample(input: Float32Array, inputRate: number, outputRate = 16000) {
  if (inputRate === outputRate) return input;
  const ratio = inputRate / outputRate;
  const outputLength = Math.round(input.length / ratio);
  const output = new Float32Array(outputLength);
  let inputOffset = 0;
  for (let i = 0; i < outputLength; i++) {
    const nextOffset = Math.round((i + 1) * ratio);
    let total = 0, count = 0;
    for (let j = inputOffset; j < nextOffset && j < input.length; j++) { total += input[j]; count++; }
    output[i] = count ? total / count : 0;
    inputOffset = nextOffset;
  }
  return output;
}
function encodeWav(chunks: Float32Array[], sampleRate: number) {
  const pcm = downsample(mergeAudio(chunks), sampleRate, 16000);
  const bytes = 2;
  const buf = new ArrayBuffer(44 + pcm.length * bytes);
  const view = new DataView(buf);
  const write = (o: number, t: string) => { for (let i = 0; i < t.length; i++) view.setUint8(o + i, t.charCodeAt(i)); };
  write(0, "RIFF"); view.setUint32(4, 36 + pcm.length * bytes, true); write(8, "WAVE");
  write(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true); view.setUint32(28, 16000 * bytes, true); view.setUint16(32, bytes, true); view.setUint16(34, 16, true);
  write(36, "data"); view.setUint32(40, pcm.length * bytes, true);
  let o = 44;
  for (let i = 0; i < pcm.length; i++, o += 2) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([view], { type: "audio/wav" });
}
async function blobToBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function VoiceMicButton() {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const speechRef = useRef<any>(null);
  const speechTextRef = useRef("");
  const interimTextRef = useRef("");
  const speechConfidenceRef = useRef(0);
  const speechFinalRef = useRef(false);
  const chunksRef = useRef<Float32Array[]>([]);
  const startedAt = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const cleanup = async () => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    try { speechRef.current?.stop?.(); } catch { /* noop */ }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (ctxRef.current && ctxRef.current.state !== "closed") await ctxRef.current.close().catch(() => undefined);
    processorRef.current = null; sourceRef.current = null; streamRef.current = null; ctxRef.current = null; speechRef.current = null;
  };

  const start = async () => {
    try {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      if (!window.isSecureContext) { toast.error("Voice needs HTTPS. Open the published app URL."); return; }
      if (!navigator.mediaDevices?.getUserMedia) {
        const inIframe = window.self !== window.top;
        toast.error(inIframe ? "Mic blocked in preview. Open the app in a new tab to use voice." : "Voice input not supported in this browser");
        return;
      }
      // Proactive permission check for clearer errors
      try {
        // @ts-expect-error - PermissionName includes "microphone" in most browsers
        const status = await navigator.permissions?.query?.({ name: "microphone" });
        if (status?.state === "denied") {
          toast.error("Mic blocked. Click the lock icon in the address bar and allow the microphone.");
          return;
        }
      } catch { /* not supported, continue */ }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      await ctx.resume();
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      const silent = ctx.createGain(); silent.gain.value = 0;
      chunksRef.current = []; speechTextRef.current = ""; interimTextRef.current = ""; speechConfidenceRef.current = 0; speechFinalRef.current = false;
      processor.onaudioprocess = (e) => { chunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0))); };
      source.connect(processor); processor.connect(silent); silent.connect(ctx.destination);
      streamRef.current = stream; ctxRef.current = ctx; sourceRef.current = source; processorRef.current = processor;
      startedAt.current = Date.now();

      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR) {
        const rec = new SR(); rec.lang = "en-US"; rec.continuous = true; rec.interimResults = true;
        rec.maxAlternatives = 1;
        rec.onresult = (ev: any) => {
          let finalText = "";
          let interimText = "";
          for (let i = 0; i < ev.results.length; i++) {
            const transcript = ev.results[i][0]?.transcript || "";
            if (ev.results[i].isFinal) { finalText += transcript; speechFinalRef.current = true; }
            else interimText += transcript;
            speechConfidenceRef.current = Math.max(speechConfidenceRef.current, ev.results[i][0]?.confidence || 0);
          }
          if (finalText.trim()) speechTextRef.current = finalText.trim();
          interimTextRef.current = interimText.trim();
        };
        rec.onerror = () => undefined; rec.onend = () => undefined;
        speechRef.current = rec;
        try { rec.start(); } catch { /* noop */ }
      }
      setRecording(true);
      toast.success("Listening…");
    } catch (e: any) {
      await cleanup();
      const inIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
      const name = e?.name || "";
      const msg = String(e?.message || "").toLowerCase();
      if (name === "NotAllowedError" || name === "SecurityError") {
        if (inIframe || msg.includes("permissions policy") || msg.includes("permission policy")) {
          toast.error("Mic blocked by preview iframe. Open the app in a new tab to talk.");
        } else if (msg.includes("dismissed") || msg.includes("system")) {
          toast.error("Mic prompt was dismissed. Click the mic again and choose Allow.");
        } else {
          toast.error("Mic access denied. Click the lock icon in the address bar and allow the microphone.");
        }
      } else if (name === "NotFoundError") toast.error("No microphone found");
      else if (name === "NotReadableError") toast.error("Microphone is in use by another app.");
      else toast.error(e?.message || "Could not access microphone");
    }
  };

  const speakWithBrowser = (text: string) => {
    const synth = window.speechSynthesis;
    if (!synth) return false;
    synth.cancel();
    const voices = synth.getVoices?.() || [];
    const voice = voices.find((v) => /natural|samantha|aria|jenny|google us english|english united states/i.test(v.name))
      || voices.find((v) => /^en[-_]/i.test(v.lang));
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    if (voice) utterance.voice = voice;
    utterance.rate = 0.98;
    utterance.pitch = 1;
    utterance.volume = 1;
    synth.speak(utterance);
    return true;
  };

  const playReply = async (text: string) => {
    if (speakWithBrowser(text)) return;
    try {
      const r = await fetch(TTS_URL, { method: "POST", headers: await authHeaders(), body: JSON.stringify({ text: text.slice(0, 1000) }) });
      if (!r.ok) { speakWithBrowser(text); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      audioRef.current = a;
      await a.play().catch(() => { speakWithBrowser(text); });
    } catch { speakWithBrowser(text); }
  };

  const stop = async () => {
    if (busy) return;
    const dur = (Date.now() - startedAt.current) / 1000;
    const sampleRate = ctxRef.current?.sampleRate || 44100;
    const chunks = chunksRef.current.slice();
    setRecording(false);
    setBusy(true);
    await cleanup();

    try {
      let text = "";
      const browserText = speechTextRef.current.trim() || interimTextRef.current.trim();
      if (browserText && speechFinalRef.current && (speechConfidenceRef.current === 0 || speechConfidenceRef.current >= 0.65)) text = browserText;
      if (!text) {
        const blob = encodeWav(chunks, sampleRate);
        if (dur < 0.5 || blob.size < 2048) { toast.error("Too short. Hold and speak."); return; }
        const r = await fetch(STT_URL, {
          method: "POST",
          headers: await authHeaders(),
          body: JSON.stringify({ audioBase64: await blobToBase64(blob), mimeType: "audio/wav", durationSec: dur }),
        });
        const j = await r.json().catch(() => ({} as any));
        if (r.status === 401) { await playReply("Please sign in again before using voice."); return; }
        if (!r.ok || j.error) {
          if (browserText) text = browserText;
          else { toast.error(j.error || "Couldn't hear you. Try again."); return; }
        } else {
          text = String(j.transcript || "").trim() || browserText;
        }
      }
      if (!text) { toast.error("No speech detected."); return; }

      // Conversational reply (not a lesson)
      history.push({ role: "user", content: text });
      const cr = await fetch(CHAT_URL, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ message: text, history: history.slice(-6) }),
      });
      const cj = await cr.json().catch(() => ({} as any));
      if (cr.status === 401) { await playReply("Please sign in again before using voice."); return; }
      const reply = String(cj.reply || "").trim() || "Hey! What do you want to study?";
      history.push({ role: "assistant", content: reply });
      toast.success("Speaking…");
      await playReply(reply);
    } catch (e: any) {
      toast.error(e.message || "Voice failed");
    } finally {
      chunksRef.current = []; speechTextRef.current = ""; interimTextRef.current = ""; speechConfidenceRef.current = 0; speechFinalRef.current = false; setBusy(false);
    }
  };

  if (busy) {
    return (
      <button disabled aria-label="Processing voice" className="h-9 w-9 sm:h-10 sm:w-10 rounded-full grid place-items-center bg-primary/20 text-primary">
        <Loader2 className="h-4 w-4 animate-spin" />
      </button>
    );
  }
  return recording ? (
    <button onClick={stop} aria-label="Stop recording" className="h-9 w-9 sm:h-10 sm:w-10 rounded-full grid place-items-center bg-destructive text-destructive-foreground animate-pulse shadow-glow">
      <Square className="h-4 w-4" />
    </button>
  ) : (
    <button onClick={start} aria-label="Talk to Study Bud" title="Talk to Study Bud" className="h-9 w-9 sm:h-10 sm:w-10 rounded-full grid place-items-center bg-gradient-primary text-primary-foreground shadow-glow hover:scale-105 transition">
      <Mic className="h-4 w-4" />
    </button>
  );
}
