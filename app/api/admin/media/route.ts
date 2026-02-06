import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { loadData } from "@/lib/store";
import { getFileById } from "@/lib/telegram";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const guard = requireAdmin(request);
  if (guard) return guard;

  const { searchParams } = new URL(request.url);
  const submissionId = searchParams.get("submission_id") ?? "";
  const fileId = searchParams.get("file_id") ?? "";

  if (!submissionId || !fileId) {
    return NextResponse.json({ error: "参数缺失" }, { status: 400 });
  }

  const data = await loadData();
  const submission = data.submissions[submissionId];
  if (!submission || !submission.photo_file_ids?.includes(fileId)) {
    return NextResponse.json({ error: "未授权" }, { status: 403 });
  }

  const fileRes = await getFileById(fileId);
  const contentType = fileRes.headers.get("content-type") ?? "image/jpeg";
  const body = fileRes.body ?? (await fileRes.arrayBuffer());
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600"
    }
  });
}
