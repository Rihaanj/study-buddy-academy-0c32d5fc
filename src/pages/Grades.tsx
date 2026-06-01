import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, GraduationCap, TrendingUp } from "lucide-react";
import { toast } from "sonner";

type Cls = {
  id: string; name: string; color: string;
  weight_homework: number; weight_tests: number; weight_projects: number;
};
type Asn = {
  id: string; class_id: string; title: string; category: string;
  points_earned: number | null; points_possible: number;
  due_date: string | null; is_hypothetical: boolean;
};

const CATS = ["homework", "tests", "projects"] as const;
const letter = (p: number) =>
  p >= 93 ? "A" : p >= 90 ? "A-" : p >= 87 ? "B+" : p >= 83 ? "B" : p >= 80 ? "B-" :
  p >= 77 ? "C+" : p >= 73 ? "C" : p >= 70 ? "C-" : p >= 67 ? "D+" : p >= 60 ? "D" : "F";

function classGrade(cls: Cls, asns: Asn[]) {
  const buckets: Record<string, { earned: number; possible: number }> = {
    homework: { earned: 0, possible: 0 },
    tests: { earned: 0, possible: 0 },
    projects: { earned: 0, possible: 0 },
  };
  for (const a of asns) {
    if (a.points_earned == null) continue;
    const b = buckets[a.category] || buckets.homework;
    b.earned += Number(a.points_earned);
    b.possible += Number(a.points_possible);
  }
  const weights: Record<string, number> = {
    homework: cls.weight_homework, tests: cls.weight_tests, projects: cls.weight_projects,
  };
  let num = 0, denom = 0;
  for (const k of CATS) {
    const b = buckets[k];
    if (b.possible > 0) {
      num += (b.earned / b.possible) * 100 * weights[k];
      denom += weights[k];
    }
  }
  return denom > 0 ? num / denom : 0;
}

export default function Grades() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Cls[]>([]);
  const [asns, setAsns] = useState<Asn[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // new class form
  const [newClassName, setNewClassName] = useState("");
  const [openClass, setOpenClass] = useState(false);

  // new assignment form
  const [newAsn, setNewAsn] = useState({ title: "", category: "homework", earned: "", possible: "100" });
  const [openAsn, setOpenAsn] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [c, a] = await Promise.all([
      supabase.from("grade_classes").select("*").eq("user_id", user.id).order("created_at"),
      supabase.from("grade_assignments").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    const cls = (c.data ?? []) as Cls[];
    setClasses(cls);
    setAsns((a.data ?? []) as Asn[]);
    if (!active && cls.length) setActive(cls[0].id);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const overall = useMemo(() => {
    if (!classes.length) return 0;
    const grades = classes.map(c => classGrade(c, asns.filter(a => a.class_id === c.id)));
    const valid = grades.filter(g => g > 0);
    return valid.length ? valid.reduce((s, g) => s + g, 0) / valid.length : 0;
  }, [classes, asns]);

  const addClass = async () => {
    if (!user || !newClassName.trim()) return;
    const colors = ["#7c3aed", "#ec4899", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];
    const color = colors[classes.length % colors.length];
    const { data, error } = await supabase.from("grade_classes").insert({
      user_id: user.id, name: newClassName.trim(), color,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setNewClassName(""); setOpenClass(false);
    await load();
    setActive(data!.id);
    toast.success("Class added");
  };

  const delClass = async (id: string) => {
    if (!confirm("Delete this class and all its assignments?")) return;
    await supabase.from("grade_assignments").delete().eq("class_id", id);
    await supabase.from("grade_classes").delete().eq("id", id);
    if (active === id) setActive(null);
    load();
  };

  const addAsn = async () => {
    if (!user || !active || !newAsn.title.trim()) return;
    const { error } = await supabase.from("grade_assignments").insert({
      user_id: user.id, class_id: active, title: newAsn.title.trim(),
      category: newAsn.category,
      points_earned: newAsn.earned === "" ? null : Number(newAsn.earned),
      points_possible: Number(newAsn.possible) || 100,
    });
    if (error) { toast.error(error.message); return; }
    setNewAsn({ title: "", category: "homework", earned: "", possible: "100" });
    setOpenAsn(false);
    load();
  };

  const updateAsn = async (id: string, patch: Partial<Asn>) => {
    await supabase.from("grade_assignments").update(patch).eq("id", id);
    load();
  };

  const delAsn = async (id: string) => {
    await supabase.from("grade_assignments").delete().eq("id", id);
    load();
  };

  const updateWeights = async (id: string, patch: Partial<Cls>) => {
    await supabase.from("grade_classes").update(patch).eq("id", id);
    load();
  };

  const activeClass = classes.find(c => c.id === active);
  const activeAsns = asns.filter(a => a.class_id === active);
  const activeGrade = activeClass ? classGrade(activeClass, activeAsns) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><GraduationCap className="h-6 w-6" /> Grades</h1>
          <p className="text-muted-foreground text-sm">Track classes, log assignments, and simulate what-if scores. Only you can see your grades.</p>
        </div>
        <Dialog open={openClass} onOpenChange={setOpenClass}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary text-primary-foreground shadow-glow"><Plus className="h-4 w-4 mr-1" /> Add class</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New class</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="e.g. AP Biology" value={newClassName} onChange={e => setNewClassName(e.target.value)} />
              <Button onClick={addClass} className="w-full">Add</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Overall hero */}
      <div className="glass-strong p-6 flex items-center gap-6">
        <div className="relative h-28 w-28 shrink-0">
          <svg viewBox="0 0 36 36" className="absolute inset-0">
            <circle cx="18" cy="18" r="16" fill="none" stroke="hsl(var(--muted))" strokeWidth="2.5" />
            <circle cx="18" cy="18" r="16" fill="none" stroke="url(#gg)" strokeWidth="2.5"
              strokeDasharray={`${Math.min(overall, 100)} 100`} strokeLinecap="round" transform="rotate(-90 18 18)" pathLength={100} />
            <defs><linearGradient id="gg" x1="0" x2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="100%" stopColor="hsl(var(--secondary))" />
            </linearGradient></defs>
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <div className="text-2xl font-bold gradient-text">{overall.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">{letter(overall)}</div>
            </div>
          </div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Overall GPA-style average</div>
          <div className="text-lg font-semibold">{classes.length} class{classes.length === 1 ? "" : "es"} · {asns.length} assignment{asns.length === 1 ? "" : "s"}</div>
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm">Loading…</div>
      ) : classes.length === 0 ? (
        <div className="glass p-8 text-center text-muted-foreground text-sm">
          No classes yet. Click <strong>Add class</strong> to start tracking.
        </div>
      ) : (
        <Tabs value={active ?? undefined} onValueChange={setActive}>
          <TabsList className="flex-wrap h-auto">
            {classes.map(c => {
              const g = classGrade(c, asns.filter(a => a.class_id === c.id));
              return (
                <TabsTrigger key={c.id} value={c.id} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                  {c.name} <span className="text-xs opacity-70">{g.toFixed(0)}%</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {classes.map(c => (
            <TabsContent key={c.id} value={c.id} className="space-y-4">
              <div className="glass-strong p-5 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">Current grade</div>
                  <div className="text-3xl font-bold gradient-text">{classGrade(c, asns.filter(a => a.class_id === c.id)).toFixed(2)}% · {letter(classGrade(c, asns.filter(a => a.class_id === c.id)))}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => delClass(c.id)} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-1" /> Delete class
                </Button>
              </div>

              {/* Weights */}
              <div className="glass p-4 grid grid-cols-3 gap-3">
                {CATS.map(cat => {
                  const key = `weight_${cat}` as keyof Cls;
                  return (
                    <div key={cat}>
                      <Label className="text-xs capitalize">{cat} weight (%)</Label>
                      <Input type="number" min={0} max={100} value={c[key] as number}
                        onChange={e => updateWeights(c.id, { [key]: Number(e.target.value) || 0 } as any)} />
                    </div>
                  );
                })}
              </div>

              {/* Assignments */}
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-1"><TrendingUp className="h-4 w-4" /> Assignments</h3>
                <Dialog open={openAsn} onOpenChange={setOpenAsn}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Add assignment</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>New assignment</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <Input placeholder="Title" value={newAsn.title} onChange={e => setNewAsn({ ...newAsn, title: e.target.value })} />
                      <Select value={newAsn.category} onValueChange={v => setNewAsn({ ...newAsn, category: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CATS.map(cat => <SelectItem key={cat} value={cat} className="capitalize">{cat}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label className="text-xs">Earned</Label>
                          <Input type="number" placeholder="(blank = not graded)" value={newAsn.earned} onChange={e => setNewAsn({ ...newAsn, earned: e.target.value })} /></div>
                        <div><Label className="text-xs">Out of</Label>
                          <Input type="number" value={newAsn.possible} onChange={e => setNewAsn({ ...newAsn, possible: e.target.value })} /></div>
                      </div>
                      <Button onClick={addAsn} className="w-full">Add</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-2">
                {asns.filter(a => a.class_id === c.id).length === 0 && (
                  <div className="text-sm text-muted-foreground glass p-4 text-center">No assignments yet.</div>
                )}
                {asns.filter(a => a.class_id === c.id).map(a => {
                  const pct = a.points_earned != null && a.points_possible > 0
                    ? (Number(a.points_earned) / Number(a.points_possible)) * 100 : null;
                  return (
                    <div key={a.id} className="glass p-3 flex items-center gap-3 flex-wrap">
                      <div className="flex-1 min-w-[160px]">
                        <div className="font-medium text-sm">{a.title}</div>
                        <div className="text-xs text-muted-foreground capitalize">{a.category}</div>
                      </div>
                      <Input type="number" className="w-20" placeholder="—"
                        value={a.points_earned ?? ""}
                        onChange={e => updateAsn(a.id, { points_earned: e.target.value === "" ? null : Number(e.target.value) } as any)} />
                      <span className="text-muted-foreground text-sm">/</span>
                      <Input type="number" className="w-20" value={a.points_possible}
                        onChange={e => updateAsn(a.id, { points_possible: Number(e.target.value) || 0 } as any)} />
                      <div className="text-sm font-mono w-16 text-right">
                        {pct != null ? `${pct.toFixed(0)}%` : "—"}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => delAsn(a.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
