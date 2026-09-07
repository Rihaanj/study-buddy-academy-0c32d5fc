import { lazy, Suspense, useEffect } from "react";
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
import { loaders, warmAllRoutes } from "@/lib/routePrefetch";

const AppLayout = lazy(() => loaders.layout().then((m) => ({ default: m.AppLayout })));
const Home = lazy(loaders.home);
const Planner = lazy(loaders.planner);
const Focus = lazy(loaders.focus);
const Chat = lazy(loaders.chat);
const AIHub = lazy(loaders.ai);
const CalendarPage = lazy(loaders.calendar);
const Packs = lazy(loaders.packs);
const Buffs = lazy(loaders.buffs);
const Friends = lazy(loaders.friends);
const Leaderboard = lazy(loaders.leaderboard);
const Reviews = lazy(loaders.reviews);
const CheatReports = lazy(loaders.cheats);
const Profile = lazy(loaders.profile);
const Help = lazy(loaders.help);
const NotFound = lazy(loaders.notFound);

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 } },
});

const Fallback = () => <div className="min-h-[30vh]" aria-hidden />;

const Warmer = () => {
  useEffect(() => {
    warmAllRoutes();
  }, []);
  return null;
};

const Protected = () => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen" aria-hidden />;
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner theme="dark" />
      <BrowserRouter>
        <AuthProvider>
          <FocusProvider>
            <Warmer />
            <Suspense fallback={<Fallback />}>
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
          </FocusProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
