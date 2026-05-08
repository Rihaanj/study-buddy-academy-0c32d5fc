import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, FlaskConical, GraduationCap, Link2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { toast } from "sonner";
import { format } from "date-fns";

type Klass = { id: string; name: string; color: string; weight_homework: number; weight_tests: number; weight_projects: number };
type Assn = { id: string; class_id: string; title: string; category: string; points_earned: number | null; points_possible: number; is_hypothetical: boolean; due_date: string | null; created_at: string };

const db = supabase as any;

const CATS = ["homework", "tests", "projects"] as const;

function letterGrade(pct: number) {
  if (pct >= 93) return "A"; if (pct >= 90) return "A-";
  if (pct >= 87) return "B+"; if (pct >= 83) return "B"; if (pct >= 80) return "B-";
  if (pct >= 77) return "C+"; if (pct >= 73) return "C"; if (pct >= 70) return "C-";
  if (pct >= 67) return "D+"; if (pct >= 63) return "D"; if (pct >= 60) return "D-";
  return "F";
}

function classGrade(klass: Klass, items: Assn[]) {
  const buckets: Record<string, { earned: number; possible: number }> = { homework: { earned: 0, possible: 0 }, tests: { earned: 0, possible: 0 }, projects: { earned: 0, possible: 0 } };
  for (const a of items) {
    if (a.points_earned == null) continue;
    const c = buckets[a.category] ?? buckets.homework;
    c.earned += Number(a.points_earned);
    c.possible += Number(a.points_possible);
  }
  const weights = { homework: klass.weight_homework, tests: klass.weight_tests, projects: klass.weight_projects };
  let weighted = 0, totalW = 0;
  for (const k of CATS) {
    const b = buckets[k];
    if (b.possible > 0) { weighted += (b.earned / b.possible) * weights[k]; totalW += weights[k]; }
  }
  if (totalW === 0) return null;
  return (weighted / totalW) * 100;
}

export default function Grades() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Klass[]>([]);
  const [assignments, setAssignments] = useState<Assn[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openClass, setOpenClass] = useState(false);
  const [openAssn, setOpenAssn] = useState(false);
  const [newClass, setNewClass] = useState({ name: "", color: "#7c3aed" });
  const [newAssn, setNewAssn] = useState({ title: "", category: "homework", points_earned: "", points_possible: "100", is_hypothetical: false });

  const load = async () => {
    if (!user) return;
    const [{ data: cls }, { data: ass }] = await Promise.all([
      db.from("grade_classes").select("*").eq("user_id", user.id).order("created_at"),
      db.from("grade_assignments").select("*").eq("user_id", user.id).order("created_at"),
    ]);
    setClasses(cls ?? []);
    setAssignments(ass ?? []);
    if (!activeId && (cls ?? []).length) setActiveId(cls[0].id);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const addClass = async () => {
    if (!user || !newClass.name.trim()) return;
    const { data, error } = await db.from("grade_classes").insert({ user_id: user.id, name: newClass.name.trim(), color: newClass.color }).select().single();
    if (error) { toast.error(error.message); return; }
    setClasses((c) => [...c, data]); setActiveId(data.id); setNewClass({ name: "", color: "#7c3aed" }); setOpenClass(false);
  };

  const removeClass = async (id: string) => {
    if (!confirm("Delete this class and all its assignments?")) return;
    await db.from("grade_classes").delete().eq("id", id);
    setClasses((c) => c.filter((k) => k.id !== id));
    setAssignments((a) => a.filter((x) => x.class_id !== id));
    if (activeId === id) setActiveId(classes.find((k) => k.id !== id)?.id ?? null);
  };

  const addAssn = async () => {
    if (!user || !activeId || !newAssn.title.trim()) return;
    const payload = {
      user_id: user.id, class_id: activeId, title: newAssn.title.trim(),
      category: newAssn.category,
      points_earned: newAssn.points_earned === "" ? null : Number(newAssn.points_earned),
      points_possible: Number(newAssn.points_possible || 100),
      is_hypothetical: newAssn.is_hypothetical,
    };
    const { data, error } = await db.from("grade_assignments").insert(payload).select().single();
    if (error) { toast.error(error.message); return; }
    setAssignments((a) => [...a, data]);
    setNewAssn({ title: "", category: "homework", points_earned: "", points_possible: "100", is_hypothetical: false });
    setOpenAssn(false);
  };

  const removeAssn = async (id: string) => {
    await db.from("grade_assignments").delete().eq("id", id);
    setAssignments((a) => a.filter((x) => x.id !== id));
  };

  const activeClass = classes.find((c) => c.id === activeId);
  const classItems = useMemo(() => assignments.filter((a) => a.class_id === activeId), [assignments, activeId]);
  const realItems = classItems.filter((a) => !a.is_hypothetical);
  const realPct = activeClass ? classGrade(activeClass, realItems) : null;
  const simPct = activeClass ? classGrade(activeClass, classItems) : null;

  // chart: running grade after each scored real assignment
  const chartData = useMemo(() => {
    if (!activeClass) return [] as { name: string; grade: number }[];
    const sorted = [...realItems].filter((a) => a.points_earned != null).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const out: { name: string; grade: number }[] = [];
    const acc: Assn[] = [];
    sorted.forEach((a, i) => {
      acc.push(a);
      const g = classGrade(activeClass, acc);
      if (g != null) out.push({ name: a.title.slice(0, 14) || `#${i + 1}`, grade: Math.round(g * 10) / 10 });
    });
    return out;
  }, [classItems, activeClass]);

  return (
    <div className="space-y-6">
      <header className="glass-strong p-5 sm:p-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><GraduationCap className="h-6 w-6 text-primary" /> Grades</h1>
          <p className="text-sm text-muted-foreground mt-1">Track each class. Add real or what-if assignments to see how scores change your grade.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" disabled className="opacity-70" title="Schoology sync coming once API keys are added"><Link2 className="h-4 w-4 mr-2" />Connect Schoology</Button>
          <Dialog open={openClass} onOpenChange={setOpenClass}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add class</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New class</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="e.g. AP Biology" value={newClass.name} onChange={(e) => setNewClass({ ...newClass, name: e.target.value })} />
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground">Color</label>
                  <input type="color" value={newClass.color} onChange={(e) => setNewClass({ ...newClass, color: e.target.value })} className="h-9 w-16 rounded bg-transparent border border-white/10" />
                </div>
                <p className="text-xs text-muted-foreground">Default weights: 30% homework · 50% tests · 20% projects.</p>
              </div>
              <DialogFooter><Button onClick={addClass}>Create</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {classes.length === 0 ? (
        <div className="glass p-8 text-center text-muted-foreground">No classes yet — add one to get started.</div>
      ) : (
        <Tabs value={activeId ?? ""} onValueChange={setActiveId}>
          <TabsList className="flex flex-wrap h-auto justify-start gap-1">
            {classes.map((c) => (
              <TabsTrigger key={c.id} value={c.id} className="gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                {c.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {activeClass && (
            <TabsContent value={activeClass.id} className="space-y-5 mt-5">
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="glass p-4">
                  <div className="text-xs uppercase text-muted-foreground">Current grade</div>
                  <div className="text-3xl font-bold mt-1">{realPct == null ? "—" : `${realPct.toFixed(1)}%`}</div>
                  <div className="text-xs text-muted-foreground">{realPct == null ? "No scored work" : letterGrade(realPct)}</div>
                </div>
                <div className="glass p-4">
                  <div className="text-xs uppercase text-muted-foreground flex items-center gap-1"><FlaskConical className="h-3 w-3" /> What-if grade</div>
                  <div className="text-3xl font-bold mt-1 text-accent">{simPct == null ? "—" : `${simPct.toFixed(1)}%`}</div>
                  <div className="text-xs text-muted-foreground">Includes hypothetical entries</div>
                </div>
                <div className="glass p-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Class</div>
                    <div className="text-sm mt-1">{classItems.length} assignments</div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeClass(activeClass.id)} aria-label="Delete class"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>

              <div className="glass p-4">
                <div className="text-sm font-semibold mb-2">Grade over time</div>
                {chartData.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Add scored assignments to see your trend.</p>
                ) : (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <RTooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                        <Line type="monotone" dataKey="grade" stroke={activeClass.color} strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="glass p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-semibold">Assignments</div>
                  <Dialog open={openAssn} onOpenChange={setOpenAssn}>
                    <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add</Button></DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>New assignment</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <Input placeholder="Title (e.g. Unit 3 quiz)" value={newAssn.title} onChange={(e) => setNewAssn({ ...newAssn, title: e.target.value })} />
                        <Select value={newAssn.category} onValueChange={(v) => setNewAssn({ ...newAssn, category: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="homework">Homework</SelectItem>
                            <SelectItem value="tests">Tests</SelectItem>
                            <SelectItem value="projects">Projects</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="grid grid-cols-2 gap-2">
                          <Input placeholder="Score" type="number" value={newAssn.points_earned} onChange={(e) => setNewAssn({ ...newAssn, points_earned: e.target.value })} />
                          <Input placeholder="Out of" type="number" value={newAssn.points_possible} onChange={(e) => setNewAssn({ ...newAssn, points_possible: e.target.value })} />
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={newAssn.is_hypothetical} onChange={(e) => setNewAssn({ ...newAssn, is_hypothetical: e.target.checked })} />
                          What-if (test impact, not part of real grade)
                        </label>
                      </div>
                      <DialogFooter><Button onClick={addAssn}>Add</Button></DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                {classItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No assignments yet.</p>
                ) : (
                  <ul className="divide-y divide-white/5">
                    {classItems.map((a) => {
                      const pct = a.points_earned == null ? null : (Number(a.points_earned) / Number(a.points_possible)) * 100;
                      return (
                        <li key={a.id} className="py-2 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm truncate flex items-center gap-2">
                              {a.title}
                              {a.is_hypothetical && <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent">what-if</span>}
                            </div>
                            <div className="text-xs text-muted-foreground capitalize">{a.category} · {a.points_earned ?? "—"}/{a.points_possible}{a.due_date ? ` · due ${format(new Date(a.due_date), "MMM d")}` : ""}</div>
                          </div>
                          <div className="text-sm font-mono w-16 text-right">{pct == null ? "—" : `${pct.toFixed(0)}%`}</div>
                          <Button variant="ghost" size="icon" onClick={() => removeAssn(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}
