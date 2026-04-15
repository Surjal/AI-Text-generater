from __future__ import annotations

from typing import List

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

from .preprocess import sentence_tokenize, preprocess_sentence_text
from .ai_service import AIService


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


def summarize_text(text: str, summary_sentences: int = 3, hybrid: bool = True) -> str:
    """
    Summarization using a hybrid approach:
    1. Extract top sentences via TF-IDF (Extractive).
    2. Enhance/Refine via LLM (Abstractive) if available.
    """
    summary_sentences = min(20, max(1, int(summary_sentences)))
    sentences = sentence_tokenize(text)

    if not sentences:
        return ""

    if len(sentences) <= summary_sentences:
        extractive_summary = " ".join(sentences).strip()
    else:
        scores = _score_sentences_tf_idf(sentences)
        top_indices = np.argsort(scores)[::-1][:summary_sentences * 2] # Get more for context
        top_indices_sorted = sorted(top_indices.tolist())
        extractive_summary = " ".join([sentences[i] for i in top_indices_sorted]).strip()

    if hybrid:
        # Try LLM abstractive summarization
        # Use the extractive summary as a condensed input to save tokens if text is long
        input_for_llm = extractive_summary if len(text) > 4000 else text
        abstractive = AIService.summarize(input_for_llm, summary_sentences)
        if abstractive:
            return abstractive

    # Fallback to extractive
    if len(sentences) > summary_sentences:
        scores = _score_sentences_tf_idf(sentences)
        top_indices = np.argsort(scores)[::-1][:summary_sentences]
        top_indices_sorted = sorted(top_indices.tolist())
        extractive_summary = " ".join([sentences[i] for i in top_indices_sorted]).strip()
        
    return extractive_summary

