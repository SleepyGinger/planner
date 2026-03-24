"use client";

import { Task, CATEGORIES, TaskCategory } from "@/lib/types";
import { completeTask, uncompleteTask, deleteTask, updateTask } from "@/lib/firestore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Pencil, Clock, CalendarPlus } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/dates";
import { formatMinutes } from "@/lib/format";

const categoryEmoji: Record<TaskCategory, string> = {
  errand: "🏃",
  project: "🔨",
  wellness: "💆",
  fun: "🎉",
  learning: "📚",
};

interface TaskCardProps {
  task: Task;
  onUpdate: () => void;
  onPlanDate?: (taskId: string) => void;
  compact?: boolean;
}

export function TaskCard({ task, onUpdate, onPlanDate, compact }: TaskCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description);
  const [editCategory, setEditCategory] = useState<TaskCategory>(task.category);
  const [editMinutes, setEditMinutes] = useState(task.estimatedMinutes);

  const handleToggle = async () => {
    if (task.status === "todo") {
      await completeTask(task.id);
    } else {
      await uncompleteTask(task.id);
    }
    onUpdate();
  };

  const handleDelete = async () => {
    await deleteTask(task.id);
    onUpdate();
  };

  const handleSaveEdit = async () => {
    await updateTask(task.id, {
      title: editTitle,
      description: editDescription,
      category: editCategory,
      estimatedMinutes: editMinutes,
    });
    setEditOpen(false);
    onUpdate();
  };

  return (
    <Card
      className={cn(
        "p-3 transition-all",
        task.status === "done" && "opacity-60"
      )}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={task.status === "done"}
          onCheckedChange={handleToggle}
          className="mt-1"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {task.emoji && <span className="text-lg leading-none">{task.emoji}</span>}
            <span
              className={cn(
                "font-medium text-sm",
                task.status === "done" && "line-through"
              )}
            >
              {task.title}
            </span>
            <Badge variant="outline" className="text-xs">
              {categoryEmoji[task.category]} {task.category}
            </Badge>
          </div>
          {!compact && task.description && (
            <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
          )}
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatMinutes(task.estimatedMinutes)}
            </span>
            {task.plannedDate && (
              <span className="text-primary font-medium">
                {formatDate(task.plannedDate)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onPlanDate && task.status === "todo" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onPlanDate(task.id)}
            >
              <CalendarPlus className="h-3.5 w-3.5" />
            </Button>
          )}
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger
              render={<Button variant="ghost" size="icon" className="h-7 w-7" />}
            >
              <Pencil className="h-3.5 w-3.5" />
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Task</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 mt-2">
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Title"
                />
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Description"
                  rows={2}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    value={editCategory}
                    onValueChange={(v) => setEditCategory(v as TaskCategory)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {categoryEmoji[c]} {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  type="number"
                  value={editMinutes}
                  onChange={(e) => setEditMinutes(Number(e.target.value))}
                  placeholder="Estimated minutes"
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setEditOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveEdit}>Save</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
