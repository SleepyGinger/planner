import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { getFirebaseDb } from "./firebase";
import { Task, Dump, ParsedTask, CATEGORIES, TaskCategory } from "./types";

/** Strip unexpected fields and replace undefined with safe defaults so Firestore never rejects the write. */
function sanitizeParsedTask(t: ParsedTask): ParsedTask {
  return {
    title: t.title || "Untitled",
    emoji: t.emoji || "\ud83d\udccc",
    description: t.description || "",
    category: CATEGORIES.includes(t.category as TaskCategory) ? t.category : "errand",
    estimatedMinutes: typeof t.estimatedMinutes === "number" ? t.estimatedMinutes : 120,
    tags: Array.isArray(t.tags) ? t.tags.filter((tag): tag is string => typeof tag === "string") : [],
    notes: typeof t.notes === "string" ? t.notes : "",
    plannedDate: typeof t.plannedDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.plannedDate) ? t.plannedDate : null,
  };
}

function tasksCol() {
  return collection(getFirebaseDb(), "tasks");
}

function dumpsCol() {
  return collection(getFirebaseDb(), "dumps");
}

// ---- Dumps ----

export async function createDump(userId: string, rawText: string): Promise<string> {
  const ref = await addDoc(dumpsCol(), {
    rawText,
    userId,
    createdAt: new Date().toISOString(),
  });
  return ref.id;
}

export async function createDumpWithTasks(
  userId: string,
  rawText: string,
  tasks: ParsedTask[],
  startSortOrder: number = 0
): Promise<{ dumpId: string; taskIds: string[] }> {
  const db = getFirebaseDb();
  const batch = writeBatch(db);
  const now = new Date().toISOString();

  const dumpRef = doc(collection(db, "dumps"));
  batch.set(dumpRef, { rawText, userId, createdAt: now });

  const taskIds: string[] = [];
  for (let i = 0; i < tasks.length; i++) {
    const sanitized = sanitizeParsedTask(tasks[i]);
    const ref = doc(collection(db, "tasks"));
    batch.set(ref, {
      ...sanitized,
      status: "todo",
      plannedDate: sanitized.plannedDate || null,
      dumpId: dumpRef.id,
      userId,
      createdAt: now,
      completedAt: null,
      sortOrder: startSortOrder + i,
    });
    taskIds.push(ref.id);
  }

  await batch.commit();
  return { dumpId: dumpRef.id, taskIds };
}

export async function getDumps(userId: string): Promise<Dump[]> {
  const q = query(
    dumpsCol(),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Dump));
}

// ---- Tasks ----

export async function createTask(
  userId: string,
  parsed: ParsedTask,
  dumpId: string | null
): Promise<string> {
  const ref = await addDoc(tasksCol(), {
    ...sanitizeParsedTask(parsed),
    status: "todo",
    plannedDate: null,
    dumpId,
    userId,
    createdAt: new Date().toISOString(),
    completedAt: null,
  });
  return ref.id;
}

export async function createTasks(
  userId: string,
  tasks: ParsedTask[],
  dumpId: string | null,
  startSortOrder: number = 0
): Promise<string[]> {
  const db = getFirebaseDb();
  const batch = writeBatch(db);
  const now = new Date().toISOString();
  const ids: string[] = [];

  for (let i = 0; i < tasks.length; i++) {
    const sanitized = sanitizeParsedTask(tasks[i]);
    const ref = doc(collection(db, "tasks"));
    batch.set(ref, {
      ...sanitized,
      status: "todo",
      plannedDate: sanitized.plannedDate || null,
      dumpId,
      userId,
      createdAt: now,
      completedAt: null,
      sortOrder: startSortOrder + i,
    });
    ids.push(ref.id);
  }

  await batch.commit();
  return ids;
}

export async function getTasks(userId: string): Promise<Task[]> {
  const q = query(
    tasksCol(),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task));
}

export async function updateTask(
  taskId: string,
  data: Partial<Omit<Task, "id">>
): Promise<void> {
  await updateDoc(doc(getFirebaseDb(), "tasks", taskId), data);
}

export async function deleteTask(taskId: string): Promise<void> {
  await deleteDoc(doc(getFirebaseDb(), "tasks", taskId));
}

export async function completeTask(taskId: string): Promise<void> {
  await updateDoc(doc(getFirebaseDb(), "tasks", taskId), {
    status: "done",
    completedAt: new Date().toISOString(),
  });
}

export async function uncompleteTask(taskId: string): Promise<void> {
  await updateDoc(doc(getFirebaseDb(), "tasks", taskId), {
    status: "todo",
    completedAt: null,
  });
}

export async function planTask(taskId: string, date: string): Promise<void> {
  await updateDoc(doc(getFirebaseDb(), "tasks", taskId), { plannedDate: date });
}

export async function unplanTask(taskId: string): Promise<void> {
  await updateDoc(doc(getFirebaseDb(), "tasks", taskId), { plannedDate: null });
}

export async function reorderTasks(
  orderedIds: string[]
): Promise<void> {
  const db = getFirebaseDb();
  const batch = writeBatch(db);
  orderedIds.forEach((id, index) => {
    batch.update(doc(db, "tasks", id), { sortOrder: index });
  });
  await batch.commit();
}

export async function reorderPlannedTasks(
  orderedIds: string[]
): Promise<void> {
  const db = getFirebaseDb();
  const batch = writeBatch(db);
  orderedIds.forEach((id, index) => {
    batch.update(doc(db, "tasks", id), { plannedSortOrder: index });
  });
  await batch.commit();
}
