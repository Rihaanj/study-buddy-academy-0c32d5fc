import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_tasks",
  title: "List study tasks",
  description: "List the signed-in student's planner tasks, newest first.",
  inputSchema: {
    only_open: z.boolean().optional().describe("When true, only return tasks that are not completed."),
    limit: z.number().int().min(1).max(100).optional().describe("Maximum number of tasks to return (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ only_open, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("tasks")
      .select("id,title,subject,due_date,completed,difficulty,priority_score,created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 25);
    if (only_open) query = query.eq("completed", false);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { tasks: data ?? [] },
    };
  },
});
