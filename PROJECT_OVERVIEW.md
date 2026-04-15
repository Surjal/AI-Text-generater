# Project Overview

## 1. High-level architecture

- `frontend/`: React + Vite single-page application.
- `backend/`: Flask API server with NLP and analytics utilities.
- Project objective: summarize text/PDF content, generate study items, and track quiz performance.

## 2. Backend

- `backend/app.py`
  - Main Flask service exposing endpoints for:
    - `/process-text`
    - `/auth/signup`, `/auth/login`, `/auth/logout`
    - `/auth/me`
    - `/user/history`
    - `/admin/users`, `/admin/block`, `/admin/delete`, `/admin/stats`
    - `/api/analytics`
    - `/api/quiz-attempt`
    - `/api/recommendations`
    - `/api/spaced-review`
    - `/api/explanations`
    - `/api/export`
  - Handles text upload, PDF extraction, summarization, QA item generation, keyword extraction, and key point extraction.
  - Uses persistent SQLite-backed storage through `DatabaseManager` (not in-memory).
  - Uses `FRONTEND_ORIGIN` for CORS in deployment.
  - Runs with env-configurable host/port (`HOST`, `PORT`), defaulting to `0.0.0.0:5001`.

- `backend/utils/`
  - `preprocess.py`
    - NLTK-based sentence and word tokenization.
    - Stopword fallback and text normalization.
  - `pdf_extract.py`
    - PDF-to-text extraction using `pypdf`.
  - `summarizer.py`
    - Extractive summarization using TF-IDF sentence scoring with `scikit-learn`.
  - `question_generator.py`
    - Heuristic question generation logic.
    - TextRank-style sentence ranking with `networkx` and TF-IDF similarity.
    - Rule-based WH-question conversion.
    - MCQ and fill-in-the-blank item generation without heavy pretrained models.
  - `key_extraction.py`
    - Keyword and key point extraction from raw text.
  - `advanced_qa.py`
    - Thin alias layer around `question_generator`.
    - No longer loads or depends on local heavyweight pretrained models.

## 3. Database used (type, file name, and how it is used)

- Database engine: SQLite (`sqlite3` module in Python).
- Database file name: `summarizer.db`.
- Database file path source:
  - Defined in `backend/config.py` as `DATABASE_PATH = os.path.join(os.path.dirname(__file__), "summarizer.db")`.
  - This means the DB file is created/used at `backend/summarizer.db`.

- How it is used in the app:
  1. `DatabaseManager` in `backend/database.py` opens connections to `Config.DATABASE_PATH`.
  2. On startup, `_initialize_db()` creates required tables if they do not exist.
  3. API routes in `backend/app.py` call DB methods for auth, history, admin, analytics, quiz attempts, recommendations, explanations, and spaced repetition.
  4. App data persists between restarts because it is stored in the SQLite file.

- Main tables:
  - `users`
  - `tokens`
  - `history`
  - `stats`
  - `quiz_attempts`
  - `question_performance`
  - `answer_explanations`
  - `study_recommendations`
  - `spaced_repetition`

## 4. Frontend

- React with Vite.
- Main source files:
  - `frontend/src/App.jsx`
  - `frontend/src/main.jsx`
- Pages:
  - `frontend/src/pages/Home.jsx`
  - `frontend/src/pages/Chatbot.jsx`
  - `frontend/src/pages/About.jsx`
  - `frontend/src/pages/Analytics.jsx`
  - `frontend/src/pages/Recommendations.jsx`
  - `frontend/src/pages/SpacedRepetition.jsx`
  - `frontend/src/pages/Export.jsx`
- Components:
  - `frontend/src/components/Navbar.jsx`
- Utility files:
  - `frontend/src/utils/exportQuizPdf.js`
  - `frontend/src/utils/historyStorage.js`
  - `frontend/src/utils/apiClient.js`
- UI communicates with backend to send text or PDFs and receive summaries and quiz items.
- Axios base URL supports deployment via `VITE_API_BASE_URL` in `frontend/src/App.jsx`.

## 5. AI/NLP technical stack

- Core backend NLP stack:
  - `nltk`
  - `scikit-learn`
  - `networkx`
  - `pypdf`
  - `numpy`
- Removed heavy model dependencies:
  - `transformers`
  - `torch`
  - `spacy`
  - `gensim`
- Current AI pipeline:
  1. Extract raw text from uploaded PDF or input text.
  2. Summarize using extractive TF-IDF ranking.
  3. Generate study questions using heuristic rule-based logic.
  4. Extract keywords and key points.

## 6. Data and dataset focus

- Project is shifting away from local pretrained-model usage toward dataset-driven workflows.
- No Kaggle dataset file is present in the repo currently.
- Current implementation is structured to process raw text/PDF input, and it is ready for dataset integration.

## 7. Deployment and runtime

- Backend runs as a Flask app on `0.0.0.0:5001` by default.
- Frontend runs on a Vite development server.
- Frontend can be deployed with `VITE_API_BASE_URL` set to the backend URL.
- Backend CORS allows either `FRONTEND_ORIGIN` or request origin fallback.

## 8. Latest updates and current status

- Main AI workflows are implemented in backend utilities.
- Auth and admin route support is included in the Flask backend.
- The project now avoids heavy pretrained models and relies on lightweight NLP heuristics.
- Admin and user dashboards now support analytics, user management, and activity tracking.
- Quiz attempt save flow now persists analytics data through `/api/quiz-attempt`.
- Frontend API routing supports deployed backend URLs using env config.
- Next AI improvements should focus on integrating an external dataset and enhancing QA generation based on that dataset.
