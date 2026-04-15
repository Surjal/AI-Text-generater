from __future__ import annotations

from functools import wraps
import hashlib
import os
import re
import secrets
import time
from concurrent.futures import ThreadPoolExecutor

from flask import Flask, g, jsonify, request

from config import Config
from database import DatabaseManager
from utils.preprocess import ensure_nltk_resources
from utils.pdf_extract import extract_text_from_pdf
from utils.summarizer import summarize_text
from utils.ielts_mcq import format_questions, generate_mcqs
from utils.question_generator import generate_fill_blank_items, generate_mcq_items, generate_questions
from utils.key_extraction import extract_keywords, extract_key_points
from utils.features import AnalyticsEngine, AdaptiveQuizzesEngine, ExplanationGenerator, RecommendationEngine, ExportManager
from utils.ai_service import AIService


app = Flask(__name__)
app.config.from_object(Config)

db = DatabaseManager()
executor = ThreadPoolExecutor(max_workers=4)

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
    frontend_origin = os.environ.get("FRONTEND_ORIGIN", "").strip()
    request_origin = request.headers.get("Origin", "").strip()

    if frontend_origin:
        response.headers["Access-Control-Allow-Origin"] = frontend_origin
        response.headers["Vary"] = "Origin"
    elif request_origin:
        response.headers["Access-Control-Allow-Origin"] = request_origin
        response.headers["Vary"] = "Origin"
    else:
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


def background_generate_embedding(history_id: str, text: str):
    """Generate embedding in background to avoid blocking main thread."""
    embedding = AIService.get_embedding(text)
    if embedding:
        conn = db._get_connection()
        try:
            import json
            import sqlite3
            embedding_blob = sqlite3.Binary(json.dumps(embedding).encode())
            conn.execute('UPDATE history SET embedding = ? WHERE id = ?', (embedding_blob, history_id))
            conn.commit()
        finally:
            conn.close()


def sanitize_user(user: dict) -> dict:
    return {
        "username": user["username"],
        "role": user["role"],
        "blocked": bool(user["blocked"]),
        "created_at": user["created_at"],
    }


# ==================== Core NLP Routes ====================

@app.route("/process-text", methods=["POST", "OPTIONS"])
def process_text():
    if request.method == "OPTIONS":
        return jsonify({"ok": True})

    text = ""
    summary_sentences = 3
    mcq_count = 5
    fill_blank_count = 5
    difficulty = "medium"
    include_keywords = True

    if request.content_type and "multipart/form-data" in request.content_type:
        summary_sentences = request.form.get("summary_sentences", 3)
        mcq_count = request.form.get("mcq_count", 5)
        fill_blank_count = request.form.get("fill_blank_count", 5)
        difficulty = request.form.get("difficulty", "medium")
        include_keywords = _parse_bool(request.form.get("include_keywords"), True)
        text = (request.form.get("text") or "").strip()
        upload = request.files.get("file")
        if upload and upload.filename and upload.filename.lower().endswith(".pdf"):
            try:
                text = extract_text_from_pdf(upload.stream)
            except Exception as e:
                return jsonify({"error": f"Could not read PDF: {e!s}"}), 400
    else:
        payload = request.get_json(silent=True) or {}
        text = (payload.get("text") or "").strip()
        summary_sentences = payload.get("summary_sentences", 3)
        mcq_count = payload.get("mcq_count", 5)
        fill_blank_count = payload.get("fill_blank_count", 5)
        difficulty = payload.get("difficulty", "medium")
        include_keywords = _parse_bool(payload.get("include_keywords"), True)

    try:
        summary_sentences = int(summary_sentences)
        mcq_count = int(mcq_count)
        fill_blank_count = int(fill_blank_count)
    except Exception:
        pass

    if not text:
        return jsonify({"error": "Add text or upload a PDF."}), 400

    db.increment_stat("requests")
    db.increment_stat("summaries")
    db.increment_stat("words_processed", len(re.findall(r"\w+", text)))

    summary = summarize_text(text, summary_sentences=summary_sentences)
    mcq_items = generate_mcq_items(text, mcq_count, difficulty)
    fill_blank_items = generate_fill_blank_items(summary, fill_blank_count)
    db.increment_stat("questions_generated", len(mcq_items) + len(fill_blank_items))

    keywords = extract_keywords(text, top_n=15) if include_keywords else []
    key_points = extract_key_points(text, max_points=5) if include_keywords else []

    title = generate_title(text, summary)
    topic = generate_topic(text, keywords)

    return jsonify({
        "summary": summary,
        "title": title,
        "topic": topic,
        "mcq_items": mcq_items,
        "fill_blank_items": fill_blank_items,
        "keywords": keywords,
        "key_points": key_points,
    })


# ==================== Auth Routes ====================

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


# ==================== History & Search ====================

@app.route("/user/history", methods=["GET", "POST", "OPTIONS"])
@login_required
def user_history():
    if request.method == "OPTIONS":
        return jsonify({"ok": True})

    if request.method == "GET":
        return jsonify({"history": db.get_history(g.current_user['username'])})

    payload = request.get_json(silent=True) or {}
    entry_id = payload.get("id") or secrets.token_hex(8)
    
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
    
    executor.submit(background_generate_embedding, entry_id, f"{entry['title']} {entry['summary']}")
    
    return jsonify({"entry": entry})


@app.route("/api/search", methods=["POST", "OPTIONS"])
@login_required
def search_concepts():
    if request.method == "OPTIONS":
        return jsonify({"ok": True})
    
    payload = request.get_json(silent=True) or {}
    query = payload.get("query", "").strip()
    if not query:
        return jsonify({"error": "Search query is required"}), 400
    
    query_embedding = AIService.get_embedding(query)
    if not query_embedding:
        return jsonify({"error": "Could not generate search embedding"}), 500
    
    results = db.semantic_search(g.current_user['username'], query_embedding)
    return jsonify({"results": results})


# ==================== Adaptive Learning & Spaced Repetition ====================

@app.route("/api/spaced-review", methods=["GET", "POST", "OPTIONS"])
@login_required
def spaced_repetition_route():
    if request.method == "OPTIONS":
        return jsonify({"ok": True})
    
    username = g.current_user['username']
    
    if request.method == "GET":
        due_items = db.get_due_for_review(username)
        return jsonify({"due_for_review": due_items})
    
    else:
        payload = request.get_json(silent=True) or {}
        sr_id = payload.get("spaced_repetition_id")
        quality = payload.get("quality", 3)
        
        db.update_spaced_repetition(sr_id, quality)
        return jsonify({"updated": True})


@app.route("/api/quiz-attempt", methods=["POST", "OPTIONS"])
@login_required
def submit_quiz_attempt():
    if request.method == "OPTIONS":
        return jsonify({"ok": True})
    
    payload = request.get_json(silent=True) or {}
    username = g.current_user['username']
    
    history_id = payload.get("history_id")
    score = payload.get("score", 0)
    correct_answers = payload.get("correct_answers", 0)
    total_questions = payload.get("total_questions", 1)
    time_taken = payload.get("time_taken_seconds", 0)
    
    recent_attempts = db.get_quiz_attempts(username, history_id)
    new_difficulty = AdaptiveQuizzesEngine.adjust_difficulty(
        (correct_answers / total_questions * 100) if total_questions > 0 else 0,
        recent_attempts[0]['difficulty_level'] if recent_attempts else "medium"
    )
    
    attempt_id = db.add_quiz_attempt(
        username, history_id, score, total_questions, correct_answers, time_taken,
        new_difficulty, payload.get("is_timed", False), payload.get("time_limit_seconds")
    )
    
    for q_data in payload.get("question_performance", []):
        db.add_question_performance(
            username, attempt_id, q_data['index'], q_data['question'],
            q_data['correct'], q_data.get('user_answer', ''),
            q_data.get('correct_answer', ''), difficulty_rating=q_data.get('difficulty', 3)
        )
    
    return jsonify({"attempt_id": attempt_id, "new_difficulty": new_difficulty})


@app.route("/api/analytics", methods=["GET", "OPTIONS"])
@login_required
def get_analytics():
    if request.method == "OPTIONS":
        return jsonify({"ok": True})
    
    username = g.current_user['username']
    analytics = db.get_performance_analytics(username)
    attempts = db.get_quiz_attempts(username)
    velocity = AnalyticsEngine.compute_learning_velocity(attempts)
    heatmap = AnalyticsEngine.compute_strength_weakness_heatmap(analytics)
    
    return jsonify({
        "performance": analytics,
        "learning_velocity": velocity,
        "strength_weakness": heatmap,
        "total_attempts": len(attempts)
    })


@app.route("/api/recommendations", methods=["GET", "OPTIONS"])
@login_required
def get_recommendations():
    if request.method == "OPTIONS":
        return jsonify({"ok": True})

    username = g.current_user['username']

    # Previously saved recommendations from DB.
    saved = db.get_recommendations(username, limit=10)

    # Real-time recommendations generated from recent analytics + history.
    analytics = db.get_performance_analytics(username)
    history = db.get_history(username, limit=20)
    dynamic = RecommendationEngine.generate_recommendations(analytics, history)

    return jsonify({
        "saved_recommendations": [dict(r) for r in saved],
        "dynamic_recommendations": dynamic,
    })


@app.route("/api/explanations", methods=["POST", "OPTIONS"])
@login_required
def generate_explanation_route():
    if request.method == "OPTIONS":
        return jsonify({"ok": True})
    
    payload = request.get_json(silent=True) or {}
    question = payload.get("question", "")
    correct_answer = payload.get("correct_answer", "")
    user_answer = payload.get("user_answer", "")
    context = payload.get("context", "")
    
    explanation_data = AIService.generate_explanation(question, correct_answer, user_answer, context)
    return jsonify(explanation_data)


# ==================== Admin & Stats ====================

@app.route("/admin/stats", methods=["GET", "OPTIONS"])
@admin_required
def admin_stats():
    users = db.get_all_users()
    stats = db.get_stats()
    return jsonify({
        "total_users": len(users),
        "requests": stats["requests"],
        "summaries": stats["summaries"],
        "questions_generated": stats["questions_generated"],
    })


if __name__ == "__main__":
    ensure_nltk_resources()
    app.run(
        host=os.environ.get("HOST", "0.0.0.0"),
        port=int(os.environ.get("PORT", "5001")),
        debug=True,
    )
