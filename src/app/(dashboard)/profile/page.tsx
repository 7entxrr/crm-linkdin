"use client";

import { useState } from "react";
import { User, Send } from "lucide-react";
import { toast } from "sonner";
import { updatePassword } from "firebase/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/context/auth-context";
import { getClientAuth } from "@/lib/firebase/client";
import { apiFetch } from "@/lib/api-client";

export default function ProfilePage() {
  const { profile } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [testTo, setTestTo] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  const handleSendTest = async () => {
    const to = testTo.trim() || profile?.email || "";
    if (!to) {
      toast.error("Enter a recipient email");
      return;
    }
    setSendingTest(true);
    try {
      await apiFetch("/api/email/test", {
        method: "POST",
        body: JSON.stringify({ to }),
      });
      toast.success(`Test email sent to ${to}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send test email");
    } finally {
      setSendingTest(false);
    }
  };

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
    try {
      await updatePassword(user, password);
      toast.success("Password updated");
      setPassword("");
      setConfirm("");
    } catch {
      toast.error("Failed to update password. Try signing out and back in.");
    }
  };

  const initials = profile?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "NR";

  return (
    <div className="space-y-6 max-w-lg">
      <PageHeader title="Profile" description="Your account settings" />

      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <Avatar className="h-16 w-16">
            <AvatarImage src={profile?.avatarUrl} />
            <AvatarFallback className="bg-primary text-primary-foreground text-lg">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-lg font-semibold">{profile?.name}</p>
            <p className="text-sm text-muted-foreground">{profile?.email}</p>
            <p className="text-xs capitalize text-primary mt-1">{profile?.role}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>New Password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <Label>Confirm Password</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Button onClick={handlePasswordChange}>Update Password</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="h-4 w-4" />Send Test Email
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Verify your SMTP setup by sending yourself a test email. Leave blank
            to send to your own address.
          </p>
          <div>
            <Label>Recipient</Label>
            <Input
              type="email"
              placeholder={profile?.email ?? "you@example.com"}
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
            />
          </div>
          <Button onClick={handleSendTest} disabled={sendingTest}>
            <Send className="mr-2 h-4 w-4" />
            {sendingTest ? "Sending…" : "Send Test Email"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
