"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Bird } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { getNavForRole } from "./nav-config";
import { APP_NAME } from "@/lib/constants";

export function AppSidebar() {
  const pathname = usePathname();
  const { role } = useAuth();
  if (!role) return null;

  const items = getNavForRole(role);

  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-border/60 lg:bg-sidebar/95 lg:backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 border-b border-border/60 px-5">
        <motion.div
          whileHover={{ scale: 1.05, rotate: -3 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
          className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-teal-600 text-primary-foreground shadow-lg shadow-primary/25"
        >
          <Bird className="h-5 w-5" />
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-sidebar" />
        </motion.div>
        <div>
          <p className="text-sm font-semibold leading-none tracking-tight">{APP_NAME}</p>
          <p className="mt-1 text-xs text-muted-foreground">Healthcare Recruit</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {items.map((item, i) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <motion.div
              key={`${item.href}-${item.title}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
            >
              <Link
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/15 to-teal-500/10 ring-1 ring-primary/20"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon
                  className={cn(
                    "relative z-10 h-4 w-4 shrink-0 transition-transform duration-200",
                    active && "text-primary"
                  )}
                />
                <span className="relative z-10">{item.title}</span>
              </Link>
            </motion.div>
          );
        })}
      </nav>
      <div className="border-t border-border/60 p-4">
        <div className="rounded-xl bg-gradient-to-br from-primary/10 via-transparent to-teal-500/5 p-3 ring-1 ring-primary/10">
          <p className="text-xs font-medium text-foreground">Pro tip</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Use Find Prospects to import real candidates into your pipeline.
          </p>
        </div>
      </div>
    </aside>
  );
}
