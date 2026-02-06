import { NextResponse } from "next/server";
import { getToken } from "@/lib/auth";
import { loadData } from "@/lib/store";
import { getFileById } from "@/lib/telegram";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const submissionId = searchParams.get("submission_id") ?? "";
  const fileId = searchParams.get("file_id") ?? "";

  if (!submissionId || !fileId) {
    return NextResponse.json({ error: "参数缺失" }, { status: 400 });
  }

  const token = await getToken();
  if (!token) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const data = await loadData();
  const submission = data.submissions[submissionId];
  if (!submission || submission.student_token !== token) {
    return NextResponse.json({ error: "未授权" }, { status: 403 });
  }

  const legacyId = (submission as { photo_file_id?: string }).photo_file_id;
  const allowedIds =
    submission.photo_file_ids?.length > 0
      ? submission.photo_file_ids
      : legacyId
        ? [legacyId]
        : [];

  if (!allowedIds.includes(fileId)) {
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
