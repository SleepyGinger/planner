"use client";

import { useState } from "react";
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
import { createDump, createTasks } from "@/lib/firestore";

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
  const [quickMinutes, setQuickMinutes] = useState(30);

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
      const dumpId = await createDump(user.uid, text);
      await createTasks(user.uid, parsedTasks, dumpId);
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
      await createTasks(
        user.uid,
        [
          {
            title: quickTitle,
            description: "",
            category: quickCategory,
            priority: quickPriority,
            estimatedMinutes: quickMinutes,
          },
        ],
        null
      );
      setQuickTitle("");
      setQuickAddOpen(false);
      onTasksCreated?.();
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
          <div className="grid grid-cols-3 gap-2">
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
            <Input
              type="number"
              value={quickMinutes}
              onChange={(e) => setQuickMinutes(Number(e.target.value))}
              placeholder="min"
            />
          </div>
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
                    <Input
                      value={task.title}
                      onChange={(e) => updateParsedTask(i, { title: e.target.value })}
                    />
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
                    <Button size="sm" onClick={() => setEditingIndex(null)}>
                      Done
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{task.title}</span>
                        <Badge variant="outline" className="text-xs">{task.category}</Badge>
                        <Badge variant="secondary" className="text-xs">P{task.priority}</Badge>
                        <span className="text-xs text-muted-foreground">{formatMinutes(task.estimatedMinutes)}</span>
                      </div>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {task.description}
                        </p>
                      )}
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
