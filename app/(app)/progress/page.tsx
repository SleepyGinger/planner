"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getTasks } from "@/lib/firestore";
import { Task, CATEGORIES, TaskCategory } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";
import { getDaysRemaining, getUsableDays, getTodayISO, formatDateShort } from "@/lib/dates";
import { format, parseISO } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
];

const categoryEmoji: Record<TaskCategory, string> = {
  errands: "🏃",
  projects: "🔨",
  "health/fitness": "💪",
  learning: "📚",
  "fun/experiences": "🎉",
  social: "👥",
  home: "🏠",
  admin: "📋",
};

export default function ProgressPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getTasks(user.uid).then((t) => {
      setTasks(t);
      setLoading(false);
    });
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const todo = total - done;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const daysLeft = getDaysRemaining();
  const totalMinutesRemaining = tasks
    .filter((t) => t.status === "todo")
    .reduce((sum, t) => sum + t.estimatedMinutes, 0);

  // Category breakdown
  const categoryData = CATEGORIES.map((cat) => {
    const catTasks = tasks.filter((t) => t.category === cat);
    return {
      name: cat,
      total: catTasks.length,
      done: catTasks.filter((t) => t.status === "done").length,
    };
  }).filter((d) => d.total > 0);

  const pieData = categoryData.map((d) => ({
    name: d.name,
    value: d.total,
  }));

  // Completions per day
  const completionsByDate = tasks
    .filter((t) => t.completedAt)
    .reduce<Record<string, number>>((acc, t) => {
      const day = format(parseISO(t.completedAt!), "yyyy-MM-dd");
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {});

  const usableDays = getUsableDays();
  const today = getTodayISO();
  const trendData = usableDays
    .filter((d) => d <= today)
    .map((d) => ({
      date: formatDateShort(d),
      completed: completionsByDate[d] || 0,
    }));

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold">Progress</h2>
        <p className="text-muted-foreground text-sm mt-1">
          {daysLeft} usable days remaining
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold">{done}</div>
          <div className="text-xs text-muted-foreground">Done</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold">{todo}</div>
          <div className="text-xs text-muted-foreground">Remaining</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold">{daysLeft}</div>
          <div className="text-xs text-muted-foreground">Days Left</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold">
            {Math.round(totalMinutesRemaining / 60)}h
          </div>
          <div className="text-xs text-muted-foreground">Work Left</div>
        </Card>
      </div>

      {/* Completion bar */}
      <Card className="p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span>Overall Progress</span>
          <span className="font-medium">{percent}%</span>
        </div>
        <Progress value={percent} className="h-3" />
        <p className="text-xs text-muted-foreground">
          {done} of {total} tasks complete
        </p>
      </Card>

      {/* Category breakdown */}
      {pieData.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-3">By Category</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label={({ name, value }) =>
                    `${categoryEmoji[name as TaskCategory]} ${value}`
                  }
                >
                  {pieData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={COLORS[i % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-3">
            {categoryData.map((d, i) => (
              <div
                key={d.name}
                className="flex items-center justify-between text-xs"
              >
                <span>
                  {categoryEmoji[d.name as TaskCategory]} {d.name}
                </span>
                <span className="text-muted-foreground">
                  {d.done}/{d.total} done
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Daily trend */}
      {trendData.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-3">
            Tasks Completed Per Day
          </h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10 }}
                  width={20}
                />
                <Tooltip />
                <Bar dataKey="completed" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {total === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No tasks yet. Start with a brain dump!
        </div>
      )}
    </div>
  );
}
