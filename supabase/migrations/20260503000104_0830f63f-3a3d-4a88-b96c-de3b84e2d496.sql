-- =========================================
-- 1. PROFILES — block anonymous email leaks
-- =========================================
DROP POLICY IF EXISTS "Profiles viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles viewable by signed-in users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- =========================================
-- 2. GROUP MEMBERS — no self-promotion to host
-- =========================================
DROP POLICY IF EXISTS "Users can join groups" ON public.group_members;
CREATE POLICY "Users can self-join as member only"
  ON public.group_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND role = 'member');

-- =========================================
-- 3. CHEAT REPORTS — must report as yourself
-- =========================================
DROP POLICY IF EXISTS "Anyone signed in can file a report" ON public.cheat_reports;
CREATE POLICY "Users file own cheat reports"
  ON public.cheat_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- =========================================
-- 4. STORAGE — private chat-images, anti-listing avatars
-- =========================================
UPDATE storage.buckets SET public = false WHERE id = 'chat-images';

-- Drop any pre-existing chat-images policies we may have added
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT polname FROM pg_policy
           WHERE polrelid = 'storage.objects'::regclass
             AND polname ILIKE 'chat-images%'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.polname); END LOOP;
END $$;

-- Owner can write/read/delete their own chat-image objects (path = "<uid>/...")
CREATE POLICY "chat-images owner read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "chat-images owner write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "chat-images owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Avatars: anyone signed-in can read individual files, but anonymous list() blocked.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT polname FROM pg_policy
           WHERE polrelid = 'storage.objects'::regclass
             AND polname ILIKE 'avatars%'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.polname); END LOOP;
END $$;
CREATE POLICY "avatars read auth"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');
CREATE POLICY "avatars owner write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =========================================
-- 5. PROFILES — track current focus start
-- =========================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_focus_started_at timestamptz;

-- =========================================
-- 6. activate_inventory_buff — accept in-flight focus
-- =========================================
CREATE OR REPLACE FUNCTION public.activate_inventory_buff(_buff_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item public.inventory%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_meta jsonb;
  v_now timestamptz := now();
  v_last timestamptz;
  v_study_minutes integer := 0;
  v_active_minutes integer := 0;
  v_live_count integer := 0;
  v_duration integer := 0;
  v_multiplier numeric := 1;
  v_category text := 'xp';
  v_label text := '';
  v_xp integer := 0;
  v_new_xp integer := 0;
  v_new_level integer := 1;
  v_old_level integer := 1;
  v_xp_today integer := 0;
  v_buffs_today integer := 0;
  v_today date := (now() at time zone 'utc')::date;
  v_last_active date;
  v_new_streak integer := 0;
  v_yesterday date := ((now() at time zone 'utc')::date - interval '1 day')::date;
  v_remaining_xp integer;
  v_award integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT * INTO v_item FROM public.inventory
    WHERE id = _buff_id AND user_id = auth.uid() AND item_type = 'buff' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That buff is no longer available'; END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;

  v_last := v_profile.last_buff_activated_at;
  IF v_last IS NOT NULL AND v_last > (v_now - interval '4 seconds') THEN
    RAISE EXCEPTION 'Wait 4 seconds before activating another buff';
  END IF;

  -- completed focus minutes since last buff
  SELECT COALESCE(SUM(duration_minutes),0)::integer INTO v_study_minutes
  FROM public.focus_sessions
  WHERE user_id = auth.uid() AND completed_at > COALESCE(v_last, '-infinity'::timestamptz);

  -- in-flight focus session counts too
  IF v_profile.current_focus_started_at IS NOT NULL
     AND v_profile.current_focus_started_at > COALESCE(v_last, '-infinity'::timestamptz) THEN
    v_active_minutes := GREATEST(0, EXTRACT(EPOCH FROM (v_now - v_profile.current_focus_started_at))::int / 60);
  END IF;

  IF (v_study_minutes + v_active_minutes) < 10 THEN
    RAISE EXCEPTION 'You need 10 minutes of focus before activating another buff (you have % min). Start a focus session — your current session counts in real time.', (v_study_minutes + v_active_minutes);
  END IF;

  SELECT COALESCE(count, 0) INTO v_buffs_today
  FROM public.daily_buff_usage WHERE user_id = auth.uid() AND day = v_today;
  IF v_buffs_today >= 8 THEN RAISE EXCEPTION 'Daily buff limit reached (8/day). Try again tomorrow'; END IF;

  v_meta := COALESCE(v_item.metadata, '{}'::jsonb);
  v_duration := GREATEST(COALESCE((v_meta->>'durationMin')::integer, 0), 0);
  v_multiplier := GREATEST(COALESCE((v_meta->>'multiplier')::numeric, 1), 0);
  v_category := COALESCE(NULLIF(v_meta->>'category', ''), 'xp');
  v_label := COALESCE(NULLIF(v_meta->>'label', ''), v_item.item_key);
  v_xp := GREATEST(COALESCE((v_meta->>'xpAmount')::integer, 0), 0);

  IF COALESCE((v_meta->>'instant')::boolean, false) AND v_xp > 0 THEN
    v_old_level := COALESCE(v_profile.level, 1);
    SELECT COALESCE(xp_gained, 0) INTO v_xp_today
      FROM public.daily_xp_progress WHERE user_id = auth.uid() AND day = v_today;
    v_remaining_xp := GREATEST(0, 1000 - v_xp_today);
    v_award := LEAST(v_xp, v_remaining_xp);
    IF v_award <= 0 THEN
      DELETE FROM public.inventory WHERE id = v_item.id;
      INSERT INTO public.daily_buff_usage (user_id, day, count, updated_at)
        VALUES (auth.uid(), v_today, v_buffs_today + 1, now())
        ON CONFLICT (user_id, day) DO UPDATE SET count = public.daily_buff_usage.count + 1, updated_at = now();
      UPDATE public.profiles SET last_buff_activated_at = v_now, updated_at = now() WHERE user_id = auth.uid();
      RETURN jsonb_build_object('kind','capped','message','Daily XP cap reached (1000 XP/day). Buff used but no XP awarded.','label',v_label,'rarity',v_item.rarity,'buffKey',v_item.item_key);
    END IF;
    v_new_xp := GREATEST(0, COALESCE(v_profile.xp, 0) + v_award);
    v_new_level := public.level_from_xp(v_new_xp);
    v_last_active := v_profile.last_active_date;
    v_new_streak := COALESCE(v_profile.streak, 0);
    IF v_last_active IS DISTINCT FROM v_today THEN
      IF v_last_active = v_yesterday THEN v_new_streak := v_new_streak + 1;
      ELSE v_new_streak := 1; END IF;
    END IF;
    UPDATE public.profiles
      SET xp = v_new_xp, level = v_new_level, streak = v_new_streak,
          last_active_date = v_today, last_buff_activated_at = v_now, updated_at = now()
      WHERE user_id = auth.uid();
    INSERT INTO public.daily_xp_progress (user_id, day, levels_gained, xp_gained, updated_at)
      VALUES (auth.uid(), v_today, GREATEST(0, v_new_level - v_old_level), v_xp_today + v_award, now())
      ON CONFLICT (user_id, day) DO UPDATE
        SET levels_gained = public.daily_xp_progress.levels_gained + GREATEST(0, v_new_level - v_old_level),
            xp_gained = public.daily_xp_progress.xp_gained + v_award,
            updated_at = now();
    INSERT INTO public.daily_buff_usage (user_id, day, count, updated_at)
      VALUES (auth.uid(), v_today, v_buffs_today + 1, now())
      ON CONFLICT (user_id, day) DO UPDATE SET count = public.daily_buff_usage.count + 1, updated_at = now();
    PERFORM public.refresh_weekly_score(auth.uid());
    DELETE FROM public.inventory WHERE id = v_item.id;
    RETURN jsonb_build_object('kind','instant','message',format('+%s XP instantly!', v_award),'label',v_label,'xpAward',v_award,'rarity',v_item.rarity,'buffKey',v_item.item_key);
  END IF;

  IF v_item.item_key = 'time_warp' THEN
    UPDATE public.active_buffs
      SET expires_at = CASE WHEN expires_at IS NULL THEN NULL
                            ELSE (v_now + ((expires_at - v_now) * 1.5)) END
      WHERE user_id = auth.uid() AND expires_at IS NOT NULL AND expires_at > v_now;
    UPDATE public.profiles SET last_buff_activated_at = v_now, updated_at = now() WHERE user_id = auth.uid();
    INSERT INTO public.daily_buff_usage (user_id, day, count, updated_at)
      VALUES (auth.uid(), v_today, v_buffs_today + 1, now())
      ON CONFLICT (user_id, day) DO UPDATE SET count = public.daily_buff_usage.count + 1, updated_at = now();
    DELETE FROM public.inventory WHERE id = v_item.id;
    RETURN jsonb_build_object('kind','time_warp','message','Time Warp activated','label',v_label,'rarity',v_item.rarity,'buffKey',v_item.item_key);
  END IF;

  SELECT COUNT(*) INTO v_live_count FROM public.active_buffs
    WHERE user_id = auth.uid() AND (expires_at IS NULL OR expires_at > v_now);
  IF v_live_count >= 3 THEN RAISE EXCEPTION 'Max 3 active buffs. Wait for one to expire'; END IF;

  INSERT INTO public.active_buffs (user_id, buff_key, rarity, multiplier, category, expires_at)
    VALUES (auth.uid(), v_item.item_key, v_item.rarity, v_multiplier, v_category,
      CASE WHEN v_duration > 0 THEN v_now + make_interval(mins => v_duration) ELSE NULL END);

  UPDATE public.profiles SET last_buff_activated_at = v_now, updated_at = now() WHERE user_id = auth.uid();
  INSERT INTO public.daily_buff_usage (user_id, day, count, updated_at)
    VALUES (auth.uid(), v_today, v_buffs_today + 1, now())
    ON CONFLICT (user_id, day) DO UPDATE SET count = public.daily_buff_usage.count + 1, updated_at = now();
  DELETE FROM public.inventory WHERE id = v_item.id;

  RETURN jsonb_build_object('kind','active','message',format('%s activated', v_label),
    'label',v_label,'rarity',v_item.rarity,'buffKey',v_item.item_key,
    'multiplier',v_multiplier,'category',v_category,
    'expiresAt', CASE WHEN v_duration > 0 THEN (v_now + make_interval(mins => v_duration)) ELSE NULL END);
END;
$function$;