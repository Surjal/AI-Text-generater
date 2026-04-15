import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { exportQuizPdf } from "../utils/exportQuizPdf.js";
import { loadHistory, pushHistoryEntry } from "../utils/historyStorage.js";

const MIN_CHARS = 50;
const BLANK_SPLIT_REGEX = /(?:_{3,}|\[\s*blank\s*\])/gi;

// --- Helper Functions (unchanged from original) ---
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function toText(value, fallback = "") {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
}
function normalizeAnswer(value) {
  return toText(value).trim().replace(/\s+/g, " ").toLowerCase();
}
function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => toText(item).trim()).filter(Boolean);
}
function normalizeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}
function normalizeIndex(value) {
  const index = Number(value);
  return Number.isInteger(index) && index >= 0 ? index : null;
}
function normalizeWordFrequency(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!isRecord(item)) {
        const word = toText(item).trim();
        return word ? { word, count: 1 } : null;
      }
      const word = toText(item.word).trim();
      if (!word) return null;
      return { word, count: Math.max(0, normalizeNumber(item.count, 0)) };
    })
    .filter(Boolean);
}
function normalizeSentenceScores(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!isRecord(item)) return null;
      const sentence = toText(item.sentence).trim();
      if (!sentence) return null;
      return { sentence, score: normalizeNumber(item.score, 0) };
    })
    .filter(Boolean);
}
function normalizeMcqItem(item) {
  if (!isRecord(item)) return null;
  const question = toText(item.question).trim();
  if (!question) return null;
  const options = Array.isArray(item.options)
    ? item.options.map((option) => toText(option).trim()).filter(Boolean)
    : [];
  const correctIndex = normalizeIndex(item.correct_index);
  return { type: "mcq", question, options, correct_index: correctIndex ?? 0 };
}
function normalizeFibItem(item) {
  if (!isRecord(item)) return null;
  const prompt = toText(item.prompt).trim();
  if (!prompt) return null;
  const answer = Array.isArray(item.answer)
    ? item.answer.map((part) => toText(part).trim())
    : toText(item.answer).trim();
  return { type: "fill_blank", prompt, answer };
}
function splitLegacyQuizItems(quizItems) {
  if (!Array.isArray(quizItems) || !quizItems.length)
    return { mcq: [], fib: [] };
  const mcq = [];
  const fib = [];
  for (const item of quizItems) {
    if (!isRecord(item)) continue;
    if (item.type === "mcq") {
      const normalized = normalizeMcqItem(item);
      if (normalized) mcq.push(normalized);
    } else if (item.type === "fill_blank") {
      const normalized = normalizeFibItem(item);
      if (normalized) fib.push(normalized);
    }
  }
  return { mcq, fib };
}
function normalizeQuizItemLists(data) {
  const source = isRecord(data) ? data : {};
  const mcqItems = Array.isArray(source.mcq_items)
    ? source.mcq_items.map(normalizeMcqItem).filter(Boolean)
    : Array.isArray(source.mcqItems)
      ? source.mcqItems.map(normalizeMcqItem).filter(Boolean)
      : [];
  const fillBlankItems = Array.isArray(source.fill_blank_items)
    ? source.fill_blank_items.map(normalizeFibItem).filter(Boolean)
    : Array.isArray(source.fillBlankItems)
      ? source.fillBlankItems.map(normalizeFibItem).filter(Boolean)
      : [];
  if (
    !mcqItems.length &&
    !fillBlankItems.length &&
    Array.isArray(source.quizItems)
  ) {
    const legacy = splitLegacyQuizItems(source.quizItems);
    mcqItems.push(...legacy.mcq);
    fillBlankItems.push(...legacy.fib);
  }
  return { mcqItems, fillBlankItems };
}
function normalizeProcessResponse(data) {
  const source = isRecord(data) ? data : {};
  const { mcqItems, fillBlankItems } = normalizeQuizItemLists(source);
  return {
    summary: toText(source.summary).trim(),
    title: toText(source.title).trim(),
    topic: toText(source.topic).trim(),
    wordFrequency: normalizeWordFrequency(
      source.word_frequency ?? source.wordFrequency,
    ),
    sentenceScores: normalizeSentenceScores(
      source.sentence_scores ?? source.sentenceScores,
    ),
    mcqItems,
    fillBlankItems,
    keywords: normalizeStringArray(source.keywords),
    keyPoints: normalizeStringArray(source.key_points ?? source.keyPoints),
  };
}
function normalizeHistoryEntry(entry) {
  if (!isRecord(entry)) return null;
  const createdAt = normalizeNumber(
    entry.createdAt ?? entry.created_at,
    Date.now(),
  );
  const { mcqItems, fillBlankItems } = normalizeQuizItemLists(entry);
  return {
    id: toText(entry.id).trim() || safeHistoryId(),
    createdAt,
    created_at: createdAt,
    summary: toText(entry.summary).trim(),
    sourceLabel: toText(
      entry.sourceLabel ?? entry.source_label,
      "Saved summary",
    ).trim(),
    source_label: toText(
      entry.source_label ?? entry.sourceLabel,
      "Saved summary",
    ).trim(),
    keywords: normalizeStringArray(entry.keywords),
    keyPoints: normalizeStringArray(entry.keyPoints ?? entry.key_points),
    title: toText(entry.title).trim(),
    topic: toText(entry.topic).trim(),
    mcqItems,
    fillBlankItems,
  };
}
function safeHistoryId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `history-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function splitPromptParts(prompt) {
  const parts = toText(prompt).split(BLANK_SPLIT_REGEX);
  return parts.length > 0 ? parts : [""];
}
function formatHistoryTime(value) {
  const timestamp = normalizeNumber(value, 0);
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.valueOf())) return "";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
function normalizeBlankAnswers(value) {
  if (Array.isArray(value)) {
    return value.map((item) => toText(item));
  }
  const text = toText(value);
  return text ? [text] : [];
}
function normalizeBlankAnswersForComparison(value) {
  return normalizeBlankAnswers(value).map((answer) => answer.trim());
}
function hasAnswerContent(value) {
  const answers = normalizeBlankAnswersForComparison(value);
  return answers.length > 0 && answers.some((answer) => answer.length > 0);
}
function getExpectedBlankCount(item) {
  if (!item || !isRecord(item)) return 0;
  const promptCount = Math.max(0, splitPromptParts(item.prompt).length - 1);
  const answerCount = Array.isArray(item.answer)
    ? normalizeBlankAnswersForComparison(item.answer).length
    : 1;
  return Math.max(promptCount, answerCount, 1);
}
function hasCompleteFibAnswer(item, value) {
  const expectedCount = getExpectedBlankCount(item);
  const answers = normalizeBlankAnswersForComparison(value);
  if (!expectedCount) return false;
  if (answers.length < expectedCount) return false;
  return answers.slice(0, expectedCount).every((answer) => answer.length > 0);
}
function fibMatches(user, correct) {
  const userAnswers = normalizeBlankAnswersForComparison(user);
  const correctAnswers = normalizeBlankAnswersForComparison(correct);
  if (!userAnswers.length || !correctAnswers.length) return false;
  if (userAnswers.length !== correctAnswers.length) {
    if (userAnswers.length !== 1 || correctAnswers.length !== 1) return false;
  }
  return userAnswers.every((answer, index) => {
    const userAnswer = normalizeAnswer(answer);
    const correctAnswer = normalizeAnswer(correctAnswers[index]);
    if (!userAnswer || !correctAnswer) return false;
    if (userAnswer === correctAnswer) return true;
    if (
      userAnswer.length >= 3 &&
      (correctAnswer.includes(userAnswer) || userAnswer.includes(correctAnswer))
    ) {
      return true;
    }
    return false;
  });
}

export default function Chatbot({ auth }) {
  const navigate = useNavigate();
  const pdfInputRef = useRef(null);
  const [text, setText] = useState("");
  const [pdfFile, setPdfFile] = useState(null);
  const [summarySentences, setSummarySentences] = useState(5);
  const [mcqCount, setMcqCount] = useState(5);
  const [fillBlankCount, setFillBlankCount] = useState(5);
  const [includeKeywords, setIncludeKeywords] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  const [loading, setLoading] = useState(false);
  const [hasProcessed, setHasProcessed] = useState(false);
  const [summary, setSummary] = useState("");
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [wordFrequency, setWordFrequency] = useState([]);
  const [sentenceScores, setSentenceScores] = useState([]);
  const [mcqItems, setMcqItems] = useState([]);
  const [fillBlankItems, setFillBlankItems] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [keyPoints, setKeyPoints] = useState([]);
  const [error, setError] = useState("");

  const [history, setHistory] = useState(() => loadHistory());
  const [activeTab, setActiveTab] = useState("summary");
  const [quizSubTab, setQuizSubTab] = useState("mcq");

  const [mcqPick, setMcqPick] = useState({});
  const [fibAnswers, setFibAnswers] = useState({});
  const [revealedMcq, setRevealedMcq] = useState({});
  const [revealedFib, setRevealedFib] = useState({});
  const [gradeMcq, setGradeMcq] = useState({});
  const [gradeFib, setGradeFib] = useState({});
  const [currentHistoryId, setCurrentHistoryId] = useState("");
  const [quizAttemptStatus, setQuizAttemptStatus] = useState("");

  useEffect(() => {
    setHistory(loadHistory().map(normalizeHistoryEntry).filter(Boolean));
  }, []);

  const canProcess = useMemo(() => {
    if (loading) return false;
    if (pdfFile) return true;
    return (text || "").trim().length >= MIN_CHARS;
  }, [text, loading, pdfFile]);

  const hasQuiz = mcqItems.length > 0 || fillBlankItems.length > 0;
  const hasInsights = keywords.length > 0 || keyPoints.length > 0;
  const hasAnyResult =
    hasProcessed && (Boolean(summary) || hasInsights || hasQuiz);

  function getDefaultTab(nextSummary, nextHasInsights, nextHasQuiz) {
    if (nextSummary) return "summary";
    if (nextHasQuiz) return "quiz";
    if (nextHasInsights) return "insights";
    return "summary";
  }

  const mcqProgress = useMemo(() => {
    if (!mcqItems.length) return 0;
    const n = mcqItems.filter((_, i) => revealedMcq[i]).length;
    return Math.round((n / mcqItems.length) * 100);
  }, [mcqItems, revealedMcq]);

  const fibProgress = useMemo(() => {
    if (!fillBlankItems.length) return 0;
    const n = fillBlankItems.filter((_, i) => revealedFib[i]).length;
    return Math.round((n / fillBlankItems.length) * 100);
  }, [fillBlankItems, revealedFib]);

  function resetQuizInteraction() {
    setMcqPick({});
    setFibAnswers({});
    setRevealedMcq({});
    setRevealedFib({});
    setGradeMcq({});
    setGradeFib({});
    setQuizAttemptStatus("");
  }

  function buildQuestionPerformance() {
    const mcqPerformance = mcqItems.map((item, idx) => {
      const pickedIndex = normalizeIndex(mcqPick[idx]);
      const correctIndex = normalizeIndex(item.correct_index);
      const userAnswer =
        pickedIndex !== null && item.options[pickedIndex]
          ? item.options[pickedIndex]
          : "";
      const correctAnswer = item.options[correctIndex ?? 0] || "";
      return {
        index: idx,
        question: item.question,
        correct: gradeMcq[idx] === "correct",
        user_answer: userAnswer,
        correct_answer: correctAnswer,
        difficulty: 3,
      };
    });

    const fibPerformance = fillBlankItems.map((item, idx) => {
      const userAnswer = normalizeBlankAnswers(fibAnswers[idx]).join(", ");
      const correctAnswer = Array.isArray(item.answer)
        ? item.answer.join(", ")
        : item.answer;
      return {
        index: mcqItems.length + idx,
        question: item.prompt,
        correct: gradeFib[idx] === "correct",
        user_answer: userAnswer,
        correct_answer: correctAnswer,
        difficulty: 3,
      };
    });

    return [...mcqPerformance, ...fibPerformance];
  }

  async function submitQuizAttempt() {
    if (!auth?.token || !currentHistoryId || !hasQuiz) return;

    const questionPerformance = buildQuestionPerformance();
    const correctAnswers = questionPerformance.filter(
      (item) => item.correct,
    ).length;
    const totalQuestions = questionPerformance.length;
    const score = totalQuestions
      ? Math.round((correctAnswers / totalQuestions) * 100)
      : 0;

    try {
      const response = await axios.post("/api/quiz-attempt", {
        history_id: currentHistoryId,
        score,
        correct_answers: correctAnswers,
        total_questions: totalQuestions,
        time_taken_seconds: 0,
        is_timed: false,
        question_performance: questionPerformance,
      });

      setQuizAttemptStatus(
        response?.data?.new_difficulty
          ? `Saved attempt. Next difficulty: ${response.data.new_difficulty}`
          : "Saved quiz attempt.",
      );
    } catch (err) {
      setQuizAttemptStatus(
        err?.response?.data?.error || err?.message || "Failed to save attempt.",
      );
    }
  }

  async function onProcess() {
    if (loading) return;
    setLoading(true);
    setHasProcessed(false);
    setActiveTab("summary");
    setError("");
    setSummary("");
    setTitle("");
    setTopic("");
    setWordFrequency([]);
    setSentenceScores([]);
    setMcqItems([]);
    setFillBlankItems([]);
    setKeywords([]);
    setKeyPoints([]);
    setCurrentHistoryId("");
    resetQuizInteraction();

    try {
      let res;
      const payloadBase = {
        summary_sentences: summarySentences,
        mcq_count: mcqCount,
        fill_blank_count: fillBlankCount,
        include_keywords: includeKeywords,
      };
      if (pdfFile) {
        const fd = new FormData();
        Object.entries(payloadBase).forEach(([k, v]) => {
          fd.append(
            k,
            typeof v === "boolean" ? (v ? "true" : "false") : String(v),
          );
        });
        fd.append("file", pdfFile);
        fd.append("text", "");
        res = await axios.post("/process-text", fd);
      } else {
        const trimmed = (text || "").trim();
        if (!trimmed) {
          setError(`Enter at least ${MIN_CHARS} characters or upload a PDF.`);
          return;
        }
        res = await axios.post("/process-text", {
          text: trimmed,
          ...payloadBase,
        });
      }

      const normalized = normalizeProcessResponse(res?.data);
      const { summary: sum, title: nextTitle, topic: nextTopic } = normalized;
      const mcq = normalized.mcqItems;
      const fib = normalized.fillBlankItems;

      setSummary(sum);
      setTitle(nextTitle);
      setTopic(nextTopic);
      setWordFrequency(normalized.wordFrequency);
      setSentenceScores(normalized.sentenceScores);
      setMcqItems(mcq);
      setFillBlankItems(fib);
      setKeywords(normalized.keywords);
      setKeyPoints(normalized.keyPoints);

      const sessionHistoryId = safeHistoryId();

      if (mcq.length) setQuizSubTab("mcq");
      else if (fib.length) setQuizSubTab("fib");

      const nextActiveTab = getDefaultTab(
        sum,
        normalized.keywords.length > 0 || normalized.keyPoints.length > 0,
        mcq.length > 0 || fib.length > 0,
      );
      setActiveTab(nextActiveTab);
      setHasProcessed(true);

      const label = pdfFile ? pdfFile.name || "PDF" : "Pasted text";
      const next = pushHistoryEntry({
        id: sessionHistoryId,
        summary: sum,
        title: nextTitle,
        topic: nextTopic,
        mcqItems: mcq,
        fillBlankItems: fib,
        keywords: normalized.keywords,
        keyPoints: normalized.keyPoints,
        sourceLabel: label,
      });
      setHistory(next);
      setCurrentHistoryId(sessionHistoryId);

      if (auth?.token) {
        await axios.post("/user/history", {
          id: sessionHistoryId,
          summary: sum,
          title: nextTitle,
          topic: nextTopic,
          keywords: normalized.keywords,
          key_points: normalized.keyPoints,
          source_label: label,
          mcq_items: mcq,
          fill_blank_items: fib,
        });
      }
    } catch (e) {
      setError(
        e?.response?.data?.error || e?.message || "Something went wrong.",
      );
    } finally {
      setLoading(false);
    }
  }

  function onPickPdf(e) {
    const f = e.target.files?.[0];
    setPdfFile(f || null);
    if (f) setText("");
    resetQuizInteraction();
  }

  function clearPdf() {
    setPdfFile(null);
    if (pdfInputRef.current) pdfInputRef.current.value = "";
    resetQuizInteraction();
  }

  function applyHistoryItem(h) {
    const normalized = normalizeHistoryEntry(h);
    if (!normalized) return;
    setCurrentHistoryId(normalized.id);
    setSummary(normalized.summary);
    setTitle(normalized.title);
    setTopic(normalized.topic);
    setMcqItems(normalized.mcqItems);
    setFillBlankItems(normalized.fillBlankItems);
    setKeywords(normalized.keywords);
    setKeyPoints(normalized.keyPoints);
    setError("");
    resetQuizInteraction();
    setHasProcessed(true);
    setActiveTab(
      getDefaultTab(
        normalized.summary,
        normalized.keywords.length > 0 || normalized.keyPoints.length > 0,
        normalized.mcqItems.length > 0 || normalized.fillBlankItems.length > 0,
      ),
    );
    setQuizSubTab(normalized.mcqItems.length ? "mcq" : "fib");
    setShowHistory(false);
  }

  function checkMcq(idx) {
    const item = mcqItems[idx];
    if (!item) return;
    const picked = normalizeIndex(mcqPick[idx]);
    const correctIndex = normalizeIndex(item.correct_index);
    if (picked === null || correctIndex === null) return;
    setGradeMcq((g) => ({
      ...g,
      [idx]: picked === correctIndex ? "correct" : "wrong",
    }));
    setRevealedMcq((r) => ({ ...r, [idx]: true }));
  }

  function checkFib(idx) {
    const item = fillBlankItems[idx];
    if (!item) return;
    const ans = normalizeBlankAnswers(fibAnswers[idx]);
    if (!hasCompleteFibAnswer(item, ans)) return;
    setGradeFib((g) => ({
      ...g,
      [idx]: fibMatches(ans, item.answer) ? "correct" : "wrong",
    }));
    setRevealedFib((r) => ({ ...r, [idx]: true }));
  }

  function onExportPdf() {
    if (!hasQuiz) return;
    exportQuizPdf({
      title: "AI Text Tool — Quiz",
      summary,
      mcqItems,
      fillBlankItems,
    });
  }

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
            AI Study Companion
          </h1>
          <p className="text-slate-500 mt-1 text-lg">
            Analyze documents and practice with interactive quizzes.
          </p>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={`historyToggleBtn flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
            showHistory
              ? "bg-primary-600 text-white shadow-lg shadow-primary-500/25"
              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          History
        </button>
      </div>

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Input & Settings */}
        <div
          className={`lg:col-span-5 flex flex-col gap-6 sticky top-24 ${showHistory ? "hidden lg:flex" : "flex"}`}
        >
          {showHistory ? (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-150">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-900 text-lg">
                  Recent Sessions
                </h3>
                <span className="bg-primary-50 text-primary-600 px-3 py-1 rounded-full text-xs font-bold">
                  {history.length}
                </span>
              </div>
              <div className="grow overflow-y-auto p-4 space-y-3">
                {history.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
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
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <p className="text-slate-400 font-medium">No history yet</p>
                  </div>
                ) : (
                  history.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => applyHistoryItem(h)}
                      className="w-full text-left p-4 rounded-2xl border border-slate-100 hover:border-primary-300 hover:bg-primary-50/50 transition-all group"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <strong className="text-slate-900 font-bold group-hover:text-primary-700 truncate">
                          {h.sourceLabel || "Session"}
                        </strong>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {formatHistoryTime(h.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 line-clamp-2">
                        {h.summary || "No summary"}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-900">
                  Input Content
                </h2>
                <div className="flex gap-2">
                  <label className="cursor-pointer group">
                    <input
                      ref={pdfInputRef}
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={onPickPdf}
                    />
                    <div
                      className="p-2 rounded-xl bg-slate-50 text-slate-600 hover:bg-primary-50 hover:text-primary-600 transition-all"
                      title="Upload PDF"
                    >
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  </label>
                </div>
              </div>

              {pdfFile ? (
                <div className="flex items-center justify-between p-4 bg-primary-50 rounded-2xl border border-primary-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary-600 shadow-sm">
                      <svg
                        className="w-6 h-6"
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
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 truncate max-w-50">
                        {pdfFile.name}
                      </p>
                      <p className="text-xs text-primary-600 font-medium">
                        Ready to process
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={clearPdf}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ) : (
                <textarea
                  className="w-full h-64 p-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-primary-100 focus:border-primary-400 transition-all resize-none text-slate-700 bg-slate-50/50"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Paste your study material here (min 50 chars)..."
                />
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  {[
                    {
                      label: "Sentences",
                      val: summarySentences,
                      set: setSummarySentences,
                      max: 20,
                    },
                    { label: "MCQs", val: mcqCount, set: setMcqCount, max: 20 },
                    {
                      label: "Blanks",
                      val: fillBlankCount,
                      set: setFillBlankCount,
                      max: 20,
                    },
                  ].map((s, i) => (
                    <div key={i} className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {s.label}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={s.max}
                        value={s.val}
                        onChange={(e) =>
                          s.set(
                            Math.min(
                              s.max,
                              Math.max(0, Number(e.target.value)),
                            ),
                          )
                        }
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-4 focus:ring-primary-100 transition-all"
                      />
                    </div>
                  ))}
                </div>

                <label className="flex items-center gap-3 cursor-pointer group p-4 bg-slate-50 rounded-2xl border border-slate-200 hover:border-primary-300 hover:bg-primary-50/50 transition-all">
                  <div className="relative shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={includeKeywords}
                      onChange={(e) => setIncludeKeywords(e.target.checked)}
                    />
                    <div
                      className={`w-12 h-6 rounded-full transition-colors border-2 ${includeKeywords ? "bg-primary-500 border-primary-600" : "bg-slate-200 border-slate-300"}`}
                    />
                    <div
                      className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform shadow-md ${includeKeywords ? "translate-x-6" : ""}`}
                    />
                  </div>
                  <div className="flex-1">
                    <span className="block text-sm font-semibold text-slate-900 group-hover:text-primary-700 transition-colors">
                      Extract Keywords & Points
                    </span>
                    <span className="text-xs text-slate-500">
                      {includeKeywords ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                </label>
              </div>

              <button
                onClick={onProcess}
                disabled={!canProcess || loading}
                className="processBtn w-full py-4 bg-primary-600 text-white font-bold rounded-2xl shadow-xl shadow-primary-500/25 hover:bg-primary-700 hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none transition-all flex items-center justify-center gap-2 text-lg"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />{" "}
                    Processing...
                  </>
                ) : (
                  <>⚡ Generate Insights</>
                )}
              </button>

              {error && (
                <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm font-medium animate-shake">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-7">
          {loading ? (
            <div className="loadingOverlay flex flex-col items-center justify-center gap-6 p-10 text-center">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-4 border-primary-100" />
                <div className="absolute inset-0 rounded-full border-4 border-primary-600 border-t-transparent animate-spin" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-extrabold text-slate-900">
                  Processing your content...
                </h3>
                <p className="text-slate-500 max-w-md">
                  We’re extracting key points and building your custom study
                  set.
                </p>
              </div>
              <div className="loadingProgressTrack">
                <div className="loadingProgressBar" />
              </div>
            </div>
          ) : !hasAnyResult ? (
            <div className="h-150 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col items-center justify-center p-12 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300 mb-6">
                <svg
                  className="w-10 h-10"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-extrabold text-slate-900 mb-2">
                Your results will appear here
              </h3>
              <p className="text-slate-500 max-w-sm">
                Paste text or upload a PDF and click Generate.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="landingHeroBadge w-fit">AI-powered</div>

              {/* Tabs */}
              <div className="flex p-1.5 bg-slate-100 rounded-2xl w-fit">
                {[
                  {
                    id: "summary",
                    label: "Summary",
                    icon: (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 6h16M4 12h16M4 18h7"
                        />
                      </svg>
                    ),
                  },
                  {
                    id: "insights",
                    label: "Insights",
                    icon: (
                      <svg
                        className="w-4 h-4"
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
                    ),
                  },
                  {
                    id: "quiz",
                    label: "Interactive Quiz",
                    icon: (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                      </svg>
                    ),
                  },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                      activeTab === t.id
                        ? "bg-white text-primary-600 shadow-sm"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                    }`}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-8 min-h-125">
                {activeTab === "summary" && summary && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-2xl font-extrabold text-slate-900">
                          {title || "Summary"}
                        </h3>
                        {topic && (
                          <span className="inline-block mt-2 px-3 py-1 bg-primary-50 text-primary-600 text-xs font-bold rounded-full uppercase tracking-wider">
                            {topic}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="prose prose-slate max-w-none">
                      <p className="summaryText text-slate-700 leading-relaxed text-lg whitespace-pre-line">
                        {summary}
                      </p>
                    </div>
                    {sentenceScores.length > 0 && (
                      <div className="mt-12">
                        <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                          <span className="w-1.5 h-6 bg-primary-500 rounded-full" />{" "}
                          Key Highlights
                        </h4>
                        <div className="grid gap-3">
                          {sentenceScores.slice(0, 3).map((s, i) => (
                            <div
                              key={i}
                              className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-4"
                            >
                              <span className="text-primary-600 font-bold text-sm">
                                0{i + 1}
                              </span>
                              <p className="text-slate-600 text-sm italic">
                                "{s.sentence}"
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "insights" && hasInsights && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-10">
                    {keywords.length > 0 && (
                      <div>
                        <h4 className="font-bold text-slate-900 mb-6 flex items-center gap-2 text-xl">
                          <span className="w-2 h-2 bg-primary-500 rounded-full" />{" "}
                          Vocabulary Focus
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {keywords.map((k, i) => (
                            <span
                              key={i}
                              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium hover:border-primary-300 hover:text-primary-600 transition-colors shadow-sm"
                            >
                              {k}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {keyPoints.length > 0 && (
                      <div>
                        <h4 className="font-bold text-slate-900 mb-6 flex items-center gap-2 text-xl">
                          <span className="w-2 h-2 bg-indigo-500 rounded-full" />{" "}
                          Critical Takeaways
                        </h4>
                        <ul className="space-y-4">
                          {keyPoints.map((kp, i) => (
                            <li
                              key={i}
                              className="flex gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-100"
                            >
                              <div className="shrink-0 w-8 h-8 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400">
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              </div>
                              <p className="text-slate-700 leading-relaxed font-medium">
                                {kp}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "quiz" && hasQuiz && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-6 pb-6 border-b border-slate-100">
                      <div className="flex p-1 bg-slate-100 rounded-xl w-fit">
                        {mcqItems.length > 0 && (
                          <button
                            onClick={() => setQuizSubTab("mcq")}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${quizSubTab === "mcq" ? "bg-white text-primary-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                          >
                            Multiple Choice ({mcqItems.length})
                          </button>
                        )}
                        {fillBlankItems.length > 0 && (
                          <button
                            onClick={() => setQuizSubTab("fib")}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${quizSubTab === "fib" ? "bg-white text-primary-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                          >
                            Fill in Blanks ({fillBlankItems.length})
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                            Progress
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary-500 transition-all duration-1000"
                                style={{
                                  width: `${quizSubTab === "mcq" ? mcqProgress : fibProgress}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs font-extrabold text-slate-900">
                              {quizSubTab === "mcq" ? mcqProgress : fibProgress}
                              %
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={onExportPdf}
                          className="p-2 text-slate-400 hover:text-primary-600 transition-colors"
                          title="Export PDF"
                        >
                          <svg
                            className="w-6 h-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-12 py-4">
                      {quizSubTab === "mcq"
                        ? mcqItems.map((item, idx) => (
                            <div key={idx} className="group scroll-mt-24">
                              <div className="flex gap-4 mb-6">
                                <span className="shrink-0 w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                                  {idx + 1}
                                </span>
                                <h4 className="text-xl font-bold text-slate-900 leading-snug">
                                  {item.question}
                                </h4>
                              </div>
                              <div className="grid gap-3 pl-12">
                                {item.options.map((opt, oi) => {
                                  const isPicked =
                                    normalizeIndex(mcqPick[idx]) === oi;
                                  const isCorrect =
                                    normalizeIndex(item.correct_index) === oi;
                                  const isRevealed = revealedMcq[idx];

                                  let styleClasses =
                                    "bg-white border-slate-200 text-slate-700 hover:border-primary-300 hover:bg-slate-50";
                                  if (isPicked)
                                    styleClasses =
                                      "border-primary-600 bg-primary-50 text-primary-900";
                                  if (isRevealed) {
                                    if (isCorrect)
                                      styleClasses =
                                        "border-emerald-500 bg-emerald-50 text-emerald-900 ring-4 ring-emerald-500/10";
                                    else if (isPicked)
                                      styleClasses =
                                        "border-red-500 bg-red-50 text-red-900 ring-4 ring-red-500/10 opacity-70";
                                    else
                                      styleClasses =
                                        "border-slate-100 bg-white text-slate-400 opacity-50";
                                  }

                                  return (
                                    <button
                                      key={oi}
                                      disabled={isRevealed}
                                      onClick={() =>
                                        setMcqPick((p) => ({ ...p, [idx]: oi }))
                                      }
                                      className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center gap-4 group/opt ${styleClasses}`}
                                    >
                                      <span
                                        className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold transition-colors ${
                                          isPicked
                                            ? "bg-primary-600 text-white"
                                            : isRevealed && isCorrect
                                              ? "bg-emerald-500 text-white"
                                              : "bg-slate-100 text-slate-500 group-hover/opt:bg-primary-200 group-hover/opt:text-primary-700"
                                        }`}
                                      >
                                        {String.fromCharCode(65 + oi)}
                                      </span>
                                      <span className="font-semibold">
                                        {opt}
                                      </span>
                                      {isRevealed && isCorrect && (
                                        <svg
                                          className="w-5 h-5 ml-auto text-emerald-600"
                                          fill="currentColor"
                                          viewBox="0 0 20 20"
                                        >
                                          <path
                                            fillRule="evenodd"
                                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                            clipRule="evenodd"
                                          />
                                        </svg>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="pl-12 mt-6 flex items-center gap-4">
                                {!revealedMcq[idx] && (
                                  <button
                                    disabled={
                                      normalizeIndex(mcqPick[idx]) === null
                                    }
                                    onClick={() => checkMcq(idx)}
                                    className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 disabled:opacity-30 transition-all active:scale-95"
                                  >
                                    Check Answer
                                  </button>
                                )}
                                {revealedMcq[idx] && (
                                  <div
                                    className={`flex items-center gap-2 font-bold text-sm ${gradeMcq[idx] === "correct" ? "text-emerald-600" : "text-red-500"}`}
                                  >
                                    {gradeMcq[idx] === "correct"
                                      ? "✓ Excellent!"
                                      : `✗ Not quite. The correct answer was ${String.fromCharCode(65 + item.correct_index)}.`}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
                        : fillBlankItems.map((item, idx) => (
                            <div key={idx} className="group">
                              <div className="flex gap-4 mb-6">
                                <span className="shrink-0 w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                                  {idx + 1}
                                </span>
                                <div className="text-xl font-bold text-slate-900 leading-relaxed flex flex-wrap items-center gap-x-2 gap-y-3">
                                  {splitPromptParts(item.prompt).map(
                                    (part, pi, parts) => (
                                      <React.Fragment key={pi}>
                                        <span>{part}</span>
                                        {pi < parts.length - 1 && (
                                          <input
                                            type="text"
                                            disabled={revealedFib[idx]}
                                            value={
                                              normalizeBlankAnswers(
                                                fibAnswers[idx],
                                              )[pi] ?? ""
                                            }
                                            onChange={(e) => {
                                              const newAns =
                                                normalizeBlankAnswers(
                                                  fibAnswers[idx],
                                                );
                                              newAns[pi] = e.target.value;
                                              setFibAnswers((f) => ({
                                                ...f,
                                                [idx]: newAns,
                                              }));
                                            }}
                                            className={`px-4 py-1.5 rounded-xl border-2 font-bold text-primary-700 w-40 text-center transition-all focus:ring-4 focus:ring-primary-100 ${
                                              revealedFib[idx]
                                                ? gradeFib[idx] === "correct"
                                                  ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                                                  : "bg-red-50 border-red-500 text-red-700"
                                                : "bg-slate-50 border-slate-200 focus:border-primary-400"
                                            }`}
                                            placeholder="..."
                                          />
                                        )}
                                      </React.Fragment>
                                    ),
                                  )}
                                </div>
                              </div>
                              <div className="pl-12 mt-6 flex items-center gap-4">
                                {!revealedFib[idx] && (
                                  <button
                                    disabled={
                                      !hasCompleteFibAnswer(
                                        item,
                                        fibAnswers[idx],
                                      )
                                    }
                                    onClick={() => checkFib(idx)}
                                    className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 disabled:opacity-30 transition-all active:scale-95"
                                  >
                                    Check Answer
                                  </button>
                                )}
                                {revealedFib[idx] && (
                                  <div
                                    className={`flex flex-col gap-2 font-bold text-sm ${gradeFib[idx] === "correct" ? "text-emerald-600" : "text-red-500"}`}
                                  >
                                    <span>
                                      {gradeFib[idx] === "correct"
                                        ? "✓ Spot on!"
                                        : "✗ Almost there."}
                                    </span>
                                    {gradeFib[idx] === "wrong" && (
                                      <span className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-500 font-medium">
                                        Correct answer:{" "}
                                        <span className="text-slate-900">
                                          {Array.isArray(item.answer)
                                            ? item.answer.join(", ")
                                            : item.answer}
                                        </span>
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                    </div>

                    {auth?.user && hasQuiz && (
                      <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between p-5 bg-slate-50 border border-slate-100 rounded-2xl">
                        <div>
                          <h4 className="font-bold text-slate-900">
                            Save this attempt
                          </h4>
                          <p className="text-sm text-slate-500">
                            Sends your checked answers to the analytics
                            dashboard.
                          </p>
                        </div>
                        <button
                          onClick={submitQuizAttempt}
                          disabled={!currentHistoryId}
                          className="px-5 py-3 bg-slate-900 text-white font-bold rounded-xl border border-slate-900 hover:bg-slate-800 transition-all active:scale-95 disabled:bg-slate-200 disabled:text-slate-500 disabled:border-slate-200 disabled:cursor-not-allowed"
                        >
                          Save Quiz Attempt
                        </button>
                      </div>
                    )}

                    {quizAttemptStatus && (
                      <div className="p-4 rounded-2xl bg-primary-50 border border-primary-100 text-primary-700 font-medium">
                        {quizAttemptStatus}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!auth?.user && hasAnyResult && (
                <div className="bg-linear-to-r from-slate-900 to-slate-800 rounded-3xl p-8 text-white flex flex-col md:flex-row justify-between items-center gap-6">
                  <div>
                    <h4 className="text-xl font-bold mb-2">
                      Want to save this for later?
                    </h4>
                    <p className="text-slate-400">
                      Create an account to save summaries and sync your progress
                      across devices.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate("/login")}
                    className="whitespace-nowrap px-8 py-3 bg-primary-500 text-white font-bold rounded-2xl hover:bg-primary-600 transition-all shadow-lg shadow-primary-500/20 active:scale-95"
                  >
                    Sign Up Now
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
