"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
  delay?: number;
}

export function SectionCard({
  title,
  description,
  icon: Icon,
  children,
  className,
  headerAction,
  delay = 0,
}: SectionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card
        className={cn(
          "overflow-hidden border-border/60 bg-card/80 backdrop-blur-sm transition-shadow duration-300 hover:shadow-md",
          className
        )}
      >
        <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/50 bg-muted/20 pb-4">
          <div className="flex items-start gap-3">
            {Icon && (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-primary/10">
                <Icon className="h-5 w-5" />
              </div>
            )}
            <div>
              <CardTitle className="text-base font-semibold">{title}</CardTitle>
              {description && (
                <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
              )}
            </div>
          </div>
          {headerAction}
        </CardHeader>
        <CardContent className="pt-5">{children}</CardContent>
      </Card>
    </motion.div>
  );
}
