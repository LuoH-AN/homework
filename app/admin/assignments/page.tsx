"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AdminLogin from "../components/admin-login";
import { useAdminAuth } from "../lib/admin-auth";
import type { OverviewResponse, ReminderItem } from "../lib/types";

function getTomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function isExpired(dueDate?: string) {
  if (!dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(23, 59, 59, 999);
  return due < today;
}

export default function AdminAssignmentsPage() {
  const { ready, secret, login, authenticating, authError, logout } = useAdminAuth();
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  const [assignSubject, setAssignSubject] = useState("");
  const [assignTitle, setAssignTitle] = useState("");
  const [assignDue, setAssignDue] = useState(getTomorrow());
  const [assignDesc, setAssignDesc] = useState("");

  const [assignBusy, setAssignBusy] = useState(false);
  const [editAssignmentId, setEditAssignmentId] = useState<string | null>(null);
  const [assignmentDrafts, setAssignmentDrafts] = useState<
    Record<string, { subject: string; title: string; description: string; due_date: string }>
  >({});
  const [updateBusyId, setUpdateBusyId] = useState<string | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const [closeBusyId, setCloseBusyId] = useState<string | null>(null);

  const [reminderDrafts, setReminderDrafts] = useState<ReminderItem[]>([]);
  const reminderTouchedRef = useRef(false);
  const [reminderBusy, setReminderBusy] = useState(false);

  useEffect(() => {
    if (!ready || !secret) return;
    void loadOverview(secret);
  }, [ready, secret]);

  useEffect(() => {
    if (overview?.subjects?.length && !assignSubject) {
      setAssignSubject(overview.subjects[0]);
    }
  }, [overview, assignSubject]);

  useEffect(() => {
    if (overview?.reminders?.length && !reminderTouchedRef.current) {
      setReminderDrafts(overview.reminders);
    }
  }, [overview]);

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

  async function loadOverview(token = secret) {
    setLoadingOverview(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/overview", {
        headers: token ? { "x-admin-secret": token } : undefined
      });
      if (res.status === 401 || res.status === 403) {
        logout();
        setError("管理员密钥已失效，请重新登录");
        return;
      }
      const data = (await res.json().catch(() => ({}))) as OverviewResponse;
      if (!res.ok || !data.ok) {
        setError("加载失败，请稍后再试");
        return;
      }
      setOverview(data);
    } catch (err) {
      setError("加载失败，请稍后再试");
    } finally {
      setLoadingOverview(false);
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
    setAssignBusy(true);
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
      setAssignBusy(false);
    }
  }

  async function handleAssignmentUpdate(assignmentId: string) {
    const draft = assignmentDrafts[assignmentId];
    if (!draft?.subject) {
      setError("请选择科目");
      return;
    }
    setUpdateBusyId(assignmentId);
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
      setUpdateBusyId(null);
    }
  }

  async function handleDeleteAssignment(assignmentId: string) {
    if (!confirm("确定删除这个作业吗？")) return;
    setDeleteBusyId(assignmentId);
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
      setDeleteBusyId(null);
    }
  }

  async function handleCloseAssignment(assignmentId: string) {
    setCloseBusyId(assignmentId);
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
      setCloseBusyId(null);
    }
  }

  async function handleSaveReminders() {
    setError(null);
    setNotice(null);
    setReminderBusy(true);
    try {
      const res = await fetch("/api/admin/reminders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret
        },
        body: JSON.stringify({ reminders: reminderDrafts })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload?.error ?? "更新失败");
        return;
      }
      const nextReminders = Array.isArray(payload?.reminders)
        ? payload.reminders
        : reminderDrafts;
      reminderTouchedRef.current = false;
      setReminderDrafts(nextReminders);
      setOverview((prev) => (prev ? { ...prev, reminders: nextReminders } : prev));
      setNotice("提醒已更新");
    } catch (err) {
      setError("更新失败，请稍后再试");
    } finally {
      setReminderBusy(false);
    }
  }

  const activeAssignments = useMemo(() => {
    return (overview?.assignments ?? []).filter(
      (item) => item.active && !isExpired(item.due_date)
    );
  }, [overview]);

  const archivedAssignments = useMemo(() => {
    return (overview?.assignments ?? []).filter(
      (item) => !item.active || isExpired(item.due_date)
    );
  }, [overview]);

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
            <h1>作业管理</h1>
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
          <h1>作业与提醒</h1>
          <p className="subtitle">布置新作业、编辑提醒内容。</p>
        </div>
      </header>

      {error ? <div className="error toast animate-in">{error}</div> : null}
      {notice ? <div className="notice toast animate-in">{notice}</div> : null}

      {!overview && loadingOverview ? (
        <section className="card animate-in">加载中…</section>
      ) : (
        <>
          <section className="card animate-in">
            <div className="section-title">布置作业</div>
            <form onSubmit={handleAssign}>
              <div className="field">
                <label>科目</label>
                <div className="subjects">
                  {(overview?.subjects ?? []).map((item) => (
                    <button
                      type="button"
                      key={item}
                      className={`subject-button ${item === assignSubject ? "active" : ""}`}
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
                <button className="button" type="submit" disabled={assignBusy}>
                  {assignBusy ? "提交中…" : "发布作业"}
                </button>
              </div>
            </form>
          </section>

          <section className="card animate-in">
            <div className="section-title">今日提醒</div>
            <p className="hint">支持 {`{today}`} 自动替换为当天日期。</p>
            <div className="reminder-editor">
              {reminderDrafts.map((item, index) => (
                <div className="reminder-card" key={`reminder-${index}`}>
                  <div className="field">
                    <label>标题</label>
                    <input
                      type="text"
                      value={item.title}
                      onChange={(event) => {
                        reminderTouchedRef.current = true;
                        const value = event.target.value;
                        setReminderDrafts((prev) =>
                          prev.map((entry, i) =>
                            i === index ? { ...entry, title: value } : entry
                          )
                        );
                      }}
                    />
                  </div>
                  <div className="field">
                    <label>内容</label>
                    <textarea
                      rows={2}
                      value={item.body}
                      onChange={(event) => {
                        reminderTouchedRef.current = true;
                        const value = event.target.value;
                        setReminderDrafts((prev) =>
                          prev.map((entry, i) =>
                            i === index ? { ...entry, body: value } : entry
                          )
                        );
                      }}
                    />
                  </div>
                  <div className="field">
                    <label>补充信息</label>
                    <input
                      type="text"
                      value={item.meta}
                      onChange={(event) => {
                        reminderTouchedRef.current = true;
                        const value = event.target.value;
                        setReminderDrafts((prev) =>
                          prev.map((entry, i) =>
                            i === index ? { ...entry, meta: value } : entry
                          )
                        );
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="form-actions">
              <button
                className="button"
                type="button"
                onClick={handleSaveReminders}
                disabled={reminderBusy}
              >
                {reminderBusy ? "保存中…" : "保存提醒"}
              </button>
            </div>
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
                              {(overview?.subjects ?? []).map((subject) => (
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
                            <label>截止日期</label>
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
                            />
                          </div>
                          <div className="field">
                            <label>说明</label>
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
                              disabled={updateBusyId === item.id}
                            >
                              {updateBusyId === item.id ? "保存中…" : "保存修改"}
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
                            disabled={closeBusyId === item.id}
                          >
                            {closeBusyId === item.id ? "处理中…" : "立即截止"}
                          </button>
                          <button
                            className="button ghost danger"
                            type="button"
                            onClick={() => handleDeleteAssignment(item.id)}
                            disabled={deleteBusyId === item.id}
                          >
                            {deleteBusyId === item.id ? "删除中…" : "删除"}
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
                        disabled={deleteBusyId === item.id}
                      >
                        {deleteBusyId === item.id ? "删除中…" : "删除"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
