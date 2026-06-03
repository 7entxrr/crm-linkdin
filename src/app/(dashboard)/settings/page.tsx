"use client";

import { useEffect, useState } from "react";
import { Building2, Mail, Server, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { AnimatedSection } from "@/components/shared/animated-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSettings, saveSettings } from "@/lib/services/settings";
import { getTemplates } from "@/lib/services/templates";
import { logActivity } from "@/lib/services/activities";
import { useAuth } from "@/context/auth-context";
import { DEFAULT_AUTOMATION, type AppSettings, type AutomationSettings, type EmailTemplate } from "@/types";

export default function SettingsPage() {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getSettings(), getTemplates()]).then(([s, t]) => {
      setSettings(s);
      setTemplates(t);
    });
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await saveSettings(settings);
      await logActivity({
        userId: profile!.id,
        userName: profile!.name,
        action: "Settings updated",
        entityType: "settings",
        entityId: "app",
      });
      toast.success("Settings saved");
    } catch (err) {
      toast.error(
        err instanceof Error ? `Failed to save settings: ${err.message}` : "Failed to save settings"
      );
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return null;

  const automation: AutomationSettings = settings.automation ?? DEFAULT_AUTOMATION;
  const updateAutomation = (patch: Partial<AutomationSettings>) =>
    setSettings({ ...settings, automation: { ...automation, ...patch } });

  return (
    <div className="space-y-8 max-w-2xl">
      <PageHeader
        title="Settings"
        description="Company, email, and SMTP configuration"
      />

      <SectionCard
        title="Company"
        description="Branding and default outreach settings"
        icon={Building2}
        delay={0.05}
      >
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label>Company Name</Label>
            <Input
              value={settings.companyName}
              onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>From Email</Label>
            <Input
              type="email"
              value={settings.fromEmail}
              onChange={(e) => setSettings({ ...settings, fromEmail: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Default Template</Label>
            <Select
              value={settings.defaultTemplateId ?? ""}
              onValueChange={(v) =>
                setSettings({ ...settings, defaultTemplateId: v ?? undefined })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {templates.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Create templates in Outreach → New Template
              </p>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="SMTP Settings"
        description="Configure your email delivery provider"
        icon={Server}
        delay={0.1}
      >
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label>Host</Label>
            <Input
              value={settings.smtp.host}
              onChange={(e) =>
                setSettings({ ...settings, smtp: { ...settings.smtp, host: e.target.value } })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Port</Label>
              <Input
                type="number"
                value={settings.smtp.port}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    smtp: { ...settings.smtp, port: parseInt(e.target.value) || 587 },
                  })
                }
              />
            </div>
            <div className="flex items-end gap-2 pb-2">
              <Switch
                checked={settings.smtp.secure}
                onCheckedChange={(v) =>
                  setSettings({ ...settings, smtp: { ...settings.smtp, secure: v } })
                }
              />
              <Label>Secure (TLS)</Label>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Username</Label>
            <Input
              value={settings.smtp.user}
              onChange={(e) =>
                setSettings({ ...settings, smtp: { ...settings.smtp, user: e.target.value } })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input
              type="password"
              value={settings.smtp.pass}
              onChange={(e) =>
                setSettings({ ...settings, smtp: { ...settings.smtp, pass: e.target.value } })
              }
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Automation"
        description="Control how candidates are assigned, enrolled, and emailed automatically"
        icon={Zap}
        delay={0.15}
      >
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-muted/30 p-4">
            <div className="space-y-0.5">
              <Label>Auto-assign new candidates</Label>
              <p className="text-xs text-muted-foreground">
                Distribute imported candidates evenly across active recruiters (round-robin).
              </p>
            </div>
            <Switch
              checked={automation.autoAssign}
              onCheckedChange={(v) => updateAutomation({ autoAssign: v })}
            />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-muted/30 p-4">
            <div className="space-y-0.5">
              <Label>Auto-enroll on import</Label>
              <p className="text-xs text-muted-foreground">
                Automatically start the follow-up sequence for imported candidates with an email.
              </p>
            </div>
            <Switch
              checked={automation.autoEnrollOnImport}
              onCheckedChange={(v) => updateAutomation({ autoEnrollOnImport: v })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Daily send cap</Label>
            <Input
              type="number"
              min={0}
              value={automation.dailyCap}
              onChange={(e) =>
                updateAutomation({ dailyCap: Math.max(parseInt(e.target.value) || 0, 0) })
              }
            />
            <p className="text-xs text-muted-foreground">
              Max automated emails sent per day across all sequences. 0 = unlimited.
            </p>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-muted/30 p-4">
            <div className="space-y-0.5">
              <Label>Business hours only</Label>
              <p className="text-xs text-muted-foreground">
                Only send automated emails inside the window below (server time).
              </p>
            </div>
            <Switch
              checked={automation.businessHoursOnly}
              onCheckedChange={(v) => updateAutomation({ businessHoursOnly: v })}
            />
          </div>

          {automation.businessHoursOnly && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Send from (hour)</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={automation.sendStartHour}
                  onChange={(e) =>
                    updateAutomation({
                      sendStartHour: Math.min(Math.max(parseInt(e.target.value) || 0, 0), 23),
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Send until (hour)</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={automation.sendEndHour}
                  onChange={(e) =>
                    updateAutomation({
                      sendEndHour: Math.min(Math.max(parseInt(e.target.value) || 0, 0), 23),
                    })
                  }
                />
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      <AnimatedSection delay={0.2} className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Mail className="mr-2 h-4 w-4" />
              Save Settings
            </>
          )}
        </Button>
      </AnimatedSection>
    </div>
  );
}
