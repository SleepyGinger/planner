"use client";

import { AuthGuard } from "@/components/auth-guard";
import { Nav } from "@/components/nav";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();

  return (
    <AuthGuard>
      <div className="min-h-screen pb-20">
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between h-14 px-4 lg:px-8">
            <h1 className="font-bold text-lg">Time Off Planner</h1>
            <div className="flex items-center gap-2">
            </div>
          </div>
        </header>
        <main className="px-4 lg:px-8 py-6">{children}</main>
        <Nav />
      </div>
    </AuthGuard>
  );
}
