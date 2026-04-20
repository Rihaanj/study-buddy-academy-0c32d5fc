import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Send, Image as ImageIcon, Users, UserPlus2, Search, Trash2, MessageCircle, Camera } from "lucide-react";
import { GroupAvatar } from "@/components/GroupAvatar";
import { format } from "date-fns";
import { toast } from "sonner";
import { cleanText } from "@/lib/sanitize";
import { UserAvatar } from "@/components/UserAvatar";
import { useSearchParams } from "react-router-dom";
import { EmojiPickerButton } from "@/components/EmojiPickerButton";
import { StickerPicker } from "@/components/StickerPicker";
import { encodeSticker, isStickerMessage, decodeSticker } from "@/lib/stickers";

export default function Chat() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [groups, setGroups] = useState<any[]>([]);
  const [active, setActive] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { name: string | null; avatar_url: string | null }>>({});
  const [dmPartners, setDmPartners] = useState<Record<string, { name: string | null; avatar_url: string | null }>>({});
  const [text, setText] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [openInvite, setOpenInvite] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [chatTab, setChatTab] = useState<"dm" | "gc">("dm");
  const [search, setSearch] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const groupImgRef = useRef<HTMLInputElement>(null);
  const [uploadingGroupImg, setUploadingGroupImg] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ensureProfiles = async (ids: string[]) => {
    const need = ids.filter((id) => !profiles[id]);
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

  const loadGroups = async () => {
    if (!user) return;
    const { data: memberships } = await supabase.from("group_members").select("group_id").eq("user_id", user.id);
    const ids = (memberships ?? []).map((m: any) => m.group_id);
    if (ids.length === 0) { setGroups([]); return; }
    const { data } = await supabase.from("groups").select("*").in("id", ids).order("created_at", { ascending: false });
    const groupList = data ?? [];
    setGroups(groupList);

    const dmGroupIds = groupList.filter((g: any) => g.subject === "__dm__").map((g: any) => g.id);
    if (dmGroupIds.length) {
      const { data: members } = await supabase
        .from("group_members")
        .select("group_id,user_id")
        .in("group_id", dmGroupIds)
        .neq("user_id", user.id);
      const partnerIds = Array.from(new Set((members ?? []).map((m: any) => m.user_id)));
      if (partnerIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id,name,avatar_url")
          .in("user_id", partnerIds);
        const profMap: Record<string, any> = {};
        (profs ?? []).forEach((p: any) => { profMap[p.user_id] = p; });
        const next: Record<string, { name: string | null; avatar_url: string | null }> = {};
        (members ?? []).forEach((m: any) => {
          const p = profMap[m.user_id];
          if (p) next[m.group_id] = { name: p.name, avatar_url: p.avatar_url };
        });
        setDmPartners(next);
      }
    }

    const wanted = searchParams.get("group");
    if (wanted) {
      const found = groupList.find((g: any) => g.id === wanted);
      if (found) {
        setActive(found);
        setChatTab(found.subject === "__dm__" ? "dm" : "gc");
        return;
      }
    }
    if (!active && groupList.length) setActive(groupList[0]);
  };

  useEffect(() => { loadGroups(); }, [user, searchParams]);

  const groupDisplayName = (g: any) =>
    g?.subject === "__dm__" ? (cleanText(dmPartners[g.id]?.name) || cleanText(g.name) || "Direct message") : cleanText(g?.name);
  const groupDisplaySubject = (g: any) => (g?.subject === "__dm__" ? "Direct message" : g?.subject ? cleanText(g.subject) : "");

  useEffect(() => {
    if (!active) return;
    (async () => {
      const { data } = await supabase.from("messages").select("*").eq("group_id", active.id).order("created_at");
      setMessages(data ?? []);
      ensureProfiles(Array.from(new Set((data ?? []).map((m: any) => m.user_id))));
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
    })();
    const channel = supabase
      .channel(`msgs-${active.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `group_id=eq.${active.id}` },
        (payload) => {
          setMessages((m) => [...m, payload.new]);
          ensureProfiles([(payload.new as any).user_id]);
          setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
        })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages", filter: `group_id=eq.${active.id}` },
        (payload) => {
          setMessages((m) => m.filter((x) => x.id !== (payload.old as any).id));
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [active?.id]);

  const loadFriendsForInvite = async () => {
    if (!user) return;
    const { data: fs } = await supabase.from("friendships").select("*").or(`user_a.eq.${user.id},user_b.eq.${user.id}`);
    const ids = (fs ?? []).map((f: any) => (f.user_a === user.id ? f.user_b : f.user_a));
    if (ids.length === 0) { setFriends([]); return; }
    const { data: members } = await supabase.from("group_members").select("user_id").eq("group_id", active.id);
    const memberIds = new Set((members ?? []).map((m: any) => m.user_id));
    const { data: profs } = await supabase.from("profiles").select("user_id,name,avatar_url,email").in("user_id", ids);
    setFriends((profs ?? []).filter((p: any) => !memberIds.has(p.user_id)));
  };

  const send = async () => {
    if (!user || !active || !text.trim()) return;
    const t = cleanText(text.trim()); setText("");
    const { error } = await supabase.from("messages").insert({ group_id: active.id, user_id: user.id, text: t });
    if (error) toast.error(error.message);
    notifyDmRecipient(t);
  };

  const sendSticker = async (emoji: string) => {
    if (!user || !active) return;
    const payload = encodeSticker(emoji);
    const { error } = await supabase.from("messages").insert({ group_id: active.id, user_id: user.id, text: payload });
    if (error) toast.error(error.message);
    notifyDmRecipient(`Sent a sticker ${emoji}`);
  };

  const insertEmoji = (emoji: string) => {
    setText((t) => t + emoji);
  };

  // Fire-and-forget DM email notification (only for DMs, not group chats)
  const notifyDmRecipient = async (preview: string) => {
    if (!user || !active || active.subject !== "__dm__") return;
    const partner = dmPartners[active.id];
    if (!partner) return;
    try {
      // Look up partner user_id from group_members
      const { data: members } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", active.id)
        .neq("user_id", user.id);
      const recipientId = members?.[0]?.user_id;
      if (!recipientId) return;
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "new-dm-message",
          recipientUserId: recipientId,
          notificationType: "dm_message",
          idempotencyKey: `dm-${active.id}-${Date.now()}`,
          templateData: {
            senderName: cleanText((profiles[user.id]?.name) || "A friend"),
            messagePreview: preview.slice(0, 140),
          },
        },
      });
    } catch { /* silently ignore — email is optional */ }
  };

  const upload = async (file: File) => {
    if (!user || !active) return;
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("chat-images").upload(path, file);
    if (error) { toast.error(error.message); return; }
    const { data: pub } = supabase.storage.from("chat-images").getPublicUrl(path);
    await supabase.from("messages").insert({ group_id: active.id, user_id: user.id, image_url: pub.publicUrl });
  };

  const deleteMessage = async (id: string) => {
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setMessages((m) => m.filter((x) => x.id !== id));
  };

  const uploadGroupImage = async (file: File) => {
    if (!user || !active) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setUploadingGroupImg(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/group-${active.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("chat-images").upload(path, file, { upsert: true, cacheControl: "3600" });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("chat-images").getPublicUrl(path);
      const { error: dbErr } = await supabase.from("groups").update({ image_url: pub.publicUrl }).eq("id", active.id);
      if (dbErr) throw dbErr;
      setActive((a: any) => ({ ...a, image_url: pub.publicUrl }));
      setGroups((gs) => gs.map((g) => g.id === active.id ? { ...g, image_url: pub.publicUrl } : g));
      toast.success("Group picture updated");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploadingGroupImg(false);
    }
  };

  const createGroup = async () => {
    if (!user || !name.trim()) return;
    const { data: g, error } = await supabase.from("groups").insert({ name: name.trim(), subject: subject.trim() || null, created_by: user.id }).select().single();
    if (error) { toast.error(error.message); return; }
    await supabase.from("group_members").insert({ group_id: g.id, user_id: user.id });
    setOpenNew(false); setName(""); setSubject("");
    setActive(g);
    setChatTab("gc");
    loadGroups();
  };

  // Filter groups by tab + search
  const dms = groups.filter((g) => g.subject === "__dm__");
  const gcs = groups.filter((g) => g.subject !== "__dm__");
  const visible = (chatTab === "dm" ? dms : gcs).filter((g) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (groupDisplayName(g) ?? "").toLowerCase().includes(q) || (g.subject ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="grid md:grid-cols-[280px_1fr] gap-4 h-[calc(100vh-180px)]">
      <aside className="glass p-3 flex flex-col gap-2 overflow-hidden">
        <Tabs value={chatTab} onValueChange={(v) => setChatTab(v as "dm" | "gc")} className="w-full">
          <TabsList className="grid grid-cols-2 w-full mb-2">
            <TabsTrigger value="dm"><MessageCircle className="h-3.5 w-3.5 mr-1" />DMs ({dms.length})</TabsTrigger>
            <TabsTrigger value="gc"><Users className="h-3.5 w-3.5 mr-1" />Groups ({gcs.length})</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={chatTab === "dm" ? "Search DMs..." : "Search groups..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 h-8 text-xs"
            />
          </div>
          {chatTab === "gc" && (
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <DialogTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8 shrink-0"><Plus className="h-4 w-4"/></Button></DialogTrigger>
              <DialogContent className="glass-strong">
                <DialogHeader><DialogTitle>New study group</DialogTitle></DialogHeader>
                <Input placeholder="Group name" value={name} onChange={(e)=>setName(e.target.value)}/>
                <Input placeholder="Subject (optional)" value={subject} onChange={(e)=>setSubject(e.target.value)}/>
                <Button onClick={createGroup} className="bg-gradient-primary text-primary-foreground">Create</Button>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 mt-1">
          {visible.length === 0 && (
            <p className="text-xs text-muted-foreground p-2">
              {chatTab === "dm"
                ? "No DMs yet. Start one from the Friends tab."
                : "No groups yet. Create one with the + button."}
            </p>
          )}
          {visible.map((g) => {
            const isDM = g.subject === "__dm__";
            const partner = dmPartners[g.id];
            return (
              <button key={g.id} onClick={()=>{ setActive(g); setSearchParams({ group: g.id }); }}
                className={`w-full text-left p-2.5 rounded-lg transition flex items-center gap-2 ${active?.id===g.id ? "bg-gradient-primary text-primary-foreground" : "hover:bg-white/5"}`}>
                {isDM ? <UserAvatar url={partner?.avatar_url} name={partner?.name} className="h-7 w-7" /> : <GroupAvatar url={g.image_url} name={g.name} className="h-7 w-7" />}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{groupDisplayName(g)}</div>
                  {groupDisplaySubject(g) && <div className="text-[11px] opacity-70 truncate">{groupDisplaySubject(g)}</div>}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="glass flex flex-col overflow-hidden">
        {!active ? (
          <div className="flex-1 grid place-items-center text-muted-foreground text-sm p-4 text-center">
            Pick a {chatTab === "dm" ? "DM" : "group"} or create one to start chatting.
          </div>
        ) : (
          <>
            <div className="px-3 sm:px-4 py-3 border-b border-white/10 flex items-center justify-between gap-2">
              <div className="min-w-0 flex items-center gap-2">
                {active.subject === "__dm__"
                  ? <UserAvatar url={dmPartners[active.id]?.avatar_url} name={dmPartners[active.id]?.name} className="h-8 w-8" />
                  : (
                    <div className="relative group/gpfp">
                      <GroupAvatar url={active.image_url} name={active.name} className="h-8 w-8" />
                      {active.created_by === user?.id && (
                        <>
                          <input ref={groupImgRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadGroupImage(e.target.files[0])} />
                          <button
                            type="button"
                            onClick={() => groupImgRef.current?.click()}
                            disabled={uploadingGroupImg}
                            className="absolute inset-0 grid place-items-center rounded-full bg-black/50 opacity-0 group-hover/gpfp:opacity-100 transition disabled:opacity-100"
                            aria-label="Change group picture"
                          >
                            <Camera className="h-3.5 w-3.5 text-white" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                <div className="min-w-0">
                  <div className="font-semibold truncate text-sm sm:text-base">{groupDisplayName(active)}</div>
                  {groupDisplaySubject(active) && <div className="text-xs text-muted-foreground truncate">{groupDisplaySubject(active)}</div>}
                </div>
              </div>
              {active.subject !== "__dm__" && <Dialog open={openInvite} onOpenChange={(o) => { setOpenInvite(o); if (o) loadFriendsForInvite(); }}>
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
                            const { error } = await supabase.from("group_members").insert({ group_id: active.id, user_id: f.user_id });
                            if (error) { toast.error(error.message); return; }
                            toast.success(`${f.name ?? "Friend"} added to group`);
                            setFriends((arr) => arr.filter((x) => x.user_id !== f.user_id));
                          }}>Add</Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </DialogContent>
              </Dialog>}
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
              {messages.map((m) => {
                const mine = m.user_id === user?.id;
                const sender = profiles[m.user_id];
                return (
                  <div key={m.id} className={`flex gap-2 group ${mine ? "flex-row-reverse" : ""}`}>
                    <UserAvatar url={sender?.avatar_url} name={sender?.name} className="h-7 w-7 mt-1" />
                    <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                      {!mine && <div className="text-[10px] text-muted-foreground px-2 mb-0.5">{cleanText(sender?.name) || "..."}</div>}
                      <div className="flex items-center gap-1">
                        {mine && (
                          <button
                            onClick={() => deleteMessage(m.id)}
                            className="opacity-0 group-hover:opacity-100 transition p-1 rounded-md hover:bg-destructive/20 text-destructive"
                            aria-label="Delete message"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                        {m.text && isStickerMessage(m.text) ? (
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
            <div className="border-t border-white/10 p-2 sm:p-3 flex gap-1 sm:gap-2 items-center">
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e)=>e.target.files?.[0] && upload(e.target.files[0])}/>
              <Button variant="ghost" size="icon" onClick={()=>fileRef.current?.click()} aria-label="Send image"><ImageIcon className="h-4 w-4"/></Button>
              <EmojiPickerButton onPick={insertEmoji} />
              <StickerPicker onPick={sendSticker} />
              <Input value={text} onChange={(e)=>setText(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&send()} placeholder="Message..." className="flex-1"/>
              <Button onClick={send} className="bg-gradient-primary text-primary-foreground" aria-label="Send"><Send className="h-4 w-4"/></Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
