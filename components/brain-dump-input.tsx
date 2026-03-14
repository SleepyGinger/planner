"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Loader2, Plus, Check, X, Pencil } from "lucide-react";
import { ParsedTask, CATEGORIES, TaskCategory } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { formatMinutes } from "@/lib/format";
import { createDumpWithTasks, createTasks, updateTask, getTasks } from "@/lib/firestore";
import { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const DURATION_OPTIONS = [
  { label: "Quick", value: 15 },
  { label: "Quarter day", value: 120 },
  { label: "Half day", value: 240 },
  { label: "Full day", value: 480 },
];

export function BrainDumpInput({ onTasksCreated, existingTags, maxSortOrder = 0 }: { onTasksCreated?: () => void; existingTags?: string[]; maxSortOrder?: number }) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsedTasks, setParsedTasks] = useState<ParsedTask[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Quick add state
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickCategory, setQuickCategory] = useState<TaskCategory>("errand");
  const [quickPriority, setQuickPriority] = useState<1 | 2 | 3>(2);
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

  const handleOrganize = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    setParsedTasks([]);

    try {
      const res = await fetch("/api/organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setParsedTasks(data.tasks);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to organize");
    } finally {
      setLoading(false);
    }
  };

  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveAll = async () => {
    if (!user) {
      setError("You must be signed in to save tasks. Please refresh and sign in again.");
      return;
    }
    if (parsedTasks.length === 0) return;
    setSaving(true);
    setError("");
    setSaveSuccess(false);
    try {
      await createDumpWithTasks(user.uid, text, parsedTasks, maxSortOrder + 1);
      setSaveSuccess(true);
      setText("");
      setParsedTasks([]);
      onTasksCreated?.();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error("Save failed:", e);
      setError(
        `Failed to save tasks: ${e instanceof Error ? e.message : "Unknown error"}. Your tasks are still listed below — try again.`
      );
    } finally {
      setSaving(false);
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
            priority: quickPriority,
            estimatedMinutes: quickMinutes,
            tags,
          },
        ],
        null,
        maxSortOrder + 1
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

  const removeTask = (index: number) => {
    setParsedTasks((prev) => prev.filter((_, i) => i !== index));
  };

  const updateParsedTask = (index: number, updates: Partial<ParsedTask>) => {
    setParsedTasks((prev) =>
      prev.map((t, i) => (i === index ? { ...t, ...updates } : t))
    );
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="space-y-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={20}
          className="resize-none text-xl lg:text-2xl leading-relaxed"
        />
        <div className="flex gap-4 justify-center">
          <Button
            onClick={handleOrganize}
            disabled={!text.trim() || loading}
            size="lg"
            className="h-20 flex-1 rounded-2xl shadow-md hover:shadow-lg transition-all"
          >
            {loading ? (
              <Loader2 className="h-9 w-9 animate-spin" />
            ) : (
              <Sparkles className="h-9 w-9" />
            )}
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => setQuickAddOpen(!quickAddOpen)}
            className="h-20 flex-1 rounded-2xl"
          >
            <Plus className="h-9 w-9" />
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

          {/* Category pills */}
          <div className="flex gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setQuickCategory(c)}
                className={cn(
                  "flex-1 text-xs py-2 rounded-lg border font-medium transition-colors capitalize",
                  quickCategory === c
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card hover:bg-accent border-border"
                )}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Priority pills */}
          <div className="flex gap-2">
            {([
              { value: 1 as const, label: "Must" },
              { value: 2 as const, label: "Should" },
              { value: 3 as const, label: "Could" },
            ]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setQuickPriority(opt.value)}
                className={cn(
                  "flex-1 text-xs py-2 rounded-lg border font-medium transition-colors",
                  quickPriority === opt.value
                    ? opt.value === 1
                      ? "bg-red-600 text-white border-red-600"
                      : opt.value === 2
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-foreground border-muted"
                    : "bg-card hover:bg-accent border-border"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

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

      {parsedTasks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">
              Parsed {parsedTasks.length} tasks — review & save
            </h3>
            <Button onClick={handleSaveAll} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Save All
            </Button>
          </div>
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">
              {error}
            </div>
          )}
          <div className="space-y-2">
            {parsedTasks.map((task, i) => (
              <Card key={i} className="p-3">
                {editingIndex === i ? (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        value={task.emoji}
                        onChange={(e) => updateParsedTask(i, { emoji: e.target.value })}
                        className="w-16 text-center text-xl"
                        placeholder="\ud83d\udccc"
                      />
                      <Input
                        value={task.title}
                        onChange={(e) => updateParsedTask(i, { title: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                    <Input
                      value={task.description}
                      onChange={(e) => updateParsedTask(i, { description: e.target.value })}
                      placeholder="Description"
                    />
                    {/* Category pills */}
                    <div className="flex gap-2">
                      {CATEGORIES.map((c) => (
                        <button
                          key={c}
                          onClick={() => updateParsedTask(i, { category: c })}
                          className={cn(
                            "flex-1 text-xs py-2 rounded-lg border font-medium transition-colors capitalize",
                            task.category === c
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card hover:bg-accent border-border"
                          )}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                    {/* Priority pills */}
                    <div className="flex gap-2">
                      {([
                        { value: 1 as const, label: "Must" },
                        { value: 2 as const, label: "Should" },
                        { value: 3 as const, label: "Could" },
                      ]).map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => updateParsedTask(i, { priority: opt.value })}
                          className={cn(
                            "flex-1 text-xs py-2 rounded-lg border font-medium transition-colors",
                            task.priority === opt.value
                              ? opt.value === 1
                                ? "bg-red-600 text-white border-red-600"
                                : opt.value === 2
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted text-foreground border-muted"
                              : "bg-card hover:bg-accent border-border"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {/* Duration pills */}
                    <div className="flex gap-2">
                      {DURATION_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => updateParsedTask(i, { estimatedMinutes: opt.value })}
                          className={cn(
                            "flex-1 text-xs py-2 rounded-lg border font-medium transition-colors",
                            task.estimatedMinutes === opt.value
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card hover:bg-accent border-border"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {/* Location editing */}
                    <Input
                      value={(task.tags || []).join(", ")}
                      onChange={(e) =>
                        updateParsedTask(i, {
                          tags: e.target.value
                            .split(",")
                            .map((t) => t.trim().toLowerCase())
                            .filter(Boolean),
                        })
                      }
                      placeholder="..."
                    />
                    <Button size="sm" onClick={() => setEditingIndex(null)}>
                      Done
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{task.emoji || "\ud83d\udccc"}</span>
                      <div>
                        <span className="font-bold text-sm">{task.title}</span>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <Badge variant="outline" className="text-xs">{task.category}</Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              task.priority === 1 && "border-red-400 text-red-600 dark:text-red-400",
                              task.priority === 3 && "text-muted-foreground"
                            )}
                          >
                            {task.priority === 1 ? "Must" : task.priority === 2 ? "Should" : "Could"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{formatMinutes(task.estimatedMinutes)}</span>
                          {(task.tags || []).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-[10px]">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingIndex(i)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeTask(i)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
