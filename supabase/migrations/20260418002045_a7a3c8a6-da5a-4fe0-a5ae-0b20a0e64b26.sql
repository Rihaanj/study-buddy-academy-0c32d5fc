
-- ============ ADMIN ROLES ============
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role);
$$;

DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Auto-grant admin to the app owner on signup
CREATE OR REPLACE FUNCTION public.grant_owner_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF lower(NEW.email) = 'rihaanjain2601@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_grant_owner_admin ON auth.users;
CREATE TRIGGER trg_grant_owner_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.grant_owner_admin();

-- Backfill if owner already exists
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users
WHERE lower(email) = 'rihaanjain2601@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- ============ REVIEWS ============
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own review" ON public.reviews;
CREATE POLICY "Users insert own review" ON public.reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own review" ON public.reviews;
CREATE POLICY "Users update own review" ON public.reviews
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read all reviews" ON public.reviews;
CREATE POLICY "Admins read all reviews" ON public.reviews
  FOR SELECT USING (public.is_admin(auth.uid()) OR auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_reviews_updated_at ON public.reviews;
CREATE TRIGGER trg_reviews_updated_at
  BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Track per-user "next review prompt" milestones
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_review_prompt_at timestamptz,
  ADD COLUMN IF NOT EXISTS pack_pity_count int NOT NULL DEFAULT 0;

-- ============ DAILY XP / LEVEL CAP ============
CREATE TABLE IF NOT EXISTS public.daily_xp_progress (
  user_id uuid NOT NULL,
  day date NOT NULL,
  levels_gained int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);

ALTER TABLE public.daily_xp_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own daily progress S" ON public.daily_xp_progress;
CREATE POLICY "Own daily progress S" ON public.daily_xp_progress
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Own daily progress I" ON public.daily_xp_progress;
CREATE POLICY "Own daily progress I" ON public.daily_xp_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Own daily progress U" ON public.daily_xp_progress;
CREATE POLICY "Own daily progress U" ON public.daily_xp_progress
  FOR UPDATE USING (auth.uid() = user_id);

-- ============ PITY-AWARE PACK GRANT ============
CREATE OR REPLACE FUNCTION public.grant_packs_on_level_up()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  old_packs INT; new_packs INT; i INT;
  pack_rarity TEXT; roll FLOAT;
  pity INT;
BEGIN
  IF NEW.level IS NULL OR OLD.level IS NULL OR NEW.level <= OLD.level THEN
    RETURN NEW;
  END IF;
  old_packs := FLOOR(OLD.level / 2);
  new_packs := FLOOR(NEW.level / 2);
  IF new_packs > old_packs THEN
    pity := COALESCE(NEW.pack_pity_count, 0);
    FOR i IN (old_packs + 1)..new_packs LOOP
      pity := pity + 1;
      IF pity >= 10 THEN
        -- Guaranteed Epic+: epic 65% / legendary 25% / mythic 10%
        roll := random();
        IF roll < 0.10 THEN pack_rarity := 'mythic';
        ELSIF roll < 0.35 THEN pack_rarity := 'legendary';
        ELSE pack_rarity := 'epic';
        END IF;
        pity := 0;
      ELSE
        roll := random();
        IF roll < 0.02 THEN pack_rarity := 'mythic';
        ELSIF roll < 0.07 THEN pack_rarity := 'legendary';
        ELSIF roll < 0.20 THEN pack_rarity := 'epic';
        ELSIF roll < 0.50 THEN pack_rarity := 'rare';
        ELSE pack_rarity := 'common';
        END IF;
      END IF;
      INSERT INTO public.inventory (user_id, item_type, item_key, rarity, metadata)
      VALUES (NEW.user_id, 'pack', 'buff_pack', pack_rarity,
        jsonb_build_object('opened', false, 'awarded_at_level', i * 2, 'guaranteed', (pack_rarity IN ('epic','legendary','mythic') AND COALESCE(NEW.pack_pity_count,0)+1 >= 10)));
    END LOOP;
    UPDATE public.profiles SET pack_pity_count = pity WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END; $$;
