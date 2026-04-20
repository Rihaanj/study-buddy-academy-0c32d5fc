
-- Enable realtime for profiles, inventory, active_buffs so UI updates instantly
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.inventory REPLICA IDENTITY FULL;
ALTER TABLE public.active_buffs REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.active_buffs;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Auto-grant a pack every 2 levels (when level crosses an even threshold)
CREATE OR REPLACE FUNCTION public.grant_packs_on_level_up()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_packs INT;
  new_packs INT;
  i INT;
  pack_rarity TEXT;
  roll FLOAT;
BEGIN
  IF NEW.level IS NULL OR OLD.level IS NULL OR NEW.level <= OLD.level THEN
    RETURN NEW;
  END IF;
  old_packs := FLOOR(OLD.level / 2);
  new_packs := FLOOR(NEW.level / 2);
  IF new_packs > old_packs THEN
    FOR i IN (old_packs + 1)..new_packs LOOP
      roll := random();
      IF roll < 0.05 THEN pack_rarity := 'legendary';
      ELSIF roll < 0.20 THEN pack_rarity := 'epic';
      ELSIF roll < 0.50 THEN pack_rarity := 'rare';
      ELSE pack_rarity := 'common';
      END IF;
      INSERT INTO public.inventory (user_id, item_type, item_key, rarity, metadata)
      VALUES (NEW.user_id, 'pack', 'buff_pack', pack_rarity, jsonb_build_object('opened', false, 'awarded_at_level', i * 2));
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_packs_on_level_up ON public.profiles;
CREATE TRIGGER trg_grant_packs_on_level_up
AFTER UPDATE OF level ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.grant_packs_on_level_up();
