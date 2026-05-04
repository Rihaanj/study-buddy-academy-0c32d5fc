import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Home, ListChecks, Timer, MessageCircle, Sparkles, LogOut, Calendar, Package, Zap, Users, Star, User, HelpCircle, Trophy, ShieldAlert } from "lucide-react";
const logoUrl = "/icons/icon-512.png";
import { Starfield } from "./Starfield";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { FloatingFocus } from "./FloatingFocus";
import { Button } from "./ui/button";
import { UserAvatar } from "./UserAvatar";
import { XpBar } from "./XpBar";
import { ReviewPrompt } from "./ReviewPrompt";
import { OnboardingTour } from "./OnboardingTour";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { markTabVisited } from "@/lib/badges";
import { runDueDateNotifier } from "@/lib/notifications";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const TAB_HINTS: Record<string, string> = {
  "/": "Your dashboard — quick stats, today's tasks, and shortcuts.",
  "/planner": "Add assignments and tasks. Smart priority sorts what to do first.",
  "/calendar": "See deadlines, study sessions, and events on a calendar view.",
  "/focus": "Pomodoro-style focus timer. Earns the most XP in the app.",
  "/chat": "Group study chats and DMs with friends. Send images, stickers & meet links.",
  "/friends": "Add friends, accept requests, and unlock 1-on-1 DMs.",
  "/leaderboard": "Weekly rankings. Top 3 win bonus packs every Monday.",
  "/ai": "Your AI tutor: Socratic teaching, exam sim, image decoder, voice lab.",
  "/packs": "Open mystery packs to win XP buffs and rare items.",
  "/buffs": "Activate buffs to multiply your XP. Need 10 min focus between uses.",
  "/profile": "Your stats, mastery heatmap, badges, and customization.",
  "/help": "FAQ, tips, and a refresher of the welcome tour.",
  "/reviews": "Admin: read all submitted reviews.",
  "/cheats": "Admin: review flagged AI requests.",
};

const baseTabs = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/planner", label: "Planner", icon: ListChecks },
  { to: "/calendar", label: "Cal", icon: Calendar },
  { to: "/focus", label: "Focus", icon: Timer },
  { to: "/chat", label: "Chat", icon: MessageCircle },
  { to: "/friends", label: "Friends", icon: Users },
  { to: "/leaderboard", label: "Ranks", icon: Trophy },
  { to: "/ai", label: "AI", icon: Sparkles },
  { to: "/packs", label: "Packs", icon: Package },
  { to: "/buffs", label: "Buffs", icon: Zap },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/help", label: "Help", icon: HelpCircle },
];

export const AppLayout = () => {
  const { signOut, user } = useAuth();
  const { profile } = useProfile();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
    })();
  }, [user?.id]);

  // Track tab visits for Explorer badge
  useEffect(() => {
    if (user) markTabVisited(user.id, location.pathname);
  }, [location.pathname, user?.id]);

  // Due-date in-app notifier — runs on mount + every 5 min
  useEffect(() => {
    if (!user) return;
    runDueDateNotifier(user.id);
    const t = window.setInterval(() => runDueDateNotifier(user.id), 5 * 60_000);
    return () => window.clearInterval(t);
  }, [user?.id]);

  const tabs = isAdmin
    ? [...baseTabs, { to: "/reviews", label: "Reviews", icon: Star }, { to: "/cheats", label: "Cheats", icon: ShieldAlert }]
    : baseTabs;

  return (
    <div className="min-h-screen flex flex-col">
      <Starfield />
      {/* Top bar */}
      <header className="sticky top-0 z-30 glass-strong border-b border-white/10 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between">
        <NavLink to="/" className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-2xl shrink-0 grid place-items-center bg-gradient-to-br from-primary/30 to-accent/20 shadow-[0_4px_20px_-4px_hsl(var(--primary)/0.5)]">
            <img
              src={logoUrl}
              alt="Study Bud AI logo"
              className="h-[88%] w-[88%] object-contain"
              width={40}
              height={40}
            />
          </div>
          <div className="leading-tight min-w-0">
            <div className="font-semibold tracking-tight truncate text-sm sm:text-base">Study Bud AI</div>
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-[9px] font-bold tracking-[0.2em] px-1.5 py-0.5 rounded-md bg-gradient-primary text-primary-foreground shadow-glow">RYJ</span>
              <span className="text-[10px] text-muted-foreground">by Rihaan Yeswant Jain</span>
            </div>
          </div>
        </NavLink>
        <div className="flex items-center gap-2 sm:gap-3">
          {profile && (
            <>
              <div className="hidden lg:flex flex-col items-end gap-0.5 min-w-[160px]">
                <span className="text-[11px] text-muted-foreground">⚡ {profile.xp} XP · 🔥 {profile.streak}</span>
                <XpBar xp={profile.xp} compact />
              </div>
              <NavLink to="/profile" aria-label="Profile" className="shrink-0">
                <UserAvatar url={profile.avatar_url} name={profile.name} />
              </NavLink>
            </>
          )}
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out"><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>

      {/* Desktop side nav + content */}
      <div className="flex-1 flex">
        <nav className="hidden md:flex flex-col gap-1 p-3 w-52 lg:w-56 border-r border-white/10 glass-strong relative overflow-hidden">
          {/* Cosmic nebula accents */}
          <div aria-hidden className="pointer-events-none absolute -top-20 -left-10 h-56 w-56 rounded-full bg-primary/25 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute bottom-0 -right-10 h-48 w-48 rounded-full bg-accent/25 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 h-32 w-32 rounded-full bg-secondary/20 blur-3xl" />
          <div className="relative flex flex-col gap-1">
            {tabs.map((t) => (
              <Tooltip key={t.to} delayDuration={300}>
                <TooltipTrigger asChild>
                  <NavLink
                    to={t.to}
                    end={t.end}
                    data-tour-tab={t.to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-xl transition group relative text-white ${
                        isActive
                          ? "bg-gradient-primary shadow-glow ring-1 ring-white/30 font-semibold"
                          : "hover:bg-gradient-to-r hover:from-primary/30 hover:to-accent/30 hover:ring-1 hover:ring-primary/40"
                      }`
                    }
                  >
                    <t.icon className="h-4 w-4 shrink-0 text-white" />
                    <span className="text-sm font-medium truncate">{t.label}</span>
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[220px] text-xs">
                  {TAB_HINTS[t.to] ?? t.label}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </nav>

        <main className="flex-1 px-3 sm:px-6 py-4 sm:py-6 pb-32 md:pb-8 max-w-6xl mx-auto w-full animate-fade-in">
          <Outlet />
        </main>
      </div>

      {/* Floating focus widget */}
      <FloatingFocus />

      {/* Review prompt modal (auto-triggers on milestones) */}
      <ReviewPrompt />

      {/* First-login welcome tour with 3-pack reward */}
      <OnboardingTour />

      {/* Mobile bottom nav — horizontal scroll for many tabs */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 glass-strong border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
        <div className="overflow-x-auto scrollbar-none">
          <div className="flex w-max min-w-full px-1 pt-1">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-0.5 px-2.5 py-1.5 rounded-md text-[9px] leading-none min-w-[52px] text-white ${
                    isActive ? "bg-primary/25 font-semibold ring-1 ring-primary/40" : "text-white/85"
                  }`
                }
              >
                <t.icon className="h-4 w-4 shrink-0" />
                <span className="truncate w-full text-center">{t.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
};
