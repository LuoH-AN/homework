import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { loadData } from "@/lib/store";
import { formatDate } from "@/lib/date";

export const runtime = "nodejs";

function csvEscape(value: string) {
  if (value.includes("\"") || value.includes(",") || value.includes("\n")) {
    return `"${value.replace(/\"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date")?.trim();
  const today = formatDate(new Date());
  const date = dateParam || today;

  const data = await loadData();
  const submissions = Object.values(data.submissions).filter(Boolean);

  const rows = [
    [
      "姓名",
      "科目",
      "提交时间",
      "最近更新",
      "流言",
      "批改状态",
      "分数",
      "批改意见",
      "图片数量"
    ]
  ];

  submissions.forEach((submission) => {
    const createdDate = formatDate(new Date(submission.created_at));
    if (createdDate !== date) return;

    const review = submission.review ?? { status: "pending" };
    rows.push([
      submission.student_name,
      submission.subject,
      submission.created_at,
      submission.updated_at,
      submission.note ?? "",
      review.status === "reviewed" ? "已批改" : "待批改",
      typeof review.score === "number" ? String(review.score) : "",
      review.comment ?? "",
      String(submission.photo_file_ids?.length ?? 0)
    ]);
  });

  const csv = rows.map((row) => row.map((cell) => csvEscape(cell)).join(",")).join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=homework-${date}.csv`
    }
  });
}
