"""Advanced features: Analytics, Adaptive Learning, Explanations, etc."""
from typing import Dict, List, Any, Optional
import json
import re
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

class AnalyticsEngine:
    """Feature 3: Advanced Progress Analytics"""
    
    @staticmethod
    def compute_learning_velocity(attempts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate learning velocity over time"""
        if len(attempts) < 2:
            return {"velocity": 0, "trend": "insufficient_data"}
        
        recent = attempts[:5]  # Last 5 attempts
        scores = [a['score'] if a.get('score') else (a['correct_answers'] / a['total_questions'] * 100) 
                  for a in recent]
        
        if len(scores) < 2:
            return {"velocity": 0, "trend": "improving"}
        
        # Simple linear velocity
        velocity = (scores[-1] - scores[0]) / len(scores)
        trend = "improving" if velocity > 0 else "declining" if velocity < 0 else "stable"
        
        return {
            "velocity": round(velocity, 2),
            "trend": trend,
            "recent_scores": scores,
            "average_score": round(sum(scores) / len(scores), 2)
        }
    
    @staticmethod
    def compute_strength_weakness_heatmap(performance_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a heatmap of strong/weak topics"""
        weak_areas = performance_data.get('weak_areas', [])
        strong_areas = performance_data.get('strong_areas', [])
        
        return {
            "weak_topics": [{"topic": w['question_text'][:50], "strength": 0.3} for w in weak_areas],
            "strong_topics": [{"topic": s['question_text'][:50], "strength": 0.8} for s in strong_areas],
            "overall_readiness": performance_data.get('accuracy_percentage', 0) / 100
        }


class AdaptiveQuizzesEngine:
    """Features 1 & 5: Adaptive Learning & Timed Exams"""
    
    @staticmethod
    def adjust_difficulty(user_accuracy: float, current_difficulty: str) -> str:
        """Adjust quiz difficulty based on performance"""
        difficulty_map = {"easy": 1, "medium": 2, "hard": 3}
        reverse_map = {1: "easy", 2: "medium", 3: "hard"}
        
        current_level = difficulty_map.get(current_difficulty, 2)
        
        # If accuracy > 80%, increase difficulty
        if user_accuracy > 80:
            return reverse_map.get(min(3, current_level + 1), "hard")
        # If accuracy < 40%, decrease difficulty
        elif user_accuracy < 40:
            return reverse_map.get(max(1, current_level - 1), "easy")
        else:
            return current_difficulty
    
    @staticmethod
    def calculate_adaptive_difficulty(history: List[Dict[str, Any]]) -> str:
        """Calculate adaptive difficulty for next quiz"""
        if not history:
            return "easy"
        
        # Use recent performance
        recent = history[:3] if len(history) >= 3 else history
        avg_accuracy = sum([a.get('score', 0) for a in recent]) / len(recent)
        
        if avg_accuracy > 75:
            return "hard"
        elif avg_accuracy < 50:
            return "easy"
        else:
            return "medium"


class ExplanationGenerator:
    """Feature 9: Self-Grading & Answer Explanations"""
    
    @staticmethod
    def generate_explanation(question: str, correct_answer: str, user_answer: str, 
                            context: str = "") -> Dict[str, str]:
        """Generate explanation using text analysis"""
        explanation = f"The correct answer is: {correct_answer}."
        
        if context:
            explanation += f"\nContext: {context[:200]}..."
        
        # Detect misconception
        misconception = "None detected" if user_answer.lower() == correct_answer.lower() else \
                       f"Confusion between concepts. Your answer '{user_answer}' does not fully capture '{correct_answer}'."
        
        return {
            "explanation": explanation,
            "misconception": misconception,
            "learning_tip": f"Focus on understanding the relationship between '{question}' and '{correct_answer}'."
        }
    
    @staticmethod
    def generate_misconception_insights(performance: Dict[str, Any]) -> List[str]:
        """Identify common misconceptions from performance"""
        insights = []
        weak_areas = performance.get('weak_areas', [])
        
        if weak_areas:
            most_missed = weak_areas[0]
            insights.append(
                f"You frequently miss questions about: {most_missed.get('question_text', 'this topic')[:50]}"
            )
        
        return insights


class RecommendationEngine:
    """Feature 6: Content-Based Recommendations"""
    
    @staticmethod
    def generate_recommendations(user_analytics: Dict[str, Any], all_history: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate study recommendations based on performance"""
        recommendations = []
        weak_areas = user_analytics.get('weak_areas', [])
        accuracy = user_analytics.get('accuracy_percentage', 0)
        
        # Recommend weak area review
        for weak in weak_areas[:2]:
            recommendations.append({
                "topic": weak.get('question_text', 'Unknown')[:50],
                "reason": "You need improvement in this area",
                "difficulty": "easy" if accuracy < 50 else "medium",
                "priority_score": weak.get('times_wrong', 1) / 5
            })
        
        # Recommend similar topics
        if all_history:
            most_recent_topic = all_history[0].get('topic', '')
            if most_recent_topic:
                recommendations.append({
                    "topic": f"Related: {most_recent_topic}",
                    "reason": "Continue building knowledge in this area",
                    "difficulty": "medium",
                    "priority_score": 0.7
                })
        
        return recommendations[:5]
    
    @staticmethod
    def find_related_materials(history: List[Dict[str, Any]], current_topic: str) -> List[Dict[str, Any]]:
        """Find similar study materials using TF-IDF"""
        if not history or not current_topic:
            return []
        
        try:
            # Prepare texts
            current_summary = current_topic
            all_summaries = [h.get('summary', '') or h.get('title', '') for h in history if h.get('summary') or h.get('title')]
            
            if not all_summaries:
                return []
            
            # Vectorize
            vectorizer = TfidfVectorizer(stop_words='english', max_features=100)
            texts = [current_summary] + all_summaries
            vectors = vectorizer.fit_transform(texts)
            
            # Compute similarity
            similarities = cosine_similarity(vectors[0:1], vectors[1:])[0]
            similar_indices = np.argsort(-similarities)[:3]
            
            return [
                {
                    "title": history[idx].get('title', 'Study Material'),
                    "similarity_score": round(float(similarities[idx]), 2),
                    "topic": history[idx].get('topic', '')
                }
                for idx in similar_indices if similarities[idx] > 0.1
            ]
        except Exception:
            return []


class ExportManager:
    """Feature 7: Multiple Export Formats"""
    
    # PowerPoint, Word, Markdown, Flashcard exports
    
    @staticmethod
    def export_to_markdown(title: str, summary: str, mcq_items: List[Dict], 
                          fill_blank_items: List[Dict]) -> str:
        """Export to Markdown format"""
        md = f"# {title}\n\n## Summary\n\n{summary}\n\n"
        
        if mcq_items:
            md += "## Multiple Choice Questions\n\n"
            for i, item in enumerate(mcq_items, 1):
                md += f"### Q{i}: {item.get('question', '')}\n"
                for j, opt in enumerate(item.get('options', []), 1):
                    md += f"- {chr(64+j)}. {opt}\n"
                md += f"**Answer:** {chr(64 + item.get('correct_index', 0) + 1)}\n\n"
        
        if fill_blank_items:
            md += "## Fill in the Blanks\n\n"
            for i, item in enumerate(fill_blank_items, 1):
                md += f"{i}. {item.get('prompt', '')}\n"
                md += f"**Answer:** {item.get('answer', '')}\n\n"
        
        return md
    
    @staticmethod
    def export_to_anki_format(mcq_items: List[Dict], fill_blank_items: List[Dict]) -> str:
        """Export to Anki flashcard format (CSV)"""
        csv = "Front,Back\n"
        
        for item in mcq_items:
            front = item.get('question', '')
            back = f"Correct: {item.get('options', [''])[item.get('correct_index', 0)]}\n" + \
                   "Options: " + ", ".join(item.get('options', []))
            csv += f'"{front}","{back}"\n'
        
        for item in fill_blank_items:
            front = item.get('prompt', '')
            back = item.get('answer', '')
            csv += f'"{front}","{back}"\n'
        
        return csv
    
    @staticmethod
    def export_to_json(title: str, summary: str, mcq_items: List[Dict], 
                      fill_blank_items: List[Dict], metadata: Dict = None) -> str:
        """Export to JSON format"""
        export_data = {
            "title": title,
            "summary": summary,
            "metadata": metadata or {},
            "mcq_questions": mcq_items,
            "fill_blank_questions": fill_blank_items
        }
        return json.dumps(export_data, indent=2)
