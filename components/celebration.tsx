"use client";

import { useEffect, useCallback } from "react";
import confetti from "canvas-confetti";

const CELEBRATORY_PHRASES = [
  "Crushed it!",
  "Done & dusted!",
  "Boom!",
  "Nailed it!",
  "Let's go!",
  "That's a wrap!",
  "One less thing!",
  "Knocked it out!",
  "Yes!",
  "On fire!",
];

export function Celebration({
  task,
  onDone,
}: {
  task: { emoji: string; title: string } | null;
  onDone: () => void;
}) {
  const fireConfetti = useCallback(() => {
    const duration = 1500;
    const end = Date.now() + duration;

    // Initial big burst from both sides
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { x: 0.1, y: 0.6 },
      colors: ["#a855f7", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"],
    });
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { x: 0.9, y: 0.6 },
      colors: ["#a855f7", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"],
    });

    // Continuous smaller bursts
    const interval = setInterval(() => {
      if (Date.now() > end) {
        clearInterval(interval);
        return;
      }
      confetti({
        particleCount: 30,
        spread: 100,
        origin: { x: Math.random(), y: Math.random() * 0.4 },
        colors: ["#a855f7", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"],
      });
    }, 200);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!task) return;
    const cleanup = fireConfetti();
    const timer = setTimeout(onDone, 2000);
    return () => {
      cleanup?.();
      clearTimeout(timer);
    };
  }, [task, fireConfetti, onDone]);

  if (!task) return null;

  const phrase =
    CELEBRATORY_PHRASES[Math.floor(Math.random() * CELEBRATORY_PHRASES.length)];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      style={{ animation: "celebration-fade 2s ease-out forwards" }}
    >
      <div className="text-center animate-in zoom-in-50 duration-300">
        <div className="text-8xl lg:text-9xl mb-4 drop-shadow-lg">{task.emoji || "✅"}</div>
        <div className="text-3xl lg:text-5xl font-black text-foreground drop-shadow-md">
          {phrase}
        </div>
        <div className="text-lg lg:text-xl text-muted-foreground mt-2 font-medium">
          {task.title}
        </div>
      </div>

      <style jsx>{`
        @keyframes celebration-fade {
          0% {
            opacity: 1;
          }
          70% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
