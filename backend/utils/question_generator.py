from __future__ import annotations

import random
import re
from typing import List, Optional, Tuple

import networkx as nx
import numpy as np
from nltk import ne_chunk, pos_tag, word_tokenize
from nltk.tree import Tree
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from .preprocess import sentence_tokenize, preprocess_sentence_text


COPULA_VERBS = {"is", "are", "was", "were", "has", "have", "does", "do", "did"}


def _build_textrank_ranking(sentences: List[str], top_k: int) -> List[int]:
    """
    TextRank-like ranking:
    - sentence similarity graph (cosine similarity of TF-IDF vectors)
    - PageRank over the graph
    """
    n = len(sentences)
    if n <= top_k:
        return list(range(n))

    sentence_strings = [preprocess_sentence_text(s) for s in sentences]
    vectorizer = TfidfVectorizer()
    x = vectorizer.fit_transform(sentence_strings)
    sim_matrix = cosine_similarity(x)

    # Create graph from similarity matrix.
    graph = nx.Graph()
    graph.add_nodes_from(range(n))

    # Add edges where similarity is meaningful.
    # Threshold keeps the graph sparse and stable.
    threshold = 0.05
    for i in range(n):
        for j in range(i + 1, n):
            score = float(sim_matrix[i, j])
            if score > threshold:
                graph.add_edge(i, j, weight=score)

    if graph.number_of_edges() == 0:
        # Fallback: pick first sentences.
        return list(range(top_k))

    scores = nx.pagerank(graph, weight="weight")
    ranked = sorted(range(n), key=lambda i: scores.get(i, 0.0), reverse=True)
    return ranked[:top_k]


def _extract_first_noun_phrase(sentence: str) -> Optional[str]:
    """
    Beginner-friendly heuristic:
    - use POS tags and return the first noun(-ish) span.
    """
    try:
        tokens = word_tokenize(sentence)
        tags = pos_tag(tokens)
        noun_tags = {"NN", "NNS", "NNP", "NNPS"}

        i = 0
        while i < len(tags):
            word, tag = tags[i]
            if tag in noun_tags:
                j = i
                parts = []
                while j < len(tags) and tags[j][1] in noun_tags:
                    parts.append(tags[j][0])
                    j += 1
                phrase = " ".join(parts).strip()
                if phrase:
                    return phrase
                i = j
            else:
                i += 1
    except Exception:
        pass

    # Fallback: first longer word.
    words = re.findall(r"[A-Za-z][A-Za-z\-]*", sentence)
    for w in words:
        if len(w) >= 3:
            return w
    return None


def _extract_person_entity(sentence: str) -> Optional[str]:
    """
    Attempt NER with NLTK's ne_chunk (PERSON only).
    If NER data isn't available, falls back to None.
    """
    try:
        tokens = word_tokenize(sentence)
        tags = pos_tag(tokens)
        chunks = ne_chunk(tags, binary=False)
        if isinstance(chunks, Tree):
            for subtree in chunks.subtrees():
                if subtree.label() == "PERSON":
                    name = " ".join([leaf[0] for leaf in subtree.leaves()]).strip()
                    if name:
                        return name
    except Exception:
        pass
    return None


def _choose_wh_word(sentence: str) -> Tuple[str, Optional[str]]:
    """
    Decide WH-word and keyword to remove from the sentence.
    """
    s = (sentence or "").strip()
    if not s:
        return "What", None

    lower = s.lower()
    person = _extract_person_entity(s)
    noun_phrase = _extract_first_noun_phrase(s)

    # Priority: Person -> Why -> How -> What
    if person:
        return "Who", person

    if any(x in lower for x in ["because", "due to", "so that", "therefore", "reason for"]):
        return "Why", None
    
    if any(x in lower for x in ["how to", "by using", "method of", "process of"]):
        return "How", None

    if noun_phrase:
        # If it starts with a capital and isn't a person, maybe it's still a specific entity (Who/What)
        if noun_phrase[:1].isupper() and person:
             return "Who", noun_phrase
        return "What", noun_phrase

    return "What", None


def _capitalize_first(s: str) -> str:
    s = s.strip()
    if not s:
        return s
    return s[0].upper() + s[1:]


def _statement_to_question(sentence: str) -> str:
    """
    Convert a statement-like sentence into a WH-question via rules.
    """
    s = (sentence or "").strip()
    if not s:
        return ""

    # Normalize terminal punctuation.
    sent_no_end = re.sub(r"[.?!]+$", "", s).strip()
    lower = sent_no_end.lower()

    wh_word, keyword = _choose_wh_word(sent_no_end)

    # Check for affect/impact relations
    m = re.search(r'(.+?)\s+(affects?|impacts?|influences?)\s+(.+)', sent_no_end, re.IGNORECASE)
    if m:
        subject = m.group(1).strip()
        verb = m.group(2).lower()
        obj = m.group(3).strip()
        if subject and obj:
            return _capitalize_first(f"How does {subject} {verb} {obj}?")

    # If it looks causal, ask a Why-question.
    if wh_word == "Why":
        if "because" in lower:
            before = sent_no_end[: lower.index("because")].strip().rstrip(",")
            if before:
                return _capitalize_first(f"Why {before}?")
        return _capitalize_first(f"Why {sent_no_end}?")

    # Try copula transformation: "X is/are/... Y" => "What is Y?"
    m = re.match(
        r"^(?P<subject>.+?)\s+(?P<verb>is|are|was|were|has|have|does|do|did)\s+(?P<predicate>.+)$",
        sent_no_end,
        flags=re.IGNORECASE,
    )
    if m:
        verb = m.group("verb").lower()
        predicate = m.group("predicate").strip()
        if predicate:
            return _capitalize_first(f"{wh_word} {verb} {predicate}?")

    # General fallback: remove the chosen keyword from the sentence.
    if keyword:
        try:
            remainder = re.sub(rf"\b{re.escape(keyword)}\b", "", sent_no_end, count=1, flags=re.IGNORECASE).strip()
            remainder = re.sub(r"\s+", " ", remainder)
            if remainder:
                return _capitalize_first(f"{wh_word} {remainder}?")
        except Exception:
            pass

    return _capitalize_first(f"{wh_word} {sent_no_end}?")


def generate_questions(text: str, question_count: int = 5) -> List[str]:
    """
    Generate important question candidates using:
    - TextRank sentence ranking
    - Rule-based WH-question transformation
    """
    question_count = max(1, int(question_count))
    sentences = sentence_tokenize(text)
    if not sentences:
        return []

    # Rank sentences and convert top ones.
    top_indices = _build_textrank_ranking(sentences, top_k=min(question_count, len(sentences)))
    selected = [sentences[i] for i in top_indices]

    questions: List[str] = []
    seen = set()
    for sent in selected:
        q = _statement_to_question(sent)
        if not q:
            continue
        q_norm = q.strip()
        if q_norm and q_norm.lower() not in seen:
            seen.add(q_norm.lower())
            questions.append(q_norm)

    return questions[:question_count]


def _extract_answer_candidate(sentence: str) -> Optional[str]:
    """Extract a candidate answer phrase from a sentence."""
    if not sentence:
        return None

    try:
        tokens = word_tokenize(sentence)
        tags = pos_tag(tokens)
        phrase_tokens: list[str] = []
        for word, tag in tags:
            if tag.startswith("NN"):
                phrase_tokens.append(word)
            elif phrase_tokens:
                break
        if phrase_tokens:
            candidate = " ".join(phrase_tokens).strip()
            if len(candidate) > 2:
                return candidate
    except Exception:
        pass

    words = re.findall(r"[A-Za-z][A-Za-z\-]*", sentence)
    for word in words:
        if len(word) >= 4:
            return word
    return words[0] if words else None


def _build_distractors(answer: str, pool: List[str], count: int = 3) -> List[str]:
    """Build simple distractor options from candidate answer phrases."""
    answer_clean = answer.lower().strip()
    candidates = []
    for item in pool:
        item_clean = item.lower().strip()
        if not item_clean or item_clean == answer_clean:
            continue
        if item_clean not in {c.lower().strip() for c in candidates}:
            candidates.append(item)
        if len(candidates) >= count:
            break

    fallback_words = [
        "process",
        "method",
        "system",
        "concept",
        "component",
        "approach",
        "result",
        "element",
        "factor",
    ]
    while len(candidates) < count:
        for word in fallback_words:
            if word.lower() != answer_clean and word not in candidates:
                candidates.append(word)
                if len(candidates) >= count:
                    break
        if len(candidates) >= count:
            break

    return candidates[:count]


def generate_mcq_items(text: str, question_count: int = 5) -> List[dict]:
    """Generate MCQ items from text using heuristic question generation."""
    question_count = max(0, int(question_count))
    if question_count <= 0:
        return []

    sentences = sentence_tokenize(text)
    if not sentences:
        return []

    answer_pool = []
    for sentence in sentences:
        answer = _extract_answer_candidate(sentence)
        if answer:
            answer_pool.append(answer)

    top_indices = _build_textrank_ranking(sentences, top_k=min(len(sentences), question_count * 2))
    items: List[dict] = []
    seen_questions = set()

    for idx in top_indices:
        if len(items) >= question_count:
            break
        sentence = sentences[idx]
        answer = _extract_answer_candidate(sentence)
        if not answer:
            continue

        question = _statement_to_question(sentence)
        if not question:
            continue

        question_norm = question.strip().lower()
        if question_norm in seen_questions:
            continue

        distractors = _build_distractors(answer, answer_pool, count=3)
        options = [answer] + distractors
        random.shuffle(options)
        if answer not in options:
            options[0:0] = [answer]

        items.append(
            {
                "question": question,
                "options": options,
                "correct_index": options.index(answer),
                "answer": answer,
            }
        )
        seen_questions.add(question_norm)

    return items[:question_count]


def generate_fill_blank_items(text: str, item_count: int = 5) -> List[dict]:
    """Generate fill-in-the-blank items from text using extracted answer phrases."""
    item_count = max(0, int(item_count))
    if item_count <= 0:
        return []

    sentences = sentence_tokenize(text)
    if not sentences:
        return []

    items: List[dict] = []
    seen_prompts = set()

    for sentence in sentences:
        if len(items) >= item_count:
            break

        answer = _extract_answer_candidate(sentence)
        if not answer:
            continue

        prompt = sentence.replace(answer, "_____", 1)
        if prompt == sentence:
            continue

        prompt_norm = prompt.strip().lower()
        if prompt_norm in seen_prompts:
            continue

        items.append({"prompt": prompt.strip(), "answer": answer})
        seen_prompts.add(prompt_norm)

    return items[:item_count]

