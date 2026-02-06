"use client";

import { useEffect, useMemo, useState } from "react";
import AdminLogin from "../components/admin-login";
import { useAdminAuth } from "../lib/admin-auth";
import type { AdminStudent, StudentsResponse } from "../lib/types";

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminStudentsPage() {
  const { ready, secret, login, authenticating, authError, logout } = useAdminAuth();
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [completions, setCompletions] = useState<Record<string, string[]>>({});
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [newStudentName, setNewStudentName] = useState("");
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!ready || !secret) return;
    void loadStudents(selectedDate);
  }, [ready, secret, selectedDate]);

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

  async function loadStudents(date = selectedDate) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/students?date=${date}`, {
        headers: { "x-admin-secret": secret }
      });
      if (res.status === 401 || res.status === 403) {
        logout();
        setError("管理员密钥已失效，请重新登录");
        return;
      }
      const data = (await res.json().catch(() => ({}))) as StudentsResponse;
      if (!res.ok || !data.ok) {
        setError("加载失败，请稍后再试");
        return;
      }
      setStudents(data.students);
      setSubjects(data.subjects);
      setCompletions(data.completions ?? {});
      setNameDrafts(
        data.students.reduce((acc, student) => {
          acc[student.token] = student.name;
          return acc;
        }, {} as Record<string, string>)
      );
    } catch (err) {
      setError("加载失败，请稍后再试");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddStudent() {
    const name = newStudentName.trim();
    if (!name) {
      setError("请输入姓名");
      return;
    }
    setAdding(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/students", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret
        },
        body: JSON.stringify({ name })
      });
      if (res.status === 401 || res.status === 403) {
        logout();
        setError("管理员密钥已失效，请重新登录");
        return;
      }
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload?.error ?? "新增失败");
        return;
      }
      setNewStudentName("");
      setNotice("学生已新增");
      await loadStudents(selectedDate);
    } catch (err) {
      setError("新增失败，请稍后再试");
    } finally {
      setAdding(false);
    }
  }

  async function handleRenameStudent(token: string) {
    const name = nameDrafts[token]?.trim() ?? "";
    if (!name) {
      setError("姓名不能为空");
      return;
    }
    setBusyStudentId(token);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/students", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret
        },
        body: JSON.stringify({ token, name })
      });
      if (res.status === 401 || res.status === 403) {
        logout();
        setError("管理员密钥已失效，请重新登录");
        return;
      }
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload?.error ?? "更新失败");
        return;
      }
      setNotice("姓名已更新");
      await loadStudents(selectedDate);
    } catch (err) {
      setError("更新失败，请稍后再试");
    } finally {
      setBusyStudentId(null);
    }
  }

  async function handleDeleteStudent(token: string) {
    if (!confirm("确定删除该学生并移除相关提交记录吗？")) return;
    setDeleteBusyId(token);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/students", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret
        },
        body: JSON.stringify({ token })
      });
      if (res.status === 401 || res.status === 403) {
        logout();
        setError("管理员密钥已失效，请重新登录");
        return;
      }
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload?.error ?? "删除失败");
        return;
      }
      setNotice("学生已删除");
      await loadStudents(selectedDate);
    } catch (err) {
      setError("删除失败，请稍后再试");
    } finally {
      setDeleteBusyId(null);
    }
  }

  async function toggleCompletion(studentName: string, subject: string) {
    const current = completions[studentName] ?? [];
    const completed = current.includes(subject);
    setError(null);
    try {
      const res = await fetch("/api/admin/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret
        },
        body: JSON.stringify({
          date: selectedDate,
          student_name: studentName,
          subject,
          completed: !completed
        })
      });
      if (res.status === 401 || res.status === 403) {
        logout();
        setError("管理员密钥已失效，请重新登录");
        return;
      }
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload?.error ?? "更新失败");
        return;
      }
      setCompletions((prev) => {
        const next = { ...prev } as Record<string, string[]>;
        const list = new Set(next[studentName] ?? []);
        if (completed) {
          list.delete(subject);
        } else {
          list.add(subject);
        }
        if (list.size > 0) {
          next[studentName] = Array.from(list);
        } else {
          delete next[studentName];
        }
        return next;
      });
    } catch (err) {
      setError("更新失败，请稍后再试");
    }
  }

  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  }, [students]);

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
            <h1>学生管理</h1>
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
          <h1>学生管理</h1>
          <p className="subtitle">增删改学生姓名，并调整作业完成情况。</p>
        </div>
      </header>

      {error ? <div className="error toast animate-in">{error}</div> : null}
      {notice ? <div className="notice toast animate-in">{notice}</div> : null}

      {loading ? (
        <section className="card animate-in">加载中…</section>
      ) : (
        <>
          <section className="card animate-in">
            <div className="section-title">新增学生</div>
            <div className="field">
              <label htmlFor="new-student">姓名</label>
              <input
                id="new-student"
                type="text"
                value={newStudentName}
                onChange={(event) => setNewStudentName(event.target.value)}
                placeholder="输入学生姓名"
              />
            </div>
            <div className="form-actions">
              <button className="button" type="button" onClick={handleAddStudent} disabled={adding}>
                {adding ? "添加中…" : "添加学生"}
              </button>
            </div>
          </section>

          <section className="card animate-in">
            <div className="section-title">学生名单</div>
            {sortedStudents.length ? (
              <div className="student-list">
                {sortedStudents.map((student) => (
                  <div className="student-row" key={student.token}>
                    <div className="student-main">
                      <div className="field">
                        <label>姓名</label>
                        <input
                          type="text"
                          value={nameDrafts[student.token] ?? student.name}
                          onChange={(event) =>
                            setNameDrafts((prev) => ({
                              ...prev,
                              [student.token]: event.target.value
                            }))
                          }
                        />
                      </div>
                      <div className="student-meta">注册：{student.created_at.slice(0, 10)}</div>
                    </div>
                    <div className="student-actions">
                      <button
                        className="button"
                        type="button"
                        onClick={() => handleRenameStudent(student.token)}
                        disabled={busyStudentId === student.token}
                      >
                        {busyStudentId === student.token ? "保存中…" : "保存"}
                      </button>
                      <button
                        className="button ghost danger"
                        type="button"
                        onClick={() => handleDeleteStudent(student.token)}
                        disabled={deleteBusyId === student.token}
                      >
                        {deleteBusyId === student.token ? "删除中…" : "删除"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="notice">暂无学生</div>
            )}
          </section>

          <section className="card animate-in">
            <div className="section-title">作业完成情况</div>
            <p className="hint">选择日期后，可手动标记完成科目。</p>
            <p className="hint">手动标记仅用于统计与导出，不会生成图片提交。</p>
            <div className="field">
              <label htmlFor="completion-date">日期</label>
              <input
                id="completion-date"
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              />
            </div>
            {subjects.length ? (
              <div className="completion-grid">
                <div className="completion-head">
                  <span>学生</span>
                  <span>完成科目</span>
                </div>
                {sortedStudents.length ? (
                  sortedStudents.map((student) => (
                    <div className="completion-row" key={`complete-${student.token}`}>
                      <div className="completion-name">{student.name}</div>
                      <div className="completion-tags">
                        {subjects.map((subject) => {
                          const selected = (completions[student.name] ?? []).includes(subject);
                          return (
                            <button
                              key={`${student.name}-${subject}`}
                              type="button"
                              className={`subject-button ${selected ? "active" : ""}`}
                              onClick={() => toggleCompletion(student.name, subject)}
                            >
                              {subject}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="notice">暂无学生</div>
                )}
              </div>
            ) : (
              <div className="notice">未配置科目</div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
