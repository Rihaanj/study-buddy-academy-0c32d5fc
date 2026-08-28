import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { authEmailFor, loginKeyFrom } from "@/lib/authName";
import { rememberAccount } from "@/lib/savedAccounts";

type Result = { error: string | null };

type Ctx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUpWithName: (first: string, last: string, password: string, recoveryEmail?: string) => Promise<Result>;
  signInWithName: (first: string, last: string, password: string) => Promise<Result>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Ctx | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!active) return;
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    // Session hydration is normally instant because it reads local storage.
    // Never let a browser storage lock or a slow network leave the app blank.
    const fallback = window.setTimeout(() => {
      if (active) setLoading(false);
    }, 1500);

    supabase.auth.getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setUser(data.session?.user ?? null);
      })
      .catch(() => {
        // The auth listener can still recover if the initial read fails.
      })
      .finally(() => {
        if (!active) return;
        window.clearTimeout(fallback);
        setLoading(false);
      });

    return () => {
      active = false;
      window.clearTimeout(fallback);
      sub.subscription.unsubscribe();
    };
  }, []);

  const signUpWithName: Ctx["signUpWithName"] = async (first, last, password, recoveryEmail) => {
    const login_key = loginKeyFrom(first, last);
    const { data, error } = await supabase.auth.signUp({
      email: authEmailFor(login_key),
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          first_name: first.trim(),
          last_name: last.trim(),
          full_name: `${first.trim()} ${last.trim()}`,
          login_key,
          recovery_email: (recoveryEmail ?? "").trim().toLowerCase() || null,
        },
      },
    });
    if (error) {
      if (/weak|pwned/i.test(error.message)) {
        return { error: "That password shows up in known data breaches. Pick a more unique one." };
      }
      if (/already registered|already been registered|User already/i.test(error.message)) {
        return { error: "That name is already taken. Try adding a middle name or initial." };
      }
      return { error: error.message };
    }
    // Auto-confirm is enabled, but sign in explicitly if no session came back.
    if (!data.session) {
      const { error: e2 } = await supabase.auth.signInWithPassword({
        email: authEmailFor(login_key),
        password,
      });
      if (e2) return { error: e2.message };
    }
    rememberAccount(first, last);
    return { error: null };
  };

  const signInWithName: Ctx["signInWithName"] = async (first, last, password) => {
    const login_key = loginKeyFrom(first, last);
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmailFor(login_key),
      password,
    });
    if (error) {
      if (/invalid login credentials/i.test(error.message)) {
        return { error: "Wrong name or password. Check your spelling and try again." };
      }
      return { error: error.message };
    }
    rememberAccount(first, last);
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUpWithName, signInWithName, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
