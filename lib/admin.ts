import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminSecret } from "./env";

const ADMIN_COOKIE = "hw_admin";

export async function requireAdmin(request: Request) {
  const secret = getAdminSecret();
  if (!secret) {
    return NextResponse.json({ error: "未配置管理员" }, { status: 404 });
  }

  const provided = request.headers.get("x-admin-secret");
  const cookieStore = await cookies();
  const cookieSecret = cookieStore.get(ADMIN_COOKIE)?.value;

  if (provided === secret || cookieSecret === secret) {
    return null;
  }

  return NextResponse.json({ error: "未授权" }, { status: 401 });
}

export function setAdminCookie(response: NextResponse, secret: string) {
  response.cookies.set(ADMIN_COOKIE, secret, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
}
