import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { loadData, saveData } from "@/lib/store";
import { getSubjects } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const body = (await request.json().catch(() => ({}))) as {
    date?: string;
    student_name?: string;
    subject?: string;
    completed?: boolean;
  };

  const date = body.date?.trim() ?? "";
  const studentName = body.student_name?.trim() ?? "";
  const subject = body.subject?.trim() ?? "";
  const completed = Boolean(body.completed);

  if (!date || !studentName || !subject) {
    return NextResponse.json({ error: "参数不完整" }, { status: 400 });
  }

  const data = await loadData();
  if (!data.name_index[studentName]) {
    return NextResponse.json({ error: "学生不存在" }, { status: 404 });
  }

  const subjects = getSubjects();
  if (subjects.length && !subjects.includes(subject)) {
    return NextResponse.json({ error: "科目不存在" }, { status: 400 });
  }

  const manual = data.manual_completions ?? {};
  const byStudent = manual[date] ?? {};
  const list = new Set(byStudent[studentName] ?? []);

  if (completed) {
    list.add(subject);
  } else {
    list.delete(subject);
  }

  if (list.size > 0) {
    byStudent[studentName] = Array.from(list);
    manual[date] = byStudent;
  } else {
    delete byStudent[studentName];
    if (Object.keys(byStudent).length === 0) {
      delete manual[date];
    } else {
      manual[date] = byStudent;
    }
  }

  data.manual_completions = manual;
  await saveData(data);

  return NextResponse.json({ ok: true });
}
