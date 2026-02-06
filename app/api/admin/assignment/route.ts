import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { loadData, saveData } from "@/lib/store";
import { nowIso } from "@/lib/date";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const guard = requireAdmin(request);
  if (guard) return guard;

  const body = (await request.json().catch(() => ({}))) as {
    subject?: string;
    title?: string;
    description?: string;
    due_date?: string;
  };

  const subject = body.subject?.trim() ?? "";
  const title = body.title?.trim() ?? "";
  if (!subject || !title) {
    return NextResponse.json({ error: "请填写科目与标题" }, { status: 400 });
  }

  const data = await loadData();
  const now = nowIso();
  const assignment = {
    id: crypto.randomUUID(),
    subject,
    title,
    description: body.description?.trim() || undefined,
    due_date: body.due_date?.trim() || undefined,
    created_at: now,
    updated_at: now,
    active: true
  };

  data.assignments = [...(data.assignments ?? []), assignment];
  await saveData(data);

  return NextResponse.json({ ok: true, assignment });
}

export async function PATCH(request: Request) {
  const guard = requireAdmin(request);
  if (guard) return guard;

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    subject?: string;
    title?: string;
    description?: string;
    due_date?: string;
    active?: boolean;
  };

  const id = body.id?.trim() ?? "";
  if (!id) {
    return NextResponse.json({ error: "缺少作业编号" }, { status: 400 });
  }

  const data = await loadData();
  const assignments = data.assignments ?? [];
  const index = assignments.findIndex((item) => item.id === id);
  if (index === -1) {
    return NextResponse.json({ error: "作业不存在" }, { status: 404 });
  }

  const assignment = assignments[index];

  if (Object.prototype.hasOwnProperty.call(body, "subject")) {
    const subject = body.subject?.trim() ?? "";
    if (!subject) {
      return NextResponse.json({ error: "科目不能为空" }, { status: 400 });
    }
    assignment.subject = subject;
  }

  if (Object.prototype.hasOwnProperty.call(body, "title")) {
    const title = body.title?.trim() ?? "";
    if (!title) {
      return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
    }
    assignment.title = title;
  }

  if (Object.prototype.hasOwnProperty.call(body, "description")) {
    assignment.description = body.description?.trim() || undefined;
  }

  if (Object.prototype.hasOwnProperty.call(body, "due_date")) {
    assignment.due_date = body.due_date?.trim() || undefined;
  }

  if (typeof body.active === "boolean") {
    assignment.active = body.active;
  }

  assignment.updated_at = nowIso();
  assignments[index] = assignment;
  data.assignments = assignments;
  await saveData(data);

  return NextResponse.json({ ok: true, assignment });
}
