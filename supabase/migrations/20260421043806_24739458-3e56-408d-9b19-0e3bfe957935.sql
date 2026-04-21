-- New level formula: lvl = max(1, floor(xp/100))
-- so xp 0..99 = lvl 1, xp 100..199 = lvl 1->2 boundary, xp 500 = lvl 5
CREATE OR REPLACE FUNCTION public.level_from_xp(_xp integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT GREATEST(1, _xp / 100);
$function$;