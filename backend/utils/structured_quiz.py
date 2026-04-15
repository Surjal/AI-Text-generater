from __future__ import annotations

import random
import re
from typing import Any, Dict, List, Optional, Set, Tuple

from .question_generator import (
    _build_textrank_ranking,
    _extract_first_noun_phrase,
    _extract_person_entity,
    _statement_to_question,
)
from .preprocess import sentence_tokenize, preprocess_sentence_text
from nltk import pos_tag, word_tokenize


def _collect_distractor_pool(sentences: List[str], exclude: Set[str]) -> List[str]:
    pool: List[str] = []
    seen: Set[str] = set()
    for s in sentences:
        for getter in (_extract_person_entity, _extract_first_noun_phrase):
            try:
                cand = getter(s)
            except Exception:
                cand = None
            if not cand:
                continue
            key = cand.strip().lower()
            if len(key) < 2 or len(cand.strip()) < 4 or key in exclude or key in seen:
                continue
            seen.add(key)
            pool.append(cand.strip())
    if len(pool) < 6:
        for s in sentences:
            try:
                tokens = word_tokenize(s)
                tags = pos_tag(tokens)
                for word, tag in tags:
                    if tag.startswith('NN') and len(word) >= 3:  # Nouns only
                        wl = word.lower()
                        if wl in exclude or wl in seen:
                            continue
                        seen.add(wl)
                        pool.append(word)
                        if len(pool) >= 20:
                            break
            except Exception:
                pass
    return pool


_BAD_BLANK = {
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "has",
    "have",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "must",
    "can",
    "it",
    "they",
    "he",
    "she",
    "we",
    "you",
}


def _blank_sentence(sentence: str) -> Optional[Tuple[str, List[str]]]:
    s = (sentence or "").strip()
    if not s:
        return None
    sent_no_end = re.sub(r"[.?!]+$", "", s).strip()
    try:
        tokens = word_tokenize(sent_no_end)
        tags = pos_tag(tokens)
    except Exception:
        return None
    nouns = [(i, word) for i, (word, tag) in enumerate(tags) if tag.startswith('NN') and len(word) >= 3 and word.lower() not in _BAD_BLANK]
    if len(nouns) < 2:
        return None
    # Blank 2-3 nouns
    num_to_blank = min(3, len(nouns))
    selected = random.sample(nouns, num_to_blank)
    selected.sort(key=lambda x: x[0])  # sort by position
    answers = [word for _, word in selected]
    prompt = sent_no_end
    for _, word in reversed(selected):  # reverse to replace from end
        prompt = re.sub(rf"\b{re.escape(word)}\b", "________", prompt, count=1, flags=re.IGNORECASE)
    if prompt == sent_no_end or "________" not in prompt:
        return None
    prompt = prompt.strip()
    if not prompt.endswith("?"):
        prompt = prompt + "."
    return (prompt, answers)


def _word_distractors(text: str, correct: str, need: int, rng: random.Random) -> List[str]:
    try:
        tokens = word_tokenize(text)
        tags = pos_tag(tokens)
        words = [word for word, tag in tags if tag.startswith('NN') and len(word) >= 4]
    except Exception:
        words = re.findall(r"\b[A-Za-z]{4,}\b", text)
    cl = correct.lower()
    out: List[str] = []
    seen = {cl}
    rng.shuffle(words)
    for w in words:
        wl = w.lower()
        if wl in seen or wl == cl:
            continue
        seen.add(wl)
        out.append(w)
        if len(out) >= need:
            break
    i = 0
    while len(out) < need:
        out.append(f"Choice {i + 1}")
        i += 1
    return out[:need]


def _ranked_sentence_pool(text: str, min_pool: int) -> List[str]:
    sentences = sentence_tokenize(text)
    if not sentences:
        return []
    n = len(sentences)
    top_k = min(n, max(min_pool, min_pool + 4))
    top_indices = _build_textrank_ranking(sentences, top_k=top_k)
    return [sentences[i] for i in top_indices]


def generate_mcq_items(text: str, count: int) -> List[Dict[str, Any]]:
    """Up to `count` multiple-choice items (max 20) from TextRank-ranked sentences."""
    count = min(20, max(0, int(count)))
    if count == 0:
        return []

    sentences = sentence_tokenize(text)
    if not sentences:
        return []

    selected = _ranked_sentence_pool(text, min_pool=max(count * 2, 12))
    exclude_lower: Set[str] = set()
    items: List[Dict[str, Any]] = []
    rng = random.Random(hash(preprocess_sentence_text(text)[:200]) & 0xFFFFFFFF)

    for sent in selected:
        if len(items) >= count:
            break
        stem = "Which of the following statements is true?"
        correct = sent.strip()
        if not correct:
            continue

        noun = _extract_first_noun_phrase(sent)
        if not noun or len(noun) < 2:
            continue

        exclude_lower.add(noun.lower())
        pool = _collect_distractor_pool(sentences, exclude_lower)
        distractors = [p for p in pool if p.lower() != noun.lower()]
        rng.shuffle(distractors)
        picks = distractors[:3]
        if len(picks) < 3:
            picks.extend(_word_distractors(text, noun, 3 - len(picks), rng))
        options = [correct]
        for d in picks[:3]:
            modified = re.sub(rf"\b{re.escape(noun)}\b", d, sent, count=1, flags=re.IGNORECASE)
            if modified.strip() != correct:
                options.append(modified.strip())
        if len(options) < 4:
            continue
        rng.shuffle(options)
        correct_index = options.index(correct)

        items.append(
            {
                "type": "mcq",
                "question": stem,
                "options": options,
                "correct_index": correct_index,
            }
        )

    return items[:count]


def generate_fill_blank_items(text: str, count: int) -> List[Dict[str, Any]]:
    """Up to `count` fill-in-the-blank items (max 20)."""
    count = min(20, max(0, int(count)))
    if count == 0:
        return []

    sentences = sentence_tokenize(text)
    if not sentences:
        return []

    selected = _ranked_sentence_pool(text, min_pool=max(count * 2, 12))
    exclude_lower: Set[str] = set()
    items: List[Dict[str, Any]] = []

    for sent in selected:
        if len(items) >= count:
            break
        blanked = _blank_sentence(sent)
        if not blanked:
            continue
        prompt, ans = blanked
        al = " ".join(ans).lower() if isinstance(ans, list) else ans.lower()
        if al in exclude_lower:
            continue
        exclude_lower.add(al)
        items.append(
            {
                "type": "fill_blank",
                "prompt": prompt,
                "answer": ans,
            }
        )

    return items[:count]


def generate_structured_quiz(text: str, question_count: int = 5) -> List[Dict[str, Any]]:
    """
    Legacy: alternating MCQ and fill-in-the-blank (for backward compatibility).
    """
    question_count = max(1, int(question_count))
    mcq_n = (question_count + 1) // 2
    fib_n = question_count // 2
    mcqs = generate_mcq_items(text, mcq_n)
    fibs = generate_fill_blank_items(text, fib_n)
    merged: List[Dict[str, Any]] = []
    mi, fi = 0, 0
    for i in range(question_count):
        if i % 2 == 0:
            if mi < len(mcqs):
                merged.append(mcqs[mi])
                mi += 1
            elif fi < len(fibs):
                merged.append(fibs[fi])
                fi += 1
        else:
            if fi < len(fibs):
                merged.append(fibs[fi])
                fi += 1
            elif mi < len(mcqs):
                merged.append(mcqs[mi])
                mi += 1
    return merged
