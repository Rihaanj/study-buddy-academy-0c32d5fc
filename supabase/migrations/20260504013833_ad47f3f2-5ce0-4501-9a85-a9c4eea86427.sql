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
  -- 10-second cooldown between activations (replaces old 4s + 10-min focus gate)
  IF v_last IS NOT NULL AND v_last > (v_now - interval '10 seconds') THEN
    RAISE EXCEPTION 'Wait 10 seconds before activating another buff';
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
    INSERT INTO public.daily_xp_progress (user_id, day, xp_gained, levels_gained, updated_at)
      VALUES (auth.uid(), v_today, v_award, GREATEST(0, v_new_level - v_old_level), now())
      ON CONFLICT (user_id, day) DO UPDATE SET
        xp_gained = public.daily_xp_progress.xp_gained + v_award,
        levels_gained = public.daily_xp_progress.levels_gained + GREATEST(0, v_new_level - v_old_level),
        updated_at = now();
    DELETE FROM public.inventory WHERE id = v_item.id;
    INSERT INTO public.daily_buff_usage (user_id, day, count, updated_at)
      VALUES (auth.uid(), v_today, v_buffs_today + 1, now())
      ON CONFLICT (user_id, day) DO UPDATE SET count = public.daily_buff_usage.count + 1, updated_at = now();
    RETURN jsonb_build_object('kind','instant','message', format('+%s XP from %s', v_award, v_label),'label',v_label,'rarity',v_item.rarity,'buffKey',v_item.item_key,'xpAwarded',v_award);
  END IF;

  -- Timed buff
  IF (SELECT COUNT(*) FROM public.active_buffs WHERE user_id = auth.uid()) >= 3 THEN
    RAISE EXCEPTION 'Max 3 active buffs. Wait for one to expire.';
  END IF;

  INSERT INTO public.active_buffs (user_id, buff_key, rarity, multiplier, category, expires_at, activated_at)
    VALUES (auth.uid(), v_item.item_key, v_item.rarity, v_multiplier, v_category,
            CASE WHEN v_duration > 0 THEN v_now + (v_duration || ' minutes')::interval ELSE NULL END,
            v_now);

  DELETE FROM public.inventory WHERE id = v_item.id;
  INSERT INTO public.daily_buff_usage (user_id, day, count, updated_at)
    VALUES (auth.uid(), v_today, v_buffs_today + 1, now())
    ON CONFLICT (user_id, day) DO UPDATE SET count = public.daily_buff_usage.count + 1, updated_at = now();
  UPDATE public.profiles SET last_buff_activated_at = v_now, updated_at = now() WHERE user_id = auth.uid();

  RETURN jsonb_build_object('kind','timed','message', format('%s active for %s min', v_label, v_duration),'label',v_label,'rarity',v_item.rarity,'buffKey',v_item.item_key,'durationMin',v_duration,'multiplier',v_multiplier);
END;
$function$;