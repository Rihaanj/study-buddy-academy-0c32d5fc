
-- 1. Friendships safety check
ALTER TABLE public.friendships DROP CONSTRAINT IF EXISTS friendships_no_self;
ALTER TABLE public.friendships ADD CONSTRAINT friendships_no_self CHECK (user_a <> user_b);

-- 2. shares_group_with helper
CREATE OR REPLACE FUNCTION public.shares_group_with(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members ma
    JOIN public.group_members mb ON ma.group_id = mb.group_id
    WHERE ma.user_id = _a AND mb.user_id = _b
  );
$$;

-- 3. has_pending_friend_request helper
CREATE OR REPLACE FUNCTION public.has_pending_friend_request(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friend_requests
    WHERE (from_user = _a AND to_user = _b)
       OR (from_user = _b AND to_user = _a)
  );
$$;

-- 4. Tighten profiles SELECT policy
DROP POLICY IF EXISTS "Profiles viewable by signed-in users" ON public.profiles;
DROP POLICY IF EXISTS "Profiles viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;
DROP POLICY IF EXISTS "Profiles visible to self friends groups admins" ON public.profiles;
CREATE POLICY "Profiles visible to self friends groups admins"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.are_friends(auth.uid(), user_id)
  OR public.shares_group_with(auth.uid(), user_id)
  OR public.has_pending_friend_request(auth.uid(), user_id)
  OR public.is_admin(auth.uid())
);

-- 5. Safe search RPC (no email exposed)
CREATE OR REPLACE FUNCTION public.search_users(_q text)
RETURNS TABLE(user_id uuid, name text, avatar_url text, level integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.user_id, p.name, p.avatar_url, p.level
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.user_id <> auth.uid()
    AND (
      p.name ILIKE '%' || _q || '%'
      OR p.email ILIKE '%' || _q || '%'
    )
  LIMIT 20;
$$;
REVOKE ALL ON FUNCTION public.search_users(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_users(text) TO authenticated;

-- 6. Weekly score RPCs: caller ownership check
CREATE OR REPLACE FUNCTION public.ensure_weekly_score(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  wk DATE := public.iso_monday((now() AT TIME ZONE 'UTC')::date);
  current_xp INT;
  current_focus INT;
BEGIN
  IF auth.uid() IS NULL OR _user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF EXISTS (SELECT 1 FROM public.weekly_scores WHERE user_id = _user_id AND week_start = wk) THEN
    RETURN;
  END IF;
  SELECT COALESCE(xp,0) INTO current_xp FROM public.profiles WHERE user_id = _user_id;
  SELECT COALESCE(SUM(duration_minutes),0)::int INTO current_focus FROM public.focus_sessions WHERE user_id = _user_id;
  INSERT INTO public.weekly_scores (user_id, week_start, xp_start, focus_start, xp_delta, focus_delta, score)
  VALUES (_user_id, wk, COALESCE(current_xp,0), COALESCE(current_focus,0), 0, 0, 0)
  ON CONFLICT (user_id, week_start) DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_weekly_score(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  wk DATE := public.iso_monday((now() AT TIME ZONE 'UTC')::date);
  current_xp INT;
  current_focus INT;
BEGIN
  IF auth.uid() IS NULL OR _user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  PERFORM public.ensure_weekly_score(_user_id);
  SELECT COALESCE(xp,0) INTO current_xp FROM public.profiles WHERE user_id = _user_id;
  SELECT COALESCE(SUM(duration_minutes),0)::int INTO current_focus FROM public.focus_sessions WHERE user_id = _user_id;
  UPDATE public.weekly_scores
  SET xp_delta = GREATEST(0, COALESCE(current_xp,0) - xp_start),
      focus_delta = GREATEST(0, COALESCE(current_focus,0) - focus_start),
      score = GREATEST(0, COALESCE(current_xp,0) - xp_start) + GREATEST(0, COALESCE(current_focus,0) - focus_start) * 2,
      updated_at = now()
  WHERE user_id = _user_id AND week_start = wk;
END;
$function$;

-- 7. Revoke EXECUTE on internal trigger/helper SECURITY DEFINER functions from anon/authenticated
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_friend_request_accepted() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_dm_chat_for_friendship() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.add_creator_as_host() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.grant_owner_admin() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.grant_packs_on_level_up() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_friend_requests() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_dm_on_unfriend() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_apply_level_penalty(uuid, uuid) FROM anon;

-- 8. Realtime broadcast/presence default-deny (postgres_changes is unaffected)
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Default deny realtime broadcast" ON realtime.messages;
CREATE POLICY "Default deny realtime broadcast"
ON realtime.messages
FOR SELECT
TO authenticated
USING (false);
