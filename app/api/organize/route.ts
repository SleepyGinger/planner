import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ParsedTask, CATEGORIES } from "@/lib/types";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: `You are a personal task organizer. Parse the following brain dump into structured tasks.

For each task, provide:
- title: short, actionable title
- emoji: a single emoji that best represents this specific task (be creative and specific, not generic)
- description: brief description (1 sentence)
- category: one of ${CATEGORIES.join(", ")} — errand (chores, admin, errands), project (building, creating), wellness (health, fitness, self-care), fun (social, experiences, entertainment), learning (reading, courses, skills)
- priority: 1 (must do), 2 (should do), or 3 (could do)
- estimatedMinutes: one of these values only: 15 (quick task), 120 (quarter day), 240 (half day), or 480 (full day). Pick the closest fit.
- tags: array of LOCATIONS where this task happens (e.g. "home", "gym", "downtown", "park", "online"). Keep tags lowercase, 1-2 words max. Only include relevant locations, can be empty array.

Return ONLY valid JSON — an array of task objects. No markdown, no explanation.

Brain dump:
${text}`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      return NextResponse.json({ error: "Unexpected response" }, { status: 500 });
    }

    // Parse, stripping any markdown fences the model might add
    let jsonText = content.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const tasks: ParsedTask[] = JSON.parse(jsonText);

    return NextResponse.json({ tasks });
  } catch (error: unknown) {
    console.error("Organize error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
