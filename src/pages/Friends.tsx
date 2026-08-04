import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/UserAvatar";
import { AvatarUpload } from "@/components/AvatarUpload";
import { Search, UserPlus, Check, X, Users, Inbox, Send, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { cleanText } from "@/lib/sanitize";
import { getOrCreateDM } from "@/lib/dm";
import { useNavigate } from "react-router-dom";


type ProfileLite = { user_id: string; name: string | null; email: string | null; avatar_url: string | null; level: number };

type Request = {
  id: string;
  from_user: string;
  to_user: string;
  status: string;
  created_at: string;
  profile?: ProfileLite;
};

type Friend = { friendship_id: string; profile: ProfileLite };

export default function Friends() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfileLite[]>([]);
  const [searching, setSearching] = useState(false);
  const [incoming, setIncoming] = useState<Request[]>([]);
  const [outgoing, setOutgoing] = useState<Request[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);

  const loadAll = async () => {
    if (!user) return;
    const [{ data: reqs }, { data: fs }, { data: memberships }] = await Promise.all([
      supabase.from("friend_requests").select("*").or(`from_user.eq.${user.id},to_user.eq.${user.id}`).eq("status", "pending"),
      supabase.from("friendships").select("*").or(`user_a.eq.${user.id},user_b.eq.${user.id}`),
      supabase.from("group_members").select("group_id").eq("user_id", user.id),
    ]);

    const otherIds = new Set<string>();
    (reqs ?? []).forEach((r: any) => otherIds.add(r.from_user === user.id ? r.to_user : r.from_user));
    (fs ?? []).forEach((f: any) => otherIds.add(f.user_a === user.id ? f.user_b : f.user_a));

    let profilesMap: Record<string, ProfileLite> = {};
    if (otherIds.size) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id,name,email,avatar_url,level")
        .in("user_id", Array.from(otherIds));
      (profs ?? []).forEach((p: any) => { profilesMap[p.user_id] = p; });
    }

    const inc: Request[] = [];
    const out: Request[] = [];
    (reqs ?? []).forEach((r: any) => {
      const otherId = r.from_user === user.id ? r.to_user : r.from_user;
      const enriched = { ...r, profile: profilesMap[otherId] };
      if (r.to_user === user.id) inc.push(enriched);
      else out.push(enriched);
    });
    setIncoming(inc);
    setOutgoing(out);

    const fl: Friend[] = (fs ?? []).map((f: any) => {
      const otherId = f.user_a === user.id ? f.user_b : f.user_a;
      return { friendship_id: f.id, profile: profilesMap[otherId] };
    }).filter((f) => f.profile);
    setFriends(fl);

    const groupIds = (memberships ?? []).map((m: any) => m.group_id);
    if (groupIds.length) {
      const { data: gs } = await supabase.from("groups").select("id,name").in("id", groupIds);
      setGroups((gs ?? []) as any);
    } else {
      setGroups([]);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadAll();
    const ch = supabase
      .channel(`friends-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "friend_requests" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => loadAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const friendIds = useMemo(() => new Set(friends.map((f) => f.profile.user_id)), [friends]);
  const pendingIds = useMemo(() => {
    const s = new Set<string>();
    incoming.forEach((r) => s.add(r.from_user));
    outgoing.forEach((r) => s.add(r.to_user));
    return s;
  }, [incoming, outgoing]);

  const search = async () => {
    if (!user || !query.trim()) { setResults([]); return; }
    setSearching(true);
    const q = query.trim().replace(/[%,()]/g, "");
    // Server-side RPC: returns only name/avatar/level (never email) so we don't expose PII.
    const { data } = await supabase.rpc("search_users" as any, { _q: q });
    setResults(((data ?? []) as any[]).map((p) => ({
      user_id: p.user_id, name: p.name, avatar_url: p.avatar_url, level: p.level,
    })) as ProfileLite[]);
    setSearching(false);
  };

  const sendRequest = async (to: string) => {
    if (!user) return;
    const { error } = await supabase.from("friend_requests").insert({ from_user: user.id, to_user: to });
    if (error) { toast.error(error.message); return; }
    toast.success("Friend request sent");
    loadAll();
  };

  const respond = async (id: string, accept: boolean) => {
    const req = incoming.find((r) => r.id === id);
    const { error } = await supabase.from("friend_requests").update({ status: accept ? "accepted" : "rejected" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (accept && user && req?.profile) {
      const dmId = await getOrCreateDM(user.id, req.profile.user_id, req.profile.name);
      const { awardBadge } = await import("@/lib/badges");
      await awardBadge(user.id, "first_friend");
      await loadAll();
      toast.success("Friend added 🎉");
      if (dmId) navigate(`/chat?dm=${dmId}`);
      return;
    }
    toast.success("Request rejected");
    loadAll();
  };

  const messageFriend = async (p: ProfileLite) => {
    if (!user) return;
    const id = await getOrCreateDM(user.id, p.user_id, p.name);
    if (!id) { toast.error("Couldn't open chat"); return; }
    await loadAll();
    navigate(`/chat?dm=${id}`);
  };

  const cancel = async (id: string) => {
    await supabase.from("friend_requests").delete().eq("id", id);
    loadAll();
  };

  const removeFriend = async (id: string) => {
    await supabase.from("friendships").delete().eq("id", id);
    toast.success("Friend removed");
    loadAll();
  };

  const inviteToGroup = async (friendId: string, groupId: string) => {
    if (!user) return;
    const { error } = await supabase.from("group_members").insert({ group_id: groupId, user_id: friendId });
    if (error) { toast.error(error.message); return; }
    toast.success("Friend added to group");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold gradient-text flex items-center gap-2"><Users className="h-6 w-6" /> Friends</h1>
        <p className="text-muted-foreground text-sm">Search by their name, send requests, and invite friends to your study groups.</p>
      </div>

      {/* Profile picture */}
      <section className="glass p-5">
        <h2 className="font-semibold mb-3">Your profile picture</h2>
        <AvatarUpload />
      </section>

      {/* Search */}
      <section className="glass p-5">
        <h2 className="font-semibold mb-3 flex items-center gap-2"><Search className="h-4 w-4" /> Find people</h2>
        <div className="flex gap-2">
          <Input
            placeholder="Search by first or last name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
          <Button onClick={search} className="bg-gradient-primary text-primary-foreground" disabled={searching}>Search</Button>
        </div>
        {results.length > 0 && (
          <ul className="mt-4 space-y-2">
            {results.map((p) => {
              const isFriend = friendIds.has(p.user_id);
              const pending = pendingIds.has(p.user_id);
              return (
                <li key={p.user_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5">
                  <UserAvatar url={p.avatar_url} name={p.name} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{cleanText(p.name) || "Unnamed"}</div>
                    <div className="text-xs text-muted-foreground truncate">Lv {p.level}</div>
                  </div>
                  {isFriend ? (
                    <span className="text-xs text-success">Friends ✓</span>
                  ) : pending ? (
                    <span className="text-xs text-muted-foreground">Pending</span>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => sendRequest(p.user_id)}>
                      <UserPlus className="h-3.5 w-3.5 mr-1" /> Add
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Incoming */}
      <section className="glass p-5">
        <h2 className="font-semibold mb-3 flex items-center gap-2"><Inbox className="h-4 w-4" /> Incoming requests ({incoming.length})</h2>
        {incoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending requests.</p>
        ) : (
          <ul className="space-y-2">
            {incoming.map((r) => (
              <li key={r.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                <UserAvatar url={r.profile?.avatar_url} name={r.profile?.name} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{cleanText(r.profile?.name) || "Unknown"}</div>
                  <div className="text-xs text-muted-foreground truncate">Lv {r.profile?.level ?? 1}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => respond(r.id, true)} aria-label="Accept"><Check className="h-4 w-4 text-success" /></Button>
                <Button size="icon" variant="ghost" onClick={() => respond(r.id, false)} aria-label="Reject"><X className="h-4 w-4 text-destructive" /></Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Outgoing */}
      {outgoing.length > 0 && (
        <section className="glass p-5">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><Send className="h-4 w-4" /> Sent ({outgoing.length})</h2>
          <ul className="space-y-2">
            {outgoing.map((r) => (
              <li key={r.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                <UserAvatar url={r.profile?.avatar_url} name={r.profile?.name} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{cleanText(r.profile?.name) || "Unknown"}</div>
                  <div className="text-xs text-muted-foreground truncate">Lv {r.profile?.level ?? 1}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => cancel(r.id)}>Cancel</Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Friend list */}
      <section className="glass p-5">
        <h2 className="font-semibold mb-3 flex items-center gap-2"><Users className="h-4 w-4" /> Your friends ({friends.length})</h2>
        {friends.length === 0 ? (
          <p className="text-sm text-muted-foreground">No friends yet — search above to add some!</p>
        ) : (
          <ul className="space-y-2">
            {friends.map((f) => (
              <li key={f.friendship_id} className="flex flex-wrap items-center gap-3 p-2 rounded-lg bg-white/5">
                <UserAvatar url={f.profile.avatar_url} name={f.profile.name} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{cleanText(f.profile.name) || "Unnamed"}</div>
                  <div className="text-xs text-muted-foreground truncate">Lv {f.profile.level}</div>
                </div>
                {groups.length > 0 && (
                  <select
                    className="text-xs bg-input border border-border rounded-md px-2 py-1"
                    defaultValue=""
                    onChange={(e) => { if (e.target.value) { inviteToGroup(f.profile.user_id, e.target.value); e.target.value = ""; } }}
                  >
                    <option value="">Invite to group...</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{cleanText(g.name)}</option>)}
                  </select>
                )}
                <Button size="sm" variant="outline" onClick={() => messageFriend(f.profile)}>
                  <MessageCircle className="h-3.5 w-3.5 mr-1" /> Message
                </Button>
                <Button size="sm" variant="ghost" onClick={() => removeFriend(f.friendship_id)}>Remove</Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
