import { z } from "zod";

export const candidateSchema = z.object({
  fullName: z.string().min(2, "Name is required"),
  role: z.string().min(1, "Role is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().min(7, "Phone is required"),
  location: z.string().min(1, "Location is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(2, "State is required"),
  linkedinUrl: z.string().url().optional().or(z.literal("")),
  experience: z.string().min(1, "Experience is required"),
  currentEmployer: z.string().min(1, "Employer is required"),
  certification: z.string().optional(),
  status: z.enum([
    "new_lead",
    "contacted",
    "replied",
    "interested",
    "interview_scheduled",
    "closed",
  ]),
  assignedRecruiterId: z.string().optional(),
  tags: z.string().optional(),
});

export type CandidateFormValues = z.infer<typeof candidateSchema>;
