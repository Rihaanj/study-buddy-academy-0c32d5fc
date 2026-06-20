import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Send, Image as ImageIcon, Users, UserPlus2, Search, Trash2, MessageCircle, Camera, Phone, Video, Info, Bot, Loader2 } from "lucide-react";
import { GroupAvatar } from "@/components/GroupAvatar";
import { format } from "date-fns";
import { toast } from "sonner";
import { cleanText } from "@/lib/sanitize";
import { UserAvatar } from "@/components/UserAvatar";
import { useSearchParams } from "react-router-dom";
import { EmojiPickerButton } from "@/components/EmojiPickerButton";
import { StickerPicker } from "@/components/StickerPicker";
import { encodeSticker, isStickerMessage, decodeSticker } from "@/lib/stickers";
import { awardBadge } from "@/lib/badges";
import { isMeetMessage, decodeMeetUrl, makeMeetMessage } from "@/lib/meet";
import { GroupMembersDialog } from "@/components/GroupMembersDialog";
import { AIResponse } from "@/components/AIResponse";
import { getChatSidebarData, markChatRead, type DmThread, type GroupThread } from "@/lib/chatMeta";
import { Badge } from "@/components/ui/badge";

type AnyMsg = {
  id: string; user_id: string; text: string | null; image_url: string | null;
  created_at: string; deleted?: boolean;
};

const GROUP_AI_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/group-ai`;

async function checkCollaboratorBadge(userId: string) {
  const { count } = await supabase.from("messages").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if ((count ?? 0) >= 10) await awardBadge(userId, "collaborator");
}

export default function Chat() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [groups, setGroups] = useState<GroupThread[]>([]);
  const [dmChats, setDmChats] = useState<DmThread[]>([]);
  const [active, setActive] = useState<any>(null); // { kind: "group"|"dm", ...group or dmChat }
  const [messages, setMessages] = useState<AnyMsg[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { name: string | null; avatar_url: string | null }>>({});
  const [text, setText] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [openInvite, setOpenInvite] = useState(false);
  const [openMembers, setOpenMembers] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [chatTab, setChatTab] = useState<"dm" | "gc">("dm");
  const [search, setSearch] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const groupImgRef = useRef<HTMLInputElement>(null);
  const [uploadingGroupImg, setUploadingGroupImg] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());


  const ensureProfiles = async (ids: string[]) => {
    const need = ids.filter((id) => !profiles[id] && id);
    if (need.length === 0) return;
    const { data } = await supabase.from("profiles").select("user_id,name,avatar_url").in("user_id", need);
    if (data) {
      setProfiles((p) => {
        const next = { ...p };
        data.forEach((r: any) => { next[r.user_id] = { name: r.name, avatar_url: r.avatar_url }; });
        return next;
      });
    }
  };

  const loadLists = async () => {
    if (!user) return;
    const { dmChats: nextDms, groups: nextGroups } = await getChatSidebarData(user.id);
    const visibleGroups = nextGroups.filter((g) => g.subject !== "__dm__");
    setGroups(visibleGroups);
    setDmChats(nextDms);

    // Auto-activate requested chat from URL
    const wantedGroup = searchParams.get("group");
    const wantedDm = searchParams.get("dm");
    if (wantedGroup) {
      const f = visibleGroups.find((g) => g.id === wantedGroup);
      if (f) { setActive({ kind: "group", ...f }); setChatTab("gc"); return; }
    }
    if (wantedDm) {
      const f = nextDms.find((d) => d.id === wantedDm);
      if (f) { setActive({ kind: "dm", ...f }); setChatTab("dm"); return; }
    }
    if (!active) {
      if (nextDms.length) { setActive({ kind: "dm", ...nextDms[0] }); setChatTab("dm"); }
      else if (visibleGroups.length) { setActive({ kind: "group", ...visibleGroups[0] }); setChatTab("gc"); }
    }
  };

  useEffect(() => { loadLists(); /* eslint-disable-next-line */ }, [user?.id, searchParams]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`chat-lists-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "dm_chats" }, () => loadLists())
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => loadLists())
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members", filter: `user_id=eq.${user.id}` }, () => loadLists())
      .on("postgres_changes", { event: "*", schema: "public", table: "groups" }, () => loadLists())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dm_messages" }, () => loadLists())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => loadLists())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!active) { setMessages([]); return; }
    let cancelled = false;
    const activeId = active.id;
    const activeKind = active.kind;
    setMessages([]); // clear stale messages immediately to avoid flash of previous chat
    (async () => {
      if (activeKind === "dm") {
        const { data } = await supabase.from("dm_messages").select("*").eq("chat_id", activeId).order("created_at");
        if (cancelled) return;
        setMessages((data ?? []) as any);
        ensureProfiles(Array.from(new Set((data ?? []).map((m: any) => m.user_id))));
      } else {
        const { data } = await supabase.from("messages").select("*").eq("group_id", activeId).order("created_at");
        if (cancelled) return;
        setMessages((data ?? []) as any);
        ensureProfiles(Array.from(new Set((data ?? []).map((m: any) => m.user_id))));
      }
      setTimeout(() => { if (!cancelled) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, 50);
      if (user && !cancelled) await markChatRead(user.id, activeKind, activeId);
      if (!cancelled) loadLists();
    })();

    const ch = supabase
      .channel(`msgs-${activeKind}-${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: activeKind === "dm" ? "dm_messages" : "messages",
          filter: activeKind === "dm" ? `chat_id=eq.${activeId}` : `group_id=eq.${activeId}` },
        async (payload) => {
          if (cancelled) return;
          setMessages((m) => m.some((x) => x.id === (payload.new as any).id) ? m : [...m, payload.new as any]);
          ensureProfiles([(payload.new as any).user_id]);
          setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
          if (user) await markChatRead(user.id, activeKind, activeId);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: activeKind === "dm" ? "dm_messages" : "messages",
          filter: activeKind === "dm" ? `chat_id=eq.${activeId}` : `group_id=eq.${activeId}` },
        (payload) => {
          if (cancelled) return;
          setMessages((m) => m.map((x) => x.id === (payload.new as any).id ? (payload.new as any) : x));
        }
      )
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, active?.kind]);

  const activeLabel = () => {
    if (!active) return "";
    if (active.kind === "dm") return cleanText(active.partner?.name) || "Direct message";
    return cleanText(active.name) || "Group";
  };

  const loadFriendsForInvite = async () => {
    if (!user || active?.kind !== "group") return;
    const { data: fs } = await supabase.from("friendships").select("*").or(`user_a.eq.${user.id},user_b.eq.${user.id}`);
    const ids = (fs ?? []).map((f: any) => (f.user_a === user.id ? f.user_b : f.user_a));
    if (ids.length === 0) { setFriends([]); return; }
    const { data: members } = await supabase.from("group_members").select("user_id").eq("group_id", active.id);
    const memberIds = new Set((members ?? []).map((m: any) => m.user_id));
    const { data: profs } = await supabase.from("profiles").select("user_id,name,avatar_url,email").in("user_id", ids);
    setFriends((profs ?? []).filter((p: any) => !memberIds.has(p.user_id)));
  };

  const insertMessage = async (payload: Partial<AnyMsg>) => {
    if (!active || !user) return null;
    if (active.kind === "dm") {
      const { data, error } = await supabase.from("dm_messages").insert({
        chat_id: active.id, user_id: user.id, text: payload.text ?? null, image_url: payload.image_url ?? null,
      }).select().single();
      if (error) { toast.error(error.message); return null; }
      // Optimistic: realtime will also fire, but guard in subscription dedupes
      setMessages((m) => m.some((x) => x.id === data.id) ? m : [...m, data as any]);
      return data;
    } else {
      const { data, error } = await supabase.from("messages").insert({
        group_id: active.id, user_id: user.id, text: payload.text ?? null, image_url: payload.image_url ?? null,
      }).select().single();
      if (error) { toast.error(error.message); return null; }
      setMessages((m) => m.some((x) => x.id === data.id) ? m : [...m, data as any]);
      checkCollaboratorBadge(user.id);
      return data;
    }
  };

  const send = async () => {
    if (!text.trim()) return;
    const t = cleanText(text.trim());
    setText("");
    await insertMessage({ text: t });
  };

  const sendSticker = async (emoji: string) => {
    await insertMessage({ text: encodeSticker(emoji) });
  };

  const sendMeet = async () => {
    const ok = confirm("Send a Google Meet link to everyone in this chat?");
    if (!ok) return;
    await insertMessage({ text: makeMeetMessage() });
    toast.success("Meet link sent");
  };

  const insertEmoji = (emoji: string) => setText((t) => t + emoji);

  const upload = async (file: File) => {
    if (!user || !active) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files can be uploaded here.");
      return;
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${user.id}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from("chat-images").upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });
    if (error) { toast.error(`Upload failed: ${error.message}`); return; }
    const { data: signed } = await supabase.storage.from("chat-images").createSignedUrl(path, 60 * 60 * 24 * 365);
    await insertMessage({ image_url: signed?.signedUrl ?? path });
    toast.success("Photo sent");
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const it of Array.from(items)) {
      if (it.type.startsWith("image/")) {
        const file = it.getAsFile();
        if (file) { e.preventDefault(); await upload(file); return; }
      }
    }
  };

  /** Soft-delete: sets deleted=true so peers see "this message was deleted". */
  const deleteMessage = async (id: string) => {
    const table = active.kind === "dm" ? "dm_messages" : "messages";
    const { error } = await supabase.from(table).update({ deleted: true, text: null, image_url: null }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setMessages((m) => m.map((x) => x.id === id ? { ...x, deleted: true, text: null, image_url: null } : x));
  };

  const uploadGroupImage = async (file: File) => {
    if (!user || !active || active.kind !== "group") return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setUploadingGroupImg(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/group-${active.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("chat-images").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from("chat-images").createSignedUrl(path, 60 * 60 * 24 * 365);
      const url = signed?.signedUrl ?? path;
      const { error: dbErr } = await supabase.from("groups").update({ image_url: url }).eq("id", active.id);
      if (dbErr) throw dbErr;
      setActive((a: any) => ({ ...a, image_url: url }));
      setGroups((gs) => gs.map((g) => g.id === active.id ? { ...g, image_url: url } : g));
      toast.success("Group picture updated");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally { setUploadingGroupImg(false); }
  };

  const createGroup = async () => {
    if (!user || !name.trim()) return;
    const { data: g, error } = await supabase.from("groups").insert({
      name: name.trim(), subject: subject.trim() || null, created_by: user.id,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    // trigger in DB auto-adds creator as host — but upsert just in case
    await supabase.from("group_members").upsert({ group_id: g.id, user_id: user.id, role: "host" }, { onConflict: "group_id,user_id" as any });
    await awardBadge(user.id, "squad_member");
    setOpenNew(false); setName(""); setSubject("");
    setActive({ kind: "group", ...g });
    setChatTab("gc");
    loadLists();
  };

  // Group AI streaming
  const askGroupAi = async () => {
    if (!aiInput.trim()) return;
    const newMsgs = [...aiMessages, { role: "user" as const, content: aiInput.trim() }];
    setAiMessages(newMsgs);
    setAiInput("");
    setAiBusy(true);
    // Add placeholder assistant msg
    setAiMessages((m) => [...m, { role: "assistant", content: "" }]);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const r = await fetch(GROUP_AI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ messages: newMsgs }),
      });
      if (r.status === 429) { toast.error("Rate limited — try again shortly."); setAiBusy(false); return; }
      if (r.status === 402 || r.status === 503) { toast.error("The AI is taking a quick break — try again in a moment."); setAiBusy(false); return; }
      if (!r.ok || !r.body) { toast.error("AI error"); setAiBusy(false); return; }
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = "", done = false, acc = "";
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl); buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const p = JSON.parse(json);
            const c = p.choices?.[0]?.delta?.content;
            if (c) {
              acc += c;
              setAiMessages((mm) => {
                const copy = [...mm];
                const last = copy[copy.length - 1];
                if (last?.role === "assistant") copy[copy.length - 1] = { ...last, content: acc };
                return copy;
              });
            }
          } catch { buf = line + "\n" + buf; break; }
        }
      }
    } catch (e: any) {
      toast.error(e.message ?? "AI error");
    } finally { setAiBusy(false); }
  };

  // Search filtering for sidebar
  const visibleDms = dmChats.filter((d) => !search.trim() || (d.partner?.name ?? "").toLowerCase().includes(search.toLowerCase()));
  const visibleGroups = groups.filter((g) => !search.trim() || (g.name ?? "").toLowerCase().includes(search.toLowerCase()) || (g.subject ?? "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="grid md:grid-cols-[280px_1fr] gap-4 h-[calc(100vh-180px)]">
      <aside className="glass p-3 flex flex-col gap-2 overflow-hidden">
        <Tabs value={chatTab} onValueChange={(v) => setChatTab(v as "dm" | "gc")} className="w-full">
          <TabsList className="grid grid-cols-2 w-full mb-2">
            <TabsTrigger value="dm"><MessageCircle className="h-3.5 w-3.5 mr-1" />DMs ({dmChats.length})</TabsTrigger>
            <TabsTrigger value="gc"><Users className="h-3.5 w-3.5 mr-1" />Groups ({groups.length})</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={chatTab === "dm" ? "Search DMs..." : "Search groups..."} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-7 h-8 text-xs" />
          </div>
          {chatTab === "gc" && (
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <DialogTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8 shrink-0"><Plus className="h-4 w-4" /></Button></DialogTrigger>
              <DialogContent className="glass-strong">
                <DialogHeader><DialogTitle>New study group</DialogTitle></DialogHeader>
                <Input placeholder="Group name" value={name} onChange={(e) => setName(e.target.value)} />
                <Input placeholder="Subject (optional)" value={subject} onChange={(e) => setSubject(e.target.value)} />
                <Button onClick={createGroup} className="bg-gradient-primary text-primary-foreground">Create</Button>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 mt-1">
          {chatTab === "dm" && visibleDms.length === 0 && (
            <p className="text-xs text-muted-foreground p-2">No DMs yet. Start one from the Friends tab.</p>
          )}
          {chatTab === "gc" && visibleGroups.length === 0 && (
            <p className="text-xs text-muted-foreground p-2">No groups yet. Create one with the + button.</p>
          )}
          {chatTab === "dm" && visibleDms.map((d) => {
            const isActive = active?.kind === "dm" && active.id === d.id;
            const unread = !isActive && d.unread_count > 0;
            return (
              <button key={d.id}
                onClick={() => { setActive({ kind: "dm", ...d }); setSearchParams({ dm: d.id }); }}
                className={`w-full text-left p-2.5 rounded-lg transition flex items-center gap-2 ${isActive ? "bg-gradient-primary text-primary-foreground" : "hover:bg-white/5"}`}>
                <div className="relative shrink-0">
                  <UserAvatar url={d.partner?.avatar_url} name={d.partner?.name} className="h-9 w-9" />
                  {unread && <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <div className={`text-sm truncate ${unread ? "font-bold" : "font-medium"}`}>{cleanText(d.partner?.name) || "Friend"}</div>
                    {unread && <Badge variant="secondary" className="h-4 px-1.5 text-[10px] bg-primary text-primary-foreground ml-auto shrink-0">{d.unread_count}</Badge>}
                  </div>
                  <div className={`text-[11px] truncate ${unread ? "opacity-90" : "opacity-60"}`}>{d.last_message}</div>
                </div>
              </button>
            );
          })}
          {chatTab === "gc" && visibleGroups.map((g) => {
            const isActive = active?.kind === "group" && active.id === g.id;
            const unread = !isActive && g.unread_count > 0;
            return (
              <button key={g.id}
                onClick={() => { setActive({ kind: "group", ...g }); setSearchParams({ group: g.id }); }}
                className={`w-full text-left p-2.5 rounded-lg transition flex items-center gap-2 ${isActive ? "bg-gradient-primary text-primary-foreground" : "hover:bg-white/5"}`}>
                <div className="relative shrink-0">
                  <GroupAvatar url={g.image_url} name={g.name} className="h-9 w-9" />
                  {unread && <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <div className={`text-sm truncate ${unread ? "font-bold" : "font-medium"}`}>{cleanText(g.name)}</div>
                    {unread && <Badge variant="secondary" className="h-4 px-1.5 text-[10px] bg-primary text-primary-foreground ml-auto shrink-0">{g.unread_count}</Badge>}
                  </div>
                  <div className={`text-[11px] truncate ${unread ? "opacity-90" : "opacity-60"}`}>{g.last_message}</div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="glass flex flex-col overflow-hidden">
        {!active ? (
          <div className="flex-1 grid place-items-center text-muted-foreground text-sm p-4 text-center">
            Pick a chat or create one to start.
          </div>
        ) : (
          <>
            {/* HEADER */}
            <div className="px-3 sm:px-4 py-3 border-b border-white/10 flex items-center justify-between gap-2">
              <div className="min-w-0 flex items-center gap-2">
                {active.kind === "dm" ? (
                  <UserAvatar url={active.partner?.avatar_url} name={active.partner?.name} className="h-8 w-8" />
                ) : (
                  <div className="relative group/gpfp">
                    <GroupAvatar url={active.image_url} name={active.name} className="h-8 w-8" />
                    <input ref={groupImgRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadGroupImage(e.target.files[0])} />
                    <button type="button" onClick={() => groupImgRef.current?.click()} disabled={uploadingGroupImg}
                      className="absolute inset-0 grid place-items-center rounded-full bg-black/50 opacity-0 group-hover/gpfp:opacity-100 transition"
                      aria-label="Change group picture">
                      <Camera className="h-3.5 w-3.5 text-white" />
                    </button>
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-semibold truncate text-sm sm:text-base">{activeLabel()}</div>
                  {active.kind === "group" && active.subject && <div className="text-xs text-muted-foreground truncate">{cleanText(active.subject)}</div>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={sendMeet} aria-label="Start Google Meet" title="Start Google Meet">
                  <Video className="h-4 w-4" />
                </Button>
                {active.kind === "group" && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setAiOpen(true)} aria-label="Group AI" title="Group AI">
                      <Bot className="h-4 w-4" />
                    </Button>
                    <Dialog open={openInvite} onOpenChange={(o) => { setOpenInvite(o); if (o) loadFriendsForInvite(); }}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline"><UserPlus2 className="h-3.5 w-3.5 mr-1" />Invite</Button>
                      </DialogTrigger>
                      <DialogContent className="glass-strong">
                        <DialogHeader><DialogTitle>Invite a friend</DialogTitle></DialogHeader>
                        {friends.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No friends to invite. Add some on the Friends tab first.</p>
                        ) : (
                          <ul className="space-y-2 max-h-80 overflow-y-auto">
                            {friends.map((f) => (
                              <li key={f.user_id} className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                                <UserAvatar url={f.avatar_url} name={f.name} />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm truncate">{cleanText(f.name) || "Unnamed"}</div>
                                  <div className="text-xs text-muted-foreground truncate">{f.email}</div>
                                </div>
                                <Button size="sm" onClick={async () => {
                                  const { error } = await supabase.from("group_members").insert({ group_id: active.id, user_id: f.user_id, role: "member" });
                                  if (error) { toast.error(error.message); return; }
                                  toast.success(`${f.name ?? "Friend"} added`);
                                  setFriends((arr) => arr.filter((x) => x.user_id !== f.user_id));
                                }}>Add</Button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </DialogContent>
                    </Dialog>
                    <Button size="sm" variant="ghost" onClick={() => setOpenMembers(true)} title="Members">
                      <Info className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* MESSAGES */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
              {messages.map((m) => {
                const mine = m.user_id === user?.id;
                const sender = profiles[m.user_id];
                const deleted = !!m.deleted;
                const meetUrl = m.text && isMeetMessage(m.text) ? decodeMeetUrl(m.text) : null;
                return (
                  <div key={m.id} className={`flex gap-2 group ${mine ? "flex-row-reverse" : ""}`}>
                    <UserAvatar url={sender?.avatar_url} name={sender?.name} className="h-7 w-7 mt-1" />
                    <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                      {!mine && <div className="text-[10px] text-muted-foreground px-2 mb-0.5">{cleanText(sender?.name) || "..."}</div>}
                      <div className="flex items-center gap-1">
                        {mine && !deleted && (
                          <button onClick={() => deleteMessage(m.id)}
                            className="opacity-0 group-hover:opacity-100 transition p-1 rounded-md hover:bg-destructive/20 text-destructive"
                            aria-label="Delete message">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                        {deleted ? (
                          <div className="p-3 rounded-2xl bg-muted/30 italic text-xs text-muted-foreground">This message was deleted</div>
                        ) : meetUrl ? (
                          <a href={meetUrl} target="_blank" rel="noopener noreferrer"
                            className={`p-3 rounded-2xl flex items-center gap-2 ${mine ? "bg-gradient-primary text-primary-foreground" : "bg-white/5"} hover:brightness-110 transition`}>
                            <Video className="h-4 w-4" />
                            <div>
                              <div className="text-sm font-semibold">Join Google Meet</div>
                              <div className="text-[10px] opacity-80">Tap to open</div>
                            </div>
                          </a>
                        ) : m.text && isStickerMessage(m.text) ? (
                          <div className="text-6xl px-2 py-1 select-none" aria-label="sticker">{decodeSticker(m.text)}</div>
                        ) : (
                          <div className={`p-3 rounded-2xl ${mine ? "bg-gradient-primary text-primary-foreground" : "bg-white/5"}`}>
                            {m.text && <div className="text-sm whitespace-pre-wrap break-words">{cleanText(m.text)}</div>}
                            {m.image_url && <img src={m.image_url} alt="shared" className="rounded-lg mt-2 max-h-64" />}
                          </div>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1 px-2">{format(new Date(m.created_at), "p")}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* COMPOSER */}
            <div className="border-t border-white/10 p-2 sm:p-3 flex gap-1 sm:gap-2 items-center">
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              <Button variant="ghost" size="icon" onClick={() => fileRef.current?.click()} aria-label="Send image"><ImageIcon className="h-4 w-4" /></Button>
              <EmojiPickerButton onPick={insertEmoji} />
              <StickerPicker onPick={sendSticker} />
              <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Message..." className="flex-1" />
              <Button onClick={send} className="bg-gradient-primary text-primary-foreground" aria-label="Send"><Send className="h-4 w-4" /></Button>
            </div>
          </>
        )}
      </div>

      {/* Group members dialog */}
      <GroupMembersDialog
        open={openMembers}
        onOpenChange={setOpenMembers}
        group={active?.kind === "group" ? active : null}
        onGroupDeleted={() => { setActive(null); loadLists(); }}
      />

      {/* Group AI panel */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="glass-strong max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Bot className="h-4 w-4" /> Group AI</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {aiMessages.length === 0 && (
              <p className="text-xs text-muted-foreground">Ask the group's AI anything academic — it won't write homework for you.</p>
            )}
            {aiMessages.map((m, i) => (
              <div key={i} className={`p-3 rounded-lg text-sm ${m.role === "user" ? "bg-primary/20" : "bg-white/5"}`}>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{m.role}</div>
                {m.role === "assistant" ? <AIResponse title="" content={m.content} streaming={aiBusy && i === aiMessages.length - 1} /> : <div className="whitespace-pre-wrap">{m.content}</div>}
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-2 border-t border-white/10">
            <Input value={aiInput} onChange={(e) => setAiInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && askGroupAi()} placeholder="Ask the group AI..." disabled={aiBusy} />
            <Button onClick={askGroupAi} disabled={aiBusy || !aiInput.trim()} className="bg-gradient-primary text-primary-foreground">
              {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ask"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
