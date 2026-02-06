import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { loadData, saveData } from "@/lib/store";
import { nowIso } from "@/lib/date";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const body = (await request.json().catch(() => ({}))) as {
    submission_id?: string;
    status?: "pending" | "reviewed";
    score?: number;
    comment?: string;
    reviewer?: string;
  };

  const submissionId = body.submission_id?.trim() ?? "";
  if (!submissionId) {
    return NextResponse.json({ error: "缺少提交记录" }, { status: 400 });
  }

  const data = await loadData();
  const submission = data.submissions[submissionId];
  if (!submission) {
    return NextResponse.json({ error: "提交记录不存在" }, { status: 404 });
  }

  if (body.status === "pending") {
    delete submission.review;
  } else {
    const score =
      typeof body.score === "number" && !Number.isNaN(body.score)
        ? body.score
        : undefined;
    submission.review = {
      status: "reviewed",
      score,
      comment: body.comment?.trim() || undefined,
      reviewed_at: nowIso(),
      reviewer: body.reviewer?.trim() || undefined
    };
  }

  data.submissions[submissionId] = submission;
  await saveData(data);

  return NextResponse.json({ ok: true });
}
