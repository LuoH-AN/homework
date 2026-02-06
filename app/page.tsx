"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useMe } from "./components/me-context";
import { formatDateOnly, formatLocal } from "./lib/format";
import { defaultReminders } from "../lib/reminders";

// 判断作业是否已过期
function isExpired(dueDate?: string) {
  if (!dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(23, 59, 59, 999);
  return due < today;
}

// 获取今天的日期字符串 (YYYY-MM-DD)
function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

export default function Home() {
  const { loading, syncing, me, error, setError } = useMe();

  const latest = useMemo(() => {
    if (!me?.submissions?.length) return null;
    return me.submissions.reduce((current, item) => {
      if (!current) return item;
      const currentTime = new Date(current.updated_at).getTime();
      const itemTime = new Date(item.updated_at).getTime();
      return itemTime > currentTime ? item : current;
    }, me.submissions[0]);
  }, [me]);

  // 计算作业状态
  const assignmentStatus = useMemo(() => {
    const assignments = me?.assignments ?? [];
    const submissions = me?.submissions ?? [];
    const today = getTodayString();

    // 今天提交的科目
    const submittedSubjectsToday = new Set(
      submissions
        .filter((s) => s.created_at.slice(0, 10) === today)
        .map((s) => s.subject)
    );
    const manualDate = me?.manual_completion_date ?? "";
    const manualSubjects =
      manualDate === today ? (me?.manual_completed_subjects ?? []) : [];
    manualSubjects.forEach((subject) => submittedSubjectsToday.add(subject));

    // 活跃的未过期作业
    const activeAssignments = assignments.filter(
      (item) => item.active && !isExpired(item.due_date)
    );

    // 已完成（今天已提交）
    const completed = activeAssignments.filter((item) =>
      submittedSubjectsToday.has(item.subject)
    );

    // 未完成（今天未提交且未过期）
    const pending = activeAssignments.filter(
      (item) => !submittedSubjectsToday.has(item.subject)
    );

    // 已逾期（有截止日期且已过期，且没有提交过）
    const allSubmittedSubjects = new Set(submissions.map((s) => s.subject));
    const expired = assignments.filter(
      (item) =>
        isExpired(item.due_date) && !allSubmittedSubjects.has(item.subject)
    );

    return { completed, pending, expired };
  }, [me]);

  const syncText = loading && !me ? "连接中" : syncing ? "同步中" : "已同步";
  const statusText = me?.registered ? "已登记" : "未登记";
  const studentName = me?.student?.name ?? "同学";
  const reminders = (me?.reminders?.length ? me.reminders : defaultReminders()).map(
    (item) => {
      const todayLabel = formatDateOnly(new Date().toISOString());
      const meta = item.meta
        .replaceAll("{today}", todayLabel)
        .replaceAll("{{today}}", todayLabel);
      return { ...item, meta };
    }
  );

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(null), 3000);
    return () => window.clearTimeout(timer);
  }, [error, setError]);

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <div className="eyebrow">Homework Flow</div>
          <h1>作业提交中心</h1>
          <p className="subtitle">多页面入口更清晰，提交过程更流畅。</p>
        </div>
        <div className="status-stack">
          <div className={`status-pill ${syncing ? "is-syncing" : ""}`}>{syncText}</div>
          <Link className="button small" href="/submit">
            立即提交
          </Link>
        </div>
      </header>

      {error ? <div className="error toast animate-in">{error}</div> : null}

      {loading && !me ? (
        <section className="card animate-in">加载中…</section>
      ) : (
        <>
          <section className="block-grid">
            <Link className="tile tile-rose" href="/register">
              <div className="tile-top">
                <span className="chip">登记</span>
                <span className="tile-meta">{statusText}</span>
              </div>
              <h3>绑定姓名</h3>
              <p>首次登记后，系统会锁定姓名用于作业归档。</p>
            </Link>
            <Link className="tile tile-blue" href="/submit">
              <div className="tile-top">
                <span className="chip">提交</span>
                <span className="tile-meta">{me?.subjects?.length ?? 0} 门科目</span>
              </div>
              <h3>上传作业</h3>
              <p>选择科目与图片，一键发送到 Telegram 群组。</p>
            </Link>
            <Link className="tile tile-sun" href="/history">
              <div className="tile-top">
                <span className="chip">记录</span>
                <span className="tile-meta">{me?.submissions?.length ?? 0} 次提交</span>
              </div>
              <h3>查看历史</h3>
              <p>追踪提交时间、修改截止与标签分类。</p>
            </Link>
          </section>

          <section className="card animate-in">
            <div className="section-title">当前状态</div>
            <div className="stat-grid">
              <div className="stat">
                <div className="stat-value">{studentName}</div>
                <div className="stat-label">学生姓名</div>
              </div>
              <div className="stat">
                <div className="stat-value">{statusText}</div>
                <div className="stat-label">登记状态</div>
              </div>
              <div className="stat">
                <div className="stat-value">{me?.subjects?.length ?? 0}</div>
                <div className="stat-label">可提交科目</div>
              </div>
              <div className="stat">
                <div className="stat-value">{me?.submissions?.length ?? 0}</div>
                <div className="stat-label">历史提交</div>
              </div>
            </div>
            {latest ? (
              <div className="notice">最近一次提交：{formatLocal(latest.updated_at)}</div>
            ) : (
              <div className="notice">暂无提交记录，先去上传第一份作业吧。</div>
            )}
            {me?.registered ? (
              <div className="hint">登记时间将保留，提交记录可在三天内修改。</div>
            ) : (
              <div className="hint">先完成登记，解锁提交与记录页面。</div>
            )}
          </section>

          {me?.registered && (assignmentStatus.completed.length > 0 || assignmentStatus.pending.length > 0 || assignmentStatus.expired.length > 0) ? (
            <section className="card animate-in">
              <div className="section-title">今日作业状态</div>
              <div className="homework-status">
                {assignmentStatus.completed.length > 0 ? (
                  <div className="status-group">
                    <div className="status-header completed">已完成</div>
                    <div className="status-items">
                      {assignmentStatus.completed.map((item) => (
                        <div key={item.id} className="status-item completed">
                          {item.title ? `${item.subject} · ${item.title}` : item.subject}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {assignmentStatus.pending.length > 0 ? (
                  <div className="status-group">
                    <div className="status-header pending">未完成</div>
                    <div className="status-items">
                      {assignmentStatus.pending.map((item) => (
                        <div key={item.id} className="status-item pending">
                          {item.title ? `${item.subject} · ${item.title}` : item.subject}
                          {item.due_date ? <span className="due-date">截止：{item.due_date}</span> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {assignmentStatus.expired.length > 0 ? (
                  <div className="status-group">
                    <div className="status-header expired">已逾期</div>
                    <div className="status-items">
                      {assignmentStatus.expired.map((item) => (
                        <div key={item.id} className="status-item expired">
                          {item.title ? `${item.subject} · ${item.title}` : item.subject}
                          <span className="expired-tag">无法提交</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="card animate-in">
            <div className="section-title">今日提醒</div>
            <div className="reminder-grid">
              {reminders.map((item, index) => (
                <div className="reminder" key={`${item.title}-${index}`}>
                  <div className="reminder-title">{item.title}</div>
                  <div className="reminder-body">{item.body}</div>
                  {item.meta ? <div className="reminder-meta">{item.meta}</div> : null}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
