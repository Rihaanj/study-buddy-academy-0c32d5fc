import { useEffect, useState } from "react";
import { Navigate, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Starfield } from "@/components/Starfield";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Brain, Target, Trophy, ArrowRight, Lock, User as UserIcon } from "lucide-react";
import { SeoHead } from "@/components/SeoHead";
import { validateSignup } from "@/lib/authName";
import { toast } from "sonner";

const logoUrl = "/icons/icon-512.png";

const features = [
  { icon: Brain, label: "AI Tutor" },
  { icon: Target, label: "Focus Mode" },
  { icon: Trophy, label: "Earn Packs" },
];

export default function Login() {
  const { signInWithName, signUpWithName, user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate("/app", { replace: true });
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground relative">
        <Starfield />
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-primary animate-pulse" />
          <span>Loading the cosmos...</span>
        </div>
      </div>
    );
  }
  if (user) return <Navigate to="/app" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (mode === "signup") {
      const problem = validateSignup(first, last, password);
      if (problem) { toast.error(problem); return; }
    } else if (!first.trim() || !last.trim() || !password) {
      toast.error("Enter your first name, last name and password.");
      return;
    }
    setBusy(true);
    const { error } =
      mode === "signup"
        ? await signUpWithName(first, last, password, recoveryEmail)
        : await signInWithName(first, last, password);
    setBusy(false);
    if (error) { toast.error(error); return; }
    toast.success(mode === "signup" ? "Welcome aboard!" : "Welcome back!");
    navigate("/app", { replace: true });
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <SeoHead
        title="Create your account — Study Bud AI | Free AI Tutor for Students"
        description="Create a Study Bud AI account with just your name and a password. AI tutor, smart planner, focus timer, streaks, and rewards. Free for students."
        path="/login"
      />
      <Starfield />

      <div className="absolute top-1/4 -left-24 w-96 h-96 rounded-full bg-primary/20 blur-[120px] animate-pulse" />
      <div className="absolute bottom-1/4 -right-24 w-96 h-96 rounded-full bg-secondary/20 blur-[120px] animate-pulse" style={{ animationDelay: "1.5s" }} />

      <div className="min-h-screen grid place-items-center px-4 py-10 relative">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 animate-fade-in">
            <Link to="/" className="mx-auto h-24 w-24 grid place-items-center float relative">
              <div className="absolute inset-0 rounded-full bg-gradient-primary blur-2xl opacity-40" />
              <img src={logoUrl} alt="Study Bud AI orbit logo" className="relative h-full w-full object-contain drop-shadow-[0_0_30px_hsl(var(--primary)/0.7)]" width={96} height={96} />
            </Link>
            <h1 className="text-4xl sm:text-5xl font-bold mt-6 gradient-text tracking-tight">Study Bud AI</h1>
            <p className="text-muted-foreground mt-3 text-base">
              Your cosmic Student OS — AI tutor, planner,<br className="hidden sm:block" /> focus, and rewards.
            </p>
          </div>

          <div className="glass-strong p-7 sm:p-9 animate-fade-in" style={{ animationDelay: "150ms" }}>
            <div className="flex justify-center gap-2 mb-6">
              {features.map((f) => (
                <div key={f.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-muted-foreground">
                  <f.icon className="h-3 w-3 text-primary" />
                  {f.label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/5 border border-white/10 mb-6">
              {(["signup", "signin"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`h-9 rounded-lg text-sm font-medium transition-all ${
                    mode === m ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "signup" ? "Create account" : "Sign in"}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="first">First name</Label>
                  <Input id="first" value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Rihaan" autoComplete="given-name" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="last">Last name</Label>
                  <Input id="last" value={last} onChange={(e) => setLast(e.target.value)} placeholder="Jain" autoComplete="family-name" required />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                />
              </div>

              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="recovery" className="flex items-center gap-2">
                    Recovery email <span className="text-[10px] text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="recovery"
                    type="email"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                  <p className="text-[11px] text-muted-foreground">Only used if you ever forget your password.</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={busy}
                className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow h-12 text-base font-semibold group transition-all hover:shadow-[0_0_60px_hsl(var(--primary)/0.6)]"
              >
                {busy ? (
                  <span className="flex items-center gap-2"><Sparkles className="h-4 w-4 animate-spin" /> Working...</span>
                ) : (
                  <span className="flex items-center gap-2">
                    {mode === "signup" ? <UserIcon className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    {mode === "signup" ? "Create my account" : "Sign in"}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                )}
              </Button>
            </form>

            <p className="text-[11px] text-muted-foreground mt-5 text-center">
              Your name + password is your account. No email required.
            </p>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6 animate-fade-in" style={{ animationDelay: "300ms" }}>
            Made by <span className="gradient-text font-semibold">Rihaan Yeswant Jain</span>
          </p>
        </div>
      </div>
    </div>
  );
}
