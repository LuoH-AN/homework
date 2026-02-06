import { NextResponse } from "next/server";
import { getAdminSecret } from "@/lib/env";
import { setAdminCookie } from "@/lib/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = getAdminSecret();
  if (!secret) {
    return NextResponse.json({ error: "未配置管理员" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { secret?: string };
  if (!body.secret || body.secret !== secret) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  setAdminCookie(response, secret);
  return response;
}
