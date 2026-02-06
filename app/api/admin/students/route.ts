import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { loadData, saveData } from "@/lib/store";
import { getSubjects } from "@/lib/env";
import { formatDate, nowIso } from "@/lib/date";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date")?.trim() || formatDate(new Date());

  const data = await loadData();
  const subjects = getSubjects();
  const completions = (data.manual_completions ?? {})[date] ?? {};

  const students = Object.entries(data.students)
    .filter(([, student]) => student && student.name !== "组长")
    .map(([token, student]) => ({
      token,
      name: student.name,
      created_at: student.created_at,
      last_seen_at: student.last_seen_at
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

  return NextResponse.json({
    ok: true,
    date,
    subjects,
    students,
    completions
  });
}

export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const name = body.name?.trim() ?? "";

  if (!name || name.length > 24) {
    return NextResponse.json(
      { error: "姓名不能为空且长度需小于 24" },
      { status: 400 }
    );
  }
  if (name === "组长") {
    return NextResponse.json({ error: "该姓名不可用" }, { status: 400 });
  }

  const data = await loadData();
  if (data.name_index[name]) {
    return NextResponse.json({ error: "姓名已存在" }, { status: 400 });
  }

  const token = crypto.randomUUID();
  data.students[token] = { name, created_at: nowIso() };
  data.name_index[name] = token;
  data.student_submissions[token] = [];

  await saveData(data);

  return NextResponse.json({ ok: true, token, name });
}

export async function PATCH(request: Request) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const body = (await request.json().catch(() => ({}))) as {
    token?: string;
    name?: string;
  };
  const token = body.token?.trim() ?? "";
  const name = body.name?.trim() ?? "";

  if (!token) {
    return NextResponse.json({ error: "缺少学生" }, { status: 400 });
  }
  if (!name || name.length > 24) {
    return NextResponse.json(
      { error: "姓名不能为空且长度需小于 24" },
      { status: 400 }
    );
  }
  if (name === "组长") {
    return NextResponse.json({ error: "该姓名不可用" }, { status: 400 });
  }

  const data = await loadData();
  const student = data.students[token];
  if (!student) {
    return NextResponse.json({ error: "学生不存在" }, { status: 404 });
  }

  const existingToken = data.name_index[name];
  if (existingToken && existingToken !== token) {
    return NextResponse.json({ error: "姓名已存在" }, { status: 400 });
  }

  const oldName = student.name;
  if (oldName !== name) {
    delete data.name_index[oldName];
    data.name_index[name] = token;
    student.name = name;
    data.students[token] = student;

    Object.values(data.submissions).forEach((submission) => {
      if (submission && submission.student_token === token) {
        submission.student_name = name;
      }
    });

    const manual = data.manual_completions ?? {};
    Object.keys(manual).forEach((date) => {
      const byStudent = manual[date];
      if (!byStudent || !byStudent[oldName]) return;
      const existing = new Set(byStudent[name] ?? []);
      byStudent[oldName].forEach((subject) => existing.add(subject));
      byStudent[name] = Array.from(existing);
      delete byStudent[oldName];
      if (Object.keys(byStudent).length === 0) {
        delete manual[date];
      }
    });
    data.manual_completions = manual;
  }

  await saveData(data);

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const body = (await request.json().catch(() => ({}))) as { token?: string };
  const token = body.token?.trim() ?? "";
  if (!token) {
    return NextResponse.json({ error: "缺少学生" }, { status: 400 });
  }

  const data = await loadData();
  const student = data.students[token];
  if (!student) {
    return NextResponse.json({ error: "学生不存在" }, { status: 404 });
  }

  const name = student.name;
  delete data.students[token];
  delete data.name_index[name];

  const submissionIds = new Set(data.student_submissions[token] ?? []);
  delete data.student_submissions[token];

  Object.entries(data.submissions).forEach(([id, submission]) => {
    if (!submission) return;
    if (submission.student_token === token || submissionIds.has(id)) {
      delete data.submissions[id];
    }
  });

  const manual = data.manual_completions ?? {};
  Object.keys(manual).forEach((date) => {
    const byStudent = manual[date];
    if (!byStudent || !byStudent[name]) return;
    delete byStudent[name];
    if (Object.keys(byStudent).length === 0) {
      delete manual[date];
    }
  });
  data.manual_completions = manual;

  await saveData(data);

  return NextResponse.json({ ok: true });
}
