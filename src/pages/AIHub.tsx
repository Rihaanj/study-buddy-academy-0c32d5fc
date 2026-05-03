import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AIResponse } from "@/components/AIResponse";
import FollowUpGate from "@/components/FollowUpGate";
import { BookOpen, FlaskConical, Repeat, ImageIcon, History, Loader2, Sparkles, ShieldAlert, Mic, Flame, Eye, Volume2, Square } from "lucide-react";
const logoUrl = "/icons/icon-512.png";
import { toast } from "sonner";
import { awardXp, getActiveXpMultiplier, computeTestXpDelta, type TestDifficulty } from "@/lib/gamification";
import { trackAIUsage, awardBadge } from "@/lib/badges";
import { classifyCheatIntent, fileCheatReport } from "@/lib/cheating";
import { format } from "date-fns";
import { streamAI, logAiHistory } from "@/lib/aiHub";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tutor`;
const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-tts`;
const STT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-stt`;
const aiHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` };

// ===================== TUTOR (with Socratic / Analogy / Prereqs sub-modes + 3-Q gate) =====================
function Tutor() {
  const { user } = useAuth();
  const [mode, setMode] = useState<"tutor" | "socratic" | "analogy" | "prereqs">("tutor");
  const [q, setQ] = useState("");
  const [out, setOut] = useState("");
  const [loading, setLoading] = useState(false);
  const [showGate, setShowGate] = useState(false);

  const ask = async () => {
    if (!q.trim()) return;
    const last = Number(localStorage.getItem("sba_ai_last_ask") || 0);
    const remaining = last + 4000 - Date.now();
    if (remaining > 0) { toast.error(`Slow down — wait ${Math.ceil(remaining / 1000)}s.`); return; }
    localStorage.setItem("sba_ai_last_ask", String(Date.now()));
    const reason = await classifyCheatIntent(q);
    if (reason) {
      toast.error("I can only help with academic schoolwork. This attempt has been logged.", { duration: 6000, icon: <ShieldAlert className="h-4 w-4" /> });
      if (user) await fileCheatReport({ userId: user.id, reason, context: q.slice(0, 1000) });
      return;
    }
    setOut(""); setShowGate(false); setLoading(true);
    try {
      await streamAI({ body: { mode, prompt: q }, onDelta: (s) => setOut((o) => o + s) });
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
    if (user) {
      await awardBadge(user.id, "getting_started");
      await trackAIUsage(user.id, "tutor");
      await logAiHistory(user.id, mode, q.slice(0, 80), q.slice(0, 200), {});
    }
    // Only the "tutor" mode triggers the 3-question gate (others are exploratory)
    if (mode === "tutor") setShowGate(true);
  };

  const titles = { tutor: "AI Tutor", socratic: "Socratic Guide", analogy: "Analogy Machine", prereqs: "Prerequisite Checker" };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {(["tutor", "socratic", "analogy", "prereqs"] as const).map((m) => (
          <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)} className={mode === m ? "bg-gradient-primary text-primary-foreground" : ""}>
            {m === "tutor" && "Teach"}{m === "socratic" && "Socratic"}{m === "analogy" && "Analogy"}{m === "prereqs" && "Prereqs"}
          </Button>
        ))}
      </div>
      <Label>Ask your AI tutor</Label>
      <Textarea rows={3} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Explain photosynthesis like I'm in 7th grade..." />
      <Button onClick={ask} disabled={loading} className="bg-gradient-primary text-primary-foreground">
        {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Ask
      </Button>
      {(out || loading) && <AIResponse title={titles[mode]} content={out} streaming={loading} />}
      {showGate && !loading && out && (
        <FollowUpGate topic={q.slice(0, 80)} context={out} subject={null} />
      )}
    </div>
  );
}

// ===================== TESTS (existing) =====================
function Tests() {
  const { user } = useAuth();
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState("medium");
  const [test, setTest] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [grading, setGrading] = useState(false);
  const [results, setResults] = useState<Record<number, { correct: boolean; feedback?: string }> | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!topic.trim()) return;
    const reason = await classifyCheatIntent(`Generate a test about: ${topic}`);
    if (reason) {
      toast.error("Tests can only be generated for academic subjects.", { icon: <ShieldAlert className="h-4 w-4" /> });
      if (user) await fileCheatReport({ userId: user.id, reason, context: `[test] ${topic}` });
      return;
    }
    setLoading(true); setTest(null); setAnswers({}); setResults(null);
    try {
      const r = await fetch(FN_URL, { method: "POST", headers: aiHeaders, body: JSON.stringify({ mode: "test", topic, count, difficulty }) });
      if (!r.ok) { toast.error("Failed"); return; }
      setTest(await r.json());
    } finally { setLoading(false); }
  };

  const submit = async () => {
    if (!user || !test) return;
    setGrading(true);
    const out: Record<number, { correct: boolean; feedback?: string }> = {};
    await Promise.all(test.questions.map(async (q: any, i: number) => {
      const ua = (answers[i] || "").trim();
      if (!ua) { out[i] = { correct: false, feedback: "No answer." }; return; }
      if (q.type === "mcq") { out[i] = { correct: ua.toLowerCase() === String(q.answer).trim().toLowerCase() }; return; }
      try {
        const r = await fetch(FN_URL, { method: "POST", headers: aiHeaders, body: JSON.stringify({ mode: "grade", question: q.question, expected: q.answer, userAnswer: ua }) });
        if (r.ok) { const v = await r.json(); out[i] = { correct: !!v.correct, feedback: v.feedback }; }
        else out[i] = { correct: false, feedback: "Could not grade." };
        // Burn list for wrong
        if (!out[i].correct) await (supabase.from("burn_list") as any).insert({ user_id: user.id, topic, question: q.question, expected_answer: String(q.answer), user_answer: ua });
      } catch { out[i] = { correct: false, feedback: "Could not grade." }; }
    }));
    setResults(out); setGrading(false);
    const score = Object.values(out).filter((r) => r.correct).length;
    const total = test.questions.length;
    const diff = (["easy", "medium", "hard"].includes(difficulty) ? difficulty : "medium") as TestDifficulty;
    const { data: prof } = await supabase.from("profiles").select("level").eq("user_id", user.id).maybeSingle();
    const baseDelta = computeTestXpDelta(diff, score, total, prof?.level ?? 1);
    const mult = await getActiveXpMultiplier(user.id);
    const xpDelta = baseDelta >= 0 ? Math.round(baseDelta * mult) : baseDelta;
    if (xpDelta !== 0) await awardXp(user.id, xpDelta);
    await trackAIUsage(user.id, "test");
    await logAiHistory(user.id, "test", topic, null, { score, total, difficulty: diff, xpDelta });
    if (xpDelta > 0) toast.success(`${score}/${total} · +${xpDelta} XP`);
    else if (xpDelta < 0) toast.error(`${score}/${total} · ${xpDelta} XP`);
    else toast(`${score}/${total} · no XP`);
  };

  const score = results ? Object.values(results).filter((r) => r.correct).length : 0;
  const submitted = !!results;

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2"><Label>Topic</Label><Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Quadratic equations" /></div>
        <div><Label>Difficulty</Label>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy · max +10 XP</SelectItem>
              <SelectItem value="medium">Medium · max +20 XP</SelectItem>
              <SelectItem value="hard">Hard · max +30 XP</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-3 items-end flex-wrap">
        <div><Label>Questions</Label><Input type="number" min={3} max={15} value={count} onChange={(e) => setCount(Number(e.target.value) || 5)} className="w-24" /></div>
        <Button onClick={generate} disabled={loading} className="bg-gradient-primary text-primary-foreground">
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Generate test
        </Button>
      </div>
      {test && (
        <div className="glass p-4 sm:p-5 space-y-5">
          <h3 className="text-lg font-bold gradient-text">{test.title}</h3>
          {test.questions.map((q: any, i: number) => {
            const r = results?.[i];
            return (
              <div key={i} className="space-y-2">
                <div className="font-medium text-sm sm:text-base">{i + 1}. {q.question}</div>
                {q.type === "mcq" && q.choices ? (
                  <div className="space-y-1">
                    {q.choices.map((c: string, j: number) => (
                      <label key={j} className={`flex gap-2 items-center p-2 rounded-lg cursor-pointer ${answers[i] === c ? "bg-primary/20" : "hover:bg-white/5"}`}>
                        <input type="radio" name={`q${i}`} checked={answers[i] === c} onChange={() => setAnswers({ ...answers, [i]: c })} disabled={submitted} />
                        <span className="text-sm">{c}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <Input value={answers[i] || ""} onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })} placeholder="Your answer" disabled={submitted} />
                )}
                {r && (
                  <div className={`text-xs ${r.correct ? "text-success" : "text-destructive"}`}>
                    {r.correct ? "✓ Correct" : `✗ Expected: ${q.answer}`}
                    {r.feedback && <div className="text-muted-foreground mt-1">{r.feedback}</div>}
                  </div>
                )}
              </div>
            );
          })}
          {!submitted ? (
            <Button onClick={submit} disabled={grading} className="bg-gradient-primary text-primary-foreground">
              {grading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Grading…</> : "Submit"}
            </Button>
          ) : (<div className="text-lg font-bold gradient-text">Score: {score}/{test.questions.length}</div>)}
        </div>
      )}
    </div>
  );
}

// ===================== EXAM SIM (Style mimicry + Burn list) =====================
function ExamSim() {
  const { user } = useAuth();
  const [topic, setTopic] = useState("");
  const [sample, setSample] = useState("");
  const [loading, setLoading] = useState(false);
  const [out, setOut] = useState<{ style_notes: string; questions: { question: string; answer: string }[] } | null>(null);
  const [burn, setBurn] = useState<any[]>([]);

  const loadBurn = async () => {
    if (!user) return;
    const { data } = await (supabase.from("burn_list") as any)
      .select("*").eq("user_id", user.id).eq("resolved", false)
      .order("last_wrong_at", { ascending: false }).limit(20);
    setBurn(data ?? []);
  };
  useEffect(() => { loadBurn(); }, [user?.id]);

  const generate = async () => {
    if (!topic.trim() || !sample.trim()) { toast.error("Add a topic and a sample question"); return; }
    const reason = await classifyCheatIntent(`Generate exam questions about: ${topic}`);
    if (reason) { toast.error("Academic only.", { icon: <ShieldAlert className="h-4 w-4" /> }); if (user) await fileCheatReport({ userId: user.id, reason, context: `[exam] ${topic}` }); return; }
    setLoading(true); setOut(null);
    try {
      const r = await fetch(FN_URL, { method: "POST", headers: aiHeaders, body: JSON.stringify({ mode: "mimic", topic, sampleQuestion: sample }) });
      if (!r.ok) { toast.error("Failed"); return; }
      setOut(await r.json());
      if (user) await logAiHistory(user.id, "exam-mimic", topic, sample.slice(0, 200), {});
    } finally { setLoading(false); }
  };

  const resolveBurn = async (id: string) => {
    await (supabase.from("burn_list") as any).update({ resolved: true }).eq("id", id);
    loadBurn();
  };

  return (
    <div className="space-y-6">
      <div className="glass p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><FlaskConical className="h-4 w-4" /> Style Mimicry</h3>
        <p className="text-xs text-muted-foreground">Paste a sample question from your teacher. The AI generates 5 more in that exact style.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>Topic</Label><Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="French Revolution" /></div>
          <div><Label>Sample question</Label><Textarea rows={2} value={sample} onChange={(e) => setSample(e.target.value)} placeholder="Compare and contrast the goals of the National Assembly with..." /></div>
        </div>
        <Button onClick={generate} disabled={loading} className="bg-gradient-primary text-primary-foreground">
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Generate 5 in this style
        </Button>
        {out && (
          <div className="space-y-3 mt-2">
            <p className="text-xs text-muted-foreground italic">Style detected: {out.style_notes}</p>
            <ol className="list-decimal pl-5 space-y-2">
              {out.questions.map((q, i) => (
                <li key={i} className="text-sm">
                  <div>{q.question}</div>
                  <details className="mt-1"><summary className="text-xs text-muted-foreground cursor-pointer">Show model answer</summary>
                    <div className="text-xs mt-1 text-success">{q.answer}</div>
                  </details>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <div className="glass p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><Flame className="h-4 w-4 text-destructive" /> Burn List ({burn.length})</h3>
        <p className="text-xs text-muted-foreground">Questions you've gotten wrong. Master them to clear the list.</p>
        {burn.length === 0 ? (
          <p className="text-sm text-muted-foreground">No questions on your burn list — keep it that way! 🔥</p>
        ) : (
          <ul className="space-y-2 max-h-[400px] overflow-y-auto">
            {burn.map((b) => (
              <li key={b.id} className="text-sm border-l-2 border-destructive/40 pl-3 py-1">
                <div className="font-medium">{b.question}</div>
                <div className="text-xs text-muted-foreground">Expected: {b.expected_answer}</div>
                {b.user_answer && <div className="text-xs text-destructive">You said: {b.user_answer}</div>}
                <button onClick={() => resolveBurn(b.id)} className="text-[11px] text-primary hover:underline mt-1">Mark as mastered →</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ===================== PRACTICE (existing minimal) =====================
function Practice() {
  const { user } = useAuth();
  const [topic, setTopic] = useState("");
  const [out, setOut] = useState("");
  const [loading, setLoading] = useState(false);
  const [showGate, setShowGate] = useState(false);

  const go = async () => {
    if (!topic.trim()) return;
    const reason = await classifyCheatIntent(`Generate practice about: ${topic}`);
    if (reason) { toast.error("Academic only.", { icon: <ShieldAlert className="h-4 w-4" /> }); if (user) await fileCheatReport({ userId: user.id, reason, context: `[practice] ${topic}` }); return; }
    setOut(""); setShowGate(false); setLoading(true);
    try {
      await streamAI({ body: { mode: "practice", prompt: `Topic: ${topic}` }, onDelta: (s) => setOut((o) => o + s) });
    } catch (e: any) { toast.error(e.message); }
    setLoading(false); setShowGate(true);
    if (user) { await trackAIUsage(user.id, "practice"); await logAiHistory(user.id, "practice", topic, null, {}); }
  };

  return (
    <div className="space-y-4">
      <Label>Topic</Label>
      <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Newton's laws" />
      <Button onClick={go} disabled={loading} className="bg-gradient-primary text-primary-foreground">
        {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Generate practice
      </Button>
      {(out || loading) && <AIResponse title="Practice Set" content={out} streaming={loading} />}
      {showGate && !loading && out && <FollowUpGate topic={topic} context={out} />}
    </div>
  );
}

// ===================== VISUAL DECODER (image → teach + 3-Q gate) =====================
function VisualDecoder() {
  const { user } = useAuth();
  const [imageUrl, setImageUrl] = useState("");
  const [out, setOut] = useState("");
  const [loading, setLoading] = useState(false);
  const [showGate, setShowGate] = useState(false);
  const [topicLabel, setTopicLabel] = useState("");

  const upload = async (file: File) => {
    if (!user) return;
    if (file.size > 25 * 1024 * 1024) { toast.error("Image must be under 25MB"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Only image files."); return; }
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${user.id}/study-${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from("chat-images").upload(path, file, { contentType: file.type });
    if (error) { toast.error(error.message); return; }
    const { data: pub } = supabase.storage.from("chat-images").getPublicUrl(path);
    setImageUrl(pub.publicUrl);
    setTopicLabel(file.name.replace(/\.[^.]+$/, "").slice(0, 60));
  };

  const analyze = async () => {
    if (!imageUrl) return;
    setOut(""); setShowGate(false); setLoading(true);
    try {
      await streamAI({ body: { mode: "image", imageUrl, prompt: "Teach the main concept clearly. Then I'll be quizzed." }, onDelta: (s) => setOut((o) => o + s) });
    } catch (e: any) { toast.error(e.message); }
    setLoading(false); setShowGate(true);
    if (user) await logAiHistory(user.id, "image", topicLabel || null, null, {});
  };

  return (
    <div className="space-y-4">
      <Label className="flex items-center gap-2"><Eye className="h-4 w-4" /> Upload notes, a diagram, or a math problem (≤25MB)</Label>
      <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      {imageUrl && <img src={imageUrl} alt="upload" className="max-h-64 rounded-lg" />}
      <Button onClick={analyze} disabled={!imageUrl || loading} className="bg-gradient-primary text-primary-foreground">
        {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Teach me this
      </Button>
      {(out || loading) && <AIResponse title="Visual Decoder" content={out} streaming={loading} />}
      {showGate && !loading && out && <FollowUpGate topic={topicLabel || "this image"} context={out} />}
    </div>
  );
}

// ===================== VOICE LAB (TTS + presentation auditor) =====================
function VoiceLab() {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Recorder
  const [recording, setRecording] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const [analysis, setAnalysis] = useState<{ transcript: string; wordCount: number; fillerCount: number; wordsPerMinute: number; paceLabel: string } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const speak = async () => {
    if (!text.trim()) return;
    setLoading(true); setAudioUrl(null);
    try {
      const r = await fetch(TTS_URL, { method: "POST", headers: aiHeaders, body: JSON.stringify({ text }) });
      if (!r.ok) { toast.error("TTS failed"); return; }
      const blob = await r.blob();
      setAudioUrl(URL.createObjectURL(blob));
    } finally { setLoading(false); }
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        const dur = (Date.now() - startedAtRef.current) / 1000;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        // Convert to base64
        const ab = await blob.arrayBuffer();
        const bytes = new Uint8Array(ab);
        let bin = "";
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
        const b64 = btoa(bin);
        setAnalyzing(true);
        try {
          const r = await fetch(STT_URL, { method: "POST", headers: aiHeaders, body: JSON.stringify({ audioBase64: b64, mimeType: blob.type, durationSec: dur }) });
          if (!r.ok) { toast.error("Transcription failed"); return; }
          setAnalysis(await r.json());
          if (user) await logAiHistory(user.id, "voice-audit", null, null, { dur });
        } finally { setAnalyzing(false); }
      };
      startedAtRef.current = Date.now();
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch { toast.error("Mic access denied"); }
  };
  const stopRec = () => { recRef.current?.stop(); setRecording(false); };

  return (
    <div className="space-y-6">
      <div className="glass p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><Volume2 className="h-4 w-4" /> Read-Aloud (TTS)</h3>
        <p className="text-xs text-muted-foreground">Paste any study text — we'll read it back to you in a natural voice.</p>
        <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste notes to be read aloud..." />
        <Button onClick={speak} disabled={loading} className="bg-gradient-primary text-primary-foreground">
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Volume2 className="h-4 w-4 mr-2" />}Speak
        </Button>
        {audioUrl && <audio src={audioUrl} controls className="w-full" />}
      </div>

      <div className="glass p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><Mic className="h-4 w-4" /> Presentation Auditor</h3>
        <p className="text-xs text-muted-foreground">Record yourself practicing a speech. We'll transcribe + flag fillers ("um", "like") and your pace.</p>
        {!recording ? (
          <Button onClick={startRec} disabled={analyzing} className="bg-gradient-primary text-primary-foreground">
            {analyzing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing…</> : <><Mic className="h-4 w-4 mr-2" /> Start recording</>}
          </Button>
        ) : (
          <Button onClick={stopRec} variant="destructive">
            <Square className="h-4 w-4 mr-2" /> Stop
          </Button>
        )}
        {analysis && (
          <div className="space-y-2 mt-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="glass p-3 text-center"><div className="text-[10px] text-muted-foreground">Words</div><div className="text-xl font-bold">{analysis.wordCount}</div></div>
              <div className="glass p-3 text-center"><div className="text-[10px] text-muted-foreground">Pace (wpm)</div><div className="text-xl font-bold">{analysis.wordsPerMinute}</div><div className="text-[10px] text-muted-foreground">{analysis.paceLabel}</div></div>
              <div className="glass p-3 text-center"><div className="text-[10px] text-muted-foreground">Fillers</div><div className={`text-xl font-bold ${analysis.fillerCount > 5 ? "text-destructive" : "text-success"}`}>{analysis.fillerCount}</div></div>
            </div>
            <details><summary className="text-xs text-muted-foreground cursor-pointer">Show transcript</summary>
              <p className="text-sm mt-2 whitespace-pre-wrap">{analysis.transcript || "(no speech detected)"}</p>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}

// ===================== HISTORY (existing) =====================
function StudyAnalytics() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("ai_history").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
    setItems(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const counts = items.reduce((acc: Record<string, number>, it) => { acc[it.kind] = (acc[it.kind] ?? 0) + 1; return acc; }, {});
  const tests = items.filter((i) => i.kind === "test");
  const avgScore = tests.length ? Math.round((tests.reduce((a, t) => a + (t.metadata?.score ?? 0) / Math.max(1, t.metadata?.total ?? 1), 0) / tests.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <Button onClick={load} variant="outline" size="sm" disabled={loading}>{loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}Refresh</Button>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass p-4"><div className="text-xs text-muted-foreground">Tutor Qs</div><div className="text-2xl font-bold mt-1">{counts.tutor ?? 0}</div></div>
        <div className="glass p-4"><div className="text-xs text-muted-foreground">Practice</div><div className="text-2xl font-bold mt-1">{counts.practice ?? 0}</div></div>
        <div className="glass p-4"><div className="text-xs text-muted-foreground">Tests</div><div className="text-2xl font-bold mt-1">{tests.length}</div></div>
        <div className="glass p-4"><div className="text-xs text-muted-foreground">Avg test</div><div className="text-2xl font-bold mt-1">{tests.length ? `${avgScore}%` : "—"}</div></div>
      </div>
      <div className="glass p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><History className="h-4 w-4" /> Recent activity</h3>
        {items.length === 0 ? <p className="text-sm text-muted-foreground">No AI activity yet.</p> : (
          <ul className="space-y-2 max-h-[400px] overflow-y-auto">
            {items.slice(0, 30).map((it) => (
              <li key={it.id} className="text-sm border-l-2 border-primary/40 pl-3 py-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{it.kind}</span>
                  <span className="text-[10px] text-muted-foreground">{format(new Date(it.created_at), "MMM d, p")}</span>
                </div>
                {it.topic && <div className="text-xs text-muted-foreground truncate">Topic: {it.topic}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function AIHub() {
  return (
    <div className="space-y-6">
      <div className="glass-strong rounded-2xl p-5 sm:p-6 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-gradient-primary opacity-20 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-44 w-44 rounded-full bg-secondary/30 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="relative h-14 w-14 grid place-items-center shrink-0 float">
            <div className="absolute inset-0 rounded-2xl bg-gradient-primary opacity-50 blur-xl" />
            <img src={logoUrl} alt="Study Bud AI logo" className="relative h-full w-full object-contain drop-shadow-[0_0_18px_hsl(var(--primary)/0.7)]" width={56} height={56} loading="lazy" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold gradient-text flex items-center gap-2">
              AI Hub <Sparkles className="h-4 w-4 text-accent animate-pulse" />
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm">Tutor · tests · exam sim · vision · voice — earn XP by answering 3 follow-ups (max 1000 XP/day).</p>
          </div>
        </div>
      </div>
      <Tabs defaultValue="tutor">
        <TabsList className="glass flex-wrap h-auto">
          <TabsTrigger value="tutor"><BookOpen className="h-4 w-4 mr-1.5" />Tutor</TabsTrigger>
          <TabsTrigger value="tests"><FlaskConical className="h-4 w-4 mr-1.5" />Tests</TabsTrigger>
          <TabsTrigger value="exam"><Flame className="h-4 w-4 mr-1.5" />Exam Sim</TabsTrigger>
          <TabsTrigger value="practice"><Repeat className="h-4 w-4 mr-1.5" />Practice</TabsTrigger>
          <TabsTrigger value="visual"><Eye className="h-4 w-4 mr-1.5" />Visual</TabsTrigger>
          <TabsTrigger value="voice"><Mic className="h-4 w-4 mr-1.5" />Voice Lab</TabsTrigger>
          <TabsTrigger value="analytics"><History className="h-4 w-4 mr-1.5" />History</TabsTrigger>
        </TabsList>
        <TabsContent value="tutor" className="mt-4"><Tutor /></TabsContent>
        <TabsContent value="tests" className="mt-4"><Tests /></TabsContent>
        <TabsContent value="exam" className="mt-4"><ExamSim /></TabsContent>
        <TabsContent value="practice" className="mt-4"><Practice /></TabsContent>
        <TabsContent value="visual" className="mt-4"><VisualDecoder /></TabsContent>
        <TabsContent value="voice" className="mt-4"><VoiceLab /></TabsContent>
        <TabsContent value="analytics" className="mt-4"><StudyAnalytics /></TabsContent>
      </Tabs>
    </div>
  );
}
