import { NextResponse } from "next/server";
import { buildEditCaption } from "@/lib/captions";
import { getToken } from "@/lib/auth";
import { loadData, saveData } from "@/lib/store";
import { nowIso } from "@/lib/date";
import { sendHomeworkPhoto } from "@/lib/telegram";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = getToken();
  if (!token) {
    return NextResponse.json({ error: "未绑定姓名" }, { status: 401 });
  }

  const data = await loadData();
  const student = data.students[token];
  if (!student) {
    return NextResponse.json({ error: "未绑定姓名" }, { status: 401 });
  }

  const form = await request.formData();
  const submissionId = String(form.get("submission_id") ?? "").trim();
  const file = form.get("image");

  if (!submissionId) {
    return NextResponse.json({ error: "缺少提交记录" }, { status: 400 });
  }

  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: "请上传图片" }, { status: 400 });
  }

  const submission = data.submissions[submissionId];
  if (!submission || submission.student_token !== token) {
    return NextResponse.json({ error: "提交记录不存在" }, { status: 404 });
  }

  const deadline = new Date(submission.created_at);
  deadline.setHours(deadline.getHours() + 72);
  if (new Date() > deadline) {
    return NextResponse.json({ error: "已超过修改期限" }, { status: 403 });
  }

  const updatedAt = new Date();
  const caption = buildEditCaption({
    name: student.name,
    subject: submission.subject,
    createdAt: new Date(submission.created_at),
    updatedAt
  });

  const message = await sendHomeworkPhoto(file, caption);
  const photos = message?.photo ?? [];
  const largest = photos[photos.length - 1];
  if (!largest?.file_id) {
    return NextResponse.json({ error: "Telegram 返回异常" }, { status: 500 });
  }

  submission.history.push({
    updated_at: submission.updated_at,
    photo_file_id: submission.photo_file_id,
    photo_unique_id: submission.photo_unique_id,
    tg_message_id: submission.tg_message_id
  });
  submission.photo_file_id = largest.file_id;
  submission.photo_unique_id = largest.file_unique_id;
  submission.tg_message_id = message.message_id;
  submission.updated_at = nowIso();
  submission.edit_count += 1;

  data.submissions[submissionId] = submission;
  await saveData(data);

  return NextResponse.json({ ok: true });
}
