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

function mergeAudio(chunks: Float32Array[]) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

function downsample(input: Float32Array, inputRate: number, outputRate = 16000) {
  if (inputRate === outputRate) return input;
  const ratio = inputRate / outputRate;
  const outputLength = Math.round(input.length / ratio);
  const output = new Float32Array(outputLength);
  let inputOffset = 0;
  for (let i = 0; i < outputLength; i += 1) {
    const nextOffset = Math.round((i + 1) * ratio);
    let total = 0;
    let count = 0;
    for (let j = inputOffset; j < nextOffset && j < input.length; j += 1) {
      total += input[j];
      count += 1;
    }
    output[i] = count ? total / count : 0;
    inputOffset = nextOffset;
  }
  return output;
}

function encodeWav(chunks: Float32Array[], sampleRate: number) {
  const pcm = downsample(mergeAudio(chunks), sampleRate, 16000);
  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + pcm.length * bytesPerSample);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + pcm.length * bytesPerSample, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true);
  view.setUint32(28, 16000 * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, pcm.length * bytesPerSample, true);
  let offset = 44;
  for (let i = 0; i < pcm.length; i += 1, offset += 2) {
    const sample = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return new Blob([view], { type: "audio/wav" });
}

async function blobToBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    const slice = bytes.subarray(i, i + 0x8000);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export function VoiceMicButton() {
  const navigate = useNavigate();
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const speechRef = useRef<any>(null);
  const speechTextRef = useRef("");
  const chunksRef = useRef<Float32Array[]>([]);
  const startedAt = useRef(0);

  const cleanup = async () => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    speechRef.current?.stop?.();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (ctxRef.current && ctxRef.current.state !== "closed") await ctxRef.current.close().catch(() => undefined);
    processorRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    ctxRef.current = null;
    speechRef.current = null;
  };

  const start = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error("Voice input is not supported in this browser");
        return;
      }
      if (navigator.permissions) {
        try {
          const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
          if (status.state === "denied") {
            toast.error("Microphone blocked. Enable it in your browser settings.");
            return;
          }
        } catch {
          // Browser does not support microphone permission query.
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      await ctx.resume();
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      const silent = ctx.createGain();
      silent.gain.value = 0;

      chunksRef.current = [];
      speechTextRef.current = "";
      processor.onaudioprocess = (event) => {
        chunksRef.current.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      };
      source.connect(processor);
      processor.connect(silent);
      silent.connect(ctx.destination);

      streamRef.current = stream;
      ctxRef.current = ctx;
      sourceRef.current = source;
      processorRef.current = processor;
      startedAt.current = Date.now();

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = "en-US";
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event: any) => {
          let text = "";
          for (let i = 0; i < event.results.length; i += 1) {
            text += event.results[i][0]?.transcript || "";
          }
          speechTextRef.current = text.trim();
        };
        recognition.onerror = () => undefined;
        recognition.onend = () => undefined;
        speechRef.current = recognition;
        try { recognition.start(); } catch { /* already started */ }
      }

      setRecording(true);
      toast.success("Listening now");
    } catch (e: any) {
      await cleanup();
      if (e?.name === "NotAllowedError") toast.error("Mic access denied. Enable it in browser settings.");
      else if (e?.name === "NotFoundError") toast.error("No microphone found");
      else if (e?.name === "NotReadableError") toast.error("Mic is being used by another app");
      else toast.error(e?.message || "Mic access denied");
    }
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
      const instantText = speechTextRef.current.trim();
      if (instantText.length > 1) {
        toast.success("Got it. Building your lesson now.");
        navigate(`/ai?q=${encodeURIComponent(instantText)}`);
        return;
      }

      const blob = encodeWav(chunks, sampleRate);
      if (dur < 0.6 || blob.size < 2048 || chunks.length < 2) {
        toast.error("Too short. Hold the mic and speak clearly.");
        return;
      }
      const r = await fetch(STT_URL, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ audioBase64: await blobToBase64(blob), mimeType: "audio/wav", durationSec: dur }),
      });
      const j = await r.json().catch(() => ({} as any));
      if (!r.ok || j.error) {
        toast.error(j.error || "Couldn't hear you. Try again.");
        return;
      }
      const text = String(j.transcript || "").trim();
      if (!text) {
        toast.error("No speech detected. Speak a bit louder.");
        return;
      }
      toast.success("Got it. Building your lesson now.");
      navigate(`/ai?q=${encodeURIComponent(text)}`);
    } catch (e: any) {
      toast.error(e.message || "Voice failed");
    } finally {
      chunksRef.current = [];
      speechTextRef.current = "";
      setBusy(false);
    }
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