import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ShieldAlert, Loader2, Check, X, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cleanText } from "@/lib/sanitize";

type Report = {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  reason: string;
  context: string | null;
  status: "pending" | "approved" | "dismissed";
  created_at: string;
  reviewed_at: string | null;
};

export default function CheatReports() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      const isAdmin = !!data;
      setAllowed(isAdmin);
      if (!isAdmin) { setLoading(false); return; }
      const { data: reports } = await supabase
        .from("cheat_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      setRows((reports ?? []) as Report[]);
      setLoading(false);
    })();
  }, [user?.id]);

  if (allowed === false) {
    return (
      <div className="glass p-8 text-center space-y-3">
        <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground" />
        <h1 className="text-xl font-semibold">Admins only</h1>
        <p className="text-sm text-muted-foreground">This page is restricted.</p>
        <Button onClick={() => navigate("/")} variant="outline">Back home</Button>
      </div>
    );
  }

  const approve = async (r: Report) => {
    setWorking(r.id);
    const { error } = await supabase.rpc("admin_apply_level_penalty", { _user_id: r.user_id, _report_id: r.id });
    setWorking(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Penalty applied to ${cleanText(r.user_name) || r.user_email || "user"} (-1 level)`);
    setRows((rs) => rs.map((x) => x.id === r.id ? { ...x, status: "approved", reviewed_at: new Date().toISOString() } : x));
  };

  const dismiss = async (r: Report) => {
    setWorking(r.id);
    const { error } = await supabase
      .from("cheat_reports")
      .update({ status: "dismissed", reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq("id", r.id);
    setWorking(null);
    if (error) { toast.error(error.message); return; }
    setRows((rs) => rs.map((x) => x.id === r.id ? { ...x, status: "dismissed", reviewed_at: new Date().toISOString() } : x));
  };

  const remove = async (r: Report) => {
    setWorking(r.id);
    const { error } = await supabase.from("cheat_reports").delete().eq("id", r.id);
    setWorking(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Report deleted");
    setRows((rs) => rs.filter((x) => x.id !== r.id));
  };

  const pending = rows.filter((r) => r.status === "pending");
  const reviewed = rows.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <ShieldAlert className="h-6 w-6 text-warning" />
        <div>
          <h1 className="text-2xl font-bold gradient-text">Cheat reports</h1>
          <p className="text-sm text-muted-foreground">Admin-only. Approving applies a -1 level penalty (-100 XP).</p>
        </div>
      </header>

      {loading ? (
        <div className="glass p-6 text-center text-muted-foreground"><Loader2 className="h-4 w-4 inline animate-spin mr-2" />Loading...</div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Pending ({pending.length})</h2>
            {pending.length === 0 && <div className="glass p-6 text-center text-muted-foreground text-sm">Nothing to review 🎉</div>}
            {pending.map((r) => (
              <article key={r.id} className="glass p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="font-semibold">{cleanText(r.user_name) || "Unnamed"}</div>
                    <div className="text-xs text-muted-foreground">{r.user_email ?? "—"} · {format(new Date(r.created_at), "PPp")}</div>
                  </div>
                  <Badge variant="outline" className="border-warning/50 text-warning">{r.reason}</Badge>
                </div>
                {r.context && (
                  <pre className="text-xs bg-white/5 p-3 rounded-lg whitespace-pre-wrap break-words max-h-48 overflow-y-auto">{cleanText(r.context)}</pre>
                )}
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => dismiss(r)} disabled={working === r.id}>
                    <X className="h-3.5 w-3.5 mr-1" />Dismiss
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive" disabled={working === r.id}>
                        {working === r.id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                        Approve (-1 level)
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Apply level penalty?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove 100 XP from {cleanText(r.user_name) || r.user_email || "this user"} (drops them by ~1 level). Cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => approve(r)}>Confirm penalty</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </article>
            ))}
          </section>

          {reviewed.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Reviewed ({reviewed.length})</h2>
              {reviewed.map((r) => (
                <div key={r.id} className="glass p-3 flex items-center gap-3 opacity-70">
                  <Badge variant={r.status === "approved" ? "destructive" : "outline"}>{r.status}</Badge>
                  <div className="text-sm flex-1 min-w-0 truncate">{cleanText(r.user_name) || r.user_email}</div>
                  <div className="text-xs text-muted-foreground truncate hidden sm:block">{r.reason}</div>
                  <div className="text-xs text-muted-foreground shrink-0">{format(new Date(r.created_at), "MMM d")}</div>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
