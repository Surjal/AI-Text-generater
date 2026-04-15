from __future__ import annotations

from functools import wraps
import hashlib
import re
import secrets
import time

from flask import Flask, g, jsonify, request

from config import Config
from database import DatabaseManager
from utils.preprocess import ensure_nltk_resources
from utils.pdf_extract import extract_text_from_pdf
from utils.summarizer import summarize_text
from utils.ielts_mcq import format_questions, generate_mcqs
from utils.question_generator import generate_fill_blank_items, generate_mcq_items
from utils.key_extraction import extract_keywords, extract_key_points
from utils.features import AnalyticsEngine, AdaptiveQuizzesEngine, ExplanationGenerator, RecommendationEngine, ExportManager


app = Flask(__name__)
app.config.from_object(Config)

db = DatabaseManager()

def _parse_bool(val, default: bool = False) -> bool:
    if val is None:
        return default
    if isinstance(val, bool):
        return val
    s = str(val).strip().lower()
    return s in ("1", "true", "yes", "on")


def hash_password(password: str) -> str:
    return hashlib.sha256((password or "").encode("utf-8")).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    return hash_password(password) == password_hash


def get_token_from_request() -> str | None:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[len("Bearer ") :].strip()
    return request.args.get("token")


def get_current_user(require_admin: bool = False):
    token = get_token_from_request()
    if not token:
        return None
    
    username = db.get_token_user(token)
    if not username:
        return None
    
    user = db.get_user(username)
    if not user or user.get("blocked"):
        return None
    
    if require_admin and user.get("role") != "admin":
        return None
    
    return user


def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "Unauthorized"}), 401
        g.current_user = user
        return f(*args, **kwargs)

    return wrapper


def admin_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        user = get_current_user(require_admin=True)
        if not user:
            return jsonify({"error": "Admin required"}), 403
        g.current_user = user
        return f(*args, **kwargs)

    return wrapper


@app.after_request
def add_cors_headers(response):
    # Simple CORS for local development. In production, restrict this.
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response


def create_token(username: str) -> str:
    token = secrets.token_hex(24)
    db.create_token(token, username)
    return token


def generate_title(text: str, summary: str) -> str:
    if summary:
        first = summary.split(".")[0].strip()
        if first:
            return first[:80]
    first_sentence = re.split(r"(?<=[.!?])\s+", text.strip())[0] if text else ""
    return first_sentence[:80] or "Smart Summary"


def generate_topic(text: str, keywords: list[str]) -> str:
    if keywords:
        return keywords[0]
    words = [w.lower() for w in re.findall(r"\w+", text) if len(w) > 3]
    return words[0].capitalize() if words else "General"


def extract_word_frequency(text: str, top_n: int = 12) -> list[dict[str, object]]:
    counts: dict[str, int] = {}
    for word in re.findall(r"\w+", text.lower()):
        if len(word) < 3:
            continue
        counts[word] = counts.get(word, 0) + 1
    sorted_words = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    return [{"word": word, "count": count} for word, count in sorted_words[:top_n]]


def compute_sentence_scores(text: str, keywords: list[str]) -> list[dict[str, object]]:
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    keyword_set = {k.lower() for k in keywords}
    scores = []
    for sentence in sentences:
        words = [w.lower() for w in re.findall(r"\w+", sentence)]
        score = sum(1 for w in words if w in keyword_set) + len(words) / 20
        scores.append({"sentence": sentence, "score": round(score, 2)})
    return scores


def sanitize_user(user: dict) -> dict:
    return {
        "username": user["username"],
        "role": user["role"],
        "blocked": bool(user["blocked"]),
        "created_at": user["created_at"],
    }


@app.route("/process-text", methods=["POST", "OPTIONS"])
def process_text():
    if request.method == "OPTIONS":
        return jsonify({"ok": True})

    text = ""
    summary_sentences = 3
    mcq_count = 5
    fill_blank_count = 5
    include_keywords = True

    if request.content_type and "multipart/form-data" in request.content_type:
        summary_sentences = request.form.get("summary_sentences", 3)
        mcq_count = request.form.get("mcq_count", 5)
        fill_blank_count = request.form.get("fill_blank_count", 5)
        include_keywords = _parse_bool(request.form.get("include_keywords"), True)
        text = (request.form.get("text") or "").strip()
        upload = request.files.get("file")
        if upload and upload.filename and upload.filename.lower().endswith(".pdf"):
            try:
                text = extract_text_from_pdf(upload.stream)
            except Exception as e:
                return (
                    jsonify(
                        {
                            "summary": "",
                            "mcq_items": [],
                            "fill_blank_items": [],
                            "keywords": [],
                            "key_points": [],
                            "error": f"Could not read PDF: {e!s}",
                        }
                    ),
                    400,
                )
    else:
        payload = request.get_json(silent=True) or {}
        text = (payload.get("text") or "").strip()
        summary_sentences = payload.get("summary_sentences", 3)
        mcq_count = payload.get("mcq_count", 5)
        fill_blank_count = payload.get("fill_blank_count", 5)
        include_keywords = _parse_bool(payload.get("include_keywords"), True)

    try:
        summary_sentences = int(summary_sentences)
    except Exception:
        summary_sentences = 3

    try:
        mcq_count = int(mcq_count)
    except Exception:
        mcq_count = 5

    try:
        fill_blank_count = int(fill_blank_count)
    except Exception:
        fill_blank_count = 5

    summary_sentences = min(20, max(1, summary_sentences))
    mcq_count = min(20, max(0, mcq_count))
    fill_blank_count = min(20, max(0, fill_blank_count))

    if not text:
        return (
            jsonify(
                {
                    "summary": "",
                    "mcq_items": [],
                    "fill_blank_items": [],
                    "keywords": [],
                    "key_points": [],
                    "error": "Add text or upload a PDF with extractable text.",
                }
            ),
            400,
        )

    if len(text) < 10:
        return jsonify(
            {
                "summary": text,
                "mcq_items": [],
                "fill_blank_items": [],
                "keywords": [],
                "key_points": [],
                "note": "Input text is too short.",
            }
        )

    db.increment_stat("requests")
    db.increment_stat("summaries")
    db.increment_stat("words_processed", len(re.findall(r"\w+", text)))
    db.increment_stat("documents_processed")

    summary = summarize_text(text, summary_sentences=summary_sentences)
    # Keep the current IELTS-style questions, then top up with the broader generator if needed.
    mcq_items = generate_mcqs(text, mcq_count) if mcq_count > 0 else []
    if len(mcq_items) < mcq_count:
        seen_questions = {
            str(item.get("question", "")).strip().lower() for item in mcq_items
        }
        for item in generate_mcq_items(text, mcq_count - len(mcq_items)):
            question_text = str(item.get("question", "")).strip()
            if not question_text or question_text.lower() in seen_questions:
                continue
            mcq_items.append(item)
            seen_questions.add(question_text.lower())
            if len(mcq_items) >= mcq_count:
                break
    for item in mcq_items:
        try:
            correct_index = int(item.get("correct_index", 0))
        except Exception:
            correct_index = 0
        item["correct_index"] = correct_index
        item["correct_letter"] = chr(ord("A") + correct_index) if 0 <= correct_index < 26 else "A"
        item.setdefault("answer_text", item.get("answer", ""))
    fill_blank_items = generate_fill_blank_items(summary, fill_blank_count) if fill_blank_count > 0 else []
    db.increment_stat("questions_generated", len(mcq_items) + len(fill_blank_items))

    keywords: list = []
    key_points: list = []
    if include_keywords:
        keywords = extract_keywords(text, top_n=15)
        key_points = extract_key_points(text, max_points=5)

    title = generate_title(text, summary)
    topic = generate_topic(text, keywords)
    sentence_scores = compute_sentence_scores(text, keywords)
    word_frequency = extract_word_frequency(text)

    # Format MCQs
    mcq_text = format_questions(mcq_items) if mcq_items else ""

    # Format Fill in the Blanks
    fib_text = ""
    if fill_blank_items:
        fib_lines = ["Fill in the Blanks:"]
        for i, item in enumerate(fill_blank_items, 1):
            prompt = item["prompt"]
            answer = item["answer"]
            fib_lines.append(f"{i}. {prompt}")
            fib_lines.append(f"   Answer: {answer}")
            fib_lines.append("")
        fib_text = "\n".join(fib_lines).strip()

    return jsonify(
        {
            "summary": summary,
            "title": title,
            "topic": topic,
            "sentence_scores": sentence_scores,
            "word_frequency": word_frequency,
            "mcq_text": mcq_text,
            "fib_text": fib_text,
            "mcq_items": mcq_items,
            "fill_blank_items": fill_blank_items,
            "keywords": keywords,
            "key_points": key_points,
        }
    )


@app.route("/auth/signup", methods=["POST", "OPTIONS"])
def signup():
    if request.method == "OPTIONS":
        return jsonify({"ok": True})

    payload = request.get_json(silent=True) or {}
    username = (payload.get("username") or "").strip().lower()
    password = payload.get("password") or ""

    if not username or not password:
        return jsonify({"error": "Username and password are required."}), 400

    if db.get_user(username):
        return jsonify({"error": "A user with that name already exists."}), 400

    if db.create_user(username, hash_password(password)):
        token = create_token(username)
        user = db.get_user(username)
        return jsonify({"token": token, "user": sanitize_user(user)})
    else:
        return jsonify({"error": "Could not create user."}), 500


@app.route("/auth/login", methods=["POST", "OPTIONS"])
def login():
    if request.method == "OPTIONS":
        return jsonify({"ok": True})

    payload = request.get_json(silent=True) or {}
    username = (payload.get("username") or "").strip().lower()
    password = payload.get("password") or ""

    user = db.get_user(username)
    if not user or not verify_password(password, user["password_hash"]):
        return jsonify({"error": "Invalid username or password."}), 401

    if user.get("blocked"):
        return jsonify({"error": "This account is blocked."}), 403

    token = create_token(username)
    return jsonify({"token": token, "user": sanitize_user(user)})


@app.route("/auth/logout", methods=["POST", "OPTIONS"])
@login_required
def logout():
    token = get_token_from_request()
    if token:
        db.delete_token(token)
    return jsonify({"ok": True})


@app.route("/auth/me", methods=["GET", "OPTIONS"])
@login_required
def me():
    return jsonify({"user": sanitize_user(g.current_user)})


@app.route("/user/history", methods=["GET", "POST", "OPTIONS"])
@login_required
def user_history():
    if request.method == "OPTIONS":
        return jsonify({"ok": True})

    if request.method == "GET":
        return jsonify({"history": db.get_history(g.current_user['username'])})

    payload = request.get_json(silent=True) or {}
    entry_id = (payload.get("id") or secrets.token_hex(8)).strip() if isinstance(payload.get("id"), str) else secrets.token_hex(8)
    entry = {
        "id": entry_id,
        "created_at": time.time(),
        "summary": payload.get("summary", ""),
        "source_label": payload.get("source_label", "Saved summary"),
        "keywords": payload.get("keywords", []),
        "key_points": payload.get("key_points", []),
        "title": payload.get("title", ""),
        "topic": payload.get("topic", ""),
        "mcq_items": payload.get("mcq_items", []),
        "fill_blank_items": payload.get("fill_blank_items", []),
    }
    db.add_history(g.current_user['username'], entry)
    db.add_spaced_repetition(g.current_user['username'], entry["id"])
    return jsonify({"entry": entry})


@app.route("/admin/users", methods=["GET", "OPTIONS"])
@admin_required
def admin_users():
    users = [sanitize_user(user) for user in db.get_all_users()]
    return jsonify({"users": users})


@app.route("/admin/block", methods=["POST", "OPTIONS"])
@admin_required
def admin_block_user():
    if request.method == "OPTIONS":
        return jsonify({"ok": True})

    payload = request.get_json(silent=True) or {}
    username = (payload.get("username") or "").strip().lower()
    blocked = bool(payload.get("blocked", False))

    user = db.get_user(username)
    if not user:
        return jsonify({"error": "User not found."}), 404
    if username == "admin":
        return jsonify({"error": "Cannot block the admin user."}), 400

    db.update_user_status(username, blocked)
    # If blocked, we should probably delete their tokens to force logout.
    # For simplicity, we'll let the next token check handle it since get_current_user checks blocked status.
    
    updated_user = db.get_user(username)
    return jsonify({"user": sanitize_user(updated_user)})


@app.route("/admin/delete", methods=["POST", "OPTIONS"])
@admin_required
def admin_delete_user():
    if request.method == "OPTIONS":
        return jsonify({"ok": True})

    payload = request.get_json(silent=True) or {}
    username = (payload.get("username") or "").strip().lower()

    user = db.get_user(username)
    if not user:
        return jsonify({"error": "User not found."}), 404
    if username == "admin":
        return jsonify({"error": "Cannot delete the admin user."}), 400

    db.delete_user(username)
    return jsonify({"ok": True})


@app.route("/admin/stats", methods=["GET", "OPTIONS"])
@admin_required
def admin_stats():
    users = db.get_all_users()
    total_users = len(users)
    blocked_users = sum(1 for user in users if user.get("blocked"))
    
    stats = db.get_stats()
    average_summary = (
        stats["words_processed"] / stats["summaries"] if stats["summaries"] else 0
    )
    
    return jsonify(
        {
            "total_users": total_users,
            "blocked_users": blocked_users,
            "active_users": total_users - blocked_users,
            "requests": stats["requests"],
            "summaries": stats["summaries"],
            "documents_processed": stats["documents_processed"],
            "questions_generated": stats["questions_generated"],
            "words_processed": stats["words_processed"],
            "average_words_per_summary": round(average_summary, 1),
        }
    )


# ==================== NEW FEATURES: Analytics, Adaptive Learning, etc. ====================

@app.route("/api/analytics", methods=["GET", "OPTIONS"])
@login_required
def get_analytics():
    """Feature 3: Get comprehensive learning analytics"""
    if request.method == "OPTIONS":
        return jsonify({"ok": True})
    
    username = g.current_user['username']
    
    # Get analytics
    analytics = db.get_performance_analytics(username)
    
    # Get attempts for velocity calculation
    attempts = db.get_quiz_attempts(username)
    velocity = AnalyticsEngine.compute_learning_velocity(attempts)
    heatmap = AnalyticsEngine.compute_strength_weakness_heatmap(analytics)
    
    return jsonify({
        "performance": analytics,
        "learning_velocity": velocity,
        "strength_weakness": heatmap,
        "total_attempts": len(attempts)
    })


@app.route("/api/quiz-attempt", methods=["POST", "OPTIONS"])
@login_required
def submit_quiz_attempt():
    """Feature 1, 3, 5: Submit a quiz attempt with performance data"""
    if request.method == "OPTIONS":
        return jsonify({"ok": True})
    
    payload = request.get_json(silent=True) or {}
    username = g.current_user['username']
    
    history_id = payload.get("history_id")
    score = payload.get("score", 0)
    correct_answers = payload.get("correct_answers", 0)
    total_questions = payload.get("total_questions", 1)
    time_taken = payload.get("time_taken_seconds", 0)
    is_timed = payload.get("is_timed", False)
    
    # Calculate adaptive difficulty
    recent_attempts = db.get_quiz_attempts(username, history_id)
    new_difficulty = AdaptiveQuizzesEngine.adjust_difficulty(
        (correct_answers / total_questions * 100) if total_questions > 0 else 0,
        recent_attempts[0]['difficulty_level'] if recent_attempts else "medium"
    )
    
    # Add attempt
    attempt_id = db.add_quiz_attempt(
        username, history_id, score, total_questions, correct_answers, time_taken,
        new_difficulty, is_timed, payload.get("time_limit_seconds")
    )
    
    # Store question performance
    for q_data in payload.get("question_performance", []):
        db.add_question_performance(
            username, attempt_id, q_data['index'], q_data['question'],
            q_data['correct'], q_data.get('user_answer', ''),
            q_data.get('correct_answer', ''), difficulty_rating=q_data.get('difficulty', 3)
        )
    
    # Generate recommendation
    analytics = db.get_performance_analytics(username)
    recommendations = RecommendationEngine.generate_recommendations(analytics, db.get_history(username))
    for rec in recommendations[:2]:
        db.add_recommendation(username, rec['topic'], rec['reason'], rec['difficulty'], rec['priority_score'])
    
    return jsonify({"attempt_id": attempt_id, "new_difficulty": new_difficulty})


@app.route("/api/recommendations", methods=["GET", "OPTIONS"])
@login_required
def get_recommendations():
    """Feature 6: Get personalized study recommendations"""
    if request.method == "OPTIONS":
        return jsonify({"ok": True})
    
    username = g.current_user['username']
    recommendations = db.get_recommendations(username, limit=10)
    
    # Also compute real-time recommendations
    analytics = db.get_performance_analytics(username)
    history = db.get_history(username, limit=20)
    real_time_recs = RecommendationEngine.generate_recommendations(analytics, history)
    
    return jsonify({
        "saved_recommendations": [dict(r) for r in recommendations],
        "dynamic_recommendations": real_time_recs
    })


@app.route("/api/spaced-review", methods=["GET", "POST", "OPTIONS"])
@login_required
def spaced_repetition():
    """Feature 1: Spaced repetition schedule and review"""
    if request.method == "OPTIONS":
        return jsonify({"ok": True})
    
    username = g.current_user['username']
    
    if request.method == "GET":
        due_items = db.get_due_for_review(username)
        return jsonify({"due_for_review": [dict(item) for item in due_items]})
    
    else:  # POST - update spaced repetition
        payload = request.get_json(silent=True) or {}
        sr_id = payload.get("spaced_repetition_id")
        correct = payload.get("correct", False)
        
        db.update_spaced_repetition(sr_id, correct)
        
        return jsonify({"updated": True})


@app.route("/api/explanations", methods=["GET", "POST", "OPTIONS"])
@login_required
def handle_explanations():
    """Feature 9: Get/generate detailed answer explanations"""
    if request.method == "OPTIONS":
        return jsonify({"ok": True})
    
    payload = request.get_json(silent=True) or {}
    history_id = payload.get("history_id")
    
    if request.method == "GET":
        explanations = db.get_explanations(history_id) if history_id else []
        return jsonify({"explanations": explanations})
    
    else:  # POST - generate explanation
        question = payload.get("question", "")
        correct_answer = payload.get("correct_answer", "")
        user_answer = payload.get("user_answer", "")
        context = payload.get("context", "")
        
        # Generate explanation using AI
        explanation_data = ExplanationGenerator.generate_explanation(
            question, correct_answer, user_answer, context
        )
        
        # Store explanation
        exp_id = db.add_explanation(history_id, payload.get("question_index", 0), question,
                                   explanation_data['explanation'],
                                   [explanation_data['misconception']])
        
        return jsonify({"explanation_id": exp_id, **explanation_data})


@app.route("/api/export", methods=["POST", "OPTIONS"])
@login_required
def export_study_material():
    """Feature 7: Export study material in multiple formats"""
    if request.method == "OPTIONS":
        return jsonify({"ok": True})
    
    payload = request.get_json(silent=True) or {}
    export_format = payload.get("format", "markdown")  # markdown, anki, json
    title = payload.get("title", "Study Material")
    summary = payload.get("summary", "")
    mcq_items = payload.get("mcq_items", [])
    fill_blank_items = payload.get("fill_blank_items", [])
    
    if export_format == "markdown":
        content = ExportManager.export_to_markdown(title, summary, mcq_items, fill_blank_items)
        return jsonify({"format": "markdown", "content": content, "filename": f"{title}.md"})
    
    elif export_format == "anki":
        content = ExportManager.export_to_anki_format(mcq_items, fill_blank_items)
        return jsonify({"format": "anki", "content": content, "filename": f"{title}.csv"})
    
    elif export_format == "json":
        content = ExportManager.export_to_json(title, summary, mcq_items, fill_blank_items)
        return jsonify({"format": "json", "content": content, "filename": f"{title}.json"})
    
    else:
        return jsonify({"error": "Unsupported export format"}), 400


if __name__ == "__main__":
    ensure_nltk_resources()
    app.run(host="127.0.0.1", port=5001, debug=True)
