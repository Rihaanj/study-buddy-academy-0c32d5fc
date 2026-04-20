ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS image_url TEXT;

CREATE POLICY "Creators can update group"
ON public.groups
FOR UPDATE
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);