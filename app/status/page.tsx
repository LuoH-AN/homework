"use client";

import { useEffect, useMemo } from "react";
import { useMe } from "../components/me-context";
import { formatLocal } from "../lib/format";

export default function StatusPage() {
  const { loading, me, error, setError } = useMe();

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(null), 3000);
    return () => window.clearTimeout(timer);
  }, [error, setError]);

  // 今日完成情况
  const assignmentStatus = useMemo(() => {
    const assignments = me?.assignments ?? [];

    const done = new Set(me?.submitted_subjects_today ?? []);
    (me?.manual_completed_subjects ?? []).forEach((s) => done.add(s));

    const completed = assignments.filter((a) => done.has(a.subject));
    const pending = assignments.filter((a) => !done.has(a.subject));
    const expired = me?.expired_assignments ?? [];

    return { completed, pending, expired };
  }, [me]);

  // 按科目分组统计提交
  const subjectSummary = useMemo(() => {
    const submissions = me?.submissions ?? [];
    const map = new Map<
      string,
      { count: number; latestReviewStatus: string; latestUpdatedAt: string }
    >();

    for (const sub of submissions) {
      const existing = map.get(sub.subject);
      if (!existing) {
        map.set(sub.subject, {
          count: 1,
          latestReviewStatus: sub.review.status,
          latestUpdatedAt: sub.updated_at,
        });
      } else {
        existing.count += 1;
        if (
          new Date(sub.updated_at).getTime() >
          new Date(existing.latestUpdatedAt).getTime()
        ) {
          existing.latestReviewStatus = sub.review.status;
          existing.latestUpdatedAt = sub.updated_at;
        }
      }
    }

    return Array.from(map.entries()).map(([subject, info]) => ({
      subject,
      ...info,
    }));
  }, [me]);

  const reviewLabel = (status: string) => {
    switch (status) {
      case "reviewed":
        return "已批改";
      case "returned":
        return "已退回";
      default:
        return "待批改";
    }
  };

  const reviewClass = (status: string) => {
    switch (status) {
      case "reviewed":
        return "review-pill is-reviewed";
      case "returned":
        return "review-pill is-returned";
      default:
        return "review-pill";
    }
  };

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <div className="eyebrow">完成情况</div>
          <h1>学习状态</h1>
          <p className="subtitle">查看今日各科完成情况与历史提交汇总。</p>
        </div>
      </header>

      {error ? <div className="error toast animate-in">{error}</div> : null}

      {loading && !me ? (
        <section className="card animate-in">加载中…</section>
      ) : !me?.registered ? (
        <section className="card animate-in">
          <div className="notice">请先完成登记，再查看完成情况。</div>
        </section>
      ) : (
        <>
          {/* 区块一：今日完成情况 */}
          {(assignmentStatus.completed.length > 0 ||
            assignmentStatus.pending.length > 0) && (
            <section className="card animate-in">
              <div className="section-title">今日完成情况</div>
              <div className="completion-tags">
                {assignmentStatus.completed.map((a) => (
                  <span
                    key={a.id}
                    className="subject-button is-complete"
                  >
                    {a.subject}
                  </span>
                ))}
                {assignmentStatus.pending.map((a) => (
                  <span
                    key={a.id}
                    className="subject-button is-missing"
                  >
                    {a.subject}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* 区块二：已逾期未完成 */}
          {assignmentStatus.expired.length > 0 && (
            <section className="card animate-in">
              <div className="section-title">已逾期未完成</div>
              <div className="status-items">
                {assignmentStatus.expired.map((a) => (
                  <div key={a.id} className="status-item expired">
                    {a.title ? `${a.subject} · ${a.title}` : a.subject}
                    <span className="expired-tag">已逾期</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 区块三：提交汇总 */}
          {subjectSummary.length > 0 && (
            <section className="card animate-in">
              <div className="section-title">提交汇总</div>
              <div className="status-items">
                {subjectSummary.map((item) => (
                  <div key={item.subject} className="status-item">
                    <span>
                      {item.subject}
                      <span style={{ color: "var(--muted)", marginLeft: 8, fontSize: 13 }}>
                        {item.count} 次提交 · 最近 {formatLocal(item.latestUpdatedAt)}
                      </span>
                    </span>
                    <span className={reviewClass(item.latestReviewStatus)}>
                      {reviewLabel(item.latestReviewStatus)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 无任何数据时 */}
          {assignmentStatus.completed.length === 0 &&
            assignmentStatus.pending.length === 0 &&
            assignmentStatus.expired.length === 0 &&
            subjectSummary.length === 0 && (
              <section className="card animate-in">
                <div className="notice">暂无作业数据。</div>
              </section>
            )}
        </>
      )}
    </main>
  );
}
