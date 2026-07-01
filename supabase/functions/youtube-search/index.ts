import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Whitelist bonus channels (case-insensitive substring match)
const PRIORITY_CHANNELS = [
  "khan academy",
  "crash course",
  "organic chemistry tutor",
  "professor dave explains",
  "ted-ed",
  "ted ed",
  "mit opencourseware",
  "3blue1brown",
  "veritasium",
  "amoeba sisters",
  "bozeman science",
];

async function requireUser(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization") || "";
  const jwt = auth.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return null;
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data, error } = await sb.auth.getUser(jwt);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch { return null; }
}

// Parse ISO 8601 duration (PT#H#M#S) → "H:MM:SS" or "M:SS"
function fmtDuration(iso: string): string {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || "");
  if (!m) return "";
  const h = parseInt(m[1] || "0", 10);
  const mm = parseInt(m[2] || "0", 10);
  const ss = parseInt(m[3] || "0", 10);
  if (h) return `${h}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

async function search(topic: string): Promise<any[]> {
  const KEY = Deno.env.get("YOUTUBE_API_KEY");
  if (!KEY) throw new Error("YOUTUBE_API_KEY missing");
  const q = encodeURIComponent(`${topic} explained`);
  const searchUrl =
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&safeSearch=strict&relevanceLanguage=en&maxResults=15&q=${q}&key=${KEY}`;
  const sr = await fetch(searchUrl);
  if (!sr.ok) throw new Error(`YouTube search ${sr.status}`);
  const sj = await sr.json();
  const items: any[] = sj.items || [];
  if (!items.length) return [];
  const ids = items.map((i) => i.id?.videoId).filter(Boolean).join(",");
  const detailsUrl =
    `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet,statistics&id=${ids}&key=${KEY}`;
  const dr = await fetch(detailsUrl);
  if (!dr.ok) throw new Error(`YouTube details ${dr.status}`);
  const dj = await dr.json();
  const scored = (dj.items || []).map((v: any) => {
    const channel = (v.snippet?.channelTitle || "").toLowerCase();
    const isPriority = PRIORITY_CHANNELS.some((c) => channel.includes(c));
    const views = parseInt(v.statistics?.viewCount || "0", 10);
    const durSec = (() => {
      const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(v.contentDetails?.duration || "");
      if (!m) return 0;
      return (parseInt(m[1] || "0", 10) * 3600) + (parseInt(m[2] || "0", 10) * 60) + parseInt(m[3] || "0", 10);
    })();
    // filter out shorts (<60s) and 2h+ lectures for undergrad tempo
    const okLen = durSec >= 60 && durSec <= 3600;
    return {
      video: v,
      priority: isPriority ? 1 : 0,
      score: (isPriority ? 1e9 : 0) + views,
      okLen,
    };
  })
    .filter((x: any) => x.okLen)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 3)
    .map((x: any) => {
      const v = x.video;
      const t = v.snippet?.thumbnails || {};
      return {
        id: v.id,
        title: v.snippet?.title || "",
        channel: v.snippet?.channelTitle || "",
        thumbnail: t.high?.url || t.medium?.url || t.default?.url || "",
        duration: fmtDuration(v.contentDetails?.duration || ""),
        url: `https://www.youtube.com/watch?v=${v.id}`,
      };
    });
  return scored;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const userId = await requireUser(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const { topic } = await req.json();
    if (!topic || typeof topic !== "string") {
      return new Response(JSON.stringify({ error: "topic required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const videos = await search(topic.slice(0, 120));
    return new Response(JSON.stringify({ videos }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("youtube-search", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown", videos: [] }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
