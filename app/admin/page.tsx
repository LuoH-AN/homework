"use client";

import { useEffect, useMemo, useState } from "react";
import { formatLocal } from "../lib/format";

type ReviewInfo = {
  status: "pending" | "reviewed";
  score?: number;
  comment?: string;
  reviewed_at?: string;
  reviewer?: string;
};

type AdminSubmission = {
  id: string;
  student_name: string;
  subject: string;
  created_at: string;
  updated_at: string;
  note: string;
  photo_file_ids: string[];
  review: ReviewInfo;
};

type Assignment = {
  id: string;
  subject: string;
  title: string;
  description?: string;
  due_date?: string;
  active: boolean;
};

type OverviewResponse = {
  ok: boolean;
  subjects: string[];
  assignments: Assignment[];
  submissions: AdminSubmission[];
};

const STORAGE_KEY = "admin_secret";

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [assignSubject, setAssignSubject] = useState("");
  const [assignTitle, setAssignTitle] = useState("");
  const [assignDue, setAssignDue] = useState("");
  const [assignDesc, setAssignDesc] = useState("");
  const [reviewDrafts, setReviewDrafts] = useState<
    Record<string, { score: string; comment: string }>
  >({});
  const [editAssignmentId, setEditAssignmentId] = useState<string | null>(null);
  const [assignmentDrafts, setAssignmentDrafts] = useState<
    Record<
      string,
      { subject: string; title: string; description: string; due_date: string }
    >
  >({});

  const pendingSubmissions = useMemo(() => {
    return (
      overview?.submissions.filter(
        (item) => item.review?.status !== "reviewed"
      ) ?? []
    );
  }, [overview]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setSecret(saved);
      void loginAndLoad(saved);
    }
  }, []);

  async function loginAndLoad(nextSecret?: string) {
    const token = nextSecret ?? secret;
    if (!token) {
      setError("请输入管理员密钥");
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const loginRes = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: token })
      });
      if (!loginRes.ok) {
        setError("管理员密钥错误");
        return;
      }
      localStorage.setItem(STORAGE_KEY, token);
      await loadOverview(token);
    } catch (err) {
      setError("加载失败，请稍后再试");
    } finally {
      setLoading(false);
    }
  }

  async function loadOverview(token = secret) {
    const res = await fetch("/api/admin/overview", {
      headers: token ? { "x-admin-secret": token } : undefined
    });
    const data = (await res.json().catch(() => ({}))) as OverviewResponse;
    if (!res.ok || !data.ok) {
      throw new Error(data as any);
    }
    setOverview(data);
    if (!assignSubject && data.subjects?.length) {
      setAssignSubject(data.subjects[0]);
    }
  }

  async function handleAssign(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!assignSubject || !assignTitle.trim()) {
      setError("请填写科目与标题");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/assignment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret
        },
        body: JSON.stringify({
          subject: assignSubject,
          title: assignTitle.trim(),
          description: assignDesc.trim() || undefined,
          due_date: assignDue.trim() || undefined
        })
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error ?? "布置失败");
        return;
      }
      setAssignTitle("");
      setAssignDue("");
      setAssignDesc("");
      setNotice("作业已布置");
      await loadOverview();
    } catch (err) {
      setError("布置失败，请稍后再试");
    } finally {
      setLoading(false);
    }
  }

  async function handleAssignmentUpdate(assignmentId: string) {
    const draft = assignmentDrafts[assignmentId];
    if (!draft?.subject || !draft?.title.trim()) {
      setError("请填写科目与标题");
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/assignment", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret
        },
        body: JSON.stringify({
          id: assignmentId,
          subject: draft.subject,
          title: draft.title.trim(),
          description: draft.description.trim() || undefined,
          due_date: draft.due_date.trim() || undefined
        })
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error ?? "更新失败");
        return;
      }
      setNotice("作业已更新");
      setEditAssignmentId(null);
      await loadOverview();
    } catch (err) {
      setError("更新失败，请稍后再试");
    } finally {
      setLoading(false);
    }
  }

  async function handleReview(
    submissionId: string,
    status: "reviewed" | "pending"
  ) {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const draft = reviewDrafts[submissionId];
      const res = await fetch("/api/admin/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret
        },
        body: JSON.stringify({
          submission_id: submissionId,
          status,
          score:
            draft && draft.score !== ""
              ? Number(draft.score)
              : undefined,
          comment: draft?.comment?.trim() || undefined
        })
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error ?? "更新失败");
        return;
      }
      setNotice(status === "reviewed" ? "已标记批改" : "已恢复待批改");
      await loadOverview();
    } catch (err) {
      setError("更新失败，请稍后再试");
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/export", {
        headers: { "x-admin-secret": secret }
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error ?? "导出失败");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `homework-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setNotice("已导出今日提交");
    } catch (err) {
      setError("导出失败，请稍后再试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <div className="eyebrow">Admin</div>
          <h1>作业管理</h1>
          <p className="subtitle">批改、布置、导出都在这里完成。</p>
        </div>
      </header>

      {error ? <div className="error animate-in">{error}</div> : null}
      {notice ? <div className="notice animate-in">{notice}</div> : null}

      {!overview ? (
        <section className="card animate-in">
          <h2 className="section-title">管理员登录</h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void loginAndLoad();
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
            <div className="form-actions">
              <button className="button" type="submit" disabled={loading}>
                {loading ? "验证中…" : "进入管理"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {overview ? (
        <>
          <section className="card animate-in">
            <div className="section-title">布置作业</div>
            <form onSubmit={handleAssign}>
              <div className="field">
                <label>科目</label>
                <div className="subjects">
                  {overview.subjects.map((item) => (
                    <button
                      type="button"
                      key={item}
                      className={`subject-button ${
                        item === assignSubject ? "active" : ""
                      }`}
                      onClick={() => setAssignSubject(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label htmlFor="assign-title">标题</label>
                <input
                  id="assign-title"
                  type="text"
                  value={assignTitle}
                  onChange={(event) => setAssignTitle(event.target.value)}
                  placeholder="例如：阅读理解练习"
                />
              </div>
              <div className="field">
                <label htmlFor="assign-due">截止日期（可选）</label>
                <input
                  id="assign-due"
                  type="text"
                  value={assignDue}
                  onChange={(event) => setAssignDue(event.target.value)}
                  placeholder="YYYY-MM-DD"
                />
              </div>
              <div className="field">
                <label htmlFor="assign-desc">说明（可选）</label>
                <textarea
                  id="assign-desc"
                  rows={3}
                  value={assignDesc}
                  onChange={(event) => setAssignDesc(event.target.value)}
                  placeholder="作业要求或注意事项"
                />
              </div>
              <div className="form-actions">
                <button className="button" type="submit" disabled={loading}>
                  {loading ? "提交中…" : "发布作业"}
                </button>
              </div>
            </form>
          </section>

          <section className="animate-in">
            <div className="section-title">已布置作业</div>
            {overview.assignments.length ? (
              <div className="assignment-cards">
                {overview.assignments.map((item) => {
                  const draft = assignmentDrafts[item.id] ?? {
                    subject: item.subject,
                    title: item.title,
                    description: item.description ?? "",
                    due_date: item.due_date ?? ""
                  };
                  const isEditing = editAssignmentId === item.id;
                  return (
                    <div className="card assignment-card" key={item.id}>
                      <div className="assignment-title">
                        {item.subject} · {item.title}
                      </div>
                      {item.due_date ? (
                        <div className="assignment-meta">截止：{item.due_date}</div>
                      ) : null}
                      {item.description ? (
                        <div className="assignment-desc">{item.description}</div>
                      ) : null}
                      {isEditing ? (
                        <div className="assignment-edit">
                          <div className="field">
                            <label>科目</label>
                            <div className="subjects">
                              {overview.subjects.map((subject) => (
                                <button
                                  type="button"
                                  key={subject}
                                  className={`subject-button ${
                                    draft.subject === subject ? "active" : ""
                                  }`}
                                  onClick={() =>
                                    setAssignmentDrafts((prev) => ({
                                      ...prev,
                                      [item.id]: { ...draft, subject }
                                    }))
                                  }
                                >
                                  {subject}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="field">
                            <label>标题</label>
                            <input
                              type="text"
                              value={draft.title}
                              onChange={(event) =>
                                setAssignmentDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    ...draft,
                                    title: event.target.value
                                  }
                                }))
                              }
                            />
                          </div>
                          <div className="field">
                            <label>截止日期（可选）</label>
                            <input
                              type="text"
                              value={draft.due_date}
                              onChange={(event) =>
                                setAssignmentDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    ...draft,
                                    due_date: event.target.value
                                  }
                                }))
                              }
                              placeholder="YYYY-MM-DD"
                            />
                          </div>
                          <div className="field">
                            <label>说明（可选）</label>
                            <textarea
                              rows={3}
                              value={draft.description}
                              onChange={(event) =>
                                setAssignmentDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    ...draft,
                                    description: event.target.value
                                  }
                                }))
                              }
                            />
                          </div>
                          <div className="assignment-actions">
                            <button
                              className="button ghost"
                              type="button"
                              onClick={() => setEditAssignmentId(null)}
                            >
                              取消
                            </button>
                            <button
                              className="button"
                              type="button"
                              onClick={() => handleAssignmentUpdate(item.id)}
                            >
                              保存修改
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="assignment-actions">
                          <button
                            className="button ghost"
                            type="button"
                            onClick={() => {
                              setAssignmentDrafts((prev) => ({
                                ...prev,
                                [item.id]: draft
                              }));
                              setEditAssignmentId(item.id);
                            }}
                          >
                            编辑
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="notice">暂无已布置作业</div>
            )}
          </section>

          <section className="card animate-in">
            <div className="section-title">导出今日提交</div>
            <p className="hint">会导出今天提交的全部记录（CSV）。</p>
            <div className="form-actions">
              <button className="button" type="button" onClick={handleExport}>
                导出今日
              </button>
            </div>
          </section>

          <section className="card animate-in">
            <div className="section-title">待批改</div>
            {pendingSubmissions.length ? (
              <div className="admin-list">
                {pendingSubmissions.map((submission) => (
                  <div className="admin-item" key={submission.id}>
                    <div className="admin-header">
                      <div>
                        <div className="admin-title">
                          {submission.student_name} · {submission.subject}
                        </div>
                        <div className="admin-meta">
                          提交：{formatLocal(submission.created_at)}
                        </div>
                      </div>
                      <span className="review-pill">待批改</span>
                    </div>
                    {submission.note ? (
                      <div className="note">流言：{submission.note}</div>
                    ) : null}
                    <div className="submission-images">
                      {submission.photo_file_ids.map((fileId, index) => (
                        <img
                          key={fileId}
                          src={`/api/admin/media?submission_id=${submission.id}&file_id=${fileId}`}
                          alt={`${submission.subject} 作业图片 ${index + 1}`}
                          loading="lazy"
                        />
                      ))}
                    </div>
                    <div className="admin-form">
                      <div className="field">
                        <label>分数（可选）</label>
                        <input
                          type="number"
                          value={reviewDrafts[submission.id]?.score ?? ""}
                          onChange={(event) =>
                            setReviewDrafts((prev) => ({
                              ...prev,
                              [submission.id]: {
                                score: event.target.value,
                                comment: prev[submission.id]?.comment ?? ""
                              }
                            }))
                          }
                          placeholder="例如 95"
                        />
                      </div>
                      <div className="field">
                        <label>批改意见（可选）</label>
                        <textarea
                          rows={3}
                          value={reviewDrafts[submission.id]?.comment ?? ""}
                          onChange={(event) =>
                            setReviewDrafts((prev) => ({
                              ...prev,
                              [submission.id]: {
                                score: prev[submission.id]?.score ?? "",
                                comment: event.target.value
                              }
                            }))
                          }
                          placeholder="写下老师的评语"
                        />
                      </div>
                      <div className="form-actions">
                        <button
                          className="button"
                          type="button"
                          onClick={() => handleReview(submission.id, "reviewed")}
                        >
                          标记已批改
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="notice">暂无待批改作业</div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
