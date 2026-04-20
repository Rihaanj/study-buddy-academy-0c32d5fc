import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { format, isSameDay, parseISO, startOfMonth, endOfMonth, addDays, startOfWeek, endOfWeek } from "date-fns";
import { toast } from "sonner";

type EventRow = {
  id: string;
  title: string;
  date: string;
  type: string;
  duration_minutes: number;
  description: string | null;
  notes: string | null;
};

type Item = {
  id: string;
  title: string;
  date: string;
  kind: "task" | "event" | "focus";
  meta?: string;
  event?: EventRow;
};

export default function Calendar() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] = useState<"school" | "exam" | "personal">("school");
  const [duration, setDuration] = useState<number | "">("");
  const [month, setMonth] = useState(new Date());

  // Detail dialog state
  const [selected, setSelected] = useState<Item | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    const [{ data: events }, { data: tasks }, { data: sessions }] = await Promise.all([
      supabase.from("events").select("*").eq("user_id", user.id),
      supabase.from("tasks").select("*").eq("user_id", user.id).not("due_date", "is", null),
      supabase.from("focus_sessions").select("*").eq("user_id", user.id),
    ]);
    const list: Item[] = [];
    (events ?? []).forEach((e: any) =>
      list.push({ id: `e-${e.id}`, title: e.title, date: e.date, kind: "event", meta: e.type, event: e })
    );
    (tasks ?? []).forEach((t: any) => list.push({ id: `t-${t.id}`, title: t.title, date: t.due_date, kind: "task" }));
    (sessions ?? []).forEach((s: any) =>
      list.push({ id: `f-${s.id}`, title: `Focus ${s.duration_minutes}m`, date: s.completed_at, kind: "focus" })
    );
    setItems(list);
  };
  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel(`cal-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "events", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const create = async () => {
    if (!user || !title.trim() || !date) return;
    const { error } = await supabase.from("events").insert({
      user_id: user.id, title: title.trim(), date: new Date(date).toISOString(), type,
      duration_minutes: duration === "" ? 60 : Number(duration),
    });
    if (error) { toast.error(error.message); return; }
    setOpen(false); setTitle(""); setDate(""); setType("school"); setDuration("");
    toast.success("Event added");
    load();
  };

  const openDetail = (i: Item) => {
    setSelected(i);
    setEditTitle(i.title);
    setEditDescription(i.event?.description ?? "");
    setEditNotes(i.event?.notes ?? "");
  };

  const saveDetail = async () => {
    if (!selected?.event) return;
    setSaving(true);
    const { error } = await supabase
      .from("events")
      .update({ title: editTitle.trim() || selected.title, description: editDescription, notes: editNotes })
      .eq("id", selected.event.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    setSelected(null);
    load();
  };

  const deleteEvent = async () => {
    if (!selected?.event) return;
    const { error } = await supabase.from("events").delete().eq("id", selected.event.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Event deleted");
    setSelected(null);
    load();
  };

  const start = startOfWeek(startOfMonth(month));
  const end = endOfWeek(endOfMonth(month));
  const days: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);

  const colorOf = (i: Item) => {
    if (i.kind === "task") return "bg-primary/30 border-primary/50";
    if (i.kind === "focus") return "bg-accent/30 border-accent/50";
    if (i.meta === "exam") return "bg-destructive/30 border-destructive/50";
    if (i.meta === "personal") return "bg-muted/40 border-border";
    return "bg-primary/30 border-primary/50";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Calendar</h1>
          <p className="text-muted-foreground text-sm">Tasks · Events · Focus — click any event to add notes.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setMonth(addDays(startOfMonth(month), -1))}>‹</Button>
          <div className="px-3 py-2 text-sm font-semibold">{format(month, "MMMM yyyy")}</div>
          <Button variant="ghost" onClick={() => setMonth(addDays(endOfMonth(month), 1))}>›</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-gradient-primary text-primary-foreground"><Plus className="h-4 w-4 mr-2" />Event</Button></DialogTrigger>
            <DialogContent className="glass-strong">
              <DialogHeader><DialogTitle>New event</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                <div><Label>When</Label><Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Type</Label>
                    <Select value={type} onValueChange={(v: any) => setType(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="school">School</SelectItem>
                        <SelectItem value="exam">Exam</SelectItem>
                        <SelectItem value="personal">Personal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Duration (min) <span className="text-muted-foreground text-[10px]">— optional</span></Label><Input type="number" value={duration} onChange={(e) => setDuration(e.target.value === "" ? "" : (Number(e.target.value) || ""))} placeholder="60" /></div>
                </div>
                <Button onClick={create} className="w-full bg-gradient-primary text-primary-foreground">Add</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="glass-strong p-3">
        <div className="grid grid-cols-7 gap-1 text-[11px] text-muted-foreground mb-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="px-2 py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const dayItems = items.filter((i) => isSameDay(parseISO(i.date), d));
            const inMonth = d.getMonth() === month.getMonth();
            return (
              <div key={d.toISOString()} className={`min-h-[88px] p-1.5 rounded-lg border border-white/5 ${inMonth ? "bg-white/[0.02]" : "opacity-40"}`}>
                <div className="text-xs text-muted-foreground">{format(d, "d")}</div>
                <div className="space-y-1 mt-1">
                  {dayItems.slice(0, 3).map((i) => (
                    <button
                      key={i.id}
                      onClick={() => i.kind === "event" && openDetail(i)}
                      className={`text-[10px] truncate w-full text-left px-1.5 py-0.5 rounded border ${colorOf(i)} ${i.kind === "event" ? "hover:brightness-125 cursor-pointer" : "cursor-default"}`}
                    >
                      {i.title}
                    </button>
                  ))}
                  {dayItems.length > 3 && <div className="text-[10px] text-muted-foreground">+{dayItems.length - 3} more</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Event detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="glass-strong max-w-md">
          <DialogHeader>
            <DialogTitle>Event details</DialogTitle>
          </DialogHeader>
          {selected?.event && (
            <div className="space-y-3">
              <div>
                <Label>Title</Label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
              <div className="text-xs text-muted-foreground">
                {format(parseISO(selected.event.date), "EEE, MMM d · h:mm a")} · {selected.event.duration_minutes}m · {selected.event.type}
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="What is this event about?"
                  rows={2}
                />
              </div>
              <div>
                <Label>Notes (things to remember)</Label>
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Materials to bring, topics to review, links..."
                  rows={4}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={saveDetail} disabled={saving} className="flex-1 bg-gradient-primary text-primary-foreground">
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button variant="ghost" onClick={deleteEvent} aria-label="Delete event">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
