import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

const TOKEN_COOKIE = "hw_token";

export function getToken(): string | null {
  const store = cookies();
  return store.get(TOKEN_COOKIE)?.value ?? null;
}

export function setToken(response: NextResponse, token: string) {
  response.cookies.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
}
