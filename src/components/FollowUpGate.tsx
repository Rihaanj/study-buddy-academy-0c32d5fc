import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { generateFollowUps, gradeAnswer, awardGateXp, addToBurnList, bumpMastery, type FollowUpQ } from "@/lib/aiHub";

type Props = {
  topic: string;
  /** Source content (answer / explanation / lesson) used to ground the questions. */
  context: string;
  /** Optional subject for mastery tracking. */
  subject?: string | null;
  onComplete?: (result: { correct: number; xp: number }) => void;
};

/**
 * 3-question scaled XP gate. Generates 3 questions on the topic from the AI lesson,
 * grades them with AI, awards XP only after the user answers (1/3 → 5 XP, 2/3 → 10, 3/3 → 20),
 * pushes wrong ones onto the user's burn list, and bumps topic mastery.
 */
export default function FollowUpGate({ topic, context, subject = null, onComplete }: Props) {
  const { user } = useAuth();
  const [qs, setQs] = useState<FollowUpQ[] | null>(null);
  const [loadingQs, setLoadingQs] = useState(false);
  const [answers, setAnswers] = useState<string[]>(["", "", ""]);
  const [grading, setGrading] = useState(false);
  const [results, setResults] = useState<{ correct: boolean; feedback?: string }[] | null>(null);
  const [xpAwarded, setXpAwarded] = useState<number | null>(null);
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    if (!topic.trim() || !context.trim()) return;
    requested.current = true;
    (async () => {
      setLoadingQs(true);
      try {
        const got = await generateFollowUps(topic, context);
        setQs(got);
      } finally {
        setLoadingQs(false);
      }
    })();
  }, [topic, context]);

  const submit = async () => {
    if (!user || !qs) return;
    setGrading(true);
    try {
      const verdicts = await Promise.all(qs.map((q, i) => gradeAnswer(q.question, q.expected, answers[i] || "")));
      setResults(verdicts);
      const correctCount = verdicts.filter((v) => v.correct).length;
      // Burn list for wrong ones
      for (let i = 0; i < verdicts.length; i++) {
        if (!verdicts[i].correct) {
          await addToBurnList(user.id, topic, qs[i].question, qs[i].expected, answers[i] || "");
        }
      }
      // Mastery: count whole batch as one attempt per question
      for (const v of verdicts) await bumpMastery(user.id, topic, subject, v.correct);

      const { awarded, capped } = await awardGateXp(user.id, correctCount);
      setXpAwarded(awarded);
      if (awarded > 0) toast.success(`${correctCount}/3 correct · +${awarded} XP ⚡${capped ? " (daily cap)" : ""}`);
      else if (correctCount === 0) toast.error("0/3 correct — no XP. Wrong ones added to your Burn List.");
      onComplete?.({ correct: correctCount, xp: awarded });
    } finally {
      setGrading(false);
    }
  };

  if (loadingQs) {
    return (
      <div className="glass p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cooking up 3 quick questions to lock in what you just learned…
      </div>
    );
  }

  if (!qs || qs.length === 0) return null;

  const submitted = !!results;

  return (
    <div className="glass-strong p-4 sm:p-5 space-y-4 border border-primary/30">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold text-sm sm:text-base">🎯 Quick check (3 questions = up to +20 XP)</h3>
        <span className="text-[11px] text-muted-foreground">1✓ = +5 · 2✓ = +10 · 3✓ = +20</span>
      </div>
      <ol className="space-y-3 list-decimal pl-5">
        {qs.map((q, i) => {
          const r = results?.[i];
          return (
            <li key={i} className="space-y-1.5">
              <div className="text-sm font-medium">{q.question}</div>
              <Input
                value={answers[i]}
                onChange={(e) => setAnswers((a) => a.map((x, j) => j === i ? e.target.value : x))}
                placeholder="Your answer..."
                disabled={submitted}
              />
              {r && (
                <div className={`text-xs flex items-start gap-1.5 ${r.correct ? "text-success" : "text-destructive"}`}>
                  {r.correct ? <CheckCircle2 className="h-3.5 w-3.5 mt-0.5" /> : <XCircle className="h-3.5 w-3.5 mt-0.5" />}
                  <span>
                    {r.correct ? "Correct!" : `Expected: ${q.expected}`}
                    {r.feedback && <span className="block text-muted-foreground mt-0.5">{r.feedback}</span>}
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {!submitted ? (
        <Button onClick={submit} disabled={grading} className="bg-gradient-primary text-primary-foreground">
          {grading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Grading…</> : "Submit answers for XP"}
        </Button>
      ) : (
        <div className="text-sm">
          Score: <span className="font-bold gradient-text">{results!.filter((r) => r.correct).length}/3</span>
          {xpAwarded !== null && xpAwarded > 0 && <> · <span className="text-success">+{xpAwarded} XP</span></>}
        </div>
      )}
    </div>
  );
}
