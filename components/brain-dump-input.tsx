"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sparkles, Loader2, Plus } from "lucide-react";
import { ParsedTask, TaskCategory } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { createDumpWithTasks, createTasks, updateTask, getTasks } from "@/lib/firestore";
import { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const DURATION_OPTIONS = [
  { label: "Quick", value: 15 },
  { label: "Quarter day", value: 120 },
  { label: "Half day", value: 240 },
  { label: "Full day", value: 480 },
];

export function BrainDumpInput({ onTasksCreated, existingTags, minSortOrder = 0 }: { onTasksCreated?: () => void; existingTags?: string[]; minSortOrder?: number }) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Quick add state
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickCategory, setQuickCategory] = useState<TaskCategory>("errand");
  const [quickMinutes, setQuickMinutes] = useState(120);
  const [quickTags, setQuickTags] = useState("");

  // Existing tags from user's tasks (use prop if provided, otherwise fetch)
  const [fetchedTasks, setFetchedTasks] = useState<Task[]>([]);
  useEffect(() => {
    if (!existingTags && user) {
      getTasks(user.uid).then(setFetchedTasks);
    }
  }, [user, existingTags]);

  const allExistingTags = useMemo(() => {
    if (existingTags) return existingTags;
    const tagSet = new Set<string>();
    fetchedTasks.forEach((t) => t.tags?.forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [existingTags, fetchedTasks]);

  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleOrganizeAndSave = async () => {
    if (!text.trim()) return;
    if (!user) {
      setError("You must be signed in to save tasks. Please refresh and sign in again.");
      return;
    }
    setLoading(true);
    setError("");
    setSaveSuccess(false);

    try {
      const res = await fetch("/api/organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, existingLocations: allExistingTags, todayISO: new Date().toISOString().split("T")[0] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const tasks: ParsedTask[] = data.tasks;
      await createDumpWithTasks(user.uid, text, tasks, minSortOrder - tasks.length);
      setSaveSuccess(true);
      setText("");
      onTasksCreated?.();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: unknown) {
      console.error("Organize & save failed:", e);
      setError(e instanceof Error ? e.message : "Failed to organize and save");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAdd = async () => {
    if (!user || !quickTitle.trim()) return;
    setSaving(true);
    try {
      const tags = quickTags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      const title = quickTitle;
      const ids = await createTasks(
        user.uid,
        [
          {
            title,
            emoji: "\ud83d\udccc",
            description: "",
            category: quickCategory,
            estimatedMinutes: quickMinutes,
            tags,
          },
        ],
        null,
        minSortOrder - 1
      );
      setQuickTitle("");
      setQuickTags("");
      setQuickAddOpen(false);
      onTasksCreated?.();

      // Background: fetch AI emoji and update the task
      fetch("/api/emoji", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      })
        .then((res) => res.json())
        .then(({ emoji }) => {
          if (emoji && ids[0]) {
            updateTask(ids[0], { emoji }).then(() => onTasksCreated?.());
          }
        })
        .catch(() => {});
    } catch {
      setError("Failed to add task");
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="space-y-4">
        <Textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.metaKey) {
              e.preventDefault();
              handleOrganizeAndSave();
            }
          }}
          className="resize-none !text-5xl leading-relaxed min-h-[30vh]"
        />
        <div className="flex gap-4 justify-center max-w-md mx-auto">
          <Button
            onClick={handleOrganizeAndSave}
            disabled={!text.trim() || loading}
            size="lg"
            className="h-20 flex-1 rounded-2xl shadow-md hover:shadow-lg transition-all bg-violet-600 hover:bg-violet-700 text-white border-0 p-2"
          >
            {loading ? (
              <Loader2 className="!h-16 !w-16 animate-spin" />
            ) : (
              <Sparkles className="!h-16 !w-16" strokeWidth={2.5} />
            )}
          </Button>
          <Button
            size="lg"
            onClick={() => setQuickAddOpen(!quickAddOpen)}
            className="h-20 flex-1 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white border-0 p-2"
          >
            <Plus className="!h-16 !w-16" strokeWidth={2.5} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">
          {error}
        </div>
      )}

      {quickAddOpen && (
        <Card className="p-4 space-y-3">
          <Input
            placeholder="Task title"
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleQuickAdd()}
          />

          {/* Duration pills */}
          <div className="flex gap-2">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setQuickMinutes(opt.value)}
                className={cn(
                  "flex-1 text-xs py-2 rounded-lg border font-medium transition-colors",
                  quickMinutes === opt.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card hover:bg-accent border-border"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Locations */}
          {allExistingTags.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {allExistingTags.map((tag) => {
                const selected = quickTags
                  .split(",")
                  .map((t) => t.trim().toLowerCase())
                  .includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      const current = quickTags
                        .split(",")
                        .map((t) => t.trim().toLowerCase())
                        .filter(Boolean);
                      if (selected) {
                        setQuickTags(current.filter((t) => t !== tag).join(", "));
                      } else {
                        setQuickTags([...current, tag].join(", "));
                      }
                    }}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-full border transition-colors",
                      selected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card hover:bg-accent border-border"
                    )}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          )}
          <Input
            placeholder="..."
            value={quickTags}
            onChange={(e) => setQuickTags(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleQuickAdd()}
          />

          <Button onClick={handleQuickAdd} disabled={saving || !quickTitle.trim()} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Add Task
          </Button>
        </Card>
      )}

      {saveSuccess && (
        <div className="text-sm text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 rounded-md p-3">
          Tasks saved successfully!
        </div>
      )}

    </div>
  );
}
