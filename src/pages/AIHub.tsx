import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AIResponse } from "@/components/AIResponse";
import { BookOpen, FlaskConical, Repeat, ImageIcon, History, Loader2, Sparkles, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { awardXp, getActiveXpMultiplier, computeTestXpDelta, TEST_BASE_XP, type TestDifficulty } from "@/lib/gamification";
import { trackAIUsage, awardBadge } from "@/lib/badges";
import { detectCheatingIntent, fileCheatReport } from "@/lib/cheating";
import { format } from "date-fns";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tutor`;

async function streamAI({ body, onDelta }: { body: any; onDelta: (s: string) => void }) {
  const resp = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
    body: JSON.stringify(body),
  });
  if (resp.status === 429) { toast.error("Rate limited — try again shortly."); return; }
  if (resp.status === 402) { toast.error("AI credits exhausted. Add funds in Lovable settings."); return; }
  if (!resp.ok || !resp.body) { toast.error("AI request failed"); return; }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = ""; let done = false;
  while (!done) {
    const { done: d, value } = await reader.read();
    if (d) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, nl); buf = buf.slice(nl + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") { done = true; break; }
      try {
        const p = JSON.parse(json);
        const c = p.choices?.[0]?.delta?.content;
        if (c) onDelta(c);
      } catch { buf = line + "\n" + buf; break; }
    }
  }
}

async function logHistory(userId: string, kind: string, topic: string | null, prompt: string | null, metadata: Record<string, unknown> = {}) {
  await (supabase.from("ai_history") as any).insert({ user_id: userId, kind, topic, prompt, metadata });
}

function Tutor() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [out, setOut] = useState("");
  const [loading, setLoading] = useState(false);
  const ask = async () => {
    if (!q.trim()) return;
    // Cheating intent check — block, warn the user, and quietly file a report for admin review
    const cheat = detectCheatingIntent(q);
    if (cheat.suspected) {
      setOut("");
      toast.error("I can help you understand the topic, but I won't write your essay or homework for you. This attempt has been logged.", { duration: 6000, icon: <ShieldAlert className="h-4 w-4" /> });
      if (user) {
        await fileCheatReport({ userId: user.id, reason: cheat.reason, context: q.slice(0, 1000) });
      }
      return;
    }
    setOut(""); setLoading(true);
    await streamAI({ body: { mode: "tutor", prompt: q }, onDelta: (s) => setOut((o) => o + s) });
    setLoading(false);
    if (user) {
      await awardBadge(user.id, "getting_started");
      await trackAIUsage(user.id, "tutor");
      await logHistory(user.id, "tutor", null, q.slice(0, 200), {});
    }
  };
  return (
    <div className="space-y-4">
      <Label>Ask your AI tutor</Label>
      <Textarea rows={3} value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Explain photosynthesis like I'm in 7th grade..." />
      <Button onClick={ask} disabled={loading} className="bg-gradient-primary text-primary-foreground">
        {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : null}Ask
      </Button>
      {(out || loading) && <AIResponse title="AI Tutor" content={out} streaming={loading} />}
    </div>
  );
}

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
    setLoading(true); setTest(null); setAnswers({}); setResults(null);
    try {
      const r = await fetch(FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ mode: "test", topic, count, difficulty }),
      });
      if (r.status === 429) { toast.error("Rate limited."); return; }
      if (r.status === 402) { toast.error("AI credits exhausted."); return; }
      if (!r.ok) { toast.error("Failed"); return; }
      setTest(await r.json());
    } finally { setLoading(false); }
  };

  /** AI grades each non-MCQ answer for meaning instead of exact text. */
  const submit = async () => {
    if (!user || !test) return;
    setGrading(true);
    const out: Record<number, { correct: boolean; feedback?: string }> = {};
    await Promise.all(
      test.questions.map(async (q: any, i: number) => {
        const ua = (answers[i] || "").trim();
        if (!ua) { out[i] = { correct: false, feedback: "No answer given." }; return; }
        if (q.type === "mcq") {
          out[i] = { correct: ua.toLowerCase() === String(q.answer).trim().toLowerCase() };
          return;
        }
        // AI-judge text answers (idea > exact wording)
        try {
          const r = await fetch(FN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
            body: JSON.stringify({ mode: "grade", question: q.question, expected: q.answer, userAnswer: ua }),
          });
          if (r.ok) {
            const verdict = await r.json();
            out[i] = { correct: !!verdict.correct, feedback: verdict.feedback };
          } else {
            // Fallback: substring match
            out[i] = { correct: ua.toLowerCase().includes(String(q.answer).toLowerCase().slice(0, 10)) };
          }
        } catch {
          out[i] = { correct: false, feedback: "Could not grade." };
        }
      })
    );
    setResults(out);
    setGrading(false);

    const score = Object.values(out).filter((r) => r.correct).length;
    const total = test.questions.length;
    const diff = (["easy","medium","hard"].includes(difficulty) ? difficulty : "medium") as TestDifficulty;

    // Look up current level for the lvl-5+ penalty rule
    const { data: prof } = await supabase.from("profiles").select("level").eq("user_id", user.id).maybeSingle();
    const currentLevel = prof?.level ?? 1;

    const baseDelta = computeTestXpDelta(diff, score, total, currentLevel);
    const mult = await getActiveXpMultiplier(user.id);
    // Multiplier only boosts gains, not losses
    const xpDelta = baseDelta >= 0 ? Math.round(baseDelta * mult) : baseDelta;

    if (xpDelta !== 0) await awardXp(user.id, xpDelta);
    await trackAIUsage(user.id, "test");
    await awardBadge(user.id, "getting_started");
    await logHistory(user.id, "test", topic, null, { score, total, difficulty: diff, xpDelta });
    if (xpDelta > 0) toast.success(`Test submitted! ${score}/${total} · +${xpDelta} XP ⚡`);
    else if (xpDelta < 0) toast.error(`Test submitted: ${score}/${total} · ${xpDelta} XP (level ≥ 5 penalty)`);
    else toast(`Test submitted: ${score}/${total} · no XP change`);
  };

  const score = results ? Object.values(results).filter((r) => r.correct).length : 0;
  const submitted = !!results;

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2"><Label>Topic</Label><Input value={topic} onChange={(e)=>setTopic(e.target.value)} placeholder="Quadratic equations"/></div>
        <div><Label>Difficulty</Label>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy · max +10 XP</SelectItem>
              <SelectItem value="medium">Medium · max +20 XP</SelectItem>
              <SelectItem value="hard">Hard · max +30 XP</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground mt-1">XP scales with score. Below 50% at level 5+ loses XP.</p>
        </div>
      </div>
      <div className="flex gap-3 items-end flex-wrap">
        <div><Label>Questions</Label><Input type="number" min={3} max={15} value={count} onChange={(e)=>setCount(Number(e.target.value)||5)} className="w-24"/></div>
        <Button onClick={generate} disabled={loading} className="bg-gradient-primary text-primary-foreground">
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : null}Generate test
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
                      <label key={j} className={`flex gap-2 items-center p-2 rounded-lg cursor-pointer ${answers[i]===c?"bg-primary/20":"hover:bg-white/5"}`}>
                        <input type="radio" name={`q${i}`} checked={answers[i]===c} onChange={()=>setAnswers({...answers,[i]:c})} disabled={submitted}/>
                        <span className="text-sm">{c}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <Input value={answers[i] || ""} onChange={(e)=>setAnswers({...answers,[i]:e.target.value})} placeholder="Your answer (we judge meaning, not exact words)" disabled={submitted}/>
                )}
                {r && (
                  <div className={`text-xs ${r.correct ? "text-success" : "text-destructive"}`}>
                    {r.correct ? "✓ Correct" : `✗ Expected: ${q.answer}`}
                    {r.feedback && <div className="text-muted-foreground mt-1">{r.feedback}</div>}
                    {q.explanation && <div className="text-muted-foreground mt-1">{q.explanation}</div>}
                  </div>
                )}
              </div>
            );
          })}
          {!submitted ? (
            <Button onClick={submit} disabled={grading} className="bg-gradient-primary text-primary-foreground">
              {grading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin"/>AI grading...</> : "Submit"}
            </Button>
          ) : (
            <div className="text-lg font-bold gradient-text">Score: {score}/{test.questions.length}</div>
          )}
        </div>
      )}
    </div>
  );
}

/** Splits the AI practice output into a "questions only" view and a hidden answers section. */
function splitPractice(raw: string): { questions: string; answers: string } {
  if (!raw) return { questions: "", answers: "" };
  const lines = raw.split("\n");
  const questionLines: string[] = [];
  const answerLines: string[] = [];
  for (const line of lines) {
    // Match common answer markers: "Answer:", "**Answer:**", "Ans:", etc.
    if (/^\s*(\*\*)?\s*(answer|ans)\s*:/i.test(line)) {
      answerLines.push(line);
    } else {
      questionLines.push(line);
    }
  }
  return {
    questions: questionLines.join("\n").trim(),
    answers: answerLines.length ? answerLines.join("\n").trim() : "_(No separate answer key in this output.)_",
  };
}

function Practice() {
  const { user } = useAuth();
  const [topic, setTopic] = useState("");
  const [out, setOut] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const go = async () => {
    if (!topic.trim()) return;
    setOut(""); setShowAnswers(false); setLoading(true);
    await streamAI({ body: { mode: "practice", prompt: `Topic: ${topic}` }, onDelta: (s) => setOut((o) => o + s) });
    setLoading(false);
    if (user) {
      const mult = await getActiveXpMultiplier(user.id);
      const xp = Math.round(15 * mult);
      await awardXp(user.id, xp);
      await trackAIUsage(user.id, "practice");
      await awardBadge(user.id, "getting_started");
      await logHistory(user.id, "practice", topic, null, {});
      toast.success(`Practice generated! +${xp} XP`);
    }
  };
  const { questions, answers } = splitPractice(out);
  return (
    <div className="space-y-4">
      <Label>Topic</Label>
      <Input value={topic} onChange={(e)=>setTopic(e.target.value)} placeholder="Newton's laws"/>
      <Button onClick={go} disabled={loading} className="bg-gradient-primary text-primary-foreground">
        {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : null}Generate practice
      </Button>
      {(questions || loading) && <AIResponse title="Practice Questions" content={questions} streaming={loading} />}
      {!loading && out && (
        <div className="space-y-3">
          <Button variant="outline" size="sm" onClick={() => setShowAnswers((s) => !s)}>
            {showAnswers ? "Hide answers" : "Show answers"}
          </Button>
          {showAnswers && <AIResponse title="Answer Key" content={answers} />}
        </div>
      )}
    </div>
  );
}

function ImageStudy() {
  const { user } = useAuth();
  const [imageUrl, setImageUrl] = useState("");
  const [out, setOut] = useState("");
  const [loading, setLoading] = useState(false);
  const upload = async (file: File) => {
    if (!user) return;
    const path = `${user.id}/study-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("chat-images").upload(path, file);
    if (error) { toast.error(error.message); return; }
    const { data: pub } = supabase.storage.from("chat-images").getPublicUrl(path);
    setImageUrl(pub.publicUrl);
  };
  const analyze = async () => {
    if (!imageUrl) return;
    setOut(""); setLoading(true);
    await streamAI({ body: { mode: "image", imageUrl, prompt: "Extract notes and create 3 quick-check questions." }, onDelta: (s) => setOut((o) => o + s) });
    setLoading(false);
    if (user) await logHistory(user.id, "image", null, null, {});
  };
  return (
    <div className="space-y-4">
      <Label>Upload a page or photo of your notes</Label>
      <Input type="file" accept="image/*" onChange={(e)=>e.target.files?.[0] && upload(e.target.files[0])}/>
      {imageUrl && <img src={imageUrl} alt="upload" className="max-h-64 rounded-lg"/>}
      <Button onClick={analyze} disabled={!imageUrl || loading} className="bg-gradient-primary text-primary-foreground">
        {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : null}Analyze
      </Button>
      {(out || loading) && <AIResponse title="Image Study Notes" content={out} streaming={loading} />}
    </div>
  );
}

/** Real study history: previous tutor questions, practice topics, test scores. */
function StudyAnalytics() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("ai_history")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setItems(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const counts = items.reduce((acc: Record<string, number>, it) => {
    acc[it.kind] = (acc[it.kind] ?? 0) + 1;
    return acc;
  }, {});
  const tests = items.filter((i) => i.kind === "test");
  const avgScore = tests.length
    ? Math.round((tests.reduce((a, t) => a + (t.metadata?.score ?? 0) / Math.max(1, t.metadata?.total ?? 1), 0) / tests.length) * 100)
    : 0;
  const topTopics = (() => {
    const m: Record<string, number> = {};
    items.forEach((i) => { if (i.topic) m[i.topic] = (m[i.topic] ?? 0) + 1; });
    return Object.entries(m).sort(([, a], [, b]) => b - a).slice(0, 5);
  })();

  const kindLabel: Record<string, string> = {
    tutor: "Tutor question",
    practice: "Practice",
    test: "Test",
    image: "Image study",
  };

  return (
    <div className="space-y-4">
      <Button onClick={load} variant="outline" size="sm" disabled={loading}>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
        Refresh
      </Button>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass p-4">
          <div className="text-xs text-muted-foreground">Tutor Qs</div>
          <div className="text-2xl font-bold mt-1">{counts.tutor ?? 0}</div>
        </div>
        <div className="glass p-4">
          <div className="text-xs text-muted-foreground">Practice</div>
          <div className="text-2xl font-bold mt-1">{counts.practice ?? 0}</div>
        </div>
        <div className="glass p-4">
          <div className="text-xs text-muted-foreground">Tests done</div>
          <div className="text-2xl font-bold mt-1">{tests.length}</div>
        </div>
        <div className="glass p-4">
          <div className="text-xs text-muted-foreground">Avg test score</div>
          <div className="text-2xl font-bold mt-1">{tests.length ? `${avgScore}%` : "—"}</div>
        </div>
      </div>

      {topTopics.length > 0 && (
        <div className="glass p-5">
          <h3 className="font-semibold mb-3">Top studied topics</h3>
          <div className="space-y-2">
            {topTopics.map(([topic, n]) => (
              <div key={topic} className="flex items-center justify-between text-sm">
                <span className="truncate">{topic}</span>
                <span className="text-muted-foreground text-xs">{n}×</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="glass p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><History className="h-4 w-4" /> Recent activity</h3>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No AI activity yet. Ask the tutor, run practice, or take a test to fill this in.</p>
        ) : (
          <ul className="space-y-2 max-h-[400px] overflow-y-auto">
            {items.slice(0, 30).map((it) => (
              <li key={it.id} className="text-sm border-l-2 border-primary/40 pl-3 py-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{kindLabel[it.kind] ?? it.kind}</span>
                  <span className="text-[10px] text-muted-foreground">{format(new Date(it.created_at), "MMM d, p")}</span>
                </div>
                {it.topic && <div className="text-xs text-muted-foreground truncate">Topic: {it.topic}</div>}
                {it.prompt && <div className="text-xs text-muted-foreground truncate">"{it.prompt}"</div>}
                {it.kind === "test" && it.metadata?.score !== undefined && (
                  <div className="text-xs text-success">Scored {it.metadata.score}/{it.metadata.total} · {it.metadata.difficulty}</div>
                )}
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
          <div className="h-12 w-12 rounded-2xl bg-gradient-primary grid place-items-center shadow-glow float">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold gradient-text">AI Hub</h1>
            <p className="text-muted-foreground text-xs sm:text-sm">Tutor · tests · practice · study history — all in one place.</p>
          </div>
        </div>
      </div>
      <Tabs defaultValue="tutor">
        <TabsList className="glass flex-wrap h-auto">
          <TabsTrigger value="tutor"><BookOpen className="h-4 w-4 mr-1.5"/>Tutor</TabsTrigger>
          <TabsTrigger value="tests"><FlaskConical className="h-4 w-4 mr-1.5"/>Tests</TabsTrigger>
          <TabsTrigger value="practice"><Repeat className="h-4 w-4 mr-1.5"/>Practice</TabsTrigger>
          <TabsTrigger value="image"><ImageIcon className="h-4 w-4 mr-1.5"/>Image</TabsTrigger>
          <TabsTrigger value="analytics"><History className="h-4 w-4 mr-1.5"/>History</TabsTrigger>
        </TabsList>
        <TabsContent value="tutor" className="mt-4"><Tutor/></TabsContent>
        <TabsContent value="tests" className="mt-4"><Tests/></TabsContent>
        <TabsContent value="practice" className="mt-4"><Practice/></TabsContent>
        <TabsContent value="image" className="mt-4"><ImageStudy/></TabsContent>
        <TabsContent value="analytics" className="mt-4"><StudyAnalytics/></TabsContent>
      </Tabs>
    </div>
  );
}
