
-- ============ FULL DATA RESET ============
TRUNCATE TABLE public.messages CASCADE;
TRUNCATE TABLE public.group_members CASCADE;
TRUNCATE TABLE public.groups CASCADE;
TRUNCATE TABLE public.friend_requests CASCADE;
TRUNCATE TABLE public.friendships CASCADE;
TRUNCATE TABLE public.tasks CASCADE;
TRUNCATE TABLE public.events CASCADE;
TRUNCATE TABLE public.focus_sessions CASCADE;
TRUNCATE TABLE public.inventory CASCADE;
TRUNCATE TABLE public.active_buffs CASCADE;
TRUNCATE TABLE public.reviews CASCADE;
TRUNCATE TABLE public.daily_xp_progress CASCADE;

UPDATE public.profiles
SET xp = 0, level = 1, streak = 0, focus_streak = 0,
    pack_pity_count = 0, last_active_date = NULL,
    last_review_prompt_at = NULL,
    avatar = '{"outfit": "hoodie_basic", "effects": [], "accessories": [], "evolutionStage": "student"}'::jsonb;

-- ============ COOLDOWN + LOCK ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_task_xp_at TIMESTAMPTZ;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS awarded_xp BOOLEAN NOT NULL DEFAULT false;

-- ============ BADGES ============
CREATE TABLE IF NOT EXISTS public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🏆',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  badge_key TEXT NOT NULL REFERENCES public.badges(key) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_key)
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read badge catalog" ON public.badges
  FOR SELECT USING (true);

CREATE POLICY "Users read own badges" ON public.user_badges
  FOR SELECT USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE POLICY "Users unlock own badges" ON public.user_badges
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Seed 25 badges
INSERT INTO public.badges (key, title, description, category, icon, sort_order) VALUES
  ('first_step',        'First Step',        'Complete your first task',                    'onboarding', '🚀',  1),
  ('getting_started',   'Getting Started',   'Use AI Help for the first time',              'onboarding', '🤖',  2),
  ('locked_in',         'Locked In',         'Complete your first focus session',           'onboarding', '🎯',  3),
  ('organizer',         'Organizer',         'Create 5 tasks',                              'onboarding', '📋',  4),
  ('explorer',          'Explorer',          'Visit all main tabs',                         'onboarding', '🧭',  5),
  ('on_fire',           'On Fire',           '3-day streak',                                'streak',     '🔥',  6),
  ('consistent',        'Consistent',        '7-day streak',                                'streak',     '⚡',  7),
  ('unstoppable',       'Unstoppable',       '14-day streak',                               'streak',     '💥',  8),
  ('discipline_master', 'Discipline Master', '30-day streak',                               'streak',     '👑',  9),
  ('comeback_kid',      'Comeback Kid',      'Lose streak and return next day',             'streak',     '🌅', 10),
  ('deep_focus',        'Deep Focus',        'Complete 5 focus sessions',                   'focus',      '🧘', 11),
  ('zen_mode',          'Zen Mode',          'Complete a session with no tab switching',    'focus',      '☯️', 12),
  ('time_investor',     'Time Investor',     '2 hours total focus time',                    'focus',      '⏱️', 13),
  ('focus_beast',       'Focus Beast',       '10 hours total focus time',                   'focus',      '🦁', 14),
  ('marathon_mind',     'Marathon Mind',     'Complete a 50-minute session',                'focus',      '🏃', 15),
  ('curious_mind',      'Curious Mind',      'Ask 10 AI questions',                         'ai',         '🧠', 16),
  ('quick_learner',     'Quick Learner',     'Generate 5 task breakdowns',                  'ai',         '⚡', 17),
  ('test_taker',        'Test Taker',        'Complete 3 AI-generated tests',               'ai',         '📝', 18),
  ('knowledge_seeker',  'Knowledge Seeker',  'Generate 20 practice questions',              'ai',         '📚', 19),
  ('first_friend',      'First Friend',      'Add a friend',                                'social',     '🤝', 20),
  ('squad_member',      'Squad Member',      'Join a group chat',                           'social',     '👥', 21),
  ('collaborator',      'Collaborator',      'Send 10 messages in group chat',              'social',     '💬', 22),
  ('night_owl',         'Night Owl',         'Study after 12 AM',                           'special',    '🌙', 23),
  ('last_minute_hero',  'Last Minute Hero',  'Complete a task close to deadline',           'special',    '⏰', 24),
  ('lucky_break',       'Lucky Break',       'Open your first buff pack',                   'special',    '🎁', 25)
ON CONFLICT (key) DO NOTHING;

-- Track AI usage counts (for badge detection)
CREATE TABLE IF NOT EXISTS public.ai_usage (
  user_id UUID NOT NULL,
  kind TEXT NOT NULL,          -- 'tutor' | 'breakdown' | 'test' | 'practice'
  count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind)
);
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own ai usage S" ON public.ai_usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Own ai usage I" ON public.ai_usage FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own ai usage U" ON public.ai_usage FOR UPDATE USING (auth.uid() = user_id);

-- Track tabs visited (for Explorer badge)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS visited_tabs TEXT[] NOT NULL DEFAULT '{}';
