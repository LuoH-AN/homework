import { NextResponse } from "next/server";
import { buildEditCaption } from "@/lib/captions";
import { getToken } from "@/lib/auth";
import { loadData, saveData } from "@/lib/store";
import { nowIso } from "@/lib/date";
import { sendHomeworkPhotos } from "@/lib/telegram";

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
  const files = form
    .getAll("image")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (!submissionId) {
    return NextResponse.json({ error: "缺少提交记录" }, { status: 400 });
  }

  if (files.length === 0) {
    return NextResponse.json({ error: "请上传图片" }, { status: 400 });
  }

  if (files.length > 10) {
    return NextResponse.json({ error: "最多上传 10 张图片" }, { status: 400 });
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
    updatedAt
  });

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

  const photoFileIds = photoEntries.map((entry) => entry.file_id as string);
  const photoUniqueIds = photoEntries
    .map((entry) => entry.file_unique_id)
    .filter(Boolean) as string[];
  const messageIds = photoEntries.map((entry) => entry.message_id as number);

  submission.history.push({
    updated_at: submission.updated_at,
    photo_file_ids: submission.photo_file_ids,
    photo_unique_ids: submission.photo_unique_ids,
    tg_message_ids: submission.tg_message_ids
  });
  submission.photo_file_ids = photoFileIds;
  submission.photo_unique_ids = photoUniqueIds.length ? photoUniqueIds : undefined;
  submission.tg_message_ids = messageIds;
  submission.updated_at = nowIso();
  submission.edit_count += 1;

  data.submissions[submissionId] = submission;
  await saveData(data);

  return NextResponse.json({ ok: true });
}
