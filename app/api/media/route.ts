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

  const token = getToken();
  if (!token) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const data = await loadData();
  const submission = data.submissions[submissionId];
  if (!submission || submission.student_token !== token) {
    return NextResponse.json({ error: "未授权" }, { status: 403 });
  }

  if (submission.photo_file_id !== fileId) {
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
