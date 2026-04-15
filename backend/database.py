import sqlite3
import json
import time
import os
import hashlib
from typing import Any, Dict, List, Optional
from config import Config

class DatabaseManager:
    def __init__(self, db_path: str = Config.DATABASE_PATH):
        self.db_path = db_path
        self._initialize_db()

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _initialize_db(self):
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            
            # Users table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    username TEXT PRIMARY KEY,
                    password_hash TEXT NOT NULL,
                    role TEXT DEFAULT 'user',
                    blocked INTEGER DEFAULT 0,
                    created_at REAL NOT NULL
                )
            ''')
            
            # History table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS history (
                    id TEXT PRIMARY KEY,
                    username TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    summary TEXT,
                    source_label TEXT,
                    keywords TEXT,
                    key_points TEXT,
                    title TEXT,
                    topic TEXT,
                    mcq_items TEXT,
                    fill_blank_items TEXT,
                    FOREIGN KEY (username) REFERENCES users (username)
                )
            ''')
            
            # Stats table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS stats (
                    key TEXT PRIMARY KEY,
                    value INTEGER DEFAULT 0
                )
            ''')
            
            # Tokens table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS tokens (
                    token TEXT PRIMARY KEY,
                    username TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    FOREIGN KEY (username) REFERENCES users (username)
                )
            ''')
            
            # Quiz Attempts table (for features 1, 3, 5)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS quiz_attempts (
                    id TEXT PRIMARY KEY,
                    username TEXT NOT NULL,
                    history_id TEXT NOT NULL,
                    attempt_number INTEGER DEFAULT 1,
                    score REAL,
                    total_questions INTEGER,
                    correct_answers INTEGER,
                    time_taken_seconds INTEGER,
                    difficulty_level TEXT DEFAULT 'medium',
                    is_timed INTEGER DEFAULT 0,
                    time_limit_seconds INTEGER,
                    created_at REAL NOT NULL,
                    FOREIGN KEY (username) REFERENCES users (username),
                    FOREIGN KEY (history_id) REFERENCES history (id)
                )
            ''')
            
            # Question Performance table (for features 1, 3, 9)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS question_performance (
                    id TEXT PRIMARY KEY,
                    username TEXT NOT NULL,
                    quiz_attempt_id TEXT NOT NULL,
                    question_index INTEGER,
                    question_text TEXT,
                    answered_correctly INTEGER,
                    user_answer TEXT,
                    correct_answer TEXT,
                    explanation TEXT,
                    difficulty_rating INTEGER DEFAULT 3,
                    created_at REAL NOT NULL,
                    FOREIGN KEY (username) REFERENCES users (username),
                    FOREIGN KEY (quiz_attempt_id) REFERENCES quiz_attempts (id)
                )
            ''')
            
            # Answer Explanations table (for feature 9)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS answer_explanations (
                    id TEXT PRIMARY KEY,
                    history_id TEXT NOT NULL,
                    question_index INTEGER,
                    question_text TEXT,
                    explanation TEXT,
                    misconceptions TEXT,
                    generated_at REAL NOT NULL,
                    FOREIGN KEY (history_id) REFERENCES history (id)
                )
            ''')
            
            # Study Recommendations table (for feature 6)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS study_recommendations (
                    id TEXT PRIMARY KEY,
                    username TEXT NOT NULL,
                    recommended_topic TEXT,
                    reason TEXT,
                    difficulty_level TEXT,
                    priority_score REAL,
                    created_at REAL NOT NULL,
                    expires_at REAL,
                    FOREIGN KEY (username) REFERENCES users (username)
                )
            ''')
            
            # Spaced Repetition Schedule table (for feature 1)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS spaced_repetition (
                    id TEXT PRIMARY KEY,
                    username TEXT NOT NULL,
                    history_id TEXT NOT NULL,
                    next_review_date REAL,
                    review_count INTEGER DEFAULT 0,
                    interval_days INTEGER DEFAULT 1,
                    ease_factor REAL DEFAULT 2.5,
                    last_reviewed_at REAL,
                    FOREIGN KEY (username) REFERENCES users (username),
                    FOREIGN KEY (history_id) REFERENCES history (id)
                )
            ''')
            
            # Initialize stats keys
            default_stats = [
                ("requests", 0),
                ("summaries", 0),
                ("words_processed", 0),
                ("documents_processed", 0),
                ("questions_generated", 0)
            ]
            for key, val in default_stats:
                cursor.execute('INSERT OR IGNORE INTO stats (key, value) VALUES (?, ?)', (key, val))
            
            # Initialize default admin if not exists
            admin_username = "admin"
            admin_password_hash = hashlib.sha256(Config.ADMIN_PASSWORD.encode("utf-8")).hexdigest()
            cursor.execute('INSERT OR IGNORE INTO users (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)',
                           (admin_username, admin_password_hash, "admin", time.time()))
            
            conn.commit()
        finally:
            conn.close()

    # User Methods
    def get_user(self, username: str) -> Optional[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
            return dict(user) if user else None
        finally:
            conn.close()

    def create_user(self, username: str, password_hash: str, role: str = "user") -> bool:
        conn = self._get_connection()
        try:
            conn.execute('INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)',
                       (username, password_hash, role, time.time()))
            conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False
        finally:
            conn.close()

    def update_user_status(self, username: str, blocked: bool):
        conn = self._get_connection()
        try:
            conn.execute('UPDATE users SET blocked = ? WHERE username = ?', (1 if blocked else 0, username))
            conn.commit()
        finally:
            conn.close()

    def delete_user(self, username: str):
        conn = self._get_connection()
        try:
            conn.execute('DELETE FROM users WHERE username = ?', (username,))
            conn.execute('DELETE FROM tokens WHERE username = ?', (username,))
            conn.execute('DELETE FROM history WHERE username = ?', (username,))
            conn.commit()
        finally:
            conn.close()

    def get_all_users(self) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            users = conn.execute('SELECT * FROM users').fetchall()
            return [dict(u) for u in users]
        finally:
            conn.close()

    # Token Methods
    def create_token(self, token: str, username: str):
        conn = self._get_connection()
        try:
            conn.execute('INSERT INTO tokens (token, username, created_at) VALUES (?, ?, ?)',
                       (token, username, time.time()))
            conn.commit()
        finally:
            conn.close()

    def get_token_user(self, token: str) -> Optional[str]:
        conn = self._get_connection()
        try:
            row = conn.execute('SELECT username, created_at FROM tokens WHERE token = ?', (token,)).fetchone()
            if not row:
                return None
            
            # Check expiration
            if time.time() - row['created_at'] > Config.TOKEN_EXPIRATION_HOURS * 3600:
                conn.execute('DELETE FROM tokens WHERE token = ?', (token,))
                conn.commit()
                return None
            
            return row['username']
        finally:
            conn.close()

    def delete_token(self, token: str):
        conn = self._get_connection()
        try:
            conn.execute('DELETE FROM tokens WHERE token = ?', (token,))
            conn.commit()
        finally:
            conn.close()

    # History Methods
    def add_history(self, username: str, entry: Dict[str, Any]):
        conn = self._get_connection()
        try:
            conn.execute('''
                INSERT INTO history (id, username, created_at, summary, source_label, keywords, key_points, title, topic, mcq_items, fill_blank_items)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                entry['id'],
                username,
                entry['created_at'],
                entry.get('summary', ''),
                entry.get('source_label', ''),
                json.dumps(entry.get('keywords', [])),
                json.dumps(entry.get('key_points', [])),
                entry.get('title', ''),
                entry.get('topic', ''),
                json.dumps(entry.get('mcq_items', [])),
                json.dumps(entry.get('fill_blank_items', []))
            ))
            conn.commit()
        finally:
            conn.close()

    def get_history(self, username: str, limit: int = 50) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            rows = conn.execute('SELECT * FROM history WHERE username = ? ORDER BY created_at DESC LIMIT ?',
                              (username, limit)).fetchall()
            history = []
            for row in rows:
                d = dict(row)
                d['keywords'] = json.loads(d['keywords']) if d['keywords'] else []
                d['key_points'] = json.loads(d['key_points']) if d['key_points'] else []
                d['mcq_items'] = json.loads(d['mcq_items']) if d['mcq_items'] else []
                d['fill_blank_items'] = json.loads(d['fill_blank_items']) if d['fill_blank_items'] else []
                history.append(d)
            return history
        finally:
            conn.close()

    # Stats Methods
    def increment_stat(self, key: str, amount: int = 1):
        conn = self._get_connection()
        try:
            conn.execute('UPDATE stats SET value = value + ? WHERE key = ?', (amount, key))
            conn.commit()
        finally:
            conn.close()

    def get_stats(self) -> Dict[str, int]:
        conn = self._get_connection()
        try:
            rows = conn.execute('SELECT * FROM stats').fetchall()
            return {row['key']: row['value'] for row in rows}
        finally:
            conn.close()

    # Quiz Attempts Methods (Features 1, 3, 5)
    def add_quiz_attempt(self, username: str, history_id: str, score: float, total_questions: int,
                        correct_answers: int, time_taken_seconds: int, difficulty_level: str = "medium",
                        is_timed: bool = False, time_limit_seconds: int = None) -> str:
        import secrets
        conn = self._get_connection()
        try:
            attempt_id = secrets.token_hex(8)
            conn.execute('''
                INSERT INTO quiz_attempts (id, username, history_id, score, total_questions, correct_answers,
                time_taken_seconds, difficulty_level, is_timed, time_limit_seconds, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (attempt_id, username, history_id, score, total_questions, correct_answers,
                  time_taken_seconds, difficulty_level, 1 if is_timed else 0, time_limit_seconds, time.time()))
            conn.commit()
            return attempt_id
        finally:
            conn.close()

    def get_quiz_attempts(self, username: str, history_id: str = None) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            if history_id:
                rows = conn.execute('''SELECT * FROM quiz_attempts WHERE username = ? AND history_id = ?
                                      ORDER BY created_at DESC''', (username, history_id)).fetchall()
            else:
                rows = conn.execute('''SELECT * FROM quiz_attempts WHERE username = ? ORDER BY created_at DESC''',
                                  (username,)).fetchall()
            return [dict(row) for row in rows]
        finally:
            conn.close()

    # Question Performance Methods (Features 1, 3, 9)
    def add_question_performance(self, username: str, quiz_attempt_id: str, question_index: int,
                                question_text: str, answered_correctly: bool, user_answer: str,
                                correct_answer: str, explanation: str = None, difficulty_rating: int = 3) -> str:
        import secrets
        conn = self._get_connection()
        try:
            perf_id = secrets.token_hex(8)
            conn.execute('''
                INSERT INTO question_performance (id, username, quiz_attempt_id, question_index, question_text,
                answered_correctly, user_answer, correct_answer, explanation, difficulty_rating, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (perf_id, username, quiz_attempt_id, question_index, question_text,
                  1 if answered_correctly else 0, user_answer, correct_answer, explanation, difficulty_rating, time.time()))
            conn.commit()
            return perf_id
        finally:
            conn.close()

    def get_performance_analytics(self, username: str) -> Dict[str, Any]:
        """Get comprehensive analytics for a user (Feature 3)"""
        conn = self._get_connection()
        try:
            total_attempts = conn.execute(
                'SELECT COUNT(*) as count FROM quiz_attempts WHERE username = ?', (username,)).fetchone()['count']
            
            correct_total = conn.execute(
                'SELECT SUM(correct_answers) as total FROM quiz_attempts WHERE username = ?', (username,)).fetchone()['total'] or 0
            
            total_questions = conn.execute(
                'SELECT SUM(total_questions) as total FROM quiz_attempts WHERE username = ?', (username,)).fetchone()['total'] or 0
            
            avg_accuracy = (correct_total / total_questions * 100) if total_questions > 0 else 0
            
            # Weak areas (low accuracy questions)
            weak_areas = conn.execute('''
                SELECT question_text, COUNT(*) as times_wrong, AVG(difficulty_rating) as avg_difficulty
                FROM question_performance WHERE username = ? AND answered_correctly = 0
                GROUP BY question_text ORDER BY times_wrong DESC LIMIT 5
            ''', (username,)).fetchall()
            
            # Strong areas
            strong_areas = conn.execute('''
                SELECT question_text, COUNT(*) as times_correct
                FROM question_performance WHERE username = ? AND answered_correctly = 1
                GROUP BY question_text ORDER BY times_correct DESC LIMIT 5
            ''', (username,)).fetchall()
            
            return {
                'total_attempts': total_attempts,
                'total_questions': total_questions,
                'correct_answers': correct_total,
                'accuracy_percentage': round(avg_accuracy, 2),
                'weak_areas': [dict(row) for row in weak_areas],
                'strong_areas': [dict(row) for row in strong_areas]
            }
        finally:
            conn.close()

    # Answer Explanations Methods (Feature 9)
    def add_explanation(self, history_id: str, question_index: int, question_text: str,
                       explanation: str, misconceptions: List[str] = None) -> str:
        import secrets
        conn = self._get_connection()
        try:
            exp_id = secrets.token_hex(8)
            misconceptions_json = json.dumps(misconceptions) if misconceptions else json.dumps([])
            conn.execute('''
                INSERT INTO answer_explanations (id, history_id, question_index, question_text,
                explanation, misconceptions, generated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (exp_id, history_id, question_index, question_text, explanation, misconceptions_json, time.time()))
            conn.commit()
            return exp_id
        finally:
            conn.close()

    def get_explanations(self, history_id: str) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            rows = conn.execute('''SELECT * FROM answer_explanations WHERE history_id = ?
                                  ORDER BY question_index''', (history_id,)).fetchall()
            explanations = []
            for row in rows:
                d = dict(row)
                d['misconceptions'] = json.loads(d['misconceptions']) if d['misconceptions'] else []
                explanations.append(d)
            return explanations
        finally:
            conn.close()

    # Study Recommendations Methods (Feature 6)
    def add_recommendation(self, username: str, recommended_topic: str, reason: str,
                         difficulty_level: str, priority_score: float) -> str:
        import secrets
        conn = self._get_connection()
        try:
            rec_id = secrets.token_hex(8)
            expires_at = time.time() + (30 * 24 * 3600)  # 30 days expiration
            conn.execute('''
                INSERT INTO study_recommendations (id, username, recommended_topic, reason,
                difficulty_level, priority_score, created_at, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (rec_id, username, recommended_topic, reason, difficulty_level, priority_score, time.time(), expires_at))
            conn.commit()
            return rec_id
        finally:
            conn.close()

    def get_recommendations(self, username: str, limit: int = 5) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            now = time.time()
            rows = conn.execute('''
                SELECT * FROM study_recommendations WHERE username = ? AND expires_at > ?
                ORDER BY priority_score DESC LIMIT ?
            ''', (username, now, limit)).fetchall()
            return [dict(row) for row in rows]
        finally:
            conn.close()

    # Spaced Repetition Methods (Feature 1)
    def add_spaced_repetition(self, username: str, history_id: str) -> str:
        import secrets
        conn = self._get_connection()
        try:
            sr_id = secrets.token_hex(8)
            next_review = time.time() + (1 * 24 * 3600)  # 1 day
            conn.execute('''
                INSERT INTO spaced_repetition (id, username, history_id, next_review_date, created_at)
                VALUES (?, ?, ?, ?, ?)
            ''', (sr_id, username, history_id, next_review, time.time()))
            conn.commit()
            return sr_id
        finally:
            conn.close()

    def get_due_for_review(self, username: str) -> List[Dict[str, Any]]:
        """Get items due for spaced repetition review"""
        conn = self._get_connection()
        try:
            now = time.time()
            rows = conn.execute('''
                SELECT sr.*, h.title, h.summary, h.source_label, h.topic, h.key_points FROM spaced_repetition sr
                JOIN history h ON sr.history_id = h.id
                WHERE sr.username = ? AND sr.next_review_date <= ?
                ORDER BY sr.next_review_date ASC
            ''', (username, now)).fetchall()
            due_items = []
            for row in rows:
                item = dict(row)
                title = (item.get('title') or '').strip()
                source_label = (item.get('source_label') or '').strip()
                topic = (item.get('topic') or '').strip()
                summary = (item.get('summary') or '').strip()
                key_points = item.get('key_points') or ''
                try:
                    key_points_list = json.loads(key_points) if key_points else []
                except Exception:
                    key_points_list = []

                item['question_text'] = title or topic or source_label or 'Study item'
                item['question'] = item['question_text']
                item['correct_answer'] = summary or '; '.join(key_points_list[:3]) or title or topic or source_label or 'Review the saved material'
                item['summary'] = summary
                item['source_label'] = source_label
                item['key_points'] = key_points_list
                due_items.append(item)
            return due_items
        finally:
            conn.close()

    def update_spaced_repetition(self, sr_id: str, correct: bool):
        """Update spaced repetition based on review result"""
        import math
        conn = self._get_connection()
        try:
            sr = conn.execute('SELECT * FROM spaced_repetition WHERE id = ?', (sr_id,)).fetchone()
            if not sr:
                return
            
            ease_factor = sr['ease_factor']
            interval_days = sr['interval_days']
            review_count = sr['review_count'] + 1
            
            # SMv2 algorithm adjustments
            if correct:
                ease_factor = min(2.5, max(1.3, ease_factor + 0.1))
                interval_days = max(1, int(interval_days * ease_factor))
            else:
                ease_factor = max(1.3, ease_factor - 0.2)
                interval_days = 1
                review_count = max(0, review_count - 1)
            
            next_review = time.time() + (interval_days * 24 * 3600)
            
            conn.execute('''
                UPDATE spaced_repetition SET ease_factor = ?, interval_days = ?, review_count = ?,
                next_review_date = ?, last_reviewed_at = ?
                WHERE id = ?
            ''', (ease_factor, interval_days, review_count, next_review, time.time(), sr_id))
            conn.commit()
        finally:
            conn.close()
