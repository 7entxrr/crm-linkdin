import { z } from "zod";

export const settingsSchema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  fromEmail: z.string().email("Valid from email required"),
  defaultTemplateId: z.string().optional(),
  smtp: z.object({
    host: z.string().min(1, "SMTP host required"),
    port: z.coerce.number().min(1),
    secure: z.boolean(),
    user: z.string().min(1, "SMTP user required"),
    pass: z.string().min(1, "SMTP password required"),
  }),
});

export type SettingsFormValues = z.infer<typeof settingsSchema>;
