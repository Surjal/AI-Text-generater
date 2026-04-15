# Project Overview

## 1. High-level architecture

- `frontend/`: React + Vite single-page application.
- `backend/`: Flask API server with NLP utilities.
- Project objective: summarize text and PDF content, then generate study items from it.

## 2. Backend

- `backend/app.py`
  - Main Flask service exposing endpoints for:
    - `/process-text`
    - `/auth/signup`, `/auth/login`, `/auth/logout`
    - `/auth/me`
    - `/user/history`
    - `/admin/users`, `/admin/block`, `/admin/delete`, `/admin/stats`
  - Handles text upload, PDF extraction, summarization, QA item generation, keyword extraction, and key point extraction.
  - Uses in-memory auth/session storage with `USERS`, `TOKENS`, and `STATS`.

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

## 3. Frontend

- React with Vite.
- Main source files:
  - `frontend/src/App.jsx`
  - `frontend/src/main.jsx`
- Pages:
  - `frontend/pages/Home.jsx`
  - `frontend/pages/Chatbot.jsx`
  - `frontend/pages/About.jsx`
- Components:
  - `frontend/components/Navbar.jsx`
- Utility files:
  - `frontend/utils/exportQuizPdf.js`
  - `frontend/utils/historyStorage.js`
- UI communicates with backend to send text or PDFs and receive summaries and quiz items.

## 4. AI/NLP technical stack

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

## 5. Data and dataset focus

- Project is shifting away from local pretrained-model usage toward dataset-driven workflows.
- No Kaggle dataset file is present in the repo currently.
- Current implementation is structured to process raw text/PDF input, and it is ready for dataset integration.

## 6. Deployment and runtime

- Backend is designed to run as a Flask app on `0.0.0.0:5000`.
- Frontend runs on a Vite development server.
- Backend virtual environment exists at `backend/.venv`.

## 7. Current status

- Main AI workflows are implemented in backend utilities.
- Auth and admin route support is included in the Flask backend.
- The project now avoids heavy pretrained models and relies on lightweight NLP heuristics.
- Admin and user dashboards now support analytics, user management, and activity tracking.
- Next AI improvements should focus on integrating an external dataset and enhancing QA generation based on that dataset.
