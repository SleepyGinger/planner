import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const db = getFirebaseDb();
    const q = query(collection(db, "tasks"), where("userId", "==", userId));
    const snap = await getDocs(q);

    const tasksToUpdate = snap.docs.filter((d) => !d.data().emoji);
    if (tasksToUpdate.length === 0) {
      return NextResponse.json({ updated: 0 });
    }

    const titles = tasksToUpdate.map((d) => d.data().title);

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `For each task title below, pick a single emoji that best represents that specific task. Be creative and specific, not generic.

Return ONLY a JSON array of strings (emojis), one per task, in the same order.

Tasks:
${titles.map((t, i) => `${i + 1}. ${t}`).join("\n")}`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      return NextResponse.json({ error: "Unexpected response" }, { status: 500 });
    }

    let jsonText = content.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const emojis: string[] = JSON.parse(jsonText);

    const batch = writeBatch(db);
    tasksToUpdate.forEach((d, i) => {
      if (emojis[i]) {
        batch.update(doc(db, "tasks", d.id), { emoji: emojis[i] });
      }
    });
    await batch.commit();

    return NextResponse.json({ updated: tasksToUpdate.length });
  } catch (error: unknown) {
    console.error("Backfill error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
