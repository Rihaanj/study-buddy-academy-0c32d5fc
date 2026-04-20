CREATE OR REPLACE FUNCTION public.grant_packs_on_level_up()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
      IF roll < 0.02 THEN pack_rarity := 'mythic';
      ELSIF roll < 0.07 THEN pack_rarity := 'legendary';
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
$function$;