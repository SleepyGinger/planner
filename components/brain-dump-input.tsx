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

export function BrainDumpInput({ onTasksCreated }: { onTasksCreated?: () => void }) {
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
  const [quickCategory, setQuickCategory] = useState<TaskCategory>("errands");
  const [quickPriority, setQuickPriority] = useState<1 | 2 | 3>(2);
  const [quickMinutes, setQuickMinutes] = useState(120);
  const [quickTags, setQuickTags] = useState("");

  // Existing tags from user's tasks
  const [existingTasks, setExistingTasks] = useState<Task[]>([]);
  useEffect(() => {
    if (user) {
      getTasks(user.uid).then(setExistingTasks);
    }
  }, [user]);

  const allExistingTags = useMemo(() => {
    const tagSet = new Set<string>();
    existingTasks.forEach((t) => t.tags?.forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [existingTasks]);

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

  const handleSaveAll = async () => {
    if (!user || parsedTasks.length === 0) return;
    setSaving(true);
    try {
      await createDumpWithTasks(user.uid, text, parsedTasks);
      setText("");
      setParsedTasks([]);
      onTasksCreated?.();
    } catch (e) {
      setError("Failed to save tasks");
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
        null
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
    <div className="space-y-4">
      <div className="space-y-2">
        <Textarea
          placeholder="Brain dump everything you want to do during your time off... errands, projects, things to learn, places to go, people to see..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          className="resize-none text-base"
        />
        <div className="flex gap-2">
          <Button
            onClick={handleOrganize}
            disabled={!text.trim() || loading}
            className="flex-1"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {loading ? "Organizing..." : "Organize with AI"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setQuickAddOpen(!quickAddOpen)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Quick Add
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
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={quickCategory}
              onValueChange={(v) => setQuickCategory(v as TaskCategory)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(quickPriority)}
              onValueChange={(v) => setQuickPriority(Number(v) as 1 | 2 | 3)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">High</SelectItem>
                <SelectItem value="2">Medium</SelectItem>
                <SelectItem value="3">Low</SelectItem>
              </SelectContent>
            </Select>
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

          {/* Tags */}
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
            placeholder="New tags (comma separated)"
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
          <div className="space-y-2">
            {parsedTasks.map((task, i) => (
              <Card key={i} className="p-3">
                {editingIndex === i ? (
                  <div className="space-y-2">
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
                    <div className="grid grid-cols-3 gap-2">
                      <Select
                        value={task.category}
                        onValueChange={(v) => updateParsedTask(i, { category: v as TaskCategory })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={String(task.priority)}
                        onValueChange={(v) => updateParsedTask(i, { priority: Number(v) as 1 | 2 | 3 })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">High</SelectItem>
                          <SelectItem value="2">Medium</SelectItem>
                          <SelectItem value="3">Low</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        value={task.estimatedMinutes}
                        onChange={(e) => updateParsedTask(i, { estimatedMinutes: Number(e.target.value) })}
                      />
                    </div>
                    {/* Tags editing */}
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
                      placeholder="Tags (comma separated)"
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
