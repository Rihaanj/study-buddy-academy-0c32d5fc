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
import { AppLayout } from "@/components/AppLayout";

const Home = lazy(() => import("@/pages/Home"));
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

const Protected = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
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
            <Suspense fallback={null}>
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
