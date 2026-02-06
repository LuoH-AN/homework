import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { loadData } from "@/lib/store";
import { getSubjects } from "@/lib/env";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const data = await loadData();
  const subjects = getSubjects();

  const submissions = Object.values(data.submissions)
    .filter(Boolean)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .map((submission) => ({
      id: submission.id,
      student_name: submission.student_name,
      subject: submission.subject,
      created_at: submission.created_at,
      updated_at: submission.updated_at,
      note: submission.note ?? "",
      photo_file_ids: submission.photo_file_ids ?? [],
      review: submission.review ?? { status: "pending" }
    }));

  return NextResponse.json({
    ok: true,
    subjects,
    assignments: data.assignments ?? [],
    submissions
  });
}
