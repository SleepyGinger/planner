"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getTasks, planTask, unplanTask } from "@/lib/firestore";
import { Task } from "@/lib/types";
import { TaskCard } from "@/components/task-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMinutes } from "@/lib/format";
import {
  getUsableDays,
  formatDate,
  formatDateShort,
  getTodayISO,
  isToday,
} from "@/lib/dates";

export default function PlanPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(getTodayISO());

  const usableDays = getUsableDays();
  const today = getTodayISO();

  const fetchTasks = async () => {
    if (!user) return;
    const t = await getTasks(user.uid);
    setTasks(t);
    setLoading(false);
  };

  useEffect(() => {
    fetchTasks();
  }, [user]);

  const tasksForDate = (date: string) =>
    tasks.filter((t) => t.plannedDate === date);

  const selectedTasks = tasksForDate(selectedDate).sort((a, b) => {
    // Show todo tasks first, done tasks at the bottom
    if (a.status === "done" && b.status !== "done") return 1;
    if (a.status !== "done" && b.status === "done") return -1;
    return a.priority - b.priority;
  });
  const doneCount = selectedTasks.filter((t) => t.status === "done").length;
  const unplannedTasks = tasks.filter(
    (t) => !t.plannedDate && t.status === "todo"
  );
  const totalMinutes = selectedTasks
    .filter((t) => t.status === "todo")
    .reduce((sum, t) => sum + t.estimatedMinutes, 0);

  const handlePlanDate = async (taskId: string) => {
    await planTask(taskId, selectedDate);
    fetchTasks();
  };

  const handleUnplan = async (taskId: string) => {
    await unplanTask(taskId);
    fetchTasks();
  };

  // Calendar strip navigation
  const currentDayIndex = usableDays.indexOf(selectedDate);
  const visibleDays = usableDays.slice(
    Math.max(0, currentDayIndex - 3),
    Math.min(usableDays.length, currentDayIndex + 4)
  );

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
        <h2 className="text-2xl font-bold">Daily Plan</h2>
        <p className="text-muted-foreground text-sm mt-1">
          {formatDate(selectedDate)}
          {isToday(selectedDate) && " (Today)"}
        </p>
      </div>

      {/* Calendar strip */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
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

      {/* Planned tasks for selected date */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">
            Planned ({doneCount}/{selectedTasks.length} done)
          </h3>
          <span className="text-xs text-muted-foreground">
            ~{formatMinutes(totalMinutes)} remaining
          </span>
        </div>
        {selectedTasks.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground text-sm">
            No tasks planned for this day
          </Card>
        ) : (
          selectedTasks.map((task) => (
            <div key={task.id} className="relative">
              <TaskCard task={task} onUpdate={fetchTasks} compact />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-24 h-7 w-7"
                onClick={() => handleUnplan(task.id)}
                title="Unplan"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>

      <Separator />

      {/* Unplanned tasks */}
      <div className="space-y-2">
        <h3 className="font-semibold text-sm">
          Unplanned Tasks ({unplannedTasks.length})
        </h3>
        {unplannedTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            All tasks are planned! Nice.
          </p>
        ) : (
          unplannedTasks.slice(0, 20).map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onUpdate={fetchTasks}
              onPlanDate={handlePlanDate}
              compact
            />
          ))
        )}
        {unplannedTasks.length > 20 && (
          <p className="text-xs text-muted-foreground text-center">
            +{unplannedTasks.length - 20} more unplanned tasks
          </p>
        )}
      </div>

    </div>
  );
}
