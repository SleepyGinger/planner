"use client";

import { BrainDumpInput } from "@/components/brain-dump-input";
import { getDaysRemaining } from "@/lib/dates";
import { useState, useCallback } from "react";

export default function HomePage() {
  const [key, setKey] = useState(0);
  const daysLeft = getDaysRemaining();

  const handleTasksCreated = useCallback(() => {
    setKey((k) => k + 1);
  }, []);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold">Brain Dump</h2>
        <p className="text-muted-foreground text-sm mt-1">
          {daysLeft} usable days remaining. Dump everything on your mind.
        </p>
      </div>
      <BrainDumpInput key={key} onTasksCreated={handleTasksCreated} />
    </div>
  );
}
