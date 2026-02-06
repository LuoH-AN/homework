import { NextResponse } from "next/server";
import { getToken, setToken } from "@/lib/auth";
import { loadData, saveData } from "@/lib/store";
import { nowIso } from "@/lib/date";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const existingCookieToken = await getToken();
  if (existingCookieToken) {
    return NextResponse.json({ ok: true });
  }

  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const name = body.name?.trim() ?? "";

  if (!name || name.length > 24) {
    return NextResponse.json(
      { error: "姓名不能为空且长度需小于 24" },
      { status: 400 }
    );
  }

  const data = await loadData();
  const existingNameToken = data.name_index[name];
  if (existingNameToken) {
    const newToken = crypto.randomUUID();
    const student = data.students[existingNameToken];
    if (student) {
      data.students[newToken] = student;
      delete data.students[existingNameToken];
      data.name_index[name] = newToken;

      const submissions = data.student_submissions[existingNameToken] ?? [];
      data.student_submissions[newToken] = submissions;
      delete data.student_submissions[existingNameToken];

      submissions.forEach((id) => {
        const submission = data.submissions[id];
        if (submission) {
          submission.student_token = newToken;
          data.submissions[id] = submission;
        }
      });
    } else {
      data.students[newToken] = { name, created_at: nowIso() };
      data.name_index[name] = newToken;
      data.student_submissions[newToken] = [];
    }

    await saveData(data);

    const response = NextResponse.json({ ok: true, name, rebound: true });
    setToken(response, newToken);
    return response;
  }

  const token = crypto.randomUUID();
  data.students[token] = { name, created_at: nowIso() };
  data.name_index[name] = token;
  data.student_submissions[token] = [];

  await saveData(data);

  const response = NextResponse.json({ ok: true, name });
  setToken(response, token);
  return response;
}
