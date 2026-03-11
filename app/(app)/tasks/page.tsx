"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getTasks } from "@/lib/firestore";
import { Task, CATEGORIES, TaskCategory, TaskStatus } from "@/lib/types";
import { TaskCard } from "@/components/task-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type SortBy = "priority" | "category" | "date" | "minutes";

export default function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<TaskCategory | "all">("all");
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "all">("all");
  const [sortBy, setSortBy] = useState<SortBy>("priority");

  const fetchTasks = async () => {
    if (!user) return;
    const t = await getTasks(user.uid);
    setTasks(t);
    setLoading(false);
  };

  useEffect(() => {
    fetchTasks();
  }, [user]);

  const filtered = tasks
    .filter((t) => filterCategory === "all" || t.category === filterCategory)
    .filter((t) => filterStatus === "all" || t.status === filterStatus)
    .sort((a, b) => {
      switch (sortBy) {
        case "priority":
          return a.priority - b.priority;
        case "category":
          return a.category.localeCompare(b.category);
        case "date":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "minutes":
          return b.estimatedMinutes - a.estimatedMinutes;
        default:
          return 0;
      }
    });

  const todoCount = tasks.filter((t) => t.status === "todo").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">All Tasks</h2>
        <p className="text-muted-foreground text-sm mt-1">
          {todoCount} to do, {doneCount} done
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Select
          value={filterCategory}
          onValueChange={(v) => setFilterCategory(v as TaskCategory | "all")}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filterStatus}
          onValueChange={(v) => setFilterStatus(v as TaskStatus | "all")}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="todo">To Do</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="priority">Priority</SelectItem>
            <SelectItem value="category">Category</SelectItem>
            <SelectItem value="date">Date Added</SelectItem>
            <SelectItem value="minutes">Time Est.</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {tasks.length === 0 ? "No tasks yet. Go dump your brain!" : "No tasks match your filters."}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => (
            <TaskCard key={task.id} task={task} onUpdate={fetchTasks} />
          ))}
        </div>
      )}
    </div>
  );
}
