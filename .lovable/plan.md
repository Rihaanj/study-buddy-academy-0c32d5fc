## What I'll fix

### 1. App logo everywhere = the PWA icon (the one you see when installed)
The "paw"/cap icon you see when the app is downloaded is `public/icons/icon-512.png`. Right now the header/login/AI Hub use `src/assets/logo.png` (a different generated image, scaled 1.35×, cropped). I'll:
- Switch every brand spot (`AppLayout` header, `Login`, `AIHub`, `OnboardingTour`) to import from `/icons/icon-512.png`.
- Remove the `scale-[1.35]` zoom and `object-cover` cropping so the **whole** icon shows (use `object-contain`, no overflow-hidden ring that clips).
- Keep the soft glow ring around it but no background fill clipping the rounded edges.

### 2. Sidebar text → white (and stay readable)
Currently uses `text-foreground/95` plus icon color `text-primary-foreground/90`, which can render bluish on hover and washed out on inactive. I'll:
- Force inactive nav text + icon to `text-white` (with `/90` for subtle).
- Hover state: `text-white` + soft primary/accent gradient background (no color shift on the text itself).
- Active: keep gradient pill with `text-white` + ring.
- Same treatment on the mobile bottom nav so it matches.

### 3. Focus → buff "10-min cooldown" not unlocking
Today the SQL gate (`activate_inventory_buff`) requires `SUM(focus_sessions.duration_minutes) > 10` **since the last buff was activated**, but:
- A new user with **no prior buff** has `v_last = NULL` → should sum all sessions, but the comparison `completed_at > COALESCE(v_last, '-infinity')` is fine; the bug is **`duration_minutes` only counts completed sessions, and short/abandoned timers store rounded values**. After your 10-min wait the SUM can equal 10 but the message still says "Study for at least 10 minutes" if the session hadn't been INSERTed yet (timer page hadn't returned the row).
- I'll change the SQL function (new migration) to `v_study_minutes >= 10` (already correct) **AND** also accept "currently-active session ≥ 10 min" by reading `focus_sessions` plus the live timer state we'll persist on `profiles.current_focus_started_at` (set on `start`, cleared on `stop`). If `now() - current_focus_started_at >= 10 min` we count it.
- Also fix the user-facing error to say *"Finish a 10-min focus session first — your current session counts when it ends."* so it's not confusing.

### 4. The 3-question XP gate doesn't work
Two real bugs in `FollowUpGate` + `ai-tutor`:
- The submit handler runs all three `gradeAnswer` calls in `Promise.all`, which often hits the gateway rate limit (429) → every answer comes back "wrong". I'll **sequence** them with a short delay and surface the rate-limit toast properly.
- When the AI returns no `tool_calls` (timeout / 402), `parsed = { correct:false, feedback:"Could not grade." }` — silently marks the user wrong. I'll bubble that up as a retry instead of penalising the student, and skip burn-list / XP penalty when grading itself failed.
- Add a fallback: if `generateFollowUps` returns 0 questions, show a "Tap to retry" button instead of nothing.
- Make the submit button disabled until at least one answer is non-empty, and show a clear "+X XP" toast even on 0/3 (with "no XP this round" message).

### 5. Security findings — fix all of them

| # | Finding | Fix |
|---|---|---|
| A | **Profiles email exposed to anon** | Migration: drop `Profiles viewable by everyone`; add `Profiles viewable by authenticated` (TO authenticated, USING true). Create a helper view `public.profiles_public` exposing only non-PII (`user_id, name, avatar_url, level, xp, streak, focus_streak`) for any future anon needs. |
| B | **AI edge functions accept any caller (anon key)** | In `ai-tutor` and `group-ai`: read `Authorization` header, verify Supabase JWT via `createClient(...).auth.getUser(jwt)`, return 401 if missing/invalid. Update client (`src/lib/aiHub.ts`, `AIHub.tsx`, `group-ai` callers) to send `(await supabase.auth.getSession()).access_token` instead of the publishable key. Add per-user rate limit using existing `ai_usage` (≤60 calls / 10 min). |
| C | **`group_members` self-join can pick `role='host'`** | Migration: drop `Users can join groups`, recreate with `WITH CHECK (auth.uid() = user_id AND role = 'member')`. |
| D | **`cheat_reports` insert lets you forge another user's identity** | Migration: replace insert policy `WITH CHECK (auth.uid() = user_id)`. Update client report code to send the real `user_id`. |
| E | **`chat-images` bucket is public + listable** | Migration: turn bucket private; add `storage.objects` SELECT policy that allows reads only when path prefix is the auth.uid() OR the auth.uid() is a participant of the DM/group the image belongs to (path layout already starts with `<userId>/`). Replace `getPublicUrl` with `createSignedUrl(60 * 60)` in `Chat.tsx`, `AIHub.tsx`, `dm.ts`, anywhere uploads happen. |
| F | **Realtime channel topics not gated** | Migration: enable RLS on `realtime.messages` and add policy that allows subscribe only when topic matches a row the user can read (DM participant OR group member) — using existing `is_dm_participant` / `is_group_member` helpers. |
| G | **Public bucket allows listing (avatars)** | Add restrictive SELECT policy on `storage.objects` for `avatars` bucket so individual reads still work but `list()` is blocked. |
| H | **Extension in public schema** | Migration to move `pgcrypto`/etc. to `extensions` schema if not in use elsewhere; otherwise mark accepted in security memory with rationale. |

After applying, mark each finding fixed via `manage_security_finding` and update the security memory.

### Files I'll touch

- **Edits**: `src/components/AppLayout.tsx`, `src/pages/Login.tsx`, `src/pages/AIHub.tsx`, `src/components/OnboardingTour.tsx`, `src/components/FollowUpGate.tsx`, `src/lib/aiHub.ts`, `src/hooks/useFocus.tsx`, `src/pages/Chat.tsx`, `src/lib/dm.ts`, `src/pages/CheatReports.tsx` (or wherever cheat_reports insert happens).
- **Edge functions**: `supabase/functions/ai-tutor/index.ts`, `supabase/functions/group-ai/index.ts` (add JWT verify + per-user rate limit).
- **Migrations** (single new SQL file):
  - tighten `profiles` SELECT
  - tighten `group_members` INSERT
  - tighten `cheat_reports` INSERT
  - flip `chat-images` bucket to private + add object-scoped SELECT policies for `chat-images` and `avatars`
  - enable & gate `realtime.messages`
  - patch `activate_inventory_buff` to count the in-flight focus session
  - add `profiles.current_focus_started_at timestamptz`

### Out of scope (not changing)
- Wheel visuals, leaderboard math, buff multipliers — already where you want them.
- XP cap of 1000/day stays.

Approve and I'll ship it all in one push.