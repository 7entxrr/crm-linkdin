"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/context/auth-context";
import { canAccessRoute } from "@/lib/rbac";
import { AppSidebar } from "./app-sidebar";
import { AppHeader } from "./app-header";
import { PageSkeleton } from "@/components/shared/loading-skeleton";
import { CommandPalette } from "./command-palette";
import { AiChatWidget } from "@/components/ai/ai-chat-widget";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { loading, firebaseUser, role, profile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !firebaseUser) {
      router.replace("/login");
    }
  }, [loading, firebaseUser, router]);

  useEffect(() => {
    if (!loading && role && !canAccessRoute(role, pathname)) {
      router.replace("/dashboard");
    }
  }, [loading, role, pathname, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <div className="hidden w-64 border-r lg:block" />
        <div className="flex-1 p-6">
          <div className="mx-auto w-full max-w-7xl">
            <PageSkeleton />
          </div>
        </div>
      </div>
    );
  }

  if (!firebaseUser || !profile || profile.status === "inactive") {
    return null;
  }

  return (
    <div className="flex min-h-screen app-mesh-bg">
      <CommandPalette />
      <AppSidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <AppHeader />
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
        >
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </motion.main>
      </div>
      <AiChatWidget />
    </div>
  );
}
