// Central route loaders so every chunk is imported once and cached.
// Lazy() uses these, and we warm them all up as soon as the browser is idle,
// which makes tab switching feel instant (no per-tab download).

export const loaders = {
  layout: () => import("@/components/AppLayout"),
  home: () => import("@/pages/Home"),
  planner: () => import("@/pages/Planner"),
  focus: () => import("@/pages/Focus"),
  chat: () => import("@/pages/Chat"),
  ai: () => import("@/pages/AIHub"),
  calendar: () => import("@/pages/Calendar"),
  packs: () => import("@/pages/Packs"),
  buffs: () => import("@/pages/Buffs"),
  friends: () => import("@/pages/Friends"),
  leaderboard: () => import("@/pages/Leaderboard"),
  reviews: () => import("@/pages/Reviews"),
  cheats: () => import("@/pages/CheatReports"),
  profile: () => import("@/pages/Profile"),
  help: () => import("@/pages/Help"),
  notFound: () => import("@/pages/NotFound"),
} as const;

export type RouteKey = keyof typeof loaders;

export const pathToKey: Record<string, RouteKey> = {
  "/app": "home",
  "/planner": "planner",
  "/focus": "focus",
  "/chat": "chat",
  "/ai": "ai",
  "/calendar": "calendar",
  "/packs": "packs",
  "/buffs": "buffs",
  "/friends": "friends",
  "/leaderboard": "leaderboard",
  "/reviews": "reviews",
  "/cheats": "cheats",
  "/profile": "profile",
  "/help": "help",
};

const started = new Set<string>();

export function prefetchRoute(path: string) {
  const key = pathToKey[path];
  if (!key || started.has(key)) return;
  started.add(key);
  loaders[key]().catch(() => started.delete(key));
}

let warmed = false;
export function warmAllRoutes() {
  if (warmed) return;
  warmed = true;
  const keys = Object.keys(loaders) as RouteKey[];
  let i = 0;
  const idle: (cb: () => void) => void =
    typeof (window as any).requestIdleCallback === "function"
      ? (cb) => (window as any).requestIdleCallback(cb, { timeout: 1500 })
      : (cb) => window.setTimeout(cb, 200);

  const step = () => {
    if (i >= keys.length) return;
    const key = keys[i++];
    if (!started.has(key)) {
      started.add(key);
      loaders[key]().catch(() => started.delete(key));
    }
    idle(step);
  };
  idle(step);
}
