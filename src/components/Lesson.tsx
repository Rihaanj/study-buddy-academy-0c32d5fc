import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, ShieldAlert, BookOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { classifyLessonViolation, fileCheatReport } from "@/lib/cheating";
import { logAiHistory } from "@/lib/aiHub";
import { trackAIUsage } from "@/lib/badges";
import { LessonView, type Lesson as LessonT } from "./LessonView";
import { format } from "date-fns";

const LESSON_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-lesson`;
const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-tts`;

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  let token = data.session?.access_token;
  if (!token) {
    const refreshed = await supabase.auth.refreshSession();
    token = refreshed.data.session?.access_token;
  }
  if (!token) throw new Error("Please sign in again to use lesson AI.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

export default function Lesson() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const location = useLocation();
  const navigate = useNavigate();

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [lesson, setLesson] = useState<LessonT | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [notebook, setNotebook] = useState<any[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastAutoQ = useRef<string>("");

  const loadNotebook = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("lessons")
      .select("id, topic, question, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setNotebook(data ?? []);
  };
  useEffect(() => { loadNotebook(); }, [user?.id]);

  const ask = async (raw?: string) => {
    const question = (raw ?? q).trim();
    if (!question || !user) return;
    setLoading(true); setLesson(null); setSavedId(null);
    const reason = await classifyLessonViolation(question);
    if (reason) {
      toast.error("I can only help with learning topics. This attempt was logged.", { icon: <ShieldAlert className="h-4 w-4" /> });
      await fileCheatReport({ userId: user.id, reason, context: question.slice(0, 1000) });
      setLoading(false);
      return;
    }
    try {
      const r = await fetch(LESSON_URL, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ question, grade_level: (profile as any)?.grade_level ?? "high" }),
      });
      const j = await r.json().catch(() => ({} as any));
      if (r.status === 401) { toast.error("Please sign in again to use lesson AI."); return; }
      if (j.reported) { toast.error(j.error || "I can only build lessons for learning topics."); return; }
      if (!r.ok || !j.lesson) { toast.error(j.error || "AI is reconnecting. Try again in a moment."); return; }
      const les: LessonT = { ...j.lesson, question };
      setLesson(les);
      if (j.fallback) toast("Fast study mode loaded. Try again for a deeper AI version.");
      await trackAIUsage(user.id, "tutor");
      await logAiHistory(user.id, "lesson", les.topic, question.slice(0, 200), {});
    } catch (e: any) {
      toast.error(e.message || "AI is reconnecting. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-run from ?q= (voice mic or Next Topic navigation)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qp = params.get("q");
    if (qp && qp !== lastAutoQ.current) {
      lastAutoQ.current = qp;
      setQ(qp);
      ask(qp);
      // strip q= so back doesn't re-fire
      navigate(location.pathname, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, user?.id]);

  const save = async () => {
    if (!user || !lesson) return;
    const { data, error } = await supabase.from("lessons").insert({
      user_id: user.id,
      topic: lesson.topic.slice(0, 200),
      question: lesson.question ?? q,
      explanation: lesson.explanation,
      example: lesson.example,
      key_takeaways: lesson.key_takeaways as any,
      mistakes: lesson.mistakes as any,
      youtube_videos: lesson.youtube_videos as any,
      notes: lesson.notes,
      quiz: lesson.quiz as any,
      flashcards: lesson.flashcards as any,
      next_topic: lesson.next_topic,
      grade_level: (profile as any)?.grade_level ?? null,
    }).select("id").single();
    if (error) { toast.error(error.message); return; }
    setSavedId(data.id);
    loadNotebook();
  };

  const openSaved = async (id: string) => {
    const { data, error } = await supabase.from("lessons").select("*").eq("id", id).maybeSingle();
    if (error || !data) { toast.error("Could not load lesson"); return; }
    setLesson({
      topic: data.topic,
      question: data.question,
      explanation: data.explanation,
      example: data.example,
      key_takeaways: (data.key_takeaways as any) || [],
      mistakes: (data.mistakes as any) || [],
      youtube_videos: (data.youtube_videos as any) || [],
      notes: data.notes,
      quiz: (data.quiz as any) || [],
      flashcards: (data.flashcards as any) || [],
      next_topic: data.next_topic,
    });
    setSavedId(id);
    setQ(data.question);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteSaved = async (id: string) => {
    await supabase.from("lessons").delete().eq("id", id);
    loadNotebook();
    if (savedId === id) setSavedId(null);
  };

  const speak = async (text: string) => {
    try {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      const r = await fetch(TTS_URL, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ text: text.slice(0, 3500) }),
      });
      if (!r.ok) { toast.error("Voice unavailable"); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      audioRef.current = a;
      await a.play();
    } catch (e: any) {
      toast.error(e.message || "Voice failed");
    }
  };

  const canAsk = q.trim().length > 2 && !loading;

  return (
    <div className="space-y-5">
      <div className="glass-strong rounded-2xl p-4 sm:p-5 space-y-3">
        <label className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" /> Ask anything — I'll teach you the whole lesson.
        </label>
        <Textarea
          rows={3}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. Explain the Pythagorean theorem with a real-world example"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ask();
          }}
        />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[11px] text-muted-foreground">
            Level: <b>{(profile as any)?.grade_level || "high"}</b> · Cmd/Ctrl+Enter to send
          </span>
          <Button onClick={() => ask()} disabled={!canAsk} className="bg-gradient-primary text-primary-foreground">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Build my lesson
          </Button>
        </div>
      </div>

      {loading && (
        <div className="glass rounded-2xl p-10 text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Building your lesson · finding the best videos…</p>
        </div>
      )}

      {lesson && !loading && (
        <LessonView
          lesson={lesson}
          onSave={save}
          saved={!!savedId}
          onNextTopic={(t) => { setQ(t); ask(t); }}
          onSpeak={speak}
        />
      )}

      {!lesson && !loading && notebook.length > 0 && (
        <div className="glass-strong rounded-2xl p-4 sm:p-5 space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> My Notebook
          </h3>
          <ul className="divide-y divide-white/5">
            {notebook.map((n) => (
              <li key={n.id} className="flex items-center justify-between gap-3 py-2">
                <button onClick={() => openSaved(n.id)} className="text-left flex-1 min-w-0 group">
                  <div className="text-sm font-medium truncate group-hover:text-primary">{n.topic}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {format(new Date(n.created_at), "MMM d, p")} · {n.question}
                  </div>
                </button>
                <button
                  onClick={() => deleteSaved(n.id)}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
