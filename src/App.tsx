import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { FocusProvider } from "@/hooks/useFocus";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import { AppLayout } from "@/components/AppLayout";
import { Starfield } from "@/components/Starfield";

const Planner = lazy(() => import("@/pages/Planner"));
const Focus = lazy(() => import("@/pages/Focus"));
const Chat = lazy(() => import("@/pages/Chat"));
const AIHub = lazy(() => import("@/pages/AIHub"));
const CalendarPage = lazy(() => import("@/pages/Calendar"));
const Packs = lazy(() => import("@/pages/Packs"));
const Buffs = lazy(() => import("@/pages/Buffs"));
const Friends = lazy(() => import("@/pages/Friends"));
const Leaderboard = lazy(() => import("@/pages/Leaderboard"));
const Reviews = lazy(() => import("@/pages/Reviews"));
const CheatReports = lazy(() => import("@/pages/CheatReports"));
const Profile = lazy(() => import("@/pages/Profile"));
const Help = lazy(() => import("@/pages/Help"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="min-h-[55vh] w-full animate-pulse" aria-label="Opening page">
    <div className="h-8 w-48 rounded-md bg-muted/60" />
    <div className="mt-6 grid gap-4 sm:grid-cols-3">
      <div className="h-28 rounded-lg bg-muted/40" />
      <div className="h-28 rounded-lg bg-muted/40" />
      <div className="h-28 rounded-lg bg-muted/40" />
    </div>
  </div>
);

const StartupFallback = () => (
  <div className="relative min-h-screen overflow-hidden">
    <Starfield />
    <header className="relative z-10 flex items-center gap-3 border-b border-border/60 px-4 py-3 glass-strong">
      <img
        src="/icons/icon-192.png"
        alt="Study Bud AI"
        className="h-10 w-10 object-contain"
        width={40}
        height={40}
      />
      <span className="text-base font-semibold shimmer-text">Study Bud AI</span>
    </header>
    <main className="relative z-10 mx-auto w-full max-w-6xl px-4 py-8 sm:px-6" aria-label="Opening your account">
      <div className="h-8 w-56 animate-pulse rounded-md bg-muted/60" />
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="h-28 animate-pulse rounded-lg bg-muted/40" />
        <div className="h-28 animate-pulse rounded-lg bg-muted/40" />
        <div className="h-28 animate-pulse rounded-lg bg-muted/40" />
      </div>
    </main>
  </div>
);

const Protected = () => {
  const { user, loading } = useAuth();
  if (loading) return <StartupFallback />;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <FocusProvider>
      <AppLayout />
    </FocusProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner theme="dark" />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route element={<Protected />}>
                <Route path="/app" element={<Home />} />
                <Route path="/planner" element={<Planner />} />
                <Route path="/focus" element={<Focus />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/ai" element={<AIHub />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/packs" element={<Packs />} />
                <Route path="/buffs" element={<Buffs />} />
                <Route path="/friends" element={<Friends />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
                <Route path="/reviews" element={<Reviews />} />
                <Route path="/cheats" element={<CheatReports />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/help" element={<Help />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
