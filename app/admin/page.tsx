"use client";

import { useEffect, useMemo, useState } from "react";
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
  ResponsiveContainer
} from "recharts";
import AdminLogin from "./components/admin-login";
import { useAdminAuth } from "./lib/admin-auth";
import type { OverviewResponse } from "./lib/types";

export default function AdminDashboardPage() {
  const { ready, secret, login, authenticating, authError, logout } = useAdminAuth();
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !secret) return;
    void loadOverview(secret);
  }, [ready, secret]);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(null), 3000);
    return () => window.clearTimeout(timer);
  }, [error]);

  async function loadOverview(token = secret) {
    setLoading(true);
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
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    const submissions = (overview?.submissions ?? []).filter(
      (item) => item.student_name !== "组长"
    );
    const subjects = overview?.subjects ?? [];

    const reviewed = submissions.filter((s) => s.review?.status === "reviewed").length;
    const pending = submissions.filter((s) => s.review?.status !== "reviewed").length;

    const reviewStats = [
      { name: "已批改", value: reviewed, color: "#22c55e" },
      { name: "待批改", value: pending, color: "#f59e0b" }
    ];

    const subjectStats = subjects.map((subject) => {
      const count = submissions.filter((s) => s.subject === subject).length;
      return { name: subject, 提交数: count };
    });

    const today = new Date().toISOString().slice(0, 10);
    const todaySubmissions = submissions.filter(
      (s) => s.created_at.slice(0, 10) === today
    ).length;

    const last7Days = [] as Array<{ date: string; 提交数: number }>;
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().slice(0, 10);
      const count = submissions.filter(
        (s) => s.created_at.slice(0, 10) === dateStr
      ).length;
      last7Days.push({
        date: dateStr.slice(5),
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
          <h1>管理概览</h1>
          <p className="subtitle">查看提交趋势与批改进度。</p>
        </div>
      </header>

      {error ? <div className="error toast animate-in">{error}</div> : null}

      {!overview || loading ? (
        <section className="card animate-in">加载中…</section>
      ) : (
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
      )}
    </main>
  );
}
