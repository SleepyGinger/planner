"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getTasks,
  completeTask,
  uncompleteTask,
  deleteTask,
  updateTask,
  reorderTasks,
  reorderPlannedTasks,
  planTask,
  unplanTask,
} from "@/lib/firestore";
import { Task, CATEGORIES, TaskCategory } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Check,
  Trash2,
  Sparkles,
  Undo2,
  GripVertical,
  MapPin,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  CalendarPlus,
  CalendarMinus,
  StickyNote,
} from "lucide-react";
import { BrainDumpInput } from "@/components/brain-dump-input";
import { Celebration } from "@/components/celebration";
import { formatMinutes } from "@/lib/format";
import {
  getUsableDays,
  getDaysRemaining,
  formatDate,
  formatDateShort,
  getTodayISO,
  isToday,
} from "@/lib/dates";
import { parseISO, isWeekend as isWeekendDate } from "date-fns";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useDroppable,
  pointerWithin,
  CollisionDetection,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const GREEN_TO_RED = [
  ["text-green-500", "bg-green-500"],     // 0-9%
  ["text-green-400", "bg-green-400"],     // 10-19%
  ["text-lime-500", "bg-lime-500"],       // 20-29%
  ["text-lime-400", "bg-lime-400"],       // 30-39%
  ["text-yellow-500", "bg-yellow-500"],   // 40-49%
  ["text-yellow-600", "bg-yellow-600"],   // 50-59%
  ["text-amber-500", "bg-amber-500"],     // 60-69%
  ["text-orange-500", "bg-orange-500"],   // 70-79%
  ["text-orange-600", "bg-orange-600"],   // 80-89%
  ["text-red-500", "bg-red-500"],         // 90-100%
];

const RED_TO_GREEN = [
  ["text-red-500", "bg-red-500"],         // 0-9%
  ["text-orange-600", "bg-orange-600"],   // 10-19%
  ["text-orange-500", "bg-orange-500"],   // 20-29%
  ["text-amber-500", "bg-amber-500"],     // 30-39%
  ["text-yellow-600", "bg-yellow-600"],   // 40-49%
  ["text-yellow-500", "bg-yellow-500"],   // 50-59%
  ["text-lime-400", "bg-lime-400"],       // 60-69%
  ["text-lime-500", "bg-lime-500"],       // 70-79%
  ["text-green-400", "bg-green-400"],     // 80-89%
  ["text-green-500", "bg-green-500"],     // 90-100%
];

function getPctIndex(pct: number): number {
  return Math.min(Math.floor(pct / 10), 9);
}

function getGreenToRedColor(pct: number): string {
  return GREEN_TO_RED[getPctIndex(pct)][0];
}

function getGreenToRedBg(pct: number): string {
  return GREEN_TO_RED[getPctIndex(pct)][1];
}

function getRedToGreenColor(pct: number): string {
  return RED_TO_GREEN[getPctIndex(pct)][0];
}

function getRedToGreenBg(pct: number): string {
  return RED_TO_GREEN[getPctIndex(pct)][1];
}

function TagEditor({
  taskId,
  tags,
  allTags,
  onUpdate,
}: {
  taskId: string;
  tags: string[];
  allTags: string[];
  onUpdate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");

  const suggestions = allTags.filter(
    (t) => !tags.includes(t) && t.toLowerCase().includes(input.toLowerCase())
  );

  const addTag = async (tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (!trimmed || tags.includes(trimmed)) return;
    await updateTask(taskId, { tags: [...tags, trimmed] });
    setInput("");
    onUpdate();
  };

  const removeTag = async (tag: string) => {
    await updateTask(taskId, { tags: tags.filter((t) => t !== tag) });
    onUpdate();
  };

  if (!open) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="rounded-full bg-muted p-2 hover:bg-accent transition-colors"
        title="Edit location"
      >
        <MapPin className="h-5 w-5 lg:h-6 lg:w-6 text-muted-foreground" />
      </button>
    );
  }

  return (
    <div
      className="absolute inset-0 z-10 rounded-xl bg-card border p-2 flex flex-col gap-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1 flex-wrap">
        {tags.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="text-[10px] pl-1.5 pr-0.5 py-0 gap-0.5"
          >
            {tag}
            <button onClick={() => removeTag(tag)} className="hover:text-destructive">
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-1">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) {
              addTag(input);
            }
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Add location..."
          className="h-6 text-xs px-1.5"
          autoFocus
        />
        <button
          onClick={() => setOpen(false)}
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      </div>
      {input && suggestions.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {suggestions.slice(0, 5).map((s) => (
            <button
              key={s}
              onClick={() => addTag(s)}
              className="text-[10px] px-1.5 py-0.5 rounded bg-accent hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EmojiEditor({
  taskId,
  emoji,
  onUpdate,
}: {
  taskId: string;
  emoji: string;
  onUpdate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(emoji);

  if (!editing) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
        className="text-3xl lg:text-5xl 2xl:text-6xl leading-none mb-1.5 lg:mb-2 select-none hover:scale-110 transition-transform cursor-pointer"
        title="Click to change emoji"
      >
        {emoji || "\ud83d\udccc"}
      </button>
    );
  }

  return (
    <div className="mb-1.5 lg:mb-2" onClick={(e) => e.stopPropagation()}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={async (e) => {
          if (e.key === "Enter") {
            await updateTask(taskId, { emoji: value });
            setEditing(false);
            onUpdate();
          }
          if (e.key === "Escape") {
            setValue(emoji);
            setEditing(false);
          }
        }}
        onBlur={async () => {
          if (value !== emoji) {
            await updateTask(taskId, { emoji: value });
            onUpdate();
          }
          setEditing(false);
        }}
        className="w-16 h-12 lg:w-20 lg:h-16 text-3xl lg:text-5xl text-center bg-accent rounded-lg border outline-none"
        autoFocus
      />
    </div>
  );
}

function TitleEditor({
  taskId,
  title,
  onUpdate,
}: {
  taskId: string;
  title: string;
  onUpdate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);

  if (!editing) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
        className="font-bold text-sm lg:text-base 2xl:text-lg leading-tight line-clamp-2 select-none hover:text-primary transition-colors cursor-pointer"
        title="Click to edit"
      >
        {title}
      </button>
    );
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={async (e) => {
          if (e.key === "Enter" && value.trim()) {
            await updateTask(taskId, { title: value.trim() });
            setEditing(false);
            onUpdate();
          }
          if (e.key === "Escape") {
            setValue(title);
            setEditing(false);
          }
        }}
        onBlur={async () => {
          if (value.trim() && value !== title) {
            await updateTask(taskId, { title: value.trim() });
            onUpdate();
          }
          setEditing(false);
        }}
        className="w-full text-sm lg:text-base font-bold text-center bg-accent rounded-lg border px-2 py-1 outline-none"
        autoFocus
      />
    </div>
  );
}

function NotesEditor({
  taskId,
  notes,
  onUpdate,
}: {
  taskId: string;
  notes: string;
  onUpdate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(notes);

  if (!open) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setValue(notes);
          setOpen(true);
        }}
        className={cn(
          "w-full mt-1.5",
          notes
            ? "text-[11px] lg:text-xs text-muted-foreground text-left line-clamp-2 hover:text-foreground transition-colors cursor-pointer"
            : "rounded-full bg-muted p-1 w-auto hover:bg-accent transition-colors"
        )}
        title={notes ? "Click to edit notes" : "Add notes"}
      >
        {notes ? (
          notes
        ) : (
          <StickyNote className="h-3 w-3 lg:h-3.5 lg:w-3.5 text-muted-foreground" />
        )}
      </button>
    );
  }

  return (
    <div
      className="absolute inset-0 z-10 rounded-xl bg-card border p-2 flex flex-col gap-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setValue(notes);
            setOpen(false);
          }
        }}
        placeholder="Jot down notes..."
        className="flex-1 text-xs bg-transparent resize-none outline-none min-h-[60px]"
        autoFocus
      />
      <div className="flex gap-1 justify-end">
        <button
          onClick={() => {
            setValue(notes);
            setOpen(false);
          }}
          className="text-xs px-2 py-1 rounded text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
        <button
          onClick={async () => {
            await updateTask(taskId, { notes: value.trim() });
            setOpen(false);
            onUpdate();
          }}
          className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function SortableTaskCard({
  task,
  allTags,
  selectedDate,
  onComplete,
  onDelete,
  onUpdate,
  onPlan,
  onUnplan,
}: {
  task: Task;
  allTags: string[];
  selectedDate: string;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: () => void;
  onPlan: (id: string) => void;
  onUnplan: (id: string) => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const tags = task.tags || [];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-xl border bg-card p-3 lg:p-4 flex flex-col items-center text-center transition-shadow hover:shadow-md",
        task.priority === 1 && "border-2 border-red-400 dark:border-red-700",
        task.priority === 3 && "border-muted",
        isDragging && "opacity-30"
      )}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-1 left-1 lg:top-2 lg:left-2 cursor-grab active:cursor-grabbing touch-none p-1.5 lg:p-1 rounded opacity-60 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
      </div>

      <EmojiEditor taskId={task.id} emoji={task.emoji || "\ud83d\udccc"} onUpdate={onUpdate} />
      <TitleEditor taskId={task.id} title={task.title} onUpdate={onUpdate} />
      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex gap-1 flex-wrap justify-center mt-1.5">
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="text-[10px] lg:text-xs px-1.5 py-0"
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Notes */}
      <NotesEditor taskId={task.id} notes={task.notes || ""} onUpdate={onUpdate} />


      {/* Actions — pinned to bottom of card */}
      <div className="flex justify-around mt-auto pt-2 w-full">
        {task.plannedDate === selectedDate ? (
          <button
            onClick={() => onUnplan(task.id)}
            className="rounded-full bg-orange-100 dark:bg-orange-900 p-2 hover:bg-orange-200 dark:hover:bg-orange-800 transition-colors"
            title="Unplan from this day"
          >
            <CalendarMinus className="h-5 w-5 lg:h-6 lg:w-6 text-orange-700 dark:text-orange-300" />
          </button>
        ) : (
          <button
            onClick={() => onPlan(task.id)}
            className="rounded-full bg-blue-100 dark:bg-blue-900 p-2 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
            title={`Plan for ${formatDateShort(selectedDate)}`}
          >
            <CalendarPlus className="h-5 w-5 lg:h-6 lg:w-6 text-blue-700 dark:text-blue-300" />
          </button>
        )}
        <TagEditor
          taskId={task.id}
          tags={tags}
          allTags={allTags}
          onUpdate={onUpdate}
        />
        <button
          onClick={() => onComplete(task.id)}
          className="rounded-full bg-green-100 dark:bg-green-900 p-2 hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
          title="Mark done"
        >
          <Check className="h-5 w-5 lg:h-6 lg:w-6 text-green-700 dark:text-green-300" />
        </button>
      </div>

      {/* Delete — top right with confirmation */}
      {confirmingDelete ? (
        <div className="absolute top-1 right-1 lg:top-2 lg:right-2 flex gap-0.5 lg:gap-1 animate-in fade-in duration-150">
          <button
            onClick={() => onDelete(task.id)}
            className="rounded-full bg-red-500 dark:bg-red-600 p-1 hover:bg-red-600 dark:hover:bg-red-700 transition-colors"
            title="Confirm delete"
          >
            <Check className="h-3.5 w-3.5 text-white" />
          </button>
          <button
            onClick={() => setConfirmingDelete(false)}
            className="rounded-full bg-muted p-1 hover:bg-accent transition-colors"
            title="Cancel"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmingDelete(true)}
          className="absolute top-1 right-1 lg:top-2 lg:right-2 rounded-full bg-red-100 dark:bg-red-900 p-1 hover:bg-red-200 dark:hover:bg-red-800 transition-colors opacity-60 lg:opacity-0 lg:group-hover:opacity-100"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5 text-red-700 dark:text-red-300" />
        </button>
      )}
    </div>
  );
}

const DAY_PLAN_ZONE_ID = "day-plan-zone";
const PLAN_PREFIX = "plan-";

function SortablePlannedCard({
  task,
  onComplete,
  onUncomplete,
  onUnplan,
  onDelete,
  onUpdate,
}: {
  task: Task;
  onComplete: (id: string) => void;
  onUncomplete: (id: string) => void;
  onUnplan: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: () => void;
}) {
  const isDone = task.status === "done";
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `${PLAN_PREFIX}${task.id}`, disabled: isDone });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group/planned relative rounded-xl border bg-background p-3 lg:p-4 flex flex-col items-center text-center transition-shadow hover:shadow-md",
        isDragging && "opacity-30",
        isDone && "opacity-40 border-muted"
      )}
    >
      {/* Drag handle */}
      {!isDone && (
        <div
          {...attributes}
          {...listeners}
          className="absolute top-1 left-1 lg:top-2 lg:left-2 cursor-grab active:cursor-grabbing touch-none p-1.5 lg:p-1 rounded opacity-60 lg:opacity-0 lg:group-hover/planned:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
        </div>
      )}
      <span className={cn(
        "text-3xl lg:text-5xl 2xl:text-6xl leading-none mb-1.5 lg:mb-2",
        isDone && "grayscale"
      )}>
        {task.emoji || "\ud83d\udccc"}
      </span>
      <span className={cn(
        "font-bold text-sm lg:text-base 2xl:text-lg leading-tight line-clamp-2",
        isDone && "line-through text-muted-foreground"
      )}>
        {task.title}
      </span>
      <span className="text-[11px] lg:text-xs 2xl:text-sm text-muted-foreground mt-1">
        {formatMinutes(task.estimatedMinutes)}
      </span>
      {(task.tags?.length ?? 0) > 0 && (
        <div className="flex gap-1 flex-wrap justify-center mt-1.5">
          {task.tags!.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="text-[10px] lg:text-xs px-1.5 py-0"
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}
      {/* Notes */}
      <NotesEditor taskId={task.id} notes={task.notes || ""} onUpdate={onUpdate} />

      {/* Actions — pinned to bottom */}
      <div className="flex justify-around mt-auto pt-2 w-full">
        {isDone ? (
          <button
            onClick={() => onUncomplete(task.id)}
            className="rounded-full bg-blue-100 dark:bg-blue-900 p-2 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
            title="Undo"
          >
            <Undo2 className="h-5 w-5 lg:h-6 lg:w-6 text-blue-700 dark:text-blue-300" />
          </button>
        ) : (
          <>
            <button
              onClick={() => onUnplan(task.id)}
              className="rounded-full bg-orange-100 dark:bg-orange-900 p-2 hover:bg-orange-200 dark:hover:bg-orange-800 transition-colors"
              title="Remove from day"
            >
              <CalendarMinus className="h-5 w-5 lg:h-6 lg:w-6 text-orange-700 dark:text-orange-300" />
            </button>
            <button
              onClick={() => onComplete(task.id)}
              className="rounded-full bg-green-100 dark:bg-green-900 p-2 hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
              title="Mark done"
            >
              <Check className="h-5 w-5 lg:h-6 lg:w-6 text-green-700 dark:text-green-300" />
            </button>
          </>
        )}
      </div>

      {/* Delete — top right with confirmation */}
      {confirmingDelete ? (
        <div className="absolute top-1 right-1 lg:top-2 lg:right-2 flex gap-0.5 lg:gap-1 animate-in fade-in duration-150">
          <button
            onClick={() => onDelete(task.id)}
            className="rounded-full bg-red-500 dark:bg-red-600 p-1 hover:bg-red-600 dark:hover:bg-red-700 transition-colors"
            title="Confirm delete"
          >
            <Check className="h-3.5 w-3.5 text-white" />
          </button>
          <button
            onClick={() => setConfirmingDelete(false)}
            className="rounded-full bg-muted p-1 hover:bg-accent transition-colors"
            title="Cancel"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmingDelete(true)}
          className="absolute top-1 right-1 lg:top-2 lg:right-2 rounded-full bg-red-100 dark:bg-red-900 p-1 hover:bg-red-200 dark:hover:bg-red-800 transition-colors opacity-60 lg:opacity-0 lg:group-hover/planned:opacity-100"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5 text-red-700 dark:text-red-300" />
        </button>
      )}
    </div>
  );
}

function DayPlanZone({
  tasks,
  selectedDate,
  isDragging,
  onUnplan,
  onComplete,
  onUncomplete,
  onDelete,
  onUpdate,
}: {
  tasks: Task[];
  selectedDate: string;
  isDragging: boolean;
  onUnplan: (id: string) => void;
  onComplete: (id: string) => void;
  onUncomplete: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: DAY_PLAN_ZONE_ID });
  const todoTasks = tasks.filter((t) => t.status === "todo");
  const doneTasks = tasks.filter((t) => t.status === "done");
  const totalMinutes = todoTasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-xl border-2 border-dashed p-3 transition-colors min-h-[60px]",
        isOver
          ? "border-primary bg-primary/5"
          : isDragging
          ? "border-primary/40 bg-accent/50"
          : "border-border bg-card/50"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">
          {formatDate(selectedDate)}
          {isToday(selectedDate) && " (Today)"}
        </h3>
        {tasks.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {todoTasks.length > 0 && <>{todoTasks.length} to do &middot; ~{formatMinutes(totalMinutes)}</>}
            {todoTasks.length > 0 && doneTasks.length > 0 && " &middot; "}
            {doneTasks.length > 0 && <>{doneTasks.length} done</>}
          </span>
        )}
      </div>
      {tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">
          {isDragging ? "Drop here" : "..."}
        </p>
      ) : (
        <SortableContext
          items={tasks.map((t) => `${PLAN_PREFIX}${t.id}`)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 min-[2200px]:grid-cols-10 gap-2 lg:gap-3">
            {tasks.map((task) => (
              <SortablePlannedCard
                key={task.id}
                task={task}
                onComplete={onComplete}
                onUncomplete={onUncomplete}
                onUnplan={onUnplan}
                onDelete={onDelete}
                onUpdate={onUpdate}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
}

function DoneTaskCard({
  task,
  isJustDone,
  onUncomplete,
  onDelete,
}: {
  task: Task;
  isJustDone: boolean;
  onUncomplete: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div
      className={cn(
        "group relative rounded-xl border bg-card p-3 lg:p-4 flex flex-col items-center text-center transition-all duration-700",
        isJustDone
          ? "scale-105 ring-2 ring-green-400 border-green-400 shadow-lg shadow-green-200/50 dark:shadow-green-900/50"
          : "border-muted opacity-50"
      )}
    >
      <span className={cn(
        "text-3xl lg:text-5xl 2xl:text-6xl leading-none mb-1.5 lg:mb-2 transition-all duration-700",
        !isJustDone && "grayscale"
      )}>
        {task.emoji || "\ud83d\udccc"}
      </span>
      <span className={cn(
        "font-bold text-sm lg:text-base 2xl:text-lg leading-tight line-clamp-2 transition-all duration-700",
        isJustDone
          ? "text-green-700 dark:text-green-400"
          : "line-through text-muted-foreground"
      )}>
        {isJustDone ? `${task.title} ✓` : task.title}
      </span>
      <span className="text-[11px] lg:text-xs 2xl:text-sm text-muted-foreground mt-1">
        {formatMinutes(task.estimatedMinutes)}
      </span>
      {(task.tags?.length ?? 0) > 0 && (
        <div className="flex gap-1 flex-wrap justify-center mt-1.5">
          {task.tags!.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="text-[10px] lg:text-xs px-1.5 py-0"
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Actions — bottom row */}
      <div className="flex justify-around mt-auto pt-2 w-full">
        <button
          onClick={() => onUncomplete(task.id)}
          className="rounded-full bg-blue-100 dark:bg-blue-900 p-2 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
          title="Undo"
        >
          <Undo2 className="h-5 w-5 lg:h-6 lg:w-6 text-blue-700 dark:text-blue-300" />
        </button>
      </div>

      {/* Delete — top right with confirmation */}
      {confirmingDelete ? (
        <div className="absolute top-1 right-1 lg:top-2 lg:right-2 flex gap-0.5 lg:gap-1 animate-in fade-in duration-150">
          <button
            onClick={() => onDelete(task.id)}
            className="rounded-full bg-red-500 dark:bg-red-600 p-1 hover:bg-red-600 dark:hover:bg-red-700 transition-colors"
            title="Confirm delete"
          >
            <Check className="h-3.5 w-3.5 text-white" />
          </button>
          <button
            onClick={() => setConfirmingDelete(false)}
            className="rounded-full bg-muted p-1 hover:bg-accent transition-colors"
            title="Cancel"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmingDelete(true)}
          className="absolute top-1 right-1 lg:top-2 lg:right-2 rounded-full bg-red-100 dark:bg-red-900 p-1 hover:bg-red-200 dark:hover:bg-red-800 transition-colors opacity-60 lg:opacity-0 lg:group-hover:opacity-100"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5 text-red-700 dark:text-red-300" />
        </button>
      )}
    </div>
  );
}

function TaskCardOverlay({ task }: { task: Task }) {
  const tags = task.tags || [];
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-3 lg:p-4 flex flex-col items-center text-center shadow-2xl ring-2 ring-primary/20 scale-105",
        task.priority === 1 && "border-red-300 dark:border-red-800",
        task.priority === 3 && "border-muted"
      )}
    >
      <span className="text-3xl lg:text-5xl 2xl:text-6xl leading-none mb-1.5 lg:mb-2">
        {task.emoji || "\ud83d\udccc"}
      </span>
      <span className="font-bold text-sm lg:text-base 2xl:text-lg leading-tight line-clamp-2">
        {task.title}
      </span>
      <span className="text-[11px] lg:text-xs 2xl:text-sm text-muted-foreground mt-1">
        {formatMinutes(task.estimatedMinutes)}
      </span>
      {tags.length > 0 && (
        <div className="flex gap-1 flex-wrap justify-center mt-1.5">
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="text-[10px] lg:text-xs px-1.5 py-0"
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory] = useState<TaskCategory | "all">(
    "all"
  );
  const [filterTag, setFilterTag] = useState<string>("all");
  const [filterDuration, setFilterDuration] = useState<"all" | "quick" | "quarter" | "half" | "full">("all");
  const [sortMode, setSortMode] = useState<"custom" | "priority" | "duration">("custom");
  const [backfilling, setBackfilling] = useState(false);
  const [addingLocations, setAddingLocations] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [justCompleted, setJustCompleted] = useState<string | null>(null);
  const [celebratingTask, setCelebratingTask] = useState<{ emoji: string; title: string } | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const planSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calendar strip state
  const [selectedDate, setSelectedDate] = useState(getTodayISO());
  const usableDays = getUsableDays();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    })
  );

  const [fetchError, setFetchError] = useState("");

  const fetchTasks = async () => {
    if (!user) return;
    try {
      const t = await getTasks(user.uid);
      setTasks(t);
      setFetchError("");
    } catch (e: unknown) {
      console.error("Failed to fetch tasks:", e);
      setFetchError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [user]);

  // Collect all unique tags across tasks
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    tasks.forEach((t) => t.tags?.forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [tasks]);

  // Calendar helpers
  const tasksForDate = (date: string) =>
    tasks.filter((t) => t.plannedDate === date);
  const currentDayIndex = usableDays.indexOf(selectedDate);
  const visibleDays = usableDays.slice(
    Math.max(0, currentDayIndex - 3),
    Math.min(usableDays.length, currentDayIndex + 4)
  );
  const plannedForSelected = tasksForDate(selectedDate).sort((a, b) => {
    // Done tasks go to the end
    if (a.status !== b.status) return a.status === "done" ? 1 : -1;
    const aOrder = a.plannedSortOrder ?? Infinity;
    const bOrder = b.plannedSortOrder ?? Infinity;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.priority - b.priority;
  });
  const plannedMinutes = plannedForSelected
    .filter((t) => t.status === "todo")
    .reduce((sum, t) => sum + t.estimatedMinutes, 0);

  const today = getTodayISO();
  const isOverdue = (t: Task) => t.plannedDate !== null && t.plannedDate < today && t.status === "todo";

  const todoTasks = tasks
    .filter((t) => t.status === "todo")
    .filter((t) => !t.plannedDate || isOverdue(t))
    .filter((t) => filterCategory === "all" || t.category === filterCategory)
    .filter((t) => filterTag === "all" || (filterTag === "?" ? (!t.tags || t.tags.length === 0) : t.tags?.includes(filterTag)))
    .filter((t) => {
      if (filterDuration === "all") return true;
      const m = t.estimatedMinutes;
      if (filterDuration === "quick") return m <= 15;
      if (filterDuration === "quarter") return m > 15 && m <= 120;
      if (filterDuration === "half") return m > 120 && m <= 240;
      if (filterDuration === "full") return m > 240;
      return true;
    })
    .sort((a, b) => {
      // Overdue tasks always come first
      const aOverdue = isOverdue(a);
      const bOverdue = isOverdue(b);
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;

      const aOrder = a.sortOrder ?? Infinity;
      const bOrder = b.sortOrder ?? Infinity;
      if (sortMode === "priority") {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return aOrder - bOrder;
      }
      if (sortMode === "duration") {
        if (a.estimatedMinutes !== b.estimatedMinutes) return a.estimatedMinutes - b.estimatedMinutes;
        return aOrder - bOrder;
      }
      // custom
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.priority - b.priority;
    });

  const minSortOrder = useMemo(() => {
    let min = 0;
    tasks.forEach((t) => {
      if (typeof t.sortOrder === "number" && t.sortOrder < min) min = t.sortOrder;
    });
    return min;
  }, [tasks]);

  const todoCount = tasks.filter((t) => t.status === "todo" && !t.plannedDate).length;
  const scheduledCount = tasks.filter((t) => t.status === "todo" && t.plannedDate).length;
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const needsEmojis = tasks.some((t) => t.status === "todo" && !t.emoji);
  const needsLocations = tasks.some((t) => !t.tags || t.tags.length === 0);

  const doneTasks = tasks
    .filter((t) => t.status === "done")
    .filter((t) => filterCategory === "all" || t.category === filterCategory)
    .filter((t) => filterTag === "all" || (filterTag === "?" ? (!t.tags || t.tags.length === 0) : t.tags?.includes(filterTag)))
    .filter((t) => {
      if (filterDuration === "all") return true;
      const m = t.estimatedMinutes;
      if (filterDuration === "quick") return m <= 15;
      if (filterDuration === "quarter") return m > 15 && m <= 120;
      if (filterDuration === "half") return m > 120 && m <= 240;
      if (filterDuration === "full") return m > 240;
      return true;
    });

  const activeTask = useMemo(() => {
    if (!activeId) return null;
    const realId = activeId.startsWith(PLAN_PREFIX)
      ? activeId.slice(PLAN_PREFIX.length)
      : activeId;
    return tasks.find((t) => t.id === realId) || null;
  }, [activeId, tasks]);

  const handleComplete = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    setJustCompleted(taskId);
    if (task) {
      setCelebratingTask({ emoji: task.emoji || "✅", title: task.title });
    }
    const todayStr = getTodayISO();
    // Always pin completed tasks to today so they show greyed out in today's planner
    if (task && task.plannedDate !== todayStr) {
      await planTask(taskId, todayStr);
    }
    await completeTask(taskId);
    await fetchTasks();
    setTimeout(() => setJustCompleted(null), 2000);
  };

  const handleUncomplete = async (taskId: string) => {
    await uncompleteTask(taskId);
    fetchTasks();
  };

  const handleDelete = async (taskId: string) => {
    await deleteTask(taskId);
    fetchTasks();
  };

  const handlePlan = async (taskId: string) => {
    await planTask(taskId, selectedDate);
    fetchTasks();
  };

  const handleUnplan = async (taskId: string) => {
    await unplanTask(taskId);
    fetchTasks();
  };

  const handleBackfillEmojis = async () => {
    if (!user) return;
    setBackfilling(true);
    try {
      await fetch("/api/backfill-emojis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid }),
      });
      await fetchTasks();
    } finally {
      setBackfilling(false);
    }
  };

  const handleAddLocations = async () => {
    if (!user) return;
    setAddingLocations(true);
    try {
      await fetch("/api/recheck-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid, existingLocations: allTags }),
      });
      await fetchTasks();
    } finally {
      setAddingLocations(false);
    }
  };

  // Custom collision detection:
  // - Dragging from plan zone → only collide with other plan items
  // - Dragging from main grid → prefer plan zone droppable, otherwise main grid items
  const collisionDetection: CollisionDetection = (args) => {
    const activeIdStr = String(args.active.id);
    const isFromPlan = activeIdStr.startsWith(PLAN_PREFIX);

    if (isFromPlan) {
      const collisions = closestCenter(args);
      return collisions.filter((c) => String(c.id).startsWith(PLAN_PREFIX));
    }

    const pointerCollisions = pointerWithin(args);
    const planZoneHit = pointerCollisions.find(
      (c) => c.id === DAY_PLAN_ZONE_ID
    );
    if (planZoneHit) return [planZoneHit];

    const collisions = closestCenter(args);
    return collisions.filter(
      (c) =>
        !String(c.id).startsWith(PLAN_PREFIX) && c.id !== DAY_PLAN_ZONE_ID
    );
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    const isFromPlan = activeIdStr.startsWith(PLAN_PREFIX);

    // Reorder within the day plan zone
    if (isFromPlan) {
      if (!overIdStr.startsWith(PLAN_PREFIX)) return;
      if (active.id === over.id) return;

      const activeRealId = activeIdStr.slice(PLAN_PREFIX.length);
      const overRealId = overIdStr.slice(PLAN_PREFIX.length);

      const oldIndex = plannedForSelected.findIndex(
        (t) => t.id === activeRealId
      );
      const newIndex = plannedForSelected.findIndex(
        (t) => t.id === overRealId
      );
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(plannedForSelected, oldIndex, newIndex);

      const updatedTasks = tasks.map((t) => {
        const idx = reordered.findIndex((r) => r.id === t.id);
        if (idx !== -1) return { ...t, plannedSortOrder: idx };
        return t;
      });
      setTasks(updatedTasks);

      if (planSaveTimeoutRef.current)
        clearTimeout(planSaveTimeoutRef.current);
      planSaveTimeoutRef.current = setTimeout(() => {
        reorderPlannedTasks(reordered.map((t) => t.id));
      }, 500);
      return;
    }

    // Dropped on the plan zone → plan for selected date
    if (over.id === DAY_PLAN_ZONE_ID) {
      handlePlan(active.id as string);
      return;
    }

    // Reorder within the main grid (only in custom sort mode)
    if (sortMode !== "custom") return;
    if (active.id === over.id) return;

    const oldIndex = todoTasks.findIndex((t) => t.id === active.id);
    const newIndex = todoTasks.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(todoTasks, oldIndex, newIndex);

    const updatedTasks = tasks.map((t) => {
      const idx = reordered.findIndex((r) => r.id === t.id);
      if (idx !== -1) return { ...t, sortOrder: idx };
      return t;
    });
    setTasks(updatedTasks);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      reorderTasks(reordered.map((t) => t.id));
    }, 500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const daysLeft = getDaysRemaining();
  const totalBusinessDays = getUsableDays().filter((d) => {
    const date = parseISO(d);
    return !isWeekendDate(date);
  }).length;
  const daysElapsed = totalBusinessDays - daysLeft;
  const daysPct = totalBusinessDays > 0 ? (daysElapsed / totalBusinessDays) * 100 : 0;
  const totalTasks = todoCount + scheduledCount + doneCount;
  const tasksPct = totalTasks > 0 ? (doneCount / totalTasks) * 100 : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl lg:text-3xl font-bold">Free Time</h2>
        <div className="flex gap-2">
          {needsEmojis && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBackfillEmojis}
              disabled={backfilling}
            >
              {backfilling ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              Add Emojis
            </Button>
          )}
        </div>
      </div>

      {/* Progress blocks */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="flex justify-between items-baseline text-sm font-medium">
            <div className="flex items-baseline gap-1.5">
              <span>Free Days</span>
              <span className={cn("text-lg font-bold tabular-nums", getGreenToRedColor(daysPct))}>{Math.round(daysPct)}%</span>
            </div>
            <span className="text-muted-foreground">{daysLeft} left</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs text-muted-foreground">Total days left</span>
            <span className="text-sm font-bold tabular-nums">{Math.max(0, Math.ceil((new Date("2026-04-20").getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between items-baseline text-sm font-medium">
            <div className="flex items-baseline gap-1.5">
              <span>Tasks</span>
              <span className={cn("text-lg font-bold tabular-nums", getRedToGreenColor(tasksPct))}>{Math.round(tasksPct)}%</span>
            </div>
            <span className="text-muted-foreground">{doneCount}/{totalTasks}</span>
          </div>
          <div className="flex gap-0.5 flex-wrap">
            {Array.from({ length: totalTasks }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-3 w-3 lg:h-4 lg:w-4 rounded-sm transition-colors",
                  i < doneCount ? getRedToGreenBg(tasksPct) : "bg-muted"
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Brain dump input */}
      <BrainDumpInput onTasksCreated={fetchTasks} existingTags={allTags} minSortOrder={minSortOrder} />

      {fetchError && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">
          Failed to load tasks: {fetchError}
        </div>
      )}

      {/* Calendar strip */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => {
            const idx = usableDays.indexOf(selectedDate);
            if (idx > 0) setSelectedDate(usableDays[idx - 1]);
          }}
          disabled={usableDays.indexOf(selectedDate) === 0}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {visibleDays.map((d) => {
          const count = tasksForDate(d).length;
          return (
            <button
              key={d}
              onClick={() => setSelectedDate(d)}
              className={cn(
                "flex flex-col items-center px-3 py-2 rounded-lg text-xs transition-colors shrink-0",
                d === selectedDate
                  ? "bg-primary text-primary-foreground"
                  : isToday(d)
                  ? "bg-accent border border-primary"
                  : "hover:bg-accent"
              )}
            >
              <span className="font-medium">{formatDateShort(d)}</span>
              {count > 0 && (
                <span className="text-[10px] mt-0.5 opacity-75">
                  {count} task{count > 1 ? "s" : ""}
                </span>
              )}
            </button>
          );
        })}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => {
            const idx = usableDays.indexOf(selectedDate);
            if (idx < usableDays.length - 1)
              setSelectedDate(usableDays[idx + 1]);
          }}
          disabled={
            usableDays.indexOf(selectedDate) === usableDays.length - 1
          }
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Day plan drop zone */}
        <DayPlanZone
          tasks={plannedForSelected}
          selectedDate={selectedDate}
          isDragging={!!activeId}
          onUnplan={handleUnplan}
          onComplete={handleComplete}
          onUncomplete={handleUncomplete}
          onDelete={handleDelete}
          onUpdate={fetchTasks}
        />

        {/* Sort mode pills */}
        <div className="flex gap-1.5 items-center flex-wrap">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide mr-0.5">Sort</span>
          {([
            { value: "custom" as const, label: "Custom" },
            { value: "priority" as const, label: "Priority" },
            { value: "duration" as const, label: "Duration" },
          ]).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSortMode(opt.value)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full border transition-colors",
                sortMode === opt.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card hover:bg-accent border-border"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Location filter pills */}
        {allTags.length > 0 && (
          <div className="flex gap-1.5 items-center flex-wrap">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide mr-0.5">Location</span>
            <button
              onClick={() => setFilterTag("all")}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full border transition-colors",
                filterTag === "all"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card hover:bg-accent border-border"
              )}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() =>
                  setFilterTag(filterTag === tag ? "all" : tag)
                }
                className={cn(
                  "text-xs px-2.5 py-1 rounded-full border transition-colors",
                  filterTag === tag
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card hover:bg-accent border-border"
                )}
              >
                {tag}
              </button>
            ))}
            {needsLocations && (
              <button
                onClick={() => setFilterTag(filterTag === "?" ? "all" : "?")}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-full border transition-colors",
                  filterTag === "?"
                    ? "bg-orange-500 text-white border-orange-500"
                    : "bg-card hover:bg-accent border-border text-orange-500"
                )}
              >
                ?
              </button>
            )}
          </div>
        )}

        {/* Duration filter pills */}
        <div className="flex gap-1.5 items-center flex-wrap">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide mr-0.5">Duration</span>
          {([
            { value: "all" as const, label: "All" },
            { value: "quick" as const, label: "Quick" },
            { value: "quarter" as const, label: "Quarter day" },
            { value: "half" as const, label: "Half day" },
            { value: "full" as const, label: "Full day" },
          ]).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterDuration(filterDuration === opt.value ? "all" : opt.value)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full border transition-colors",
                filterDuration === opt.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card hover:bg-accent border-border"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {todoTasks.length === 0 && doneTasks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {tasks.length === 0
              ? "..."
              : "..."}
          </div>
        ) : (
          <>
            {todoTasks.length === 0 && doneTasks.length === 0 && (
              <div className="text-center py-6 text-muted-foreground text-sm">
                ...
              </div>
            )}

            <SortableContext
              items={todoTasks.map((t) => t.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 min-[2200px]:grid-cols-10 gap-2 lg:gap-3">
                {todoTasks.map((task) => (
                  <SortableTaskCard
                    key={task.id}
                    task={task}
                    allTags={allTags}
                    selectedDate={selectedDate}
                    onComplete={handleComplete}
                    onDelete={handleDelete}
                    onUpdate={fetchTasks}
                    onPlan={handlePlan}
                    onUnplan={handleUnplan}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeTask ? <TaskCardOverlay task={activeTask} /> : null}
            </DragOverlay>

          {/* Done tasks */}
          {doneTasks.length > 0 && (
            <>
              <h3 className="text-xs lg:text-sm font-medium text-muted-foreground uppercase tracking-wide mt-4">
                Done ({doneTasks.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 min-[2200px]:grid-cols-10 gap-2 lg:gap-3">
                {doneTasks.map((task) => (
                  <DoneTaskCard
                    key={task.id}
                    task={task}
                    isJustDone={justCompleted === task.id}
                    onUncomplete={handleUncomplete}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </>
          )}
        </>
        )}
      </DndContext>

      <Celebration task={celebratingTask} onDone={() => setCelebratingTask(null)} />
    </div>
  );
}
