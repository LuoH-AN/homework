"use client";

import { useEffect, useMemo, useState } from "react";
import { formatLocal } from "../lib/format";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

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

function getTomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [assignSubject, setAssignSubject] = useState("");
  const [assignTitle, setAssignTitle] = useState("");
  const [assignDue, setAssignDue] = useState(getTomorrow());
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
  const [exportStartDate, setExportStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [exportEndDate, setExportEndDate] = useState(new Date().toISOString().slice(0, 10));

  const pendingSubmissions = useMemo(() => {
    return (
      overview?.submissions.filter(
        (item) => item.review?.status !== "reviewed"
      ) ?? []
    );
  }, [overview]);

  // 判断作业是否已过期
  const isExpired = (dueDate?: string) => {
    if (!dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(23, 59, 59, 999);
    return due < today;
  };

  // 活跃的作业（未过期）
  const activeAssignments = useMemo(() => {
    return (overview?.assignments ?? []).filter(
      (item) => item.active && !isExpired(item.due_date)
    );
  }, [overview]);

  // 归档的作业（已过期）
  const archivedAssignments = useMemo(() => {
    return (overview?.assignments ?? []).filter(
      (item) => !item.active || isExpired(item.due_date)
    );
  }, [overview]);

  // 统计数据
  const stats = useMemo(() => {
    const submissions = overview?.submissions ?? [];
    const subjects = overview?.subjects ?? [];

    // 批改状态统计
    const reviewed = submissions.filter((s) => s.review?.status === "reviewed").length;
    const pending = submissions.filter((s) => s.review?.status !== "reviewed").length;

    const reviewStats = [
      { name: "已批改", value: reviewed, color: "#22c55e" },
      { name: "待批改", value: pending, color: "#f59e0b" }
    ];

    // 按科目统计提交数量
    const subjectStats = subjects.map((subject) => {
      const count = submissions.filter((s) => s.subject === subject).length;
      return { name: subject, 提交数: count };
    });

    // 今日提交统计
    const today = new Date().toISOString().slice(0, 10);
    const todaySubmissions = submissions.filter(
      (s) => s.created_at.slice(0, 10) === today
    ).length;

    // 最近7天提交趋势
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().slice(0, 10);
      const count = submissions.filter(
        (s) => s.created_at.slice(0, 10) === dateStr
      ).length;
      last7Days.push({
        date: dateStr.slice(5), // MM-DD
        提交数: count
      });
    }

    return {
      total: submissions.length,
      reviewed,
      pending,
      todaySubmissions,
      reviewStats,
      subjectStats,
      last7Days
    };
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
    if (!assignSubject) {
      setError("请选择科目");
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
    if (!draft?.subject) {
      setError("请选择科目");
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

  async function handleDeleteAssignment(assignmentId: string) {
    if (!confirm("确定删除这个作业吗？")) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/assignment", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret
        },
        body: JSON.stringify({ id: assignmentId })
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error ?? "删除失败");
        return;
      }
      setNotice("作业已删除");
      await loadOverview();
    } catch (err) {
      setError("删除失败，请稍后再试");
    } finally {
      setLoading(false);
    }
  }

  async function handleCloseAssignment(assignmentId: string) {
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
        body: JSON.stringify({ id: assignmentId, active: false })
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error ?? "操作失败");
        return;
      }
      setNotice("作业已截止");
      await loadOverview();
    } catch (err) {
      setError("操作失败，请稍后再试");
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
      const params = new URLSearchParams();
      params.set("start", exportStartDate);
      params.set("end", exportEndDate);
      const res = await fetch(`/api/admin/export?${params.toString()}`, {
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
      const filename = exportStartDate === exportEndDate
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
            <div className="section-title">数据统计</div>
            <div className="stats-overview">
              <div className="stat-card">
                <div className="stat-number">{stats.total}</div>
                <div className="stat-label">总提交数</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{stats.todaySubmissions}</div>
                <div className="stat-label">今日提交</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{stats.reviewed}</div>
                <div className="stat-label">已批改</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{stats.pending}</div>
                <div className="stat-label">待批改</div>
              </div>
            </div>
            <div className="charts-grid">
              <div className="chart-container">
                <div className="chart-title">批改状态</div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={stats.reviewStats}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {stats.reviewStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-container">
                <div className="chart-title">按科目统计</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.subjectStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="提交数" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-container full-width">
                <div className="chart-title">最近7天提交趋势</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.last7Days}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="提交数" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

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
            <div className="section-title">已发布作业</div>
            {activeAssignments.length ? (
              <div className="assignment-cards">
                {activeAssignments.map((item) => {
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
                        {item.title ? `${item.subject} · ${item.title}` : item.subject}
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
                          <button
                            className="button ghost"
                            type="button"
                            onClick={() => handleCloseAssignment(item.id)}
                          >
                            立即截止
                          </button>
                          <button
                            className="button ghost danger"
                            type="button"
                            onClick={() => handleDeleteAssignment(item.id)}
                          >
                            删除
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="notice">暂无已发布作业</div>
            )}
          </section>

          {archivedAssignments.length ? (
            <section className="animate-in">
              <div className="section-title">归档作业</div>
              <div className="assignment-cards archived">
                {archivedAssignments.map((item) => (
                  <div className="card assignment-card archived" key={item.id}>
                    <div className="assignment-title">
                      {item.title ? `${item.subject} · ${item.title}` : item.subject}
                    </div>
                    {item.due_date ? (
                      <div className="assignment-meta">截止：{item.due_date}</div>
                    ) : null}
                    {item.description ? (
                      <div className="assignment-desc">{item.description}</div>
                    ) : null}
                    <div className="assignment-actions">
                      <button
                        className="button ghost danger"
                        type="button"
                        onClick={() => handleDeleteAssignment(item.id)}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

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
              <button className="button ghost" type="button" onClick={() => {
                const today = new Date().toISOString().slice(0, 10);
                setExportStartDate(today);
                setExportEndDate(today);
              }}>
                今天
              </button>
              <button className="button ghost" type="button" onClick={() => {
                const today = new Date();
                const weekAgo = new Date(today);
                weekAgo.setDate(weekAgo.getDate() - 7);
                setExportStartDate(weekAgo.toISOString().slice(0, 10));
                setExportEndDate(today.toISOString().slice(0, 10));
              }}>
                最近一周
              </button>
              <button className="button" type="button" onClick={handleExport} disabled={loading}>
                {loading ? "导出中…" : "导出 Word"}
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
                      <div className="note">留言：{submission.note}</div>
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
