import os
import json
import time
from typing import List, Dict, Any, Optional
try:
    import openai
except ImportError:
    openai = None
from config import Config

class AIService:
    """Service to handle all AI-related tasks using OpenAI's API."""
    
    _client = None

    @classmethod
    def get_client(cls):
        if cls._client is None:
            if openai is None:
                raise RuntimeError("openai package is not installed")
            api_key = os.environ.get("OPENAI_API_KEY")
            if not api_key:
                # Fallback to a placeholder or dummy if no key provided
                # In a real app, this should raise an error or handle gracefully
                print("Warning: OPENAI_API_KEY not found in environment.")
            cls._client = openai.OpenAI(api_key=api_key)
        return cls._client

    @classmethod
    def summarize(cls, text: str, summary_sentences: int = 3) -> str:
        """Abstractive summarization using LLM."""
        try:
            client = cls.get_client()
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are an expert educational assistant. Summarize the following text clearly and concisely. Focus on key concepts and maintain a coherent, human-like flow."},
                    {"role": "user", "content": f"Summarize this text in about {summary_sentences} sentences:\n\n{text}"}
                ],
                max_tokens=500
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"Summarization error: {e}")
            # Fallback to existing TF-IDF summarization would be handled in the caller
            return ""

    @classmethod
    def generate_questions(cls, text: str, count: int = 5, difficulty: str = "medium") -> List[Dict[str, Any]]:
        """Context-aware question generation using LLM."""
        try:
            client = cls.get_client()
            prompt = f"""
            Generate {count} educational questions from the following text at a '{difficulty}' difficulty level.
            Provide a mix of:
            1. Multiple Choice Questions (MCQ) with 4 options and a correct index.
            2. Conceptual Short Answer Questions.
            
            Return the output ONLY as a JSON list of objects with the following structure:
            [
                {{
                    "type": "mcq",
                    "question": "question text",
                    "options": ["A", "B", "C", "D"],
                    "correct_index": 0,
                    "answer": "correct option text",
                    "explanation": "Why this is correct",
                    "topic": "topic name",
                    "difficulty": "{difficulty}"
                }},
                {{
                    "type": "short_answer",
                    "question": "conceptual question",
                    "answer": "sample correct answer",
                    "explanation": "key points to look for",
                    "topic": "topic name",
                    "difficulty": "{difficulty}"
                }}
            ]
            
            Text:
            {text[:4000]}
            """
            
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are an expert teacher. Generate high-quality, relevant educational questions."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"}
            )
            
            data = json.loads(response.choices[0].message.content)
            # OpenAI might wrap it in a root key like {"questions": [...]}
            if isinstance(data, dict):
                for key in ["questions", "items", "data"]:
                    if key in data and isinstance(data[key], list):
                        return data[key]
                if "questions" not in data and any(isinstance(v, list) for v in data.values()):
                    # Find the first list in the dict
                    for v in data.values():
                        if isinstance(v, list):
                            return v
            return data if isinstance(data, list) else []
        except Exception as e:
            print(f"Question generation error: {e}")
            return []

    @classmethod
    def get_embedding(cls, text: str) -> List[float]:
        """Generate embeddings for semantic search."""
        try:
            client = cls.get_client()
            response = client.embeddings.create(
                model="text-embedding-3-small",
                input=text
            )
            return response.data[0].embedding
        except Exception as e:
            print(f"Embedding error: {e}")
            return []

    @classmethod
    def generate_explanation(cls, question: str, correct_answer: str, user_answer: str, context: str) -> Dict[str, str]:
        """Generate detailed explanation for a user's answer."""
        try:
            client = cls.get_client()
            prompt = f"""
            Question: {question}
            Correct Answer: {correct_answer}
            User Answer: {user_answer}
            Context: {context[:2000]}
            
            Explain why the correct answer is right and, if the user was wrong, clarify their misconception.
            Return a JSON object:
            {{
                "explanation": "...",
                "misconception": "...",
                "learning_tip": "..."
            }}
            """
            
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are an encouraging and insightful tutor."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"}
            )
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            print(f"Explanation generation error: {e}")
            return {
                "explanation": f"The correct answer is {correct_answer}.",
                "misconception": "Detailed AI explanation unavailable.",
                "learning_tip": "Review the source material again."
            }
