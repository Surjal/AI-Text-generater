const KEY = "summariserHistory";
const MAX = 10;

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toText(value, fallback = "") {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => toText(item).trim()).filter(Boolean);
}

function safeId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `history-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeMcqItem(item) {
  if (!isRecord(item)) return null;
  const question = toText(item.question).trim();
  if (!question) return null;
  return {
    type: "mcq",
    question,
    options: Array.isArray(item.options)
      ? item.options.map((option) => toText(option).trim()).filter(Boolean)
      : [],
    correct_index:
      Number.isInteger(Number(item.correct_index)) &&
      Number(item.correct_index) >= 0
        ? Number(item.correct_index)
        : 0,
  };
}

function normalizeFibItem(item) {
  if (!isRecord(item)) return null;
  const prompt = toText(item.prompt).trim();
  if (!prompt) return null;
  return {
    type: "fill_blank",
    prompt,
    answer: Array.isArray(item.answer)
      ? item.answer.map((part) => toText(part).trim())
      : toText(item.answer).trim(),
  };
}

function normalizeHistoryEntry(entry) {
  if (!isRecord(entry)) return null;

  const createdAtRaw = entry.createdAt ?? entry.created_at ?? Date.now();
  const createdAt = Number.isFinite(Number(createdAtRaw))
    ? Number(createdAtRaw)
    : Date.now();
  const mcqItems = Array.isArray(entry.mcqItems)
    ? entry.mcqItems.map(normalizeMcqItem).filter(Boolean)
    : [];
  const fillBlankItems = Array.isArray(entry.fillBlankItems)
    ? entry.fillBlankItems.map(normalizeFibItem).filter(Boolean)
    : [];

  if (
    !mcqItems.length &&
    !fillBlankItems.length &&
    Array.isArray(entry.quizItems)
  ) {
    for (const item of entry.quizItems) {
      if (!isRecord(item)) continue;
      if (item.type === "mcq") {
        const normalized = normalizeMcqItem(item);
        if (normalized) mcqItems.push(normalized);
      } else if (item.type === "fill_blank") {
        const normalized = normalizeFibItem(item);
        if (normalized) fillBlankItems.push(normalized);
      }
    }
  }

  return {
    id: toText(entry.id).trim() || safeId(),
    createdAt,
    created_at: createdAt,
    summary: toText(entry.summary).trim(),
    sourceLabel: toText(
      entry.sourceLabel ?? entry.source_label,
      "Saved summary",
    ).trim(),
    source_label: toText(
      entry.sourceLabel ?? entry.source_label,
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

export function loadHistory() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr)
      ? arr.map(normalizeHistoryEntry).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

export function pushHistoryEntry(entry) {
  const prev = loadHistory();
  const normalizedEntry = normalizeHistoryEntry(entry) || {
    id: safeId(),
    createdAt: Date.now(),
    created_at: Date.now(),
    summary: "",
    sourceLabel: "Saved summary",
    source_label: "Saved summary",
    keywords: [],
    keyPoints: [],
    title: "",
    topic: "",
    mcqItems: [],
    fillBlankItems: [],
  };
  const next = [
    {
      ...normalizedEntry,
    },
    ...prev,
  ].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
