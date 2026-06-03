"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Mail, Search, Columns3 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAuth } from "@/context/auth-context";
import { getNavForRole } from "./nav-config";
import { getCandidates } from "@/lib/services/candidates";
import { isAdmin } from "@/lib/rbac";
import type { Candidate } from "@/types";

const QUICK_ACTIONS = [
  { label: "Find Prospects", href: "/prospects", icon: Search },
  { label: "Send Outreach", href: "/outreach", icon: Mail },
  { label: "View Pipeline", href: "/pipeline", icon: Columns3 },
];

export function CommandPalette() {
  const router = useRouter();
  const { profile, role } = useAuth();
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (!open || !profile) return;
    getCandidates({}, isAdmin(role) ? undefined : profile.id).then(setCandidates);
  }, [open, profile, role]);

  const run = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  const navItems = role ? getNavForRole(role) : [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
          <Command.Input
            placeholder="Search pages, candidates, actions…"
            className="flex h-12 w-full border-b border-border bg-transparent px-4 text-sm outline-none placeholder:text-muted-foreground"
          />
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>
            <Command.Group heading="Pages">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Command.Item
                    key={item.href + item.title}
                    value={item.title}
                    onSelect={() => run(item.href)}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm aria-selected:bg-accent"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {item.title}
                  </Command.Item>
                );
              })}
            </Command.Group>
            <Command.Group heading="Quick actions">
              {QUICK_ACTIONS.map((a) => {
                const Icon = a.icon;
                return (
                  <Command.Item
                    key={a.href}
                    value={a.label}
                    onSelect={() => run(a.href)}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm aria-selected:bg-accent"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {a.label}
                  </Command.Item>
                );
              })}
            </Command.Group>
            {candidates.length > 0 && (
              <Command.Group heading="Candidates">
                {candidates.slice(0, 15).map((c) => (
                  <Command.Item
                    key={c.id}
                    value={`${c.fullName} ${c.email}`}
                    onSelect={() => run(`/candidates/${c.id}`)}
                    className="flex cursor-pointer flex-col items-start gap-0 rounded-lg px-3 py-2 text-sm aria-selected:bg-accent"
                  >
                    <span className="font-medium">{c.fullName}</span>
                    <span className="text-xs text-muted-foreground">{c.email}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
