CREATE OR REPLACE FUNCTION public.public_stats()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT json_build_object(
    'visitors', (SELECT COALESCE(value, 222) FROM public.app_counters WHERE key = 'visitors'),
    'focus_hours', 112 + FLOOR(COALESCE((SELECT SUM(duration_minutes) FROM public.focus_sessions), 0) / 60.0),
    'ai_uses', 383 + COALESCE((SELECT SUM(count) FROM public.ai_usage), 0),
    'students', (SELECT COUNT(*) FROM public.profiles)
  );
$function$;

CREATE OR REPLACE FUNCTION public.grant_owner_admin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF lower(COALESCE(NEW.raw_user_meta_data->>'login_key', '')) IN ('rihaan-y-jain')
     OR lower(COALESCE(NEW.raw_user_meta_data->>'recovery_email', '')) = 'rihaanjain2601@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;