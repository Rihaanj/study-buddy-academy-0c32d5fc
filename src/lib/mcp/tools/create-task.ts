import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_task",
  title: "Create a study task",
  description: "Add a new task to the signed-in student's planner.",
  inputSchema: {
    title: z.string().trim().min(1).describe("What needs to be done."),
    subject: z.string().trim().min(1).optional().describe("Class or subject, e.g. Biology."),
    due_date: z.string().trim().optional().describe("Due date as an ISO date, e.g. 2026-09-15."),
    difficulty: z.enum(["easy", "medium", "hard"]).optional().describe("How hard the task is (default medium)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ title, subject, due_date, difficulty }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: ctx.getUserId(),
        title,
        subject: subject ?? null,
        due_date: due_date ?? null,
        difficulty: difficulty ?? "medium",
      })
      .select("id,title,subject,due_date,difficulty,completed")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { task: data } };
  },
});
