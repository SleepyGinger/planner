import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { title } = await req.json();
    if (!title) {
      return NextResponse.json({ error: "Missing title" }, { status: 400 });
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16,
      messages: [
        {
          role: "user",
          content: `Reply with a single emoji that best represents this task. Be specific and creative. Task: "${title}"`,
        },
      ],
    });

    const content = message.content[0];
    const emoji =
      content.type === "text" ? content.text.trim() : "\ud83d\udccc";

    return NextResponse.json({ emoji });
  } catch {
    return NextResponse.json({ emoji: "\ud83d\udccc" });
  }
}
