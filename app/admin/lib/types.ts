export type ReviewInfo = {
  status: "pending" | "reviewed" | "returned";
  score?: number;
  comment?: string;
  reviewed_at?: string;
  reviewer?: string;
};

export type AdminSubmission = {
  id: string;
  student_name: string;
  subject: string;
  created_at: string;
  updated_at: string;
  note: string;
  photo_file_ids: string[];
  review: ReviewInfo;
};

export type Assignment = {
  id: string;
  subject: string;
  title: string;
  description?: string;
  due_date?: string;
  active: boolean;
};

export type ReminderItem = {
  title: string;
  body: string;
  meta: string;
};

export type OverviewResponse = {
  ok: boolean;
  subjects: string[];
  assignments: Assignment[];
  submissions: AdminSubmission[];
  reminders: ReminderItem[];
};

export type AdminStudent = {
  token: string;
  name: string;
  created_at: string;
  last_seen_at?: string;
};

export type StudentsResponse = {
  ok: boolean;
  date: string;
  subjects: string[];
  students: AdminStudent[];
  completions: Record<string, string[]>;
};
