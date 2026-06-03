"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Menu,
  LogOut,
  User,
  Bird,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/context/auth-context";
import { signOut } from "@/lib/firebase/auth";
import { getNavForRole } from "./nav-config";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "./theme-toggle";
import { ProfileDialog } from "./profile-dialog";

export function AppHeader() {
  const { profile, role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      router.push(`/candidates?search=${encodeURIComponent(search.trim())}`);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out successfully");
    router.push("/login");
  };

  const initials = profile?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "NR";

  const navItems = role ? getNavForRole(role) : [];

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border/60 glass-panel px-4 lg:px-6">
      <Sheet>
        <SheetTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "lg:hidden")}>
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <div className="flex h-16 items-center gap-2 border-b px-6">
            <Bird className="h-5 w-5 text-primary" />
            <span className="font-semibold">Nightingale Recruit</span>
          </div>
          <nav className="space-y-1 p-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
                    active ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.title}
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>

      <motion.form
        onSubmit={handleSearch}
        animate={{ scale: searchFocused ? 1.01 : 1 }}
        transition={{ duration: 0.2 }}
        className="relative hidden flex-1 max-w-lg md:block"
      >
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search candidates by name, email, phone..."
          className={cn(
            "h-10 pl-10 transition-all duration-200",
            searchFocused
              ? "border-primary/30 bg-background shadow-md shadow-primary/5 ring-2 ring-primary/10"
              : "border-transparent bg-muted/60 hover:bg-muted/80"
          )}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
      </motion.form>

      <div className="ml-auto flex items-center gap-3">
        <ThemeToggle />
        <NotificationBell />
        <motion.span
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="hidden rounded-full bg-gradient-to-r from-primary/15 to-teal-500/10 px-3 py-1 text-xs font-semibold capitalize text-primary ring-1 ring-primary/20 sm:inline"
        >
          {role}
        </motion.span>
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full outline-none ring-offset-2 transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-primary/30">
            <Avatar className="h-9 w-9 ring-2 ring-primary/20 ring-offset-2">
              <AvatarImage src={profile?.avatarUrl} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-teal-600 text-primary-foreground text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="font-medium">{profile?.name}</p>
              <p className="text-xs font-normal text-muted-foreground">{profile?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setTimeout(() => setProfileOpen(true), 0)}>
              <User className="mr-2 h-4 w-4" />
              My Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </header>
  );
}
