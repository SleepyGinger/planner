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
} from "firebase/firestore";
import { getFirebaseDb } from "./firebase";
import { Task, Dump, ParsedTask } from "./types";

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
    ...parsed,
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
  dumpId: string | null
): Promise<string[]> {
  const ids: string[] = [];
  for (const t of tasks) {
    const id = await createTask(userId, t, dumpId);
    ids.push(id);
  }
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
