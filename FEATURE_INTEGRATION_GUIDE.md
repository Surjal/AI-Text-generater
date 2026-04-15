# Feature Integration Guide

## Overview

This document provides instructions for integrating the newly implemented features (Adaptive Learning, Analytics, Spaced Repetition, Recommendations, and Exports) with the existing Chatbot component.

---

## 1. Integrating Quiz Submission with `/api/quiz-attempt`

### Current Flow

In `Chatbot.jsx`, quiz generation and submission need to be connected to the new analytics and tracking system.

### Integration Steps

#### Step 1: Update Quiz State in Chatbot.jsx

Add state for tracking quiz performance:

```javascript
// Add to Chatbot component state
const [quizAttempt, setQuizAttempt] = useState({
  score: 0,
  totalQuestions: 0,
  correctAnswers: 0,
  timeTaken: 0,
  questionPerformance: [],
  difficulty: "medium",
  isTimed: false,
  timeLimit: null,
});
```

#### Step 2: Track Quiz Start Time

When quiz begins:

```javascript
const handleQuizStart = (quizData) => {
  const startTime = Date.now();
  setQuizStartTime(startTime);
  setQuizAttempt((prev) => ({
    ...prev,
    totalQuestions: quizData.questions.length,
    isTimed: quizData.isTimed || false,
    timeLimit: quizData.timeLimit || null,
  }));
};
```

#### Step 3: Submit Quiz Results

When quiz is completed:

```javascript
const submitQuizAttempt = async (quizResults) => {
  const timeTaken = (Date.now() - quizStartTime) / 1000; // seconds

  const payload = {
    history_id: selectedHistory.id || selectedHistory._id,
    score: quizResults.score,
    correct_answers: quizResults.correctCount,
    total_questions: quizResults.total,
    time_taken_seconds: timeTaken,
    is_timed: quizAttempt.isTimed,
    time_limit_seconds: quizAttempt.timeLimit,
    question_performance: quizResults.questions.map((q, idx) => ({
      index: idx,
      question: q.text,
      correct: q.userAnswer === q.correctAnswer,
      user_answer: q.userAnswer,
      correct_answer: q.correctAnswer,
      difficulty: q.difficulty || 3,
    })),
  };

  try {
    const response = await fetch("http://localhost:5000/api/quiz-attempt", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error("Failed to submit quiz");

    const data = await response.json();
    console.log("Quiz attempt recorded:", data);

    // Optionally refresh analytics or recommendations
    // This will be handled by the Analytics/Recommendations pages
  } catch (error) {
    console.error("Error submitting quiz:", error);
  }
};
```

---

## 2. Displaying Adaptive Difficulty Feedback

### After Quiz Submission

Show user how their difficulty level changed:

```javascript
const handleQuizComplete = async (results) => {
  const attemptData = await submitQuizAttempt(results);

  showNotification({
    type: "info",
    title: "Quiz Complete!",
    message: `Difficulty adjusted to: ${attemptData.new_difficulty}`,
    duration: 3000,
  });
};
```

---

## 3. Linking to Learning Features

### Add Feature Access Panel in Dashboard

```jsx
// In UserDashboard.jsx or Home.jsx (for authenticated users)

const LearningFeaturesPanel = ({ auth }) => {
  if (!auth?.user) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
      <Link
        to="/analytics"
        className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow hover:shadow-lg transition"
      >
        <h3 className="font-semibold text-blue-900">📊 Analytics</h3>
        <p className="text-sm text-blue-800">View your learning progress</p>
      </Link>

      <Link
        to="/recommendations"
        className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow hover:shadow-lg transition"
      >
        <h3 className="font-semibold text-purple-900">🎯 Recommendations</h3>
        <p className="text-sm text-purple-800">Get personalized topics</p>
      </Link>

      <Link
        to="/spaced-repetition"
        className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow hover:shadow-lg transition"
      >
        <h3 className="font-semibold text-green-900">🔄 Review</h3>
        <p className="text-sm text-green-800">Spaced repetition practice</p>
      </Link>

      <Link
        to="/export"
        className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg shadow hover:shadow-lg transition"
      >
        <h3 className="font-semibold text-orange-900">📥 Export</h3>
        <p className="text-sm text-orange-800">Download study material</p>
      </Link>
    </div>
  );
};
```

---

## 4. Metrics Explained

### Learning Velocity

- **What it is**: Speed of learning improvement over recent quiz attempts
- **Interpretation**:
  - Positive trend: Knowledge getting better
  - Negative trend: Struggling with material
  - 0%: Consistent performance

### Accuracy

- **Definition**: Percentage of questions answered correctly across all attempts
- **Target**: Aim for 70-80% for sustainable learning

### Consistency

- **Definition**: How stable your performance is (lower = more consistent)
- **Implications**:
  - Low consistency = Reliable learner
  - High consistency = Inconsistent performance

### Strength/Weakness Heatmap

- **Green (70%+)**: Strong topics - you know these well
- **Yellow (50-70%)**: Medium topics - needs practice
- **Red (<50%)**: Weak topics - focus here first

---

## 5. Spaced Repetition Best Practices

### What Items Appear for Review?

Items are shown based on SMv2 algorithm:

- New items: 1 day after first learning
- Reviewed items: Dynamically scheduled based on remember/forgot ratio
- Ease factor: Adjusts based on your performance

### How to Use Review Session

1. Click "Review" in navbar when logged in
2. Try to recall each item without looking at the answer
3. Click "Show Answer"
4. Mark if you remembered or forgot
5. System automatically reschedules based on your response

### Optimal Review Frequency

- New items: Daily for first week
- Known items: Weekly or bi-weekly
- Difficult items: Multiple times per week

---

## 6. Export Formats Guide

### Markdown (.md)

**Best for**: Note-taking apps (OneNote, Obsidian, Notion)

- Opens in any text editor
- Preserves formatting with headers and lists
- Easy to share and read

### Anki Format (.csv)

**Best for**: Spaced repetition with Anki app

- Import to Anki Desktop or AnkiDroid
- Questions become flashcards
- Uses Anki's proven SM2 algorithm
- Syncs across devices

### JSON (.json)

**Best for**: Integration and programming

- Machine-readable format
- Ideal for custom tools or databases
- Preserves all metadata
- Programmatically accessible

---

## 7. Recommendation System Details

### How Recommendations Work

1. **Performance Gap Analysis**: Topics where your accuracy is below 70%
2. **Study Frequency**: Topics you haven't studied recently
3. **Difficulty Progression**: Suggests harder topics when mastering easier ones
4. **Content Similarity**: Recommends related materials using TF-IDF

### Priority Score Breakdown

```
priority_score = (performance_gap × 50%) + (frequency × 30%) + (manual_request × 20%)
```

### Acting on Recommendations

1. Review recommendations on `/recommendations` page
2. Topics with red priority badges (80%+) need immediate attention
3. Create new summaries for recommended topics
4. Track improvement in Analytics dashboard

---

## 8. API Reference

### Quiz Attempt Submission

```
POST /api/quiz-attempt
Headers: Authorization: Bearer {token}
Body: {
  "history_id": "string",
  "score": number,
  "correct_answers": number,
  "total_questions": number,
  "time_taken_seconds": number,
  "is_timed": boolean,
  "time_limit_seconds": number | null,
  "question_performance": [
    {
      "index": number,
      "question": string,
      "correct": boolean,
      "user_answer": string,
      "correct_answer": string,
      "difficulty": number (1-5)
    }
  ]
}
Response: {
  "attempt_id": "string",
  "new_difficulty": "easy" | "medium" | "hard"
}
```

### Get Analytics

```
GET /api/analytics
Headers: Authorization: Bearer {token}
Response: {
  "performance": {
    "average_score": number,
    "accuracy": number,
    "consistency": number
  },
  "learning_velocity": {
    "trend_percent": number,
    "interpretation": string
  },
  "strength_weakness": { [topic: string]: number },
  "total_attempts": number
}
```

### Get Recommendations

```
GET /api/recommendations
Headers: Authorization: Bearer {token}
Response: {
  "saved_recommendations": [
    {
      "topic": string,
      "reason": string,
      "difficulty": string,
      "priority_score": number
    }
  ],
  "dynamic_recommendations": [...]
}
```

### Spaced Repetition Review

```
GET /api/spaced-review
Response: {
  "due_for_review": [
    {
      "id": string,
      "question_text": string,
      "correct_answer": string,
      "ease_factor": number,
      "next_review_date": date
    }
  ]
}
```

### Export Study Material

```
POST /api/export
Headers: Authorization: Bearer {token}
Body: {
  "format": "markdown" | "anki" | "json",
  "history_id": string,
  "title": string,
  "summary": string,
  "mcq_items": array,
  "fill_blank_items": array
}
Response: {
  "format": string,
  "content": string,
  "filename": string
}
```

---

## 9. Troubleshooting

### Issue: Analytics shows no data

**Solution**: Complete at least 2 quiz attempts first. Analytics need historical data.

### Issue: No recommendations appear

**Solution**: Quiz performance data is needed. Complete quizzes and wait for the system to analyze patterns.

### Issue: Spaced review is empty

**Solution**: Items need to be studied first. Complete quizzes or create study sessions to generate review items.

### Issue: Export downloads as text, not markdown

**Solution**: Manually rename file from `.txt` to `.md` if needed. Browser may not recognize extension.

---

## 10. Development Checklist

- [ ] Integrate quiz submission with `/api/quiz-attempt` endpoint
- [ ] Add feature access links to Dashboard
- [ ] Test with actual quiz data flow
- [ ] Verify analytics calculations with sample data
- [ ] Test recommendations generation
- [ ] Verify spaced repetition scheduling
- [ ] Test all export formats
- [ ] Mobile responsive testing
- [ ] Performance testing with 100+ quiz attempts
- [ ] Error handling and user feedback

---

## Next Steps

1. **Immediate**: Integrate Chatbot with quiz-attempt submission
2. **Short-term**: Add data visualization charts to Analytics page
3. **Medium-term**: Implement real-time feature recommendations in Chatbot
4. **Long-term**: Add AI-powered tutoring chatbot using explanations

For questions or issues, refer to the feature implementation documentation or check the database schema in `backend/database.py`.
