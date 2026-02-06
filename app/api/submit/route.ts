import { NextResponse } from "next/server";
import { buildSubmitCaption } from "@/lib/captions";
import { getToken } from "@/lib/auth";
import { getSubjects } from "@/lib/env";
import { nowIso } from "@/lib/date";
import { loadData, saveData } from "@/lib/store";
import { sendHomeworkPhotos } from "@/lib/telegram";
import type { Submission } from "@/lib/types";

export const runtime = "nodejs";

// 判断作业是否已过期
function isExpired(dueDate?: string) {
  if (!dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(23, 59, 59, 999);
  return due < today;
}

export async function POST(request: Request) {
  const token = await getToken();
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
  const note = String(form.get("note") ?? "").trim();
  const files = form
    .getAll("image")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const subjects = getSubjects();

  if (!subject || !subjects.includes(subject)) {
    return NextResponse.json({ error: "科目无效" }, { status: 400 });
  }

  // 检查该科目是否有活跃的未过期作业
  const assignments = data.assignments ?? [];
  const activeAssignment = assignments.find(
    (item) => item.subject === subject && item.active && !isExpired(item.due_date)
  );
  if (!activeAssignment) {
    return NextResponse.json({ error: "该科目没有可提交的作业或已过期" }, { status: 400 });
  }

  if (files.length === 0) {
    return NextResponse.json({ error: "请上传图片" }, { status: 400 });
  }

  if (files.length > 10) {
    return NextResponse.json({ error: "最多上传 10 张图片" }, { status: 400 });
  }

  const now = new Date();
  const caption = buildSubmitCaption({ name: student.name, subject, when: now });
  const messages = await sendHomeworkPhotos(files, caption);
  const photoEntries = messages.map((message) => {
    const photos = message?.photo ?? [];
    const largest = photos[photos.length - 1];
    return {
      file_id: largest?.file_id,
      file_unique_id: largest?.file_unique_id,
      message_id: message?.message_id
    };
  });

  if (photoEntries.length !== files.length || photoEntries.some((entry) => !entry.file_id)) {
    return NextResponse.json({ error: "Telegram 返回异常" }, { status: 500 });
  }

  const submissionId = crypto.randomUUID();
  const createdAt = nowIso();

  const photoFileIds = photoEntries.map((entry) => entry.file_id as string);
  const photoUniqueIds = photoEntries
    .map((entry) => entry.file_unique_id)
    .filter(Boolean) as string[];
  const messageIds = photoEntries.map((entry) => entry.message_id as number);

  const submission: Submission = {
    id: submissionId,
    student_token: token,
    student_name: student.name,
    subject,
    created_at: createdAt,
    updated_at: createdAt,
    photo_file_ids: photoFileIds,
    photo_unique_ids: photoUniqueIds.length ? photoUniqueIds : undefined,
    tg_message_ids: messageIds,
    note: note || undefined,
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
