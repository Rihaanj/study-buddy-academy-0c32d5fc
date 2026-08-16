INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'admin'::public.app_role
FROM public.profiles p
WHERE lower(coalesce(p.name,'')) IN ('rihaan jain','rihaan yeswant jain')
   OR lower(coalesce(p.recovery_email,'')) = 'rihaanjain2601@gmail.com'
   OR lower(coalesce(p.login_key,'')) IN ('rihaan-jain','rihaan-yeswant-jain')
ON CONFLICT (user_id, role) DO NOTHING;