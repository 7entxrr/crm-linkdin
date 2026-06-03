"use client";

import { useState } from "react";
import { User, Lock, Shield } from "lucide-react";
import { toast } from "sonner";
import { updatePassword } from "firebase/auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/auth-context";
import { getClientAuth } from "@/lib/firebase/client";

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileDialog({ open, onOpenChange }: ProfileDialogProps) {
  const { profile, role } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const initials =
    profile?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "NR";

  const handlePasswordChange = async () => {
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    const user = getClientAuth().currentUser;
    if (!user) return;
    setSaving(true);
    try {
      await updatePassword(user, password);
      toast.success("Password updated");
      setPassword("");
      setConfirm("");
    } catch {
      toast.error("Failed to update password. Try signing out and back in.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>My Profile</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-4 rounded-xl border bg-muted/30 p-4">
          <Avatar className="h-16 w-16 ring-2 ring-primary/20 ring-offset-2">
            <AvatarImage src={profile?.avatarUrl} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-teal-600 text-lg text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <p className="text-lg font-semibold leading-tight">{profile?.name}</p>
            <p className="text-sm text-muted-foreground">{profile?.email}</p>
            <Badge variant="secondary" className="mt-1 gap-1 capitalize">
              <Shield className="h-3 w-3" />
              {role}
            </Badge>
          </div>
        </div>

        <div className="space-y-3 pt-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Lock className="h-4 w-4 text-muted-foreground" />
            Change password
          </p>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">New password</Label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Confirm password</Label>
            <Input
              type="password"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <Button
            onClick={handlePasswordChange}
            disabled={saving || !password || !confirm}
            className="w-full"
          >
            <User className="mr-2 h-4 w-4" />
            {saving ? "Updating…" : "Update password"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
