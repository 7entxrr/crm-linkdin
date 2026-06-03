import { z } from "zod";

export const recruiterSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  status: z.enum(["active", "inactive"]),
});

export type RecruiterFormValues = z.infer<typeof recruiterSchema>;
