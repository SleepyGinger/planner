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
    const { userId, existingLocations } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const db = getFirebaseDb();
    const q = query(collection(db, "tasks"), where("userId", "==", userId));
    const snap = await getDocs(q);

    // Only target tasks that have NO tags
    const tasksWithoutTags = snap.docs.filter((d) => {
      const tags = d.data().tags;
      return !tags || !Array.isArray(tags) || tags.length === 0;
    });

    if (tasksWithoutTags.length === 0) {
      return NextResponse.json({ updated: 0 });
    }

    const locations: string[] = Array.isArray(existingLocations) ? existingLocations : [];
    const locationInstruction = locations.length > 0
      ? `You MUST only use locations from this list: ${JSON.stringify(locations)}. Do NOT invent new locations. If none fit, use an empty array.`
      : `Use simple lowercase location names like "home", "gym", "downtown", "park", "online", "store". If unclear, use an empty array.`;

    const taskData = tasksWithoutTags.map((d) => ({
      id: d.id,
      title: d.data().title,
      description: d.data().description || "",
    }));

    const message = await client.messages.create({
      model: "claude-opus-4-20250514",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: `For each task below, assign exactly ONE location where this task happens. ${locationInstruction}

Return ONLY a JSON array of objects with "id" and "tags" (array with 0 or 1 location string), one per task, in the same order.

Tasks:
${taskData.map((t, i) => `${i + 1}. [${t.id}] "${t.title}" - ${t.description}`).join("\n")}`,
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

    const results: { id: string; tags: string[] }[] = JSON.parse(jsonText);

    const batch = writeBatch(db);
    let updated = 0;
    for (const result of results) {
      if (result.id && Array.isArray(result.tags) && result.tags.length > 0) {
        batch.update(doc(db, "tasks", result.id), { tags: result.tags });
        updated++;
      }
    }
    await batch.commit();

    return NextResponse.json({ updated });
  } catch (error: unknown) {
    console.error("Add locations error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
