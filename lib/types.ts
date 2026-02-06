export type Student = {
  name: string;
  created_at: string;
  last_seen_at?: string;
};

export type SubmissionHistory = {
  updated_at: string;
  photo_file_id: string;
  photo_unique_id?: string;
  tg_message_id: number;
};

export type Submission = {
  id: string;
  student_token: string;
  student_name: string;
  subject: string;
  created_at: string;
  updated_at: string;
  photo_file_id: string;
  photo_unique_id?: string;
  tg_message_id: number;
  edit_count: number;
  history: SubmissionHistory[];
};

export type DataFile = {
  version: 1;
  updated_at: string;
  students: Record<string, Student>;
  name_index: Record<string, string>;
  submissions: Record<string, Submission>;
  student_submissions: Record<string, string[]>;
};
