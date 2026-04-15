from __future__ import annotations

import random
import re
from typing import Dict, List, Optional

from nltk import ne_chunk, pos_tag, word_tokenize
from nltk.tree import Tree
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from .preprocess import ensure_nltk_resources, preprocess_sentence_text, sentence_tokenize


QUESTION_WORD_LIMIT = 12


def _capitalize_first(text: str) -> str:
    text = (text or "").strip()
    if not text:
        return text
    return text[0].upper() + text[1:]


def _normalize_sentence(sentence: str) -> str:
    sentence = (sentence or "").strip()
    if not sentence:
        return ""
    sentence = re.sub(r"\s+", " ", sentence)
    if not re.search(r"[.?!]$", sentence):
        sentence += "."
    sentence = _capitalize_first(sentence)
    return sentence


def _shorten_question(question: str, max_words: int = QUESTION_WORD_LIMIT) -> str:
    words = [w for w in re.split(r"\s+", question.strip()) if w]
    if len(words) <= max_words:
        return _capitalize_first(question.strip())
    shortened = " ".join(words[: max_words - 1])
    shortened = shortened.rstrip("?!.",) + "?"
    return _capitalize_first(shortened)


def _extract_noun_phrase(sentence: str) -> Optional[str]:
    try:
        tokens = word_tokenize(sentence)
        tags = pos_tag(tokens)
        phrase: List[str] = []
        for word, tag in tags:
            if tag.startswith("NN"):
                phrase.append(word)
            elif phrase:
                break
        if phrase:
            return " ".join(phrase)
    except Exception:
        pass
    return None


def _extract_person_or_entity(sentence: str) -> Optional[str]:
    try:
        tokens = word_tokenize(sentence)
        tags = pos_tag(tokens)
        tree = ne_chunk(tags, binary=False)
        if isinstance(tree, Tree):
            for subtree in tree.subtrees():
                if subtree.label() in {"PERSON", "ORGANIZATION", "GPE", "LOCATION"}:
                    name = " ".join(leaf[0] for leaf in subtree.leaves()).strip()
                    if name:
                        return name
    except Exception:
        pass
    return None


def _build_question(sentence: str) -> str:
    lower = sentence.lower()
    if any(keyword in lower for keyword in ("purpose", "aim", "goal", "objective", "intention")):
        return "What is the main purpose of the text?"
    if any(keyword in lower for keyword in ("main idea", "main point", "central idea", "central point", "core idea")):
        return "What is the main idea of the text?"
    if any(keyword in lower for keyword in ("because", "due to", "therefore", "as a result", "so that", "since")):
        return "Why does the text make this point?"
    if any(keyword in lower for keyword in ("how", "process", "method", "way", "approach")):
        topic = _extract_noun_phrase(sentence) or "this idea"
        return _shorten_question(f"How does the text describe {topic}?"
                                 if len(topic.split()) <= 4
                                 else "How is this idea described?")

    entity = _extract_person_or_entity(sentence)
    if entity:
        return _shorten_question(f"Who is described in the text?"
                                 if len(entity.split()) <= 3
                                 else "Who is mentioned in the text?")

    topic = _extract_noun_phrase(sentence)
    if topic:
        return _shorten_question(f"What does the text say about {topic}?"
                                 if len(topic.split()) <= 5
                                 else "What is said about this topic?")

    return "What is the key point in the text?"


def _rank_sentences(sentences: List[str], top_k: int) -> List[int]:
    if len(sentences) <= top_k:
        return list(range(len(sentences)))

    sentence_strings = [preprocess_sentence_text(s) for s in sentences]
    vectorizer = TfidfVectorizer(stop_words="english")
    matrix = vectorizer.fit_transform(sentence_strings)
    similarity = cosine_similarity(matrix)

    scores = [float(sum(similarity[i]) - 1.0) for i in range(len(sentences))]
    ranked = sorted(range(len(sentences)), key=lambda idx: scores[idx], reverse=True)
    return ranked[:top_k]


def _keyword_candidates(sentences: List[str]) -> List[str]:
    keywords: List[str] = []
    for sentence in sentences:
        noun_phrase = _extract_noun_phrase(sentence)
        if noun_phrase and noun_phrase.lower() not in (kw.lower() for kw in keywords):
            keywords.append(noun_phrase)
    return keywords


def _distort_sentence(sentence: str, replacement_nouns: List[str]) -> str:
    words = sentence.split()
    for idx, word in enumerate(words):
        if word.istitle() or re.fullmatch(r"[A-Za-z]{4,}", word):
            for substitute in replacement_nouns:
                if substitute.lower() != word.lower() and substitute.lower() not in sentence.lower():
                    words[idx] = substitute
                    return _normalize_sentence(" ".join(words))
    return _normalize_sentence(sentence)


def _select_distractors(correct: str, sentences: List[str], count: int = 3) -> List[str]:
    pool = [s for s in sentences if s.strip() and s.strip() != correct.strip() and len(s.split()) >= 6]
    pool = list(dict.fromkeys(pool))
    if not pool:
        return [
            _normalize_sentence("The text explains a closely related idea."),
            _normalize_sentence("The text does not focus on that detail."),
            _normalize_sentence("The text highlights a different outcome than that."),
        ][:count]

    selected: List[str] = []
    # Sort pool sentences by similarity to the correct answer.
    # We want distractors that are somewhat similar (plausible) but not TOO similar (paraphrases).
    try:
        all_texts = [preprocess_sentence_text(s) for s in [correct] + pool]
        vectorizer = TfidfVectorizer(stop_words="english")
        matrix = vectorizer.fit_transform(all_texts)
        similarity = cosine_similarity(matrix)[0, 1:]
        # Aim for similarity in the 0.1 to 0.5 range for plausibility.
        ranked = sorted(zip(pool, similarity), key=lambda item: abs(item[1] - 0.3))
    except Exception:
        ranked = [(s, 0.0) for s in pool]

    for candidate, score in ranked:
        if len(selected) >= count:
            break
        option = _normalize_sentence(candidate)
        # Ensure it's not the same as the correct answer and not already selected.
        if option and option not in selected and option.lower() != _normalize_sentence(correct).lower():
            selected.append(option)


    if len(selected) < count:
        for candidate in pool:
            option = _normalize_sentence(candidate)
            if option not in selected and option != _normalize_sentence(correct):
                selected.append(option)
            if len(selected) >= count:
                break

    replacement_nouns = _keyword_candidates(sentences)
    if len(selected) < count and replacement_nouns:
        selected.append(_distort_sentence(correct, replacement_nouns))

    if len(selected) > count:
        selected = selected[:count]

    return selected


def generate_mcqs(text: str, num_questions: int) -> List[Dict[str, object]]:
    """Return IELTS-style MCQ questions with full-sentence options."""
    ensure_nltk_resources()
    num_questions = max(0, int(num_questions))
    if num_questions == 0:
        return []

    sentences = [s for s in sentence_tokenize(text) if len(s.split()) >= 6]
    if not sentences:
        return []

    top_indices = _rank_sentences(sentences, top_k=min(len(sentences), num_questions * 3))
    questions: List[Dict[str, object]] = []
    seen_questions: set[str] = set()

    for idx in top_indices:
        if len(questions) >= num_questions:
            break

        sentence = sentences[idx].strip()
        if not sentence:
            continue

        question_text = _build_question(sentence)
        question_text = _shorten_question(question_text)
        if question_text.lower() in seen_questions:
            continue

        correct_answer = _normalize_sentence(sentence)
        distractors = _select_distractors(correct_answer, sentences, count=3)
        options = [correct_answer] + distractors
        random.shuffle(options)
        correct_index = options.index(correct_answer)
        questions.append(
            {
                "question": question_text,
                "options": options,
                "correct_index": correct_index,
                "correct_letter": chr(ord("A") + correct_index),
                "answer_text": correct_answer,
            }
        )
        seen_questions.add(question_text.lower())

    return questions[:num_questions]


def format_questions(questions: List[Dict[str, object]]) -> str:
    total = len(questions)
    lines: List[str] = [f"Questions 1 – {total}", "", "Choose the correct letter, A, B, C or D.",
                      f"Write the correct letter in boxes 1-{total} on your answer sheet.", ""]

    for index, item in enumerate(questions, start=1):
        lines.append(f"{index}  {item['question']}")
        for option_index, option in enumerate(item["options"]):
            letter = chr(ord("A") + option_index)
            lines.append(f"{letter}  {option}")
        lines.append("")

    lines.append("Answers:")
    for index, item in enumerate(questions, start=1):
        lines.append(f"{index}. {item['correct_letter']}")

    return "\n".join(lines).strip()


def export_to_pdf(content: str, answers: List[str], filename: str) -> None:
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=inch * 0.75,
        rightMargin=inch * 0.75,
        topMargin=inch * 0.8,
        bottomMargin=inch * 0.8,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "Title",
        parent=styles["Title"],
        fontSize=18,
        leading=22,
        alignment=TA_CENTER,
        spaceAfter=12,
    )
    heading_style = ParagraphStyle(
        "Heading",
        parent=styles["Heading2"],
        fontSize=12,
        leading=14,
        alignment=TA_LEFT,
        spaceAfter=8,
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["BodyText"],
        fontSize=11,
        leading=14,
        alignment=TA_LEFT,
        spaceAfter=4,
    )

    story = [Paragraph("IELTS-style MCQs", title_style), Spacer(1, 0.16 * inch)]
    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line:
            story.append(Spacer(1, 0.1 * inch))
            continue

        safe_line = line.replace("&", "&amp;")
        if line.startswith("Questions"):
            story.append(Paragraph(safe_line, heading_style))
        elif line in ("Choose the correct letter, A, B, C or D.", f"Write the correct letter in boxes 1-{len(answers)} on your answer sheet."):
            story.append(Paragraph(safe_line, body_style))
        elif re.match(r"^\d+\s{2}", line):
            story.append(Paragraph(f"<b>{safe_line}</b>", body_style))
        elif re.match(r"^[ABCD]\s{2}", line):
            story.append(Paragraph(safe_line, body_style))
        elif line == "Answers:":
            story.append(Spacer(1, 0.16 * inch))
            story.append(Paragraph("Answers:", heading_style))
        elif re.match(r"^\d+\.\s+[A-D]$", line):
            story.append(Paragraph(safe_line, body_style))
        else:
            story.append(Paragraph(safe_line, body_style))

    if answers and "Answers:" not in content:
        story.append(Spacer(1, 0.16 * inch))
        story.append(Paragraph("Answers:", heading_style))
        for index, letter in enumerate(answers, start=1):
            story.append(Paragraph(f"{index}. {letter}", body_style))

    doc.build(story)
