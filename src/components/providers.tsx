"use client";

import { AuthProvider } from "@/context/auth-context";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
