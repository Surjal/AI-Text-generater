from __future__ import annotations

from typing import List

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

from .preprocess import preprocess_sentence_text, sentence_tokenize


def extract_keywords(text: str, top_n: int = 15) -> List[str]:
    """
    Rank terms using TF-IDF over sentences (each sentence = one document).
    Returns up to top_n unigrams/bigrams, de-duplicated and title-cased lightly.
    """
    text = (text or "").strip()
    if not text:
        return []

    sentences = sentence_tokenize(text)
    if not sentences:
        return []

    cleaned = [preprocess_sentence_text(s) for s in sentences]
    try:
        vectorizer = TfidfVectorizer(
            max_features=300,
            stop_words="english",
            ngram_range=(1, 2),
            min_df=1,
        )
        matrix = vectorizer.fit_transform(cleaned)
    except ValueError:
        return []

    col_sums = np.asarray(matrix.sum(axis=0)).ravel()
    names = vectorizer.get_feature_names_out()
    order = np.argsort(col_sums)[::-1]

    out: List[str] = []
    seen = set()
    for i in order:
        if len(out) >= top_n:
            break
        term = str(names[int(i)]).strip()
        if len(term) < 2:
            continue
        key = term.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(term)

    return out[:top_n]


def extract_key_points(text: str, max_points: int = 5) -> List[str]:
    """
    Top `max_points` sentences by TF-IDF sum score, kept in original reading order.
    """
    from .summarizer import _score_sentences_tf_idf

    text = (text or "").strip()
    if not text:
        return []

    sentences = sentence_tokenize(text)
    if not sentences:
        return []

    if len(sentences) <= max_points:
        return [s.strip() for s in sentences if s.strip()]

    scores = _score_sentences_tf_idf(sentences)
    k = min(max_points, len(sentences))
    top_indices = np.argsort(scores)[::-1][:k]
    top_indices_sorted = sorted(top_indices.tolist())
    return [sentences[i].strip() for i in top_indices_sorted]
