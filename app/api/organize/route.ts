import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ParsedTask, CATEGORIES } from "@/lib/types";

const client = new Anthropic();

async function callWithRetry(params: Anthropic.MessageCreateParamsNonStreaming, retries = 3): Promise<Anthropic.Message> {
  for (let i = 0; i < retries; i++) {
    try {
      return await client.messages.create(params);
    } catch (err: unknown) {
      const isOverloaded = err instanceof Anthropic.APIError && err.status === 529;
      if (!isOverloaded || i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error("Unreachable");
}

export async function POST(req: NextRequest) {
  try {
    const { text, existingLocations, todayISO } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    const locations: string[] = Array.isArray(existingLocations) ? existingLocations : [];
    const locationInstruction = locations.length > 0
      ? `- tags: assign exactly ONE location from this list: ${JSON.stringify(locations)}. Do NOT invent new locations. If none fit, use an empty array.`
      : `- tags: assign exactly ONE location where this task happens (e.g. "home", "gym", "downtown", "park", "online"). Keep it lowercase, 1-2 words. If unclear, use an empty array.`;

    const today = todayISO || new Date().toISOString().split("T")[0];

    const message = await callWithRetry({
      model: "claude-opus-4-20250514",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: `You are a personal task organizer. Parse the following brain dump into structured tasks.

Today's date is ${today}.

For each task, provide:
- title: VERY short title, 2-3 words max. This is what shows on a card. Keep it punchy and scannable.
- emoji: a single emoji that best represents this specific task (be creative and specific, not generic)
- description: leave empty string ""
- notes: any extra details, context, specifics, or instructions that don't fit in the title. If the task is self-explanatory from the title alone, leave as empty string "". Most simple tasks need no notes. Only add notes when there are real details worth remembering.
- category: one of ${CATEGORIES.join(", ")}. Classification rules: arts/crafts/ceramics = fun, hanging with friends/social plans = fun, sports/surfing/outdoors = fun, reading/learning = fun or learning, museums/experiences = fun. Errands/chores/appointments/shopping/admin/logistics = errand. Building software/apps/creative projects = fun. Home maintenance/cleaning/organizing = errand. Health appointments = wellness. Default to errand if unsure.
- estimatedMinutes: one of these values only: 15 (quick task), 120 (quarter day), 240 (half day), or 480 (full day). Pick the closest fit.
${locationInstruction}
- plannedDate: If the brain dump mentions a specific date or says "today", "tomorrow", "monday", etc., resolve it to an ISO date (YYYY-MM-DD) relative to today (${today}). If no date is mentioned for a task, use null. When a date applies to all tasks in the dump (e.g. "for today:" at the top), apply it to every task.

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
