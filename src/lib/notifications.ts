import { supabase } from "@/integrations/supabase/client";
import { differenceInHours, differenceInMinutes } from "date-fns";
import { toast } from "sonner";

const SEEN_KEY = "sba_seen_due_reminders_v1";
const seen = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]")); } catch { return new Set(); }
};
const remember = (s: Set<string>) => localStorage.setItem(SEEN_KEY, JSON.stringify([...s]));

/**
 * In-app due-date notifier. Shows a toast for each incomplete task that is:
 *   - due in the next 24 hours (once per task per day)
 *   - due in the next 60 minutes (once per task)
 *   - overdue (once per task)
 * Persists "seen" markers in localStorage so the same reminder doesn't spam.
 */
export async function runDueDateNotifier(userId: string) {
  if (!userId) return;
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id,title,due_date,completed")
    .eq("user_id", userId)
    .eq("completed", false)
    .not("due_date", "is", null);

  if (!tasks?.length) return;
  const today = new Date().toISOString().slice(0, 10);
  const s = seen();
  let changed = false;

  for (const t of tasks) {
    if (!t.due_date) continue;
    const due = new Date(t.due_date);
    const mins = differenceInMinutes(due, new Date());
    const hrs = differenceInHours(due, new Date());

    if (mins < 0) {
      const key = `overdue:${t.id}`;
      if (!s.has(key)) { toast.error(`Overdue: ${t.title}`, { description: "This task's deadline has passed." }); s.add(key); changed = true; }
    } else if (mins <= 60) {
      const key = `1h:${t.id}`;
      if (!s.has(key)) { toast.warning(`Due in ${mins}m: ${t.title}`, { description: "Final push!" }); s.add(key); changed = true; }
    } else if (hrs <= 24) {
      const key = `24h:${t.id}:${today}`;
      if (!s.has(key)) { toast(`Due tomorrow: ${t.title}`, { description: "Start prepping today." }); s.add(key); changed = true; }
    }
  }
  if (changed) remember(s);
}
