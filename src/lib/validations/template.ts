import { z } from "zod";

export const templateSchema = z.object({
  name: z.string().min(2, "Template name is required"),
  subject: z.string().min(2, "Subject is required"),
  body: z.string().min(10, "Body is required"),
});

export type TemplateFormValues = z.infer<typeof templateSchema>;
