-- 1) Preserve reviews with a display name snapshot
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS reviewer_name text;

UPDATE public.reviews r
SET reviewer_name = COALESCE(
  NULLIF(btrim(p.name), ''),
  NULLIF(initcap(replace(replace(split_part(p.email, '@', 1), '.', ' '), '_', ' ')), ''),
  'Study Bud student'
)
FROM public.profiles p
WHERE p.user_id = r.user_id AND r.reviewer_name IS NULL;

UPDATE public.reviews SET reviewer_name = 'Study Bud student' WHERE reviewer_name IS NULL OR btrim(reviewer_name) = '';

ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_user_id_fkey;
ALTER TABLE public.reviews ALTER COLUMN user_id DROP NOT NULL;

-- 2) Profile columns for the new identity model
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS recovery_email text,
  ADD COLUMN IF NOT EXISTS login_key text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_login_key_uidx ON public.profiles (login_key) WHERE login_key IS NOT NULL;

-- 3) Full reset of user data (reviews intentionally kept)
TRUNCATE TABLE
  public.active_buffs,
  public.ai_history,
  public.ai_usage,
  public.burn_list,
  public.chat_reads,
  public.cheat_reports,
  public.daily_buff_usage,
  public.daily_pack_grants,
  public.daily_xp_progress,
  public.dm_messages,
  public.dm_chats,
  public.events,
  public.flashcards,
  public.flashcard_decks,
  public.focus_sessions,
  public.friend_requests,
  public.friendships,
  public.grade_assignments,
  public.grade_classes,
  public.group_members,
  public.groups,
  public.inventory,
  public.lessons,
  public.messages,
  public.study_notes,
  public.tasks,
  public.topic_mastery,
  public.user_badges,
  public.user_roles,
  public.weekly_leaderboard_rewards,
  public.weekly_scores,
  public.profiles
CASCADE;

-- 4) New signup handler: name + password identity
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fn text := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'first_name', '')), '');
  ln text := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'last_name', '')), '');
  full_name text;
BEGIN
  full_name := NULLIF(btrim(COALESCE(fn, '') || ' ' || COALESCE(ln, '')), '');
  INSERT INTO public.profiles (user_id, name, first_name, last_name, login_key, recovery_email, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(full_name, NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    fn,
    ln,
    NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'login_key', '')), ''),
    NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'recovery_email', '')), ''),
    NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'recovery_email', '')), ''),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 5) Owner admin grant now keys off the created account name / recovery email
CREATE OR REPLACE FUNCTION public.grant_owner_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(COALESCE(NEW.raw_user_meta_data->>'login_key', '')) = 'rihaan-yeswant-jain'
     OR lower(COALESCE(NEW.raw_user_meta_data->>'recovery_email', '')) = 'rihaanjain2601@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- 6) Public landing-page counters and stats
CREATE TABLE IF NOT EXISTS public.app_counters (
  key text PRIMARY KEY,
  value bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_counters TO anon, authenticated;
GRANT ALL ON public.app_counters TO service_role;

ALTER TABLE public.app_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read counters" ON public.app_counters;
CREATE POLICY "Anyone can read counters" ON public.app_counters FOR SELECT USING (true);

INSERT INTO public.app_counters (key, value) VALUES ('visitors', 222)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.bump_visitor()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v bigint;
BEGIN
  INSERT INTO public.app_counters (key, value) VALUES ('visitors', 223)
  ON CONFLICT (key) DO UPDATE SET value = public.app_counters.value + 1, updated_at = now()
  RETURNING value INTO v;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.public_stats()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'visitors', (SELECT COALESCE(value, 222) FROM public.app_counters WHERE key = 'visitors'),
    'focus_hours', 37 + FLOOR(COALESCE((SELECT SUM(duration_minutes) FROM public.focus_sessions), 0) / 60.0),
    'ai_uses', 500 + COALESCE((SELECT SUM(count) FROM public.ai_usage), 0),
    'students', (SELECT COUNT(*) FROM public.profiles)
  );
$$;

GRANT EXECUTE ON FUNCTION public.bump_visitor() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_stats() TO anon, authenticated;