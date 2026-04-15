import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { loadHistory } from "../utils/historyStorage.js";

function toTimestamp(entry) {
  const raw = entry?.created_at ?? entry?.createdAt;
  const ts = Number(raw);
  if (Number.isFinite(ts) && ts > 0) return ts;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.valueOf()) ? 0 : parsed.valueOf();
}

function formatDateLabel(entry) {
  const ts = toTimestamp(entry);
  if (!ts) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(ts));
}

function formatRelativeTime(entry) {
  const ts = toTimestamp(entry);
  if (!ts) return "";
  const seconds = Math.round((Date.now() - ts) / 1000);
  const abs = Math.abs(seconds);
  const units = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.34524, "week"],
    [12, "month"],
    [Infinity, "year"],
  ];

  let value = abs;
  let unit = "second";
  for (const [step, name] of units) {
    unit = name;
    if (value < step) break;
    value /= step;
  }

  const rounded = Math.max(1, Math.floor(value));
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  return formatter.format(seconds < 0 ? rounded : -rounded, unit);
}

function buildActivityTimeline(history) {
  const counts = {};
  history.forEach((entry) => {
    const timeRaw = toTimestamp(entry);
    const time = timeRaw ? new Date(timeRaw) : null;
    if (!time || Number.isNaN(time.valueOf())) return;
    const dateKey = [
      time.getFullYear(),
      String(time.getMonth() + 1).padStart(2, "0"),
      String(time.getDate()).padStart(2, "0"),
    ].join("-");
    counts[dateKey] = (counts[dateKey] || 0) + 1;
  });
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, count]) => {
      const date = new Date(`${dateKey}T00:00:00`);
      return {
        key: dateKey,
        count,
        shortLabel: new Intl.DateTimeFormat(undefined, {
          month: "short",
          day: "numeric",
        }).format(date),
        longLabel: new Intl.DateTimeFormat(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        }).format(date),
      };
    })
    .slice(-7);
}

function StatCard({ icon, value, label, color = "primary" }) {
  const colors = {
    primary: "bg-primary-50 text-primary-600",
    emerald: "bg-emerald-50 text-emerald-600",
    indigo: "bg-indigo-50 text-indigo-600",
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-5 group hover:shadow-md transition-all">
      <div
        className={`w-14 h-14 rounded-2xl flex items-center justify-center ${colors[color]} group-hover:scale-110 transition-transform`}
      >
        {icon}
      </div>
      <div>
        <div className="text-3xl font-extrabold text-slate-900 leading-tight">
          {value}
        </div>
        <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">
          {label}
        </div>
      </div>
    </div>
  );
}

function ActivityChart({ timeline }) {
  const maxCount = timeline.reduce(
    (max, point) => Math.max(max, point.count),
    0,
  );

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm mt-8">
      <h3 className="text-xl font-bold text-slate-900 mb-8 flex items-center gap-2">
        <svg
          className="w-5 h-5 text-primary-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
          />
        </svg>
        Weekly Progress
      </h3>
      <div className="flex items-end justify-between h-48 gap-2 md:gap-4 px-4">
        {timeline.map((point) => {
          const { key, count, shortLabel, longLabel } = point;
          const height =
            maxCount > 0 ? Math.max(18, (count / maxCount) * 120) : 18;
          return (
            <div
              key={key}
              className="grow flex flex-col items-center group relative"
            >
              <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] px-2 py-1 rounded font-bold pointer-events-none whitespace-nowrap">
                {count} summaries
              </div>
              <div
                className="w-full max-w-10 bg-primary-100 rounded-t-xl group-hover:bg-primary-500 transition-all duration-500 relative overflow-hidden"
                style={{ height: `${height}px` }}
              >
                <div className="absolute inset-0 bg-linear-to-t from-black/5 to-transparent" />
              </div>
              <span className="mt-3 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                {shortLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HistoryCard({ entry }) {
  const title =
    entry.title || entry.source_label || entry.sourceLabel || "Saved summary";
  const dateLabel = formatDateLabel(entry);
  const relative = formatRelativeTime(entry);

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
      <div className="flex justify-between items-start mb-4">
        <div className="flex flex-col">
          <h4 className="font-extrabold text-slate-900 text-lg leading-snug line-clamp-1 group-hover:text-primary-600 transition-colors">
            {title}
          </h4>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {dateLabel}
            </span>
            <span className="w-1 h-1 bg-slate-200 rounded-full" />
            <span className="text-xs font-medium text-primary-500">
              {relative}
            </span>
          </div>
        </div>
        {entry.topic && (
          <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg uppercase tracking-tight">
            {entry.topic}
          </span>
        )}
      </div>
      <p className="text-slate-500 text-sm leading-relaxed line-clamp-3 mb-6 font-medium italic">
        "{entry.summary || "Summary content unavailable."}"
      </p>
      {entry.keywords?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-auto pt-4 border-t border-slate-50">
          {entry.keywords.slice(0, 3).map((kw, i) => (
            <span
              key={i}
              className="px-2 py-1 bg-primary-50 text-primary-600 text-[10px] font-bold rounded-md uppercase tracking-wider"
            >
              #{kw}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function UserDashboard({ auth }) {
  const [serverHistory, setServerHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!auth?.token) return;
    setLoading(true);
    axios
      .get("/user/history")
      .then((res) => {
        setServerHistory(res.data.history || []);
      })
      .catch((e) => {
        setError(e?.response?.data?.error || "Could not load history.");
      })
      .finally(() => setLoading(false));
  }, [auth]);

  const localHistory = useMemo(() => loadHistory(), []);
  const historyList = auth?.token ? serverHistory : localHistory;
  const normalizedHistory = useMemo(
    () =>
      historyList.map((entry) => ({
        ...entry,
        created_at: entry?.created_at ?? entry?.createdAt,
      })),
    [historyList],
  );

  const totalDocuments = normalizedHistory.length;
  const totalQuestions = normalizedHistory.reduce(
    (sum, entry) =>
      sum +
      (entry.mcqItems?.length || entry.mcq_items?.length || 0) +
      (entry.fillBlankItems?.length || entry.fill_blank_items?.length || 0),
    0,
  );

  const timeline = useMemo(
    () => buildActivityTimeline(normalizedHistory),
    [normalizedHistory],
  );
  const searchTerm = search.trim().toLowerCase();

  const filteredHistory = useMemo(() => {
    if (!searchTerm) return normalizedHistory;
    return normalizedHistory.filter((entry) => {
      return (
        entry.summary?.toLowerCase().includes(searchTerm) ||
        entry.title?.toLowerCase().includes(searchTerm) ||
        entry.topic?.toLowerCase().includes(searchTerm) ||
        entry.source_label?.toLowerCase().includes(searchTerm) ||
        entry.sourceLabel?.toLowerCase().includes(searchTerm)
      );
    });
  }, [normalizedHistory, searchTerm]);

  if (!auth?.user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8 bg-white rounded-[3rem] border border-slate-200 shadow-sm animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 bg-slate-50 rounded-4xl flex items-center justify-center text-slate-300 mb-8">
          <svg
            className="w-12 h-12"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <h2 className="text-3xl font-extrabold text-slate-900 mb-4 tracking-tight">
          Access Restricted
        </h2>
        <p className="text-slate-500 text-lg max-w-sm mb-10 leading-relaxed">
          Sign in to your account to view your document history and personalized
          learning stats.
        </p>
        <div className="flex gap-4">
          <Link
            to="/login"
            className="px-8 py-3 bg-primary-600 text-white font-bold rounded-2xl shadow-xl shadow-primary-500/25 hover:bg-primary-700 transition-all active:scale-95"
          >
            Sign In
          </Link>
          <Link
            to="/signup"
            className="px-8 py-3 bg-white text-slate-700 font-bold rounded-2xl border border-slate-200 hover:bg-slate-50 transition-all active:scale-95"
          >
            Create Account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
            Personal Dashboard
          </h1>
          <p className="text-slate-500 text-lg mt-1 font-medium">
            Tracking your progress with{" "}
            <span className="text-primary-600">{auth.user.username}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/chatbot"
            className="newSummaryBtn px-6 py-2.5 bg-primary-600 text-white font-bold rounded-xl shadow-lg shadow-primary-500/20 hover:bg-primary-700 transition-all active:scale-95 flex items-center gap-2 text-sm"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Summary
          </Link>
        </div>
      </header>

      {/* Stats Section */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          label="Documents"
          value={totalDocuments}
          color="primary"
          icon={
            <svg
              className="w-8 h-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h4m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          }
        />
        <StatCard
          label="Questions"
          value={totalQuestions}
          color="indigo"
          icon={
            <svg
              className="w-8 h-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
        <StatCard
          label="Daily Goal"
          value={`${Math.min(100, Math.round((totalDocuments / 5) * 100))}%`}
          color="emerald"
          icon={
            <svg
              className="w-8 h-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          }
        />
      </section>

      {/* Timeline Section */}
      {timeline.length > 0 && <ActivityChart timeline={timeline} />}

      {/* History Section */}
      <section className="space-y-8 mt-16">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Summary Vault</h2>
            <p className="text-slate-500 font-medium">
              Revisit your past insights and study items.
            </p>
          </div>
          <div className="relative w-full md:w-80 group">
            <input
              type="text"
              placeholder="Search your library..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-100 focus:border-primary-400 transition-all font-medium"
            />
            <svg
              className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-64 bg-slate-100 animate-pulse rounded-3xl"
              />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 bg-red-50 border border-red-100 text-red-600 rounded-[2.5rem] text-center font-bold">
            {error}
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-[2.5rem] border border-slate-200 border-dashed">
            <div className="text-slate-300 mb-4">
              <svg
                className="w-16 h-16 mx-auto"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900">
              No documents found
            </h3>
            <p className="text-slate-500 mt-2 max-w-xs mx-auto">
              Try a different search term or create your first summary to fill
              your vault.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredHistory.map((entry) => (
              <HistoryCard
                key={entry.id || entry.created_at || entry.createdAt}
                entry={entry}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
