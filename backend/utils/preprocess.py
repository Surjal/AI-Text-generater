import re
from typing import List

import nltk
from nltk.corpus import stopwords as nltk_stopwords
from nltk.tokenize import sent_tokenize, word_tokenize

from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS


DEFAULT_STOPWORDS = set(ENGLISH_STOP_WORDS)


def ensure_nltk_resources() -> None:
    """
    Ensure the minimal NLTK data needed by this project is present.
    If downloads fail (e.g., no network), we fall back to simpler logic.
    """

    resources = [
        "punkt",
        "stopwords",
        "averaged_perceptron_tagger",
        "maxent_ne_chunker",
        "words",
    ]

    for resource in resources:
        try:
            nltk.data.find(f"tokenizers/{resource}")
        except LookupError:
            # Fallback tries: some resources live under different paths
            try:
                nltk.data.find(f"corpora/{resource}")
            except LookupError:
                try:
                    nltk.download(resource, quiet=True)
                except Exception:
                    # We'll handle missing resources via fallbacks.
                    pass


def sentence_tokenize(text: str) -> List[str]:
    text = (text or "").strip()
    if not text:
        return []
    try:
        sents = sent_tokenize(text)
    except Exception:
        # Regex fallback if punkt isn't available
        sents = re.split(r"(?<=[.!?])\s+", text)
    # Clean and filter empty
    sents = [s.strip() for s in sents if s and s.strip()]
    return sents


def _get_stopwords() -> set:
    try:
        return set(nltk_stopwords.words("english")) | DEFAULT_STOPWORDS
    except Exception:
        return set(DEFAULT_STOPWORDS)


def tokenize_words(text: str) -> List[str]:
    """
    Lowercase + word tokenization + stopword removal.
    """
    text = (text or "").strip().lower()
    if not text:
        return []

    stop_words = _get_stopwords()

    try:
        tokens = word_tokenize(text)
    except Exception:
        # Simple regex tokenization fallback
        tokens = re.findall(r"[a-zA-Z0-9]+", text)

    cleaned: List[str] = []
    for tok in tokens:
        tok = tok.strip().lower()
        if not tok:
            continue
        if tok in stop_words:
            continue
        # Keep only "word-like" tokens
        if not re.fullmatch(r"[a-zA-Z0-9]+", tok):
            continue
        cleaned.append(tok)
    return cleaned


def preprocess_sentence_tokens(sentence: str) -> List[str]:
    """
    Preprocess a sentence into tokens for TF-IDF / similarity.
    """
    return tokenize_words(sentence)


def preprocess_sentence_text(sentence: str) -> str:
    """
    Preprocess a sentence into a cleaned string for TF-IDF.
    """
    tokens = preprocess_sentence_tokens(sentence)
    return " ".join(tokens)


def preprocess_sentence_text(sentence: str) -> str:
    """
    Preprocessed sentence as a string for vectorizers.
    """
    return " ".join(preprocess_sentence_tokens(sentence))

