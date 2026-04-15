from __future__ import annotations

from typing import List

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

from .preprocess import sentence_tokenize, preprocess_sentence_tokens, preprocess_sentence_text


def _score_sentences_tf_idf(sentences: List[str]) -> np.ndarray:
    """
    TF-IDF extractive scoring: higher-sum sentences are more "informative".
    """
    # Turn sentences into cleaned strings for TF-IDF.
    sentence_strings = [preprocess_sentence_text(s) for s in sentences]

    # TfidfVectorizer handles the TF-IDF computation.
    vectorizer = TfidfVectorizer()
    tfidf_matrix = vectorizer.fit_transform(sentence_strings)

    # Sum TF-IDF values per sentence => sentence score.
    # tfidf_matrix shape: (n_sentences, n_terms)
    scores = tfidf_matrix.sum(axis=1)
    return np.asarray(scores).ravel()


def summarize_text(text: str, summary_sentences: int = 3) -> str:
    """
    Extractive summarization using TF-IDF sentence scoring.
    """
    summary_sentences = min(20, max(1, int(summary_sentences)))
    sentences = sentence_tokenize(text)

    if not sentences:
        return ""

    if len(sentences) <= summary_sentences:
        return " ".join(sentences).strip()

    scores = _score_sentences_tf_idf(sentences)
    top_indices = np.argsort(scores)[::-1][:summary_sentences]

    # Keep the original order for readability.
    top_indices_sorted = sorted(top_indices.tolist())
    selected = [sentences[i] for i in top_indices_sorted]
    return " ".join(selected).strip()

