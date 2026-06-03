export type UserRole = "admin" | "recruiter";
export type UserStatus = "active" | "inactive";

export type CandidateStatus =
  | "new_lead"
  | "contacted"
  | "replied"
  | "interested"
  | "interview_scheduled"
  | "closed";

export type OutreachStatus = "queued" | "sent" | "failed" | "replied";
export type FollowupStatus = "scheduled" | "sent" | "skipped" | "stopped";
export type SequenceStep = "day_1" | "day_3" | "day_7" | "day_14";
export type CandidateSource = "manual" | "apollo" | "pdl" | "csv";

export interface AppUser {
  id: string;
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface Candidate {
  id: string;
  fullName: string;
  role: string;
  email: string;
  phone: string;
  location: string;
  city: string;
  state: string;
  linkedinUrl?: string;
  experience: string;
  currentEmployer: string;
  certification?: string;
  /** Provider has an email on file but it may be masked until a paid plan is active. */
  emailAvailable?: boolean;
  /** Provider has a phone on file but it may be masked until a paid plan is active. */
  phoneAvailable?: boolean;
  status: CandidateStatus;
  assignedRecruiterId?: string;
  assignedRecruiterName?: string;
  tags: string[];
  apolloId?: string;
  apolloLastEnrichedAt?: Date;
  source?: CandidateSource;
  optedOut?: boolean;
  optedOutAt?: Date;
  emailBounced?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Outreach {
  id: string;
  candidateId: string;
  candidateName?: string;
  recruiterId: string;
  recruiterName?: string;
  templateId?: string;
  subject: string;
  body: string;
  channel: "email" | "sms";
  status: OutreachStatus;
  sentAt?: Date;
  opens?: number;
  clicks?: number;
  openedAt?: Date;
  firstClickAt?: Date;
  repliedAt?: Date;
  createdAt: Date;
}

export interface Followup {
  id: string;
  candidateId: string;
  candidateName?: string;
  recruiterId: string;
  recruiterName?: string;
  sequenceStep: SequenceStep;
  scheduledFor: Date;
  status: FollowupStatus;
  subject?: string;
  body?: string;
  sentAt?: Date;
  createdAt: Date;
}

export interface Activity {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  meta?: Record<string, unknown>;
  timestamp: Date;
}

export interface Note {
  id: string;
  candidateId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

export interface AutomationSettings {
  /** Auto-assign new candidates to recruiters via round-robin. */
  autoAssign: boolean;
  /** Auto-enroll imported candidates into the follow-up sequence. */
  autoEnrollOnImport: boolean;
  /** Max outreach emails sent per engine run (0 = unlimited). */
  dailyCap: number;
  /** Only send during the configured send window. */
  businessHoursOnly: boolean;
  /** Send window start hour (0-23, server local time). */
  sendStartHour: number;
  /** Send window end hour (0-23, server local time). */
  sendEndHour: number;
}

export interface AppSettings {
  id: string;
  companyName: string;
  logoUrl?: string;
  fromEmail: string;
  smtp: SmtpSettings;
  defaultTemplateId?: string;
  automation?: AutomationSettings;
}

export const DEFAULT_AUTOMATION: AutomationSettings = {
  autoAssign: false,
  autoEnrollOnImport: false,
  dailyCap: 0,
  businessHoursOnly: false,
  sendStartHour: 9,
  sendEndHour: 18,
};

export interface SourcingRule {
  id: string;
  name: string;
  personTitles: string[];
  locations: string[];
  organizationDomains?: string[];
  perRun: number;
  enabled: boolean;
  autoEnroll: boolean;
  assignedRecruiterId?: string;
  assignedRecruiterName?: string;
  lastRunAt?: Date;
  lastRunImported?: number;
  totalImported: number;
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface CandidateFilters {
  search?: string;
  role?: string;
  state?: string;
  city?: string;
  experience?: string;
  status?: CandidateStatus;
  recruiterId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface DashboardStats {
  totalCandidates: number;
  totalRecruiters: number;
  totalOutreach: number;
  responseRate: number;
  interestedCandidates: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  unsubscribeCount: number;
  bouncedCount: number;
}

export type NotificationType =
  | "reply_received"
  | "candidate_assigned"
  | "followup_due"
  | "followup_sent"
  | "task_due";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  read: boolean;
  createdAt: Date;
}

export type TaskStatus = "pending" | "completed" | "cancelled";

export interface Task {
  id: string;
  userId: string;
  userName: string;
  title: string;
  description?: string;
  candidateId?: string;
  candidateName?: string;
  dueAt: Date;
  status: TaskStatus;
  createdAt: Date;
  updatedAt?: Date;
}

export interface SavedView {
  id: string;
  userId: string;
  name: string;
  filters: CandidateFilters;
  createdAt: Date;
}

export interface Message {
  id: string;
  candidateId: string;
  direction: "inbound" | "outbound";
  subject?: string;
  body: string;
  fromEmail?: string;
  toEmail?: string;
  outreachId?: string;
  createdAt: Date;
}

export interface TemplateVariables {
  firstName: string;
  role: string;
  location: string;
  company: string;
}
