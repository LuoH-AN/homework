"use client";

import Link from "next/link";
import { useState } from "react";
import { useMe } from "../components/me-context";

export default function RegisterPage() {
  const { loading, me, error: loadError, refresh } = useMe();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleRegister(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!name.trim()) {
      setError("请输入姓名");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() })
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error ?? "注册失败");
        return;
      }
      setName("");
      setNotice("登记成功，姓名已锁定");
      await refresh();
    } catch (err) {
      setError("注册失败，请稍后再试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <div className="eyebrow">Register</div>
          <h1>首次登记</h1>
          <p className="subtitle">填写姓名后将用于作业归档与历史记录。</p>
        </div>
        <div className="status-stack">
          <Link className="button ghost small" href="/submit">
            去提交
          </Link>
          <Link className="button small" href="/history">
            看记录
          </Link>
        </div>
      </header>

      {loadError ? <div className="error animate-in">{loadError}</div> : null}
      {error ? <div className="error animate-in">{error}</div> : null}
      {notice ? <div className="notice animate-in">{notice}</div> : null}

      {loading && !me ? (
        <section className="card animate-in">加载中…</section>
      ) : me?.registered ? (
        <section className="card animate-in">
          <h2 className="section-title">已完成登记</h2>
          <p className="hint">姓名已锁定为：{me.student?.name}</p>
          <div className="form-actions">
            <Link className="button" href="/submit">
              立即提交作业
            </Link>
            <Link className="button ghost" href="/history">
              查看提交记录
            </Link>
          </div>
        </section>
      ) : (
        <section className="card animate-in">
          <h2 className="section-title">绑定姓名</h2>
          <form onSubmit={handleRegister}>
            <div className="field">
              <label htmlFor="name">姓名（提交后不可修改）</label>
              <input
                id="name"
                type="text"
                placeholder="请输入真实姓名"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="form-actions">
              <button className="button" type="submit" disabled={busy}>
                {busy ? "提交中…" : "确认登记"}
              </button>
            </div>
          </form>
        </section>
      )}
    </main>
  );
}
