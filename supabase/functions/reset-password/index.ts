import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { login_key, recovery_email, new_password } = await req.json();
    const key = String(login_key ?? "").trim().toLowerCase();
    const email = String(recovery_email ?? "").trim().toLowerCase();
    const password = String(new_password ?? "");

    if (!key || !email || password.length < 8) {
      return json({ error: "Enter your full name, recovery email, and a password of at least 8 characters." }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: profile, error } = await admin
      .from("profiles")
      .select("user_id, recovery_email")
      .eq("login_key", key)
      .maybeSingle();

    // Generic response so this cannot be used to probe which accounts exist.
    const generic = { error: "We could not verify that account. Check the name and recovery email." };
    if (error) { console.error("lookup failed", error.message); return json({ error: "Something went wrong. Try again." }, 500); }
    if (!profile || (profile.recovery_email ?? "").trim().toLowerCase() !== email) return json(generic, 400);

    const { error: upErr } = await admin.auth.admin.updateUserById(profile.user_id, { password });
    if (upErr) { console.error("update failed", upErr.message); return json({ error: "Could not update the password. Try again." }, 500); }

    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: "Unexpected error" }, 500);
  }
});
