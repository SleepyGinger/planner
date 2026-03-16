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
        <main className="px-4 lg:px-8 py-6">{children}</main>
        <Nav />
      </div>
    </AuthGuard>
  );
}
