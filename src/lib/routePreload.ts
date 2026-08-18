type RouteLoader = () => Promise<unknown>;

const routeLoaders: Record<string, RouteLoader> = {
  "/app": () => import("@/pages/Home"),
  "/planner": () => import("@/pages/Planner"),
  "/focus": () => import("@/pages/Focus"),
  "/chat": () => import("@/pages/Chat"),
  "/ai": () => import("@/pages/AIHub"),
  "/calendar": () => import("@/pages/Calendar"),
  "/packs": () => import("@/pages/Packs"),
  "/buffs": () => import("@/pages/Buffs"),
  "/friends": () => import("@/pages/Friends"),
  "/leaderboard": () => import("@/pages/Leaderboard"),
  "/reviews": () => import("@/pages/Reviews"),
  "/cheats": () => import("@/pages/CheatReports"),
  "/profile": () => import("@/pages/Profile"),
  "/help": () => import("@/pages/Help"),
};

const requestedRoutes = new Set<string>();

export const preloadRoute = (path: string) => {
  const loader = routeLoaders[path];
  if (!loader || requestedRoutes.has(path)) return;
  requestedRoutes.add(path);
  void loader().catch(() => requestedRoutes.delete(path));
};

export const preloadAppRoutes = () => {
  Object.keys(routeLoaders).forEach(preloadRoute);
};