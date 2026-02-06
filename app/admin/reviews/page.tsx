"use client";

import { useEffect, useMemo, useState } from "react";
import AdminLogin from "../components/admin-login";
import { useAdminAuth } from "../lib/admin-auth";
import type { OverviewResponse } from "../lib/types";
import { formatLocal } from "../../lib/format";

export default function AdminReviewsPage() {
  const { ready, secret, login, authenticating, authError, logout } = useAdminAuth();
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [reviewDrafts, setReviewDrafts] = useState<
    Record<string, { score: string; comment: string }>
  >({});
  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchScore, setBatchScore] = useState("");
  const [batchComment, setBatchComment] = useState("");
  const [batchBusy, setBatchBusy] = useState(false);

  useEffect(() => {
    if (!ready || !secret) return;
    void loadOverview(secret);
  }, [ready, secret]);

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

  const pendingSubmissions = useMemo(() => {
    return (
      overview?.submissions.filter((item) => item.review?.status !== "reviewed") ?? []
    );
  }, [overview]);

  useEffect(() => {
    const pendingIds = new Set(pendingSubmissions.map((item) => item.id));
    setSelectedIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (pendingIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [pendingSubmissions]);

  function toggleSelect(submissionId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(submissionId)) {
        next.delete(submissionId);
      } else {
        next.add(submissionId);
      }
      return next;
    });
  }

  function selectAllPending() {
    setSelectedIds(new Set(pendingSubmissions.map((item) => item.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleReview(
    submissionId: string,
    status: "reviewed" | "pending" | "returned"
  ) {
    setError(null);
    setNotice(null);
    setReviewBusyId(submissionId);
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
          score: draft && draft.score !== "" ? Number(draft.score) : undefined,
          comment: draft?.comment?.trim() || undefined
        })
      });
      if (res.status === 401 || res.status === 403) {
        logout();
        setError("管理员密钥已失效，请重新登录");
        return;
      }
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error ?? "更新失败");
        return;
      }
      if (status === "reviewed") {
        setNotice("已标记批改");
      } else if (status === "returned") {
        setNotice("已打回修正");
      } else {
        setNotice("已恢复待批改");
      }
      await loadOverview();
    } catch (err) {
      setError("更新失败，请稍后再试");
    } finally {
      setReviewBusyId(null);
    }
  }

  async function handleBatchReview(status: "reviewed" | "pending" | "returned") {
    if (selectedIds.size === 0) {
      setError("请先选择需要批改的作业");
      return;
    }
    setError(null);
    setNotice(null);
    setBatchBusy(true);
    try {
      const scoreValue = batchScore.trim();
      const score = scoreValue !== "" ? Number(scoreValue) : undefined;
      const res = await fetch("/api/admin/review/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret
        },
        body: JSON.stringify({
          submission_ids: Array.from(selectedIds),
          status,
          score: typeof score === "number" && !Number.isNaN(score) ? score : undefined,
          comment: batchComment.trim() || undefined
        })
      });
      if (res.status === 401 || res.status === 403) {
        logout();
        setError("管理员密钥已失效，请重新登录");
        return;
      }
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload?.error ?? "批量批改失败");
        return;
      }
      const updatedCount = typeof payload?.updated === "number" ? payload.updated : 0;
      if (status === "reviewed") {
        setNotice(`批量标记完成：${updatedCount} 条`);
      } else if (status === "returned") {
        setNotice(`批量打回：${updatedCount} 条`);
      } else {
        setNotice(`批量恢复待批改：${updatedCount} 条`);
      }
      setBatchScore("");
      setBatchComment("");
      setSelectedIds(new Set());
      await loadOverview();
    } catch (err) {
      setError("批量批改失败，请稍后再试");
    } finally {
      setBatchBusy(false);
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
            <h1>批改作业</h1>
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
          <h1>批改作业</h1>
          <p className="subtitle">支持单条与批量批改。</p>
        </div>
      </header>

      {error ? <div className="error toast animate-in">{error}</div> : null}
      {notice ? <div className="notice toast animate-in">{notice}</div> : null}

      {!overview && loadingOverview ? (
        <section className="card animate-in">加载中…</section>
      ) : (
        <>
          <section className="card animate-in">
            <div className="section-title">批量批改</div>
            <p className="hint">先勾选作业，再填写批量分数与评语。</p>
            <div className="field">
              <label>批量分数（可选）</label>
              <input
                type="number"
                value={batchScore}
                onChange={(event) => setBatchScore(event.target.value)}
                placeholder="例如 95"
              />
            </div>
            <div className="field">
              <label>批量评语（可选）</label>
              <textarea
                rows={3}
                value={batchComment}
                onChange={(event) => setBatchComment(event.target.value)}
                placeholder="批量评语"
              />
            </div>
            <div className="form-actions">
              <button className="button ghost" type="button" onClick={selectAllPending}>
                全选待批改
              </button>
              <button className="button ghost" type="button" onClick={clearSelection}>
                清空选择
              </button>
              <button
                className="button"
                type="button"
                disabled={batchBusy || selectedIds.size === 0}
                onClick={() => handleBatchReview("reviewed")}
              >
                {batchBusy ? "处理中…" : `批量标记已批改(${selectedIds.size})`}
              </button>
              <button
                className="button ghost"
                type="button"
                disabled={batchBusy || selectedIds.size === 0}
                onClick={() => handleBatchReview("returned")}
              >
                批量打回修正
              </button>
              <button
                className="button ghost"
                type="button"
                disabled={batchBusy || selectedIds.size === 0}
                onClick={() => handleBatchReview("pending")}
              >
                批量恢复待批改
              </button>
            </div>
          </section>

          <section className="card animate-in">
            <div className="section-title">待批改</div>
            {pendingSubmissions.length ? (
              <div className="admin-list">
                {pendingSubmissions.map((submission) => {
                  const reviewStatus = submission.review?.status ?? "pending";
                  const statusLabel =
                    reviewStatus === "returned"
                      ? "已打回"
                      : reviewStatus === "reviewed"
                        ? "已批改"
                        : "待批改";
                  const statusClass =
                    reviewStatus === "returned"
                      ? "is-returned"
                      : reviewStatus === "reviewed"
                        ? "is-reviewed"
                        : "";
                  const isSelected = selectedIds.has(submission.id);
                  return (
                    <div className="admin-item" key={submission.id}>
                      <div className="admin-header">
                        <div>
                          <div className="admin-title">
                            <label className="review-select">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelect(submission.id)}
                              />
                              <span>{submission.student_name} · {submission.subject}</span>
                            </label>
                          </div>
                          <div className="admin-meta">提交：{formatLocal(submission.created_at)}</div>
                        </div>
                        <span className={`review-pill ${statusClass}`}>{statusLabel}</span>
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
                            className="button ghost"
                            type="button"
                            onClick={() => handleReview(submission.id, "returned")}
                            disabled={reviewBusyId === submission.id}
                          >
                            {reviewBusyId === submission.id ? "处理中…" : "打回修正"}
                          </button>
                          <button
                            className="button"
                            type="button"
                            onClick={() => handleReview(submission.id, "reviewed")}
                            disabled={reviewBusyId === submission.id}
                          >
                            {reviewBusyId === submission.id ? "处理中…" : "标记已批改"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="notice">暂无待批改作业</div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
