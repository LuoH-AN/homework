import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { loadData, saveData } from "@/lib/store";
import { nowIso } from "@/lib/date";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const body = (await request.json().catch(() => ({}))) as {
    submission_ids?: string[];
    status?: "pending" | "reviewed" | "returned";
    score?: number;
    comment?: string;
    reviewer?: string;
  };

  const ids = Array.isArray(body.submission_ids)
    ? body.submission_ids.map((id) => id.trim()).filter(Boolean)
    : [];
  if (!ids.length) {
    return NextResponse.json({ error: "缺少提交记录" }, { status: 400 });
  }

  if (!body.status) {
    return NextResponse.json({ error: "缺少批改状态" }, { status: 400 });
  }

  const data = await loadData();
  let updated = 0;
  const skipped: string[] = [];

  ids.forEach((submissionId) => {
    const submission = data.submissions[submissionId];
    if (!submission) {
      skipped.push(submissionId);
      return;
    }

    if (body.status === "pending") {
      delete submission.review;
    } else {
      const score =
        typeof body.score === "number" && !Number.isNaN(body.score)
          ? body.score
          : undefined;
      submission.review = {
        status: body.status === "returned" ? "returned" : "reviewed",
        score,
        comment: body.comment?.trim() || undefined,
        reviewed_at: nowIso(),
        reviewer: body.reviewer?.trim() || undefined
      };
    }

    data.submissions[submissionId] = submission;
    updated += 1;
  });

  if (updated > 0) {
    await saveData(data);
  }

  return NextResponse.json({ ok: true, updated, skipped });
}
