import { NextResponse } from "next/server";
import { buildSubmitCaption } from "@/lib/captions";
import { getToken } from "@/lib/auth";
import { getSubjects } from "@/lib/env";
import { nowIso } from "@/lib/date";
import { loadData, saveData } from "@/lib/store";
import { sendHomeworkPhoto } from "@/lib/telegram";
import type { Submission } from "@/lib/types";

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
  const subject = String(form.get("subject") ?? "").trim();
  const file = form.get("image");
  const subjects = getSubjects();

  if (!subject || !subjects.includes(subject)) {
    return NextResponse.json({ error: "科目无效" }, { status: 400 });
  }

  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: "请上传图片" }, { status: 400 });
  }

  const now = new Date();
  const caption = buildSubmitCaption({ name: student.name, subject, when: now });
  const message = await sendHomeworkPhoto(file, caption);
  const photos = message?.photo ?? [];
  const largest = photos[photos.length - 1];
  if (!largest?.file_id) {
    return NextResponse.json({ error: "Telegram 返回异常" }, { status: 500 });
  }

  const submissionId = crypto.randomUUID();
  const createdAt = nowIso();

  const submission: Submission = {
    id: submissionId,
    student_token: token,
    student_name: student.name,
    subject,
    created_at: createdAt,
    updated_at: createdAt,
    photo_file_id: largest.file_id,
    photo_unique_id: largest.file_unique_id,
    tg_message_id: message.message_id,
    edit_count: 0,
    history: []
  };

  data.submissions[submissionId] = submission;
  data.student_submissions[token] = [
    ...(data.student_submissions[token] ?? []),
    submissionId
  ];

  await saveData(data);

  return NextResponse.json({ ok: true, id: submissionId });
}
