import { supabase } from "@/integrations/supabase/client";

type ChatKind = "dm" | "group";

type BaseThread = {
  id: string;
  updated_at: string;
  last_message: string;
  unread_count: number;
};

export type DmThread = BaseThread & {
  user_a: string;
  user_b: string;
  created_at: string;
  partnerId: string;
  partner?: {
    user_id: string;
    name: string | null;
    avatar_url: string | null;
    email?: string | null;
  };
};

export type GroupThread = BaseThread & {
  id: string;
  name: string;
  subject: string | null;
  image_url: string | null;
  created_at: string;
};

const db = supabase as any;

function previewText(message: any) {
  if (!message) return "No messages yet";
  if (message.deleted) return "Message deleted";
  if (message.image_url) return "Photo";
  if (!message.text) return "New message";
  if (String(message.text).startsWith("::sticker::")) return "Sticker";
  if (String(message.text).includes("meet.new") || String(message.text).includes("https://meet.google.com")) return "Meet link";
  return String(message.text);
}

export async function markChatRead(userId: string, chatKind: ChatKind, chatId: string) {
  if (!userId || !chatId) return;
  await db.from("chat_reads").upsert(
    { user_id: userId, chat_kind: chatKind, chat_id: chatId, last_read_at: new Date().toISOString() },
    { onConflict: "user_id,chat_kind,chat_id" }
  );
}

/** Mark every chat thread (DMs + groups) as read for this user — used when opening the Chat tab. */
export async function markAllChatsRead(userId: string) {
  if (!userId) return;
  const { dmChats, groups } = await getChatSidebarData(userId);
  const now = new Date().toISOString();
  const rows = [
    ...dmChats.map((d) => ({ user_id: userId, chat_kind: "dm" as const, chat_id: d.id, last_read_at: now })),
    ...groups.map((g) => ({ user_id: userId, chat_kind: "group" as const, chat_id: g.id, last_read_at: now })),
  ];
  if (!rows.length) return;
  await db.from("chat_reads").upsert(rows, { onConflict: "user_id,chat_kind,chat_id" });
}

export async function getChatSidebarData(userId: string): Promise<{ dmChats: DmThread[]; groups: GroupThread[] }> {
  const [{ data: dms }, { data: memberships }, { data: reads }] = await Promise.all([
    supabase.from("dm_chats").select("id,user_a,user_b,created_at").or(`user_a.eq.${userId},user_b.eq.${userId}`),
    supabase.from("group_members").select("group_id").eq("user_id", userId),
    db.from("chat_reads").select("chat_kind,chat_id,last_read_at").eq("user_id", userId),
  ]);

  const dmRows = (dms ?? []) as any[];
  const groupIds = ((memberships ?? []) as any[]).map((m) => m.group_id);
  const readMap = new Map<string, string>((reads ?? []).map((r: any) => [`${r.chat_kind}:${r.chat_id}`, r.last_read_at]));

  const partnerIds = dmRows.map((d) => (d.user_a === userId ? d.user_b : d.user_a));
  const [{ data: partnerProfiles }, { data: groups }, { data: dmMessages }, { data: groupMessages }] = await Promise.all([
    partnerIds.length ? supabase.from("profiles").select("user_id,name,avatar_url,email").in("user_id", partnerIds) : Promise.resolve({ data: [] }),
    groupIds.length ? supabase.from("groups").select("id,name,subject,image_url,created_at").in("id", groupIds) : Promise.resolve({ data: [] }),
    dmRows.length ? supabase.from("dm_messages").select("id,chat_id,user_id,text,image_url,created_at,deleted").in("chat_id", dmRows.map((d) => d.id)).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    groupIds.length ? supabase.from("messages").select("id,group_id,user_id,text,image_url,created_at,deleted").in("group_id", groupIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
  ]);

  const profileMap = new Map<string, any>((partnerProfiles ?? []).map((p: any) => [p.user_id, p]));
  const dmByChat = new Map<string, any[]>();
  for (const m of (dmMessages ?? []) as any[]) {
    const list = dmByChat.get(m.chat_id) ?? [];
    list.push(m);
    dmByChat.set(m.chat_id, list);
  }
  const groupByChat = new Map<string, any[]>();
  for (const m of (groupMessages ?? []) as any[]) {
    const list = groupByChat.get(m.group_id) ?? [];
    list.push(m);
    groupByChat.set(m.group_id, list);
  }

  const enrichedDms: DmThread[] = dmRows.map((d) => {
    const partnerId = d.user_a === userId ? d.user_b : d.user_a;
    const messages = dmByChat.get(d.id) ?? [];
    const latest = messages[0];
    const lastReadAt = readMap.get(`dm:${d.id}`);
    const unreadCount = messages.filter((m) => m.user_id !== userId && (!lastReadAt || new Date(m.created_at).getTime() > new Date(lastReadAt).getTime())).length;
    return {
      ...d,
      partnerId,
      partner: profileMap.get(partnerId),
      updated_at: latest?.created_at ?? d.created_at,
      last_message: previewText(latest),
      unread_count: unreadCount,
    };
  }).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  const enrichedGroups: GroupThread[] = ((groups ?? []) as any[]).map((g) => {
    const messages = groupByChat.get(g.id) ?? [];
    const latest = messages[0];
    const lastReadAt = readMap.get(`group:${g.id}`);
    const unreadCount = messages.filter((m) => m.user_id !== userId && (!lastReadAt || new Date(m.created_at).getTime() > new Date(lastReadAt).getTime())).length;
    return {
      ...g,
      updated_at: latest?.created_at ?? g.created_at,
      last_message: previewText(latest),
      unread_count: unreadCount,
    };
  }).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  return { dmChats: enrichedDms, groups: enrichedGroups };
}

export async function getUnreadChatCount(userId: string) {
  const { dmChats, groups } = await getChatSidebarData(userId);
  return [...dmChats, ...groups].reduce((sum, item) => sum + item.unread_count, 0);
}