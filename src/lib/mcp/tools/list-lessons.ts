import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_lessons",
  title: "List saved lessons",
  description: "List lessons the signed-in student saved in their notebook, newest first.",
  inputSchema: {
    search: z.string().trim().min(1).optional().describe("Filter lessons whose topic contains this text."),
    limit: z.number().int().min(1).max(50).optional().describe("Maximum lessons to return (default 15)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("lessons")
      .select("id,topic,question,grade_level,key_takeaways,created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 15);
    if (search) query = query.ilike("topic", `%${search}%`);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { lessons: data ?? [] },
    };
  },
});
