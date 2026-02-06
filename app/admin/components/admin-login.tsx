"use client";

import { useState } from "react";

type AdminLoginProps = {
  title?: string;
  subtitle?: string;
  loading?: boolean;
  error?: string | null;
  onLogin: (secret: string) => Promise<boolean> | boolean;
};

export default function AdminLogin({
  title = "管理员登录",
  subtitle = "请输入 ADMIN_SECRET 进入管理后台。",
  loading = false,
  error,
  onLogin
}: AdminLoginProps) {
  const [secret, setSecret] = useState("");

  return (
    <section className="card animate-in">
      <h2 className="section-title">{title}</h2>
      <p className="hint">{subtitle}</p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          await onLogin(secret);
        }}
      >
        <div className="field">
          <label htmlFor="admin-secret">管理员密钥</label>
          <input
            id="admin-secret"
            type="password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            placeholder="输入 ADMIN_SECRET"
          />
        </div>
        {error ? <div className="error toast animate-in">{error}</div> : null}
        <div className="form-actions">
          <button className="button" type="submit" disabled={loading}>
            {loading ? "验证中…" : "进入管理"}
          </button>
        </div>
      </form>
    </section>
  );
}
