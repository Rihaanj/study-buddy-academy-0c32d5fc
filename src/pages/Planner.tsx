import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Check, Trash2, Lock } from "lucide-react";
import { computePriority, priorityLevel, awardXp, getActiveXpMultiplier, TASK_XP_COOLDOWN_MS } from "@/lib/gamification";
import { awardBadge, checkTaskCountBadges } from "@/lib/badges";
import { toast } from "sonner";
import { format, differenceInMinutes } from "date-fns";

type Task = {
  id: string; title: string; subject: string | null; due_date: string | null;
  grade_importance: number; difficulty: "low"|"medium"|"high"; confidence: number;
  completed: boolean; priority_score: number; awarded_xp: boolean;
};

export default function Planner() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [importance, setImportance] = useState(50);
  const [difficulty, setDifficulty] = useState<"low"|"medium"|"high">("medium");
  const [confidence, setConfidence] = useState(3);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("tasks").select("*").eq("user_id", user.id).order("completed").order("priority_score", { ascending: false });
    setTasks((data ?? []) as Task[]);
  };
  useEffect(() => { load(); }, [user]);

  const create = async () => {
    if (!user || !title.trim()) return;
    const score = computePriority(importance, difficulty, confidence);
    const { error } = await supabase.from("tasks").insert({
      user_id: user.id, title: title.trim(), subject: subject.trim() || null,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      grade_importance: importance, difficulty, confidence, priority_score: score,
    });
    if (error) { toast.error(error.message); return; }
    setOpen(false); setTitle(""); setSubject(""); setDueDate(""); setImportance(50); setDifficulty("medium"); setConfidence(3);
    toast.success("Task added 🚀");
    await checkTaskCountBadges(user.id);
    load();
  };

  const complete = async (t: Task) => {
    if (!user) return;
    if (t.completed) {
      toast.info("Completed tasks are locked — create a new task instead.");
      return;
    }
    // 5-min cooldown check
    const { data: prof } = await supabase.from("profiles").select("last_task_xp_at").eq("user_id", user.id).maybeSingle();
    const last = prof?.last_task_xp_at ? new Date(prof.last_task_xp_at).getTime() : 0;
    const sinceMs = Date.now() - last;
    let xp = 0;
    if (sinceMs >= TASK_XP_COOLDOWN_MS) {
      const mult = await getActiveXpMultiplier(user.id);
      xp = Math.round(10 * mult);
    }

    // Last-minute hero badge: completing within 60 min of due date
    if (t.due_date) {
      const diff = differenceInMinutes(new Date(t.due_date), new Date());
      if (diff >= 0 && diff <= 60) await awardBadge(user.id, "last_minute_hero");
    }

    await supabase.from("tasks").update({ completed: true, awarded_xp: xp > 0 }).eq("id", t.id);
    if (xp > 0) {
      await supabase.from("profiles").update({ last_task_xp_at: new Date().toISOString() }).eq("user_id", user.id);
      await awardXp(user.id, xp);
      toast.success(`Task done! +${xp} XP ⚡`);
    } else {
      const waitMin = Math.ceil((TASK_XP_COOLDOWN_MS - sinceMs) / 60000);
      toast.success(`Task done! (XP cooldown — ${waitMin}m left)`);
    }
    await awardBadge(user.id, "first_step");
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("tasks").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Planner</h1>
          <p className="text-muted-foreground text-sm">Auto-prioritized. 5-min XP cooldown · completed tasks lock 🔒</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary text-primary-foreground shadow-glow"><Plus className="h-4 w-4 mr-2"/>New task</Button>
          </DialogTrigger>
          <DialogContent className="glass-strong">
            <DialogHeader><DialogTitle>New task</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Title</Label><Input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Calc — chapter 5 problems"/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Subject</Label><Input value={subject} onChange={(e)=>setSubject(e.target.value)} placeholder="Math"/></div>
                <div><Label>Due</Label><Input type="datetime-local" value={dueDate} onChange={(e)=>setDueDate(e.target.value)}/></div>
              </div>
              <div>
                <Label>Grade importance: {importance}</Label>
                <Slider value={[importance]} max={100} step={5} onValueChange={(v)=>setImportance(v[0])}/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Difficulty</Label>
                  <Select value={difficulty} onValueChange={(v: any)=>setDifficulty(v)}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Confidence: {confidence}/5</Label>
                  <Slider value={[confidence]} min={1} max={5} step={1} onValueChange={(v)=>setConfidence(v[0])}/>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Predicted priority: <span className="text-foreground font-semibold">{Math.round(computePriority(importance, difficulty, confidence))}</span>
              </div>
              <Button onClick={create} className="w-full bg-gradient-primary text-primary-foreground">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {tasks.length === 0 && <div className="glass p-8 text-center text-muted-foreground">No tasks yet. Add your first 👆</div>}
        {tasks.map((t) => {
          const p = priorityLevel(Number(t.priority_score));
          return (
            <div key={t.id} className={`glass p-3 sm:p-4 flex items-center gap-2 sm:gap-3 ${t.completed ? "opacity-60" : ""}`}>
              <button
                onClick={()=>complete(t)}
                disabled={t.completed}
                aria-label={t.completed ? "Locked" : "Mark complete"}
                className={`h-6 w-6 rounded-md border grid place-items-center transition shrink-0 ${
                  t.completed ? "bg-success border-success cursor-not-allowed" : "border-white/20 hover:border-primary"
                }`}>
                {t.completed ? <Lock className="h-3 w-3 text-background"/> : null}
              </button>
              <div className="flex-1 min-w-0">
                <div className={`font-medium truncate ${t.completed ? "line-through" : ""}`}>{t.title}</div>
                <div className="text-[11px] sm:text-xs text-muted-foreground truncate">
                  {t.subject ?? "General"} · {t.due_date ? format(new Date(t.due_date), "MMM d, p") : "no due"} · {t.difficulty}
                </div>
              </div>
              <span className={`text-[10px] sm:text-xs px-2 py-1 rounded-full bg-white/5 ${p.color} shrink-0`}>{p.label}</span>
              <Button variant="ghost" size="icon" onClick={()=>remove(t.id)} className="shrink-0"><Trash2 className="h-4 w-4"/></Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
