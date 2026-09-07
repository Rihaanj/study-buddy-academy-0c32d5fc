import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listTasks from "./tools/list-tasks";
import createTask from "./tools/create-task";
import completeTask from "./tools/complete-task";
import listLessons from "./tools/list-lessons";
import getMyProgress from "./tools/get-my-progress";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "study-buddy-ai",
  title: "Study Buddy Ai",
  version: "0.1.0",
  instructions:
    "Tools for Study Bud AI, a student study app. Use `get_my_progress` for XP, level and streak, `list_tasks` / `create_task` / `complete_task` for the planner, and `list_lessons` for saved notebook lessons. All tools act as the signed-in student.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getMyProgress, listTasks, createTask, completeTask, listLessons],
});
