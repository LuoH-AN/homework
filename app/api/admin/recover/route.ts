import { NextResponse } from "next/server";
import { getAdminSecret } from "@/lib/env";
import { loadData, saveData } from "@/lib/store";
import { setToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = getAdminSecret();
  if (!secret) {
    return NextResponse.json({ error: "未配置管理员" }, { status: 404 });
  }

  const provided = request.headers.get("x-admin-secret");
  if (provided !== secret) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    set_cookie?: boolean;
  };
  const name = body.name?.trim() ?? "";
  if (!name) {
    return NextResponse.json({ error: "缺少姓名" }, { status: 400 });
  }

  const data = await loadData();
  const oldToken = data.name_index[name];
  if (!oldToken) {
    return NextResponse.json({ error: "姓名不存在" }, { status: 404 });
  }

  const newToken = crypto.randomUUID();
  const student = data.students[oldToken];
  data.students[newToken] = student;
  delete data.students[oldToken];

  data.name_index[name] = newToken;

  const submissions = data.student_submissions[oldToken] ?? [];
  data.student_submissions[newToken] = submissions;
  delete data.student_submissions[oldToken];

  submissions.forEach((id) => {
    const submission = data.submissions[id];
    if (submission) {
      submission.student_token = newToken;
      data.submissions[id] = submission;
    }
  });

  await saveData(data);

  const response = NextResponse.json({ ok: true, token: newToken });
  if (body.set_cookie) {
    setToken(response, newToken);
  }
  return response;
}
