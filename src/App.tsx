import { Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { FocusProvider } from "@/hooks/useFocus";
import { AppLayout } from "@/components/AppLayout";
import Login from "@/pages/Login";
import Landing from "@/pages/Landing";
import Home from "@/pages/Home";

import Planner from "@/pages/Planner";
import Focus from "@/pages/Focus";
import Chat from "@/pages/Chat";

import AIHub from "@/pages/AIHub";
import CalendarPage from "@/pages/Calendar";
import Packs from "@/pages/Packs";
import Buffs from "@/pages/Buffs";
import Friends from "@/pages/Friends";
import Leaderboard from "@/pages/Leaderboard";
import Reviews from "@/pages/Reviews";
import CheatReports from "@/pages/CheatReports";
import Profile from "@/pages/Profile";
import Help from "@/pages/Help";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const Protected = () => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading...</div>;
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
          </FocusProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
