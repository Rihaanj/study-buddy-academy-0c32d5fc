import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserAvatar } from "./UserAvatar";
import { Button } from "./ui/button";
import { Crown, Shield, UserMinus, Trash2, Star } from "lucide-react";
import { cleanText } from "@/lib/sanitize";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

type Member = {
  id: string; user_id: string; role: string;
  profile?: { name: string | null; avatar_url: string | null; email: string | null };
};

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  group: { id: string; name: string; created_by: string } | null;
  onGroupDeleted?: () => void;
};

export const GroupMembersDialog = ({ open, onOpenChange, group, onGroupDeleted }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!group) return;
    setLoading(true);
    const { data: ms } = await supabase
      .from("group_members")
      .select("id,user_id,role")
      .eq("group_id", group.id);
    const ids = (ms ?? []).map((m: any) => m.user_id);
    let profMap: Record<string, any> = {};
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles").select("user_id,name,avatar_url,email").in("user_id", ids);
      (profs ?? []).forEach((p: any) => { profMap[p.user_id] = p; });
    }
    setMembers((ms ?? []).map((m: any) => ({ ...m, profile: profMap[m.user_id] })));
    setLoading(false);
  };

  useEffect(() => {
    if (open && group) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, group?.id]);

  const me = members.find((m) => m.user_id === user?.id);
  const amHost = me?.role === "host" || me?.role === "cohost";

  const setRole = async (mid: string, role: string) => {
    const { error } = await supabase.from("group_members").update({ role }).eq("id", mid);
    if (error) { toast.error(error.message); return; }
    toast.success("Role updated");
    load();
  };

  const kick = async (m: Member) => {
    if (m.role === "host") { toast.error("Cannot remove the host"); return; }
    if (!confirm(`Remove ${cleanText(m.profile?.name) || "this member"}?`)) return;
    const { error } = await supabase.from("group_members").delete().eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Member removed");
    load();
  };

  const leave = async () => {
    if (!me) return;
    if (!confirm("Leave this group?")) return;
    const { error } = await supabase.from("group_members").delete().eq("id", me.id);
    if (error) { toast.error(error.message); return; }
    toast.success("You left the group");
    onOpenChange(false);
    onGroupDeleted?.();
  };

  const deleteGroup = async () => {
    if (!group) return;
    if (!confirm(`Delete "${group.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("groups").delete().eq("id", group.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Group deleted");
    onOpenChange(false);
    onGroupDeleted?.();
    navigate("/chat");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-w-md">
        <DialogHeader><DialogTitle>Group members ({members.length})</DialogTitle></DialogHeader>
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
          <>
            <ul className="space-y-2 max-h-72 overflow-y-auto">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                  <UserAvatar url={m.profile?.avatar_url} name={m.profile?.name} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate flex items-center gap-1.5">
                      {cleanText(m.profile?.name) || "Unnamed"}
                      {m.role === "host" && <Crown className="h-3.5 w-3.5 text-warning" aria-label="Host" />}
                      {m.role === "cohost" && <Shield className="h-3.5 w-3.5 text-primary" aria-label="Co-host" />}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">{m.profile?.email}</div>
                  </div>
                  {amHost && m.user_id !== user?.id && me?.role === "host" && m.role !== "host" && (
                    m.role === "cohost" ? (
                      <Button size="icon" variant="ghost" title="Demote" onClick={() => setRole(m.id, "member")}>
                        <Star className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    ) : (
                      <Button size="icon" variant="ghost" title="Promote to co-host" onClick={() => setRole(m.id, "cohost")}>
                        <Star className="h-4 w-4 text-primary" />
                      </Button>
                    )
                  )}
                  {amHost && m.user_id !== user?.id && m.role !== "host" && (
                    <Button size="icon" variant="ghost" onClick={() => kick(m)} title="Remove">
                      <UserMinus className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex gap-2 pt-3 border-t border-white/10">
              {me?.role !== "host" && (
                <Button variant="outline" size="sm" onClick={leave} className="flex-1">Leave group</Button>
              )}
              {me?.role === "host" && (
                <Button variant="destructive" size="sm" onClick={deleteGroup} className="flex-1">
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete group
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
