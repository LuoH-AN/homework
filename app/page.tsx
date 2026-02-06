"use client";

import { useEffect, useMemo, useState } from "react";

type SubmissionView = {
  id: string;
  subject: string;
  created_at: string;
  updated_at: string;
  editable: boolean;
  edit_deadline: string;
  photo_file_id: string;
  tags: string[];
};

type MeResponse = {
  registered: boolean;
  student?: { name: string };
  subjects: string[];
  submissions: SubmissionView[];
};

function formatLocal(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [editFiles, setEditFiles] = useState<Record<string, File | null>>({});
  const [editBusy, setEditBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const subjects = useMemo(() => me?.subjects ?? [], [me]);

  useEffect(() => {
    void loadMe();
  }, []);

  async function loadMe() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/me", { credentials: "include" });
      const data = (await res.json()) as MeResponse;
      if (!res.ok) {
        setError("加载失败，请稍后再试");
        return;
      }
      setMe(data);
      if (data.registered && data.subjects.length > 0) {
        setSubject(data.subjects[0]);
      }
    } catch (err) {
      setError("加载失败，请稍后再试");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!name.trim()) {
      setError("请输入姓名");
      return;
    }
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() })
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error ?? "注册失败");
        return;
      }
      setName("");
      await loadMe();
    } catch (err) {
      setError("注册失败，请稍后再试");
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!subject) {
      setError("请选择科目");
      return;
    }
    if (!file) {
      setError("请上传作业图片");
      return;
    }
    setSubmitBusy(true);
    try {
      const form = new FormData();
      form.append("subject", subject);
      form.append("image", file);
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
      setFile(null);
      setNotice("提交成功，已发送到群组");
      await loadMe();
    } catch (err) {
      setError("提交失败，请稍后再试");
    } finally {
      setSubmitBusy(false);
    }
  }

  async function handleEdit(event: React.FormEvent, submissionId: string) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const editFile = editFiles[submissionId];
    if (!editFile) {
      setError("请先选择新的作业图片");
      return;
    }
    setEditBusy(submissionId);
    try {
      const form = new FormData();
      form.append("submission_id", submissionId);
      form.append("image", editFile);
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
      setEditFiles((prev) => ({ ...prev, [submissionId]: null }));
      await loadMe();
    } catch (err) {
      setError("修改失败，请稍后再试");
    } finally {
      setEditBusy(null);
    }
  }

  if (loading) {
    return (
      <main>
        <header>
          <div>
            <h1>作业提交</h1>
            <div className="subtitle">正在连接 Telegram 群组…</div>
          </div>
        </header>
        <div className="card">加载中…</div>
      </main>
    );
  }

  return (
    <main>
      <header>
        <div>
          <h1>作业提交</h1>
          <div className="subtitle">你的作业将通过 Telegram 群组保存</div>
        </div>
      </header>

      {error ? <div className="error animate-in">{error}</div> : null}
      {notice ? <div className="notice animate-in">{notice}</div> : null}

      {!me?.registered ? (
        <section className="card animate-in">
          <h2 className="section-title">首次登记</h2>
          <form onSubmit={handleRegister}>
            <div className="field">
              <label>姓名（提交后不可修改）</label>
              <input
                type="text"
                placeholder="请输入真实姓名"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <button className="button" type="submit">
              绑定姓名
            </button>
          </form>
        </section>
      ) : (
        <>
          <section className="card animate-in">
            <h2 className="section-title">新的作业</h2>
            <div className="notice">你好，{me.student?.name}。你的姓名已锁定。</div>
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
              <div className="field">
                <label>上传作业图片</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </div>
              <button className="button" type="submit" disabled={submitBusy}>
                {submitBusy ? "提交中…" : "提交作业"}
              </button>
            </form>
          </section>

          <section className="card animate-in">
            <h2 className="section-title">我的提交记录</h2>
            {me.submissions?.length ? (
              <div className="grid">
                {me.submissions.map((submission) => (
                  <div key={submission.id} className="submission">
                    <div className="meta">
                      <span>{submission.subject}</span>
                      <span>提交：{formatLocal(submission.created_at)}</span>
                    </div>
                    {submission.updated_at !== submission.created_at ? (
                      <div className="meta">
                        <span>已修改</span>
                        <span>更新：{formatLocal(submission.updated_at)}</span>
                      </div>
                    ) : null}
                    <div className="tags">
                      {submission.tags.map((tag) => (
                        <span className="tag" key={tag}>
                          {tag}
                        </span>
                      ))}
                    </div>
                    <img
                      src={`/api/media?submission_id=${submission.id}&file_id=${submission.photo_file_id}`}
                      alt={`${submission.subject} 作业图片`}
                    />
                    {submission.editable ? (
                      <form onSubmit={(event) => handleEdit(event, submission.id)}>
                        <div className="field">
                          <label>三天内可修改，截止 {formatLocal(submission.edit_deadline)}</label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(event) =>
                              setEditFiles((prev) => ({
                                ...prev,
                                [submission.id]: event.target.files?.[0] ?? null
                              }))
                            }
                          />
                        </div>
                        <button
                          className="button ghost"
                          type="submit"
                          disabled={editBusy === submission.id}
                        >
                          {editBusy === submission.id ? "修改中…" : "提交修改"}
                        </button>
                      </form>
                    ) : (
                      <div className="notice">修改期已过</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="notice">暂无提交记录</div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
