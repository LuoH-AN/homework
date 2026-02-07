import { NextResponse } from "next/server";
import { addHours, formatDate } from "@/lib/date";
import { getToken } from "@/lib/auth";
import { getSubjects } from "@/lib/env";
import { loadData } from "@/lib/store";
import { normalizeReminders } from "@/lib/reminders";

export const runtime = "nodejs";

function isExpiredServer(dueDate: string | undefined, today: string) {
  if (!dueDate) return false;
  return dueDate <= today;
}

export async function GET() {
  const subjects = getSubjects();
  const today = formatDate(new Date());
  const token = await getToken();
  const data = await loadData();
  const reminders = normalizeReminders(data.reminders);

  const allAssignments = data.assignments ?? [];
  const activeAssignments = allAssignments.filter(
    (item) => item.active && !isExpiredServer(item.due_date, today)
  );
  const expiredAssignments = allAssignments.filter(
    (item) => item.active && isExpiredServer(item.due_date, today)
  );

  if (!token || !data.students[token]) {
    return NextResponse.json({
      registered: false,
      manual_completion_date: today,
      manual_completed_subjects: [],
      submitted_subjects_today: [],
      subjects,
      submissions: [],
      assignments: activeAssignments,
      expired_assignments: expiredAssignments,
      reminders
    });
  }

  const student = data.students[token];
  const manualCompletions = data.manual_completions ?? {};
  const manualCompleted =
    manualCompletions[today]?.[student.name] ?? [];
  const submissionIds = data.student_submissions[token] ?? [];
  const rawSubmissions = submissionIds
    .map((id) => data.submissions[id])
    .filter(Boolean);

  // 使用服务端时区判断今天提交的科目
  const submittedSubjectsToday = Array.from(
    new Set(
      rawSubmissions
        .filter((s) => formatDate(new Date(s.created_at)) === today)
        .map((s) => s.subject)
    )
  );

  const submissions = rawSubmissions
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
    manual_completion_date: today,
    manual_completed_subjects: manualCompleted,
    submitted_subjects_today: submittedSubjectsToday,
    subjects,
    submissions,
    assignments: activeAssignments,
    expired_assignments: expiredAssignments,
    reminders
  });
}
