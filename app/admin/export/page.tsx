"use client";

import { useEffect, useState } from "react";
import AdminLogin from "../components/admin-login";
import { useAdminAuth } from "../lib/admin-auth";

export default function AdminExportPage() {
  const { ready, secret, login, authenticating, authError, logout } = useAdminAuth();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [exportStartDate, setExportStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [exportEndDate, setExportEndDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [exportBusy, setExportBusy] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(null), 3000);
    return () => window.clearTimeout(timer);
  }, [error]);

  async function handleExport() {
    setError(null);
    setNotice(null);
    setExportBusy(true);
    try {
      const params = new URLSearchParams();
      params.set("start", exportStartDate);
      params.set("end", exportEndDate);
      const res = await fetch(`/api/admin/export?${params.toString()}`, {
        headers: { "x-admin-secret": secret }
      });
      if (res.status === 401 || res.status === 403) {
        logout();
        setError("管理员密钥已失效，请重新登录");
        return;
      }
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error ?? "导出失败");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      const filename =
        exportStartDate === exportEndDate
          ? `homework-${exportStartDate}.docx`
          : `homework-${exportStartDate}-to-${exportEndDate}.docx`;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setNotice("导出成功");
    } catch (err) {
      setError("导出失败，请稍后再试");
    } finally {
      setExportBusy(false);
    }
  }

  if (!ready) {
    return (
      <main className="page">
        <section className="card animate-in">加载中…</section>
      </main>
    );
  }

  if (!secret) {
    return (
      <main className="page">
        <header className="page-header">
          <div>
            <div className="eyebrow">Admin</div>
            <h1>导出记录</h1>
            <p className="subtitle">请先登录管理员密钥。</p>
          </div>
        </header>
        <AdminLogin onLogin={login} loading={authenticating} error={authError} />
      </main>
    );
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <div className="eyebrow">Admin</div>
          <h1>导出记录</h1>
          <p className="subtitle">选择日期范围导出 Word 文档。</p>
        </div>
      </header>

      {error ? <div className="error toast animate-in">{error}</div> : null}
      {notice ? <div className="notice toast animate-in">{notice}</div> : null}

      <section className="card animate-in">
        <div className="section-title">导出提交记录</div>
        <p className="hint">选择日期范围，导出为 Word 文档。</p>
        <div className="export-dates">
          <div className="field">
            <label htmlFor="export-start">开始日期</label>
            <input
              id="export-start"
              type="date"
              value={exportStartDate}
              onChange={(event) => setExportStartDate(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="export-end">结束日期</label>
            <input
              id="export-end"
              type="date"
              value={exportEndDate}
              onChange={(event) => setExportEndDate(event.target.value)}
            />
          </div>
        </div>
        <div className="form-actions">
          <button
            className="button ghost"
            type="button"
            onClick={() => {
              const today = new Date().toISOString().slice(0, 10);
              setExportStartDate(today);
              setExportEndDate(today);
            }}
          >
            今天
          </button>
          <button
            className="button ghost"
            type="button"
            onClick={() => {
              const today = new Date();
              const weekAgo = new Date(today);
              weekAgo.setDate(weekAgo.getDate() - 7);
              setExportStartDate(weekAgo.toISOString().slice(0, 10));
              setExportEndDate(today.toISOString().slice(0, 10));
            }}
          >
            最近一周
          </button>
          <button className="button" type="button" onClick={handleExport} disabled={exportBusy}>
            {exportBusy ? "导出中…" : "导出 Word"}
          </button>
        </div>
      </section>
    </main>
  );
}
