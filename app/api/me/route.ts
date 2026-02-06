import { NextResponse } from "next/server";
import { addHours } from "@/lib/date";
import { getToken } from "@/lib/auth";
import { getSubjects } from "@/lib/env";
import { loadData } from "@/lib/store";
import { normalizeReminders } from "@/lib/reminders";

export const runtime = "nodejs";

export async function GET() {
  const subjects = getSubjects();
  const token = await getToken();
  const data = await loadData();
  const reminders = normalizeReminders(data.reminders);

  if (!token || !data.students[token]) {
    return NextResponse.json({
      registered: false,
      subjects,
      submissions: [],
      assignments: (data.assignments ?? []).filter((item) => item.active),
      reminders
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
      const isReturned = submission.review?.status === "returned";
      const legacyId = (submission as { photo_file_id?: string }).photo_file_id;
      return {
        id: submission.id,
        subject: submission.subject,
        created_at: submission.created_at,
        updated_at: submission.updated_at,
        photo_file_ids:
          submission.photo_file_ids?.length > 0
            ? submission.photo_file_ids
            : legacyId
              ? [legacyId]
              : [],
        editable: isReturned || new Date() <= new Date(deadline),
        edit_deadline: deadline,
        note: submission.note ?? "",
        review: submission.review ?? { status: "pending" }
      };
    });

  return NextResponse.json({
    registered: true,
    student: { name: student.name },
    subjects,
    submissions,
    assignments: (data.assignments ?? []).filter((item) => item.active),
    reminders
  });
}
