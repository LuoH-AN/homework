"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "admin_secret";

export function useAdminAuth() {
  const [secret, setSecret] = useState("");
  const [ready, setReady] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setSecret(stored);
    }
    setReady(true);
  }, []);

  const login = useCallback(async (token: string) => {
    const trimmed = token.trim();
    if (!trimmed) {
      setAuthError("请输入管理员密钥");
      return false;
    }
    setAuthenticating(true);
    setAuthError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: trimmed })
      });
      if (!res.ok) {
        setAuthError("管理员密钥错误");
        return false;
      }
      window.localStorage.setItem(STORAGE_KEY, trimmed);
      setSecret(trimmed);
      return true;
    } catch (err) {
      setAuthError("加载失败，请稍后再试");
      return false;
    } finally {
      setAuthenticating(false);
    }
  }, []);

  const logout = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setSecret("");
  }, []);

  return {
    secret,
    ready,
    authenticating,
    authError,
    setAuthError,
    login,
    logout,
    setSecret
  };
}
