ALTER TABLE public.inventory REPLICA IDENTITY FULL;
ALTER TABLE public.active_buffs REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.active_buffs;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

CREATE OR REPLACE FUNCTION public.ensure_dm_chat_for_friendship()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ua uuid;
  ub uuid;
BEGIN
  ua := LEAST(NEW.user_a, NEW.user_b);
  ub := GREATEST(NEW.user_a, NEW.user_b);

  INSERT INTO public.dm_chats (user_a, user_b)
  VALUES (ua, ub)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS ensure_dm_chat_on_friendship ON public.friendships;
CREATE TRIGGER ensure_dm_chat_on_friendship
AFTER INSERT ON public.friendships
FOR EACH ROW
EXECUTE FUNCTION public.ensure_dm_chat_for_friendship();