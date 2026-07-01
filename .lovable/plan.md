# AI Learning Experience — Full Build

Every question (typed or spoken) becomes a complete lesson: Explanation → Example → Key Takeaways → Common Mistakes → 3 YouTube videos → Notes → Quiz → Flashcards → Next Topic → Save.

## 1. Secrets
- Request `YOUTUBE_API_KEY` (YouTube Data API v3 key from Google Cloud Console).

## 2. Database
- New table `lessons` (user_id, topic, question, explanation, example, key_takeaways[], mistakes[], youtube_videos jsonb, notes, quiz jsonb, flashcards jsonb, next_topic, created_at). RLS: owner only.
- Add `profiles.grade_level` (text: `middle` | `high` | `college`).

## 3. Edge functions
- `youtube-search` — takes `topic`, queries YouTube Data API for `"<topic> explained"`, boosts whitelisted channels (Khan, CrashCourse, Organic Chemistry Tutor, Professor Dave, TED-Ed, MIT OCW), returns top 3 with title/channel/thumbnail/duration/url. JWT-verified.
- `ai-lesson` — takes `question` + user grade level, calls Lovable AI (`google/gemini-3-flash-preview`) with a strict JSON schema for the full lesson structure (explanation, example, key_takeaways, mistakes, notes, quiz [4 MCQs], flashcards [5 cards], next_topic). Then calls `youtube-search` and merges videos. Returns one JSON object. JWT-verified, ASCII-only, education-only safety policy preserved.

## 4. Frontend
- **Onboarding**: add a "What grade are you in?" step (middle/high/college); saved to profile. Existing users get a one-time modal.
- **AI Hub rewrite**: single question box → renders a `LessonView` with sections in the exact order requested. Each section is a card with the emoji header.
  - Videos: thumbnail cards with duration badge + Watch button.
  - Quiz: interactive MCQ with instant feedback + XP for correct answers (replaces current 3-Q gate).
  - Flashcards: click-to-flip cards.
  - Save button writes to `lessons` table + toast.
- **Global mic**: floating mic button in the top-right header (next to profile). Records → `voice-stt` → auto-submits to AI Hub → speaks the Explanation via `voice-tts`. Works on any page (navigates to /ai).
- **Saved Lessons**: small "My Notebook" section in AI Hub listing saved lessons; click to re-open.

## 5. Behavior rules
- Never short answers — always full structure.
- Difficulty auto-scaled from `profiles.grade_level`.
- Keep existing safety guardrails (education-focused, neutral on people).

## Technical notes
- YouTube quota: cache identical topic queries in `ai_history` metadata for 24h to save quota.
- Lesson JSON validated server-side before insert.
- Uses existing `voice-stt` / `voice-tts` functions; no new voice infra.
- Reuses existing XP/gamification for quiz rewards.

## Out of scope (ask if wanted)
- Video transcripts / in-app playback (just deep-link to YouTube for now).
- Multi-language lessons.
