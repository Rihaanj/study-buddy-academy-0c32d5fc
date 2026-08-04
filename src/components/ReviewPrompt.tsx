import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { toast } from "sonner";

const MILESTONE_LEVELS = [1, 5, 10, 20, 35, 50];
const PROMPT_COOLDOWN_DAYS = 7;

export const ReviewPrompt = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user || !profile) return;
    (async () => {
      const lastPrompt = (profile as any).last_review_prompt_at as string | null;
      if (lastPrompt) {
        const days = (Date.now() - new Date(lastPrompt).getTime()) / 86400000;
        if (days < PROMPT_COOLDOWN_DAYS) return;
      }
      // Trigger if at a milestone level OR user has done a task and never been prompted
      const atMilestone = MILESTONE_LEVELS.includes(profile.level ?? 1);
      if (!lastPrompt || atMilestone) {
        // Verify they've actually used it (have at least 1 task or focus session)
        const [{ count: taskCount }] = await Promise.all([
          supabase.from("tasks").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        ]);
        if ((taskCount ?? 0) > 0 || atMilestone) {
          setOpen(true);
        }
      }
    })();
  }, [user?.id, profile?.level]);

  const dismiss = async () => {
    setOpen(false);
    if (user) {
      await supabase.from("profiles")
        .update({ last_review_prompt_at: new Date().toISOString() } as any)
        .eq("user_id", user.id);
    }
  };

  const submit = async () => {
    if (!user || rating < 1) { toast.error("Pick a star rating first."); return; }
    setSubmitting(true);
    const { error } = await supabase.from("reviews" as any).insert({
      user_id: user.id,
      reviewer_name: (profile?.name ?? "").trim() || "Study Bud student",
      rating,
      comment: comment.trim() || null,
    } as any);
    if (error) { toast.error(error.message); setSubmitting(false); return; }
    await supabase.from("profiles")
      .update({ last_review_prompt_at: new Date().toISOString() } as any)
      .eq("user_id", user.id);
    toast.success("Thanks for the feedback! 💜");
    setSubmitting(false);
    setOpen(false);
    setRating(0); setComment("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="glass-strong max-w-md">
        <DialogHeader>
          <DialogTitle className="gradient-text">Loving Study Bud AI?</DialogTitle>
          <DialogDescription>Quick rating helps us build features that actually help you study.</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center gap-1 py-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
              className="p-1 transition-transform hover:scale-110"
              aria-label={`Rate ${n} stars`}
            >
              <Star
                className={`h-9 w-9 ${(hover || rating) >= n ? "fill-warning text-warning" : "text-muted-foreground"}`}
              />
            </button>
          ))}
        </div>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What helped? What could be better?"
          className="resize-none"
          rows={3}
        />
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={dismiss}>Maybe later</Button>
          <Button onClick={submit} disabled={submitting} className="bg-gradient-primary text-primary-foreground">
            {submitting ? "Sending..." : "Submit"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
