export type Student = {
  name: string;
  created_at: string;
  last_seen_at?: string;
};

export type ReviewInfo = {
  status: "pending" | "reviewed";
  score?: number;
  comment?: string;
  reviewed_at?: string;
  reviewer?: string;
};

export type Assignment = {
  id: string;
  subject: string;
  title: string;
  description?: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
  active: boolean;
};

export type SubmissionHistory = {
  updated_at: string;
  photo_file_ids: string[];
  photo_unique_ids?: string[];
  tg_message_ids: number[];
};

export type Submission = {
  id: string;
  student_token: string;
  student_name: string;
  subject: string;
  created_at: string;
  updated_at: string;
  photo_file_ids: string[];
  photo_unique_ids?: string[];
  tg_message_ids: number[];
  note?: string;
  review?: ReviewInfo;
  edit_count: number;
  history: SubmissionHistory[];
};

export type DataFile = {
  version: 3;
  updated_at: string;
  students: Record<string, Student>;
  name_index: Record<string, string>;
  submissions: Record<string, Submission>;
  student_submissions: Record<string, string[]>;
  assignments: Assignment[];
};
