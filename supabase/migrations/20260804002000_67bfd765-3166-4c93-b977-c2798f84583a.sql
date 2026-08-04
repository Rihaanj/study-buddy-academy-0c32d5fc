CREATE OR REPLACE FUNCTION public.grant_owner_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF lower(COALESCE(NEW.raw_user_meta_data->>'login_key', '')) IN ('rihaan-yeswant-jain','rihaan-jain')
     OR lower(COALESCE(NEW.raw_user_meta_data->>'recovery_email', '')) = 'rihaanjain2601@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

DELETE FROM public.user_roles ur
WHERE ur.role = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = ur.user_id
      AND (lower(COALESCE(p.login_key,'')) IN ('rihaan-yeswant-jain','rihaan-jain')
           OR lower(COALESCE(p.recovery_email,'')) = 'rihaanjain2601@gmail.com')
  );