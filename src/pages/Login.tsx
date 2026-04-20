import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Starfield } from "@/components/Starfield";
import { Button } from "@/components/ui/button";
import { Sparkles, Brain, Target, Trophy, ArrowRight } from "lucide-react";

const features = [
  { icon: Brain, label: "AI Tutor" },
  { icon: Target, label: "Focus Mode" },
  { icon: Trophy, label: "Earn Packs" },
];

export default function Login() {
  const { signInWithGoogle, user, loading } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      window.history.replaceState(null, "", "/");
    }
  }, [loading, user]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground relative">
        <Starfield />
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-primary animate-pulse" />
          <span>Loading the cosmos…</span>
        </div>
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <Starfield />

      {/* Floating accent orbs */}
      <div className="absolute top-1/4 -left-24 w-96 h-96 rounded-full bg-primary/20 blur-[120px] animate-pulse" />
      <div className="absolute bottom-1/4 -right-24 w-96 h-96 rounded-full bg-secondary/20 blur-[120px] animate-pulse" style={{ animationDelay: "1.5s" }} />

      <div className="min-h-screen grid place-items-center px-4 relative">
        <div className="w-full max-w-md">
          {/* Logo + brand */}
          <div className="text-center mb-8 animate-fade-in">
            <div className="mx-auto h-20 w-20 rounded-3xl bg-gradient-primary grid place-items-center shadow-glow float relative">
              <div className="absolute inset-0 rounded-3xl bg-gradient-primary blur-xl opacity-50" />
              <Sparkles className="h-10 w-10 text-primary-foreground relative" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold mt-6 gradient-text tracking-tight">
              Study Bud AI
            </h1>
            <p className="text-muted-foreground mt-3 text-base">
              Your cosmic Student OS — AI tutor, planner,<br className="hidden sm:block" /> focus, and rewards.
            </p>
          </div>

          {/* Card */}
          <div className="glass-strong p-8 sm:p-10 text-center animate-fade-in" style={{ animationDelay: "150ms" }}>
            {/* Feature pills */}
            <div className="flex justify-center gap-2 mb-8">
              {features.map((f) => (
                <div
                  key={f.label}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-muted-foreground"
                >
                  <f.icon className="h-3 w-3 text-primary" />
                  {f.label}
                </div>
              ))}
            </div>

            <Button
              onClick={handleSignIn}
              disabled={signingIn}
              className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow h-12 text-base font-semibold group transition-all hover:shadow-[0_0_60px_hsl(var(--primary)/0.6)]"
            >
              {signingIn ? (
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 animate-spin" /> Connecting...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Continue with Google
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              )}
            </Button>

            <p className="text-[11px] text-muted-foreground mt-5">
              By continuing you agree to be amazing ✨
            </p>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground mt-6 animate-fade-in" style={{ animationDelay: "300ms" }}>
            Made by <span className="gradient-text font-semibold">Rihaan</span>
          </p>
        </div>
      </div>
    </div>
  );
}
