"use client";

import Link from "next/link";
import { useState } from "react";
import { useMe } from "../components/me-context";
import { formatLocal } from "../lib/format";
import FilePicker from "../components/file-picker";

export default function HistoryPage() {
  const { loading, me, error: loadError, refresh } = useMe();
  const [editFiles, setEditFiles] = useState<Record<string, File[]>>({});
  const [editBusy, setEditBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleEdit(event: React.FormEvent, submissionId: string) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const files = editFiles[submissionId] ?? [];
    if (files.length === 0) {
      setError("请先选择新的作业图片");
      return;
    }
    if (files.length > 10) {
      setError("最多上传 10 张图片");
      return;
    }
    setEditBusy(submissionId);
    try {
      const form = new FormData();
      form.append("submission_id", submissionId);
      files.forEach((item) => form.append("image", item));
      const res = await fetch("/api/edit", {
        method: "POST",
        body: form,
        credentials: "include"
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload?.error ?? "修改失败");
        return;
      }
      setNotice("修改已提交");
      setEditFiles((prev) => ({ ...prev, [submissionId]: [] }));
      await refresh();
    } catch (err) {
      setError("修改失败，请稍后再试");
    } finally {
      setEditBusy(null);
    }
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <div className="eyebrow">History</div>
          <h1>我的提交记录</h1>
          <p className="subtitle">查看提交时间、修改记录与标签分类。</p>
        </div>
        <div className="status-stack">
          <Link className="button ghost small" href="/submit">
            去提交
          </Link>
          <Link className="button small" href="/register">
            去登记
          </Link>
        </div>
      </header>

      {loadError ? <div className="error animate-in">{loadError}</div> : null}
      {error ? <div className="error animate-in">{error}</div> : null}
      {notice ? <div className="notice animate-in">{notice}</div> : null}

      {loading && !me ? (
        <section className="card animate-in">加载中…</section>
      ) : !me?.registered ? (
        <section className="card animate-in">
          <h2 className="section-title">还未登记</h2>
          <p className="hint">绑定姓名后才能查看提交记录。</p>
          <div className="form-actions">
            <Link className="button" href="/register">
              去登记
            </Link>
          </div>
        </section>
      ) : me?.submissions?.length ? (
        <section className="card animate-in">
          <h2 className="section-title">全部记录</h2>
          <div className="grid">
            {me.submissions.map((submission) => {
              const reviewStatus = submission.review?.status ?? "pending";
              const statusLabel =
                reviewStatus === "returned"
                  ? "待修正"
                  : reviewStatus === "reviewed"
                    ? "已批改"
                    : "待批改";
              const statusClass =
                reviewStatus === "returned"
                  ? "is-returned"
                  : reviewStatus === "reviewed"
                    ? "is-reviewed"
                    : "";
              const isReturned = reviewStatus === "returned";

              return (
                <article key={submission.id} className="submission">
                  <div className="meta">
                    <span>{submission.subject}</span>
                    <span>提交：{formatLocal(submission.created_at)}</span>
                  </div>
                  <div className="review-row">
                    <span className={`review-pill ${statusClass}`}>{statusLabel}</span>
                    {typeof submission.review?.score === "number" ? (
                      <span className="review-score">
                        分数：{submission.review.score}
                      </span>
                    ) : null}
                  </div>
                  {submission.review?.comment ? (
                    <div className="comment-block">
                      <span className="comment-tag">老师</span>
                      <div className="review-comment">{submission.review.comment}</div>
                    </div>
                  ) : null}
                  {submission.note ? (
                    <div className="comment-block">
                      <span className="comment-tag">你</span>
                      <div className="note">{submission.note}</div>
                    </div>
                  ) : null}
                  {submission.updated_at !== submission.created_at ? (
                    <div className="meta">
                      <span>已修改</span>
                      <span>更新：{formatLocal(submission.updated_at)}</span>
                    </div>
                  ) : null}
                  <div className="submission-images">
                    {submission.photo_file_ids.map((fileId, index) => (
                      <img
                        key={fileId}
                        src={`/api/media?submission_id=${submission.id}&file_id=${fileId}`}
                        alt={`${submission.subject} 作业图片 ${index + 1}`}
                        loading="lazy"
                      />
                    ))}
                  </div>
                  {submission.editable ? (
                    <form onSubmit={(event) => handleEdit(event, submission.id)}>
                      <FilePicker
                        id={`edit-file-${submission.id}`}
                        label={
                          isReturned
                            ? "老师打回，可重新提交"
                            : `三天内可修改，截止 ${formatLocal(submission.edit_deadline)}`
                        }
                        files={editFiles[submission.id] ?? []}
                        onChange={(selected) =>
                          setEditFiles((prev) => ({
                            ...prev,
                            [submission.id]: selected
                          }))
                        }
                        hint="可上传多张新图片（最多 10 张）"
                      />
                      <div className="form-actions">
                        <button
                          className="button ghost small"
                          type="submit"
                          disabled={editBusy === submission.id}
                        >
                          {editBusy === submission.id ? "修改中…" : "提交修改"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="notice">修改期已过</div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="card animate-in">
          <h2 className="section-title">暂无提交记录</h2>
          <p className="hint">提交一次作业后，这里会展示你的历史记录。</p>
          <div className="form-actions">
            <Link className="button" href="/submit">
              去提交
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
