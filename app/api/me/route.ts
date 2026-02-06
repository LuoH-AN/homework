import { NextResponse } from "next/server";
import { addHours, formatDate } from "@/lib/date";
import { getToken } from "@/lib/auth";
import { getSubjects } from "@/lib/env";
import { loadData } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const subjects = getSubjects();
  const token = getToken();
  const data = await loadData();

  if (!token || !data.students[token]) {
    return NextResponse.json({
      registered: false,
      subjects,
      submissions: []
    });
  }

  const student = data.students[token];
  const submissionIds = data.student_submissions[token] ?? [];
  const submissions = submissionIds
    .map((id) => data.submissions[id])
    .filter(Boolean)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .map((submission) => {
      const deadline = addHours(submission.created_at, 72);
      return {
        id: submission.id,
        subject: submission.subject,
        created_at: submission.created_at,
        updated_at: submission.updated_at,
        photo_file_id: submission.photo_file_id,
        editable: new Date() <= new Date(deadline),
        edit_deadline: deadline,
        tags: [
          `#${submission.subject}`,
          `#${formatDate(new Date(submission.created_at))}`
        ]
      };
    });

  return NextResponse.json({
    registered: true,
    student: { name: student.name },
    subjects,
    submissions
  });
}
