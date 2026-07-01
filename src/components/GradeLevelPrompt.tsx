import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GraduationCap } from "lucide-react";

const OPTIONS = [
  { key: "middle", label: "Middle School", sub: "Grades 6-8" },
  { key: "high", label: "High School", sub: "Grades 9-12" },
  { key: "college", label: "College", sub: "Undergrad+" },
];

export function GradeLevelPrompt() {
  const { user } = useAuth();
  const { profile, reload } = useProfile();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !profile) return;
    if (!(profile as any).grade_level) setOpen(true);
  }, [user?.id, (profile as any)?.grade_level]);

  const pick = async (key: string) => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ grade_level: key })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Got it — your tutor will match your level.");
    setOpen(false);
    reload();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !(profile as any)?.grade_level) return; setOpen(v); }}>
      <DialogContent className="glass-strong max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" /> One quick question
          </DialogTitle>
          <DialogDescription>
            What level are you studying at? Your AI tutor will match your grade.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 mt-2">
          {OPTIONS.map((o) => (
            <Button
              key={o.key}
              onClick={() => pick(o.key)}
              disabled={saving}
              variant="outline"
              className="justify-start h-auto py-3"
            >
              <div className="text-left">
                <div className="font-semibold">{o.label}</div>
                <div className="text-[11px] text-muted-foreground">{o.sub}</div>
              </div>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
