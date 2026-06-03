"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  index?: number;
}

export function StatCard({ title, value, subtitle, icon: Icon, index = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <Card className="group relative overflow-hidden border-border/60 bg-card/90 backdrop-blur-sm transition-all duration-300 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5">
        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/5 blur-2xl transition-opacity group-hover:opacity-100 opacity-60" />
        <CardContent className="relative flex items-start justify-between p-5">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <motion.p
              key={String(value)}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-2 text-3xl font-bold tracking-tight text-foreground"
            >
              {value}
            </motion.p>
            {subtitle && (
              <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div
            className={cn(
              "rounded-xl bg-gradient-to-br from-primary/20 to-teal-500/10 p-3 text-primary",
              "ring-1 ring-primary/15 transition-transform duration-300 group-hover:scale-110"
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
