"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMe } from "../components/me-context";
import FilePicker from "../components/file-picker";
import { COMPRESS_UNSUPPORTED, compressImagesToJpeg } from "../lib/image";

// 判断作业是否已过期
function isExpired(dueDate?: string) {
  if (!dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(23, 59, 59, 999);
  return due < today;
}

export default function SubmitPage() {
  const { loading, me, error: loadError, refresh, setError: setLoadError } = useMe();
  const [subject, setSubject] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const subjects = useMemo(() => me?.subjects ?? [], [me]);
  const assignments = useMemo(() => me?.assignments ?? [], [me]);

  // 活跃的作业（未过期）
  const activeAssignments = useMemo(() => {
    return assignments.filter((item) => item.active && !isExpired(item.due_date));
  }, [assignments]);

  // 已过期的作业
  const expiredAssignments = useMemo(() => {
    return assignments.filter((item) => !item.active || isExpired(item.due_date));
  }, [assignments]);

  useEffect(() => {
    if (!subject && subjects.length) {
      setSubject(subjects[0]);
    }
  }, [subjects, subject]);

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

  useEffect(() => {
    if (!loadError) return;
    const timer = window.setTimeout(() => setLoadError(null), 3000);
    return () => window.clearTimeout(timer);
  }, [loadError, setLoadError]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!subject) {
      setError("请选择科目");
      return;
    }
    if (files.length === 0) {
      setError("请上传作业图片");
      return;
    }
    if (files.length > 10) {
      setError("最多上传 10 张图片");
      return;
    }
    setBusy(true);
    try {
      const compressed = await compressImagesToJpeg(files);
      const form = new FormData();
      form.append("subject", subject);
      compressed.forEach((item) => form.append("image", item));
      if (note.trim()) {
        form.append("note", note.trim());
      }
      const res = await fetch("/api/submit", {
        method: "POST",
        body: form,
        credentials: "include"
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload?.error ?? "提交失败");
        return;
      }
      setFiles([]);
      setNote("");
      setNotice("提交成功，已发送到群组");
      await refresh();
    } catch (err) {
      if (err instanceof Error && err.message === COMPRESS_UNSUPPORTED) {
        setError("当前浏览器不支持图片压缩，请更换浏览器后再试");
      } else {
        setError("提交失败，请稍后再试");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <div className="eyebrow">Submit</div>
          <h1>新的作业</h1>
          <p className="subtitle">选择科目并上传图片，系统将自动归档。</p>
        </div>
        <div className="status-stack">
          <Link className="button ghost small" href="/register">
            去登记
          </Link>
          <Link className="button small" href="/history">
            看记录
          </Link>
        </div>
      </header>

      {loadError ? <div className="error toast animate-in">{loadError}</div> : null}
      {error ? <div className="error toast animate-in">{error}</div> : null}
      {notice ? <div className="notice toast animate-in">{notice}</div> : null}

      {loading && !me ? (
        <section className="card animate-in">加载中…</section>
      ) : (
        <>
          {activeAssignments.length ? (
            <section className="card animate-in">
              <h2 className="section-title">当前作业</h2>
              <div className="assignment-list">
                {activeAssignments.map((item) => (
                  <div className="assignment-item" key={item.id}>
                    <div className="assignment-title">
                      {item.title ? `${item.subject} · ${item.title}` : item.subject}
                    </div>
                    {item.due_date ? (
                      <div className="assignment-meta">截止：{item.due_date}</div>
                    ) : null}
                    {item.description ? (
                      <div className="assignment-desc">{item.description}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {expiredAssignments.length ? (
            <section className="card animate-in">
              <h2 className="section-title">已过期作业</h2>
              <div className="assignment-list expired">
                {expiredAssignments.map((item) => (
                  <div className="assignment-item expired" key={item.id}>
                    <div className="assignment-title">
                      {item.title ? `${item.subject} · ${item.title}` : item.subject}
                      <span className="expired-tag">已截止</span>
                    </div>
                    {item.due_date ? (
                      <div className="assignment-meta">截止：{item.due_date}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {!me?.registered ? (
            <section className="card animate-in">
              <h2 className="section-title">还未登记</h2>
              <p className="hint">先绑定姓名，再开始提交作业。</p>
              <div className="form-actions">
                <Link className="button" href="/register">
                  去登记
                </Link>
              </div>
            </section>
          ) : (
            <section className="card animate-in">
              <h2 className="section-title">上传作业</h2>
              <form onSubmit={handleSubmit}>
                <div className="field">
                  <label>选择科目</label>
                  {subjects.length ? (
                <div className="subjects">
                  {subjects.map((item) => (
                    <button
                      type="button"
                      key={item}
                      className={`subject-button ${item === subject ? "active" : ""}`}
                      onClick={() => setSubject(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="notice">尚未配置科目，请联系管理员。</div>
              )}
            </div>
            <FilePicker
              id="submit-file"
              label="上传作业图片"
              files={files}
              onChange={setFiles}
              hint="支持上传多张图片（最多 10 张）"
            />
            <div className="field">
              <label htmlFor="note">留言（可选）</label>
              <textarea
                id="note"
                rows={3}
                placeholder="写下想告诉老师的话…"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
                <div className="form-actions">
                  <button className="button" type="submit" disabled={busy}>
                    {busy ? "提交中…" : "提交作业"}
                  </button>
                </div>
              </form>
            </section>
          )}
        </>
      )}
    </main>
  );
}
