import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Button } from "@/components/ui/button";
import { Play, ChevronRight, Save, Check, Volume2, Loader2 } from "lucide-react";
import { cleanText } from "@/lib/sanitize";
import { toast } from "sonner";

export type LessonVideo = {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration: string;
  url: string;
};

export type LessonQuizQ = {
  question: string;
  choices: string[];
  correct_index: number;
  explanation: string;
};

export type LessonFlashcard = { front: string; back: string };

export type Lesson = {
  topic: string;
  question?: string;
  explanation: string;
  example: string;
  key_takeaways: string[];
  mistakes: string[];
  youtube_videos: LessonVideo[];
  notes: string;
  quiz: LessonQuizQ[];
  flashcards: LessonFlashcard[];
  next_topic: string;
};

const Section = ({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) => (
  <section className="glass-strong rounded-2xl p-5 sm:p-6 space-y-3 border border-white/10">
    <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
      <span className="text-2xl leading-none">{emoji}</span>
      <span className="gradient-text">{title}</span>
    </h2>
    <div className="text-sm sm:text-base">{children}</div>
  </section>
);

function QuizCard({ q, index }: { q: LessonQuizQ; index: number }) {
  const [picked, setPicked] = useState<number | null>(null);
  const done = picked !== null;
  return (
    <div className="glass p-4 rounded-xl space-y-2">
      <div className="font-medium">
        {index + 1}. {q.question}
      </div>
      <div className="grid gap-1.5">
        {q.choices.map((c, i) => {
          const isRight = i === q.correct_index;
          const isPicked = picked === i;
          const cls = !done
            ? "hover:bg-white/10"
            : isRight
            ? "bg-success/25 ring-1 ring-success"
            : isPicked
            ? "bg-destructive/25 ring-1 ring-destructive"
            : "opacity-60";
          return (
            <button
              key={i}
              disabled={done}
              onClick={() => setPicked(i)}
              className={`text-left p-2.5 rounded-lg text-sm transition ${cls}`}
            >
              <span className="font-semibold mr-2">{String.fromCharCode(65 + i)}.</span>
              {c}
            </button>
          );
        })}
      </div>
      {done && (
        <p className={`text-xs ${picked === q.correct_index ? "text-success" : "text-destructive"}`}>
          {picked === q.correct_index ? "Correct — " : "Not quite — "}
          {q.explanation}
        </p>
      )}
    </div>
  );
}

function Flashcard({ card }: { card: LessonFlashcard }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      onClick={() => setFlipped((f) => !f)}
      className="glass rounded-xl p-4 min-h-[120px] text-left text-sm transition hover:ring-1 hover:ring-primary/40 relative"
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
        {flipped ? "Back" : "Front"}
      </div>
      <div className="font-medium">{flipped ? card.back : card.front}</div>
      <div className="absolute bottom-2 right-3 text-[10px] text-muted-foreground">tap to flip</div>
    </button>
  );
}

export function LessonView({
  lesson,
  onSave,
  saved,
  onNextTopic,
  onSpeak,
}: {
  lesson: Lesson;
  onSave?: () => Promise<void> | void;
  saved?: boolean;
  onNextTopic?: (t: string) => void;
  onSpeak?: (text: string) => Promise<void> | void;
}) {
  const [savingLocal, setSavingLocal] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const doSave = async () => {
    if (!onSave || saved) return;
    setSavingLocal(true);
    try { await onSave(); toast.success("Saved to your Notebook"); } finally { setSavingLocal(false); }
  };

  const doSpeak = async () => {
    if (!onSpeak) return;
    setSpeaking(true);
    try { await onSpeak(lesson.explanation); } finally { setSpeaking(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">
          <span className="gradient-text">{lesson.topic}</span>
        </h1>
        <div className="flex gap-2">
          {onSpeak && (
            <Button size="sm" variant="outline" onClick={doSpeak} disabled={speaking}>
              {speaking ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Volume2 className="h-4 w-4 mr-1.5" />}
              Read aloud
            </Button>
          )}
          {onSave && (
            <Button size="sm" onClick={doSave} disabled={saved || savingLocal} className="bg-gradient-primary text-primary-foreground">
              {saved ? <Check className="h-4 w-4 mr-1.5" /> : savingLocal ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
              {saved ? "Saved" : "Save to Notebook"}
            </Button>
          )}
        </div>
      </div>

      <Section emoji="📖" title="Simple Explanation">
        <div className="ai-prose">
          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
            {cleanText(lesson.explanation)}
          </ReactMarkdown>
        </div>
      </Section>

      <Section emoji="💡" title="Real-World Example">
        <div className="ai-prose">
          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
            {cleanText(lesson.example)}
          </ReactMarkdown>
        </div>
      </Section>

      <Section emoji="🧠" title="Key Takeaways">
        <ul className="list-disc pl-5 space-y-1.5">
          {lesson.key_takeaways.map((k, i) => (
            <li key={i}>{cleanText(k)}</li>
          ))}
        </ul>
      </Section>

      <Section emoji="⚠️" title="Common Mistakes">
        <ul className="list-disc pl-5 space-y-1.5">
          {lesson.mistakes.map((m, i) => (
            <li key={i}>{cleanText(m)}</li>
          ))}
        </ul>
      </Section>

      <Section emoji="🎥" title="Watch & Learn">
        {lesson.youtube_videos?.length ? (
          <div className="grid sm:grid-cols-3 gap-3">
            {lesson.youtube_videos.map((v) => (
              <a
                key={v.id}
                href={v.url}
                target="_blank"
                rel="noopener noreferrer"
                className="glass rounded-xl overflow-hidden hover:ring-1 hover:ring-primary/50 transition group"
              >
                <div className="relative aspect-video bg-black/40">
                  {v.thumbnail && <img src={v.thumbnail} alt={v.title} className="w-full h-full object-cover" loading="lazy" />}
                  <div className="absolute inset-0 grid place-items-center bg-black/0 group-hover:bg-black/30 transition">
                    <Play className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition" />
                  </div>
                  {v.duration && (
                    <span className="absolute bottom-1.5 right-1.5 text-[10px] font-mono bg-black/70 px-1.5 py-0.5 rounded">
                      {v.duration}
                    </span>
                  )}
                </div>
                <div className="p-3 space-y-1">
                  <div className="text-xs font-medium line-clamp-2">{v.title}</div>
                  <div className="text-[10px] text-muted-foreground">{v.channel}</div>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No videos found — try again in a moment.</p>
        )}
      </Section>

      <Section emoji="📝" title="Study Notes">
        <div className="ai-prose">
          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
            {cleanText(lesson.notes)}
          </ReactMarkdown>
        </div>
      </Section>

      <Section emoji="❓" title="Quick Quiz">
        <div className="space-y-3">
          {lesson.quiz.map((q, i) => (
            <QuizCard key={i} q={q} index={i} />
          ))}
        </div>
      </Section>

      <Section emoji="🧠" title="Flashcards">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {lesson.flashcards.map((c, i) => (
            <Flashcard key={i} card={c} />
          ))}
        </div>
      </Section>

      <Section emoji="➡️" title="Learn Next">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm">{cleanText(lesson.next_topic)}</p>
          {onNextTopic && (
            <Button size="sm" variant="outline" onClick={() => onNextTopic(lesson.next_topic)}>
              Start this lesson <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </Section>
    </div>
  );
}
