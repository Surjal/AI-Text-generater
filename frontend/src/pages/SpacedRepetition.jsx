import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../utils/apiClient";

const SpacedRepetition = () => {
  const navigate = useNavigate();
  const [dueItems, setDueItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    const fetchDueItems = async () => {
      try {
        const response = await apiFetch("/spaced-review", {
          method: "GET",
        });

        if (response.status === 401) {
          navigate("/login");
          return;
        }

        if (!response.ok) throw new Error("Failed to fetch review items");

        const data = await response.json();
        setDueItems(data.due_for_review || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDueItems();
  }, [navigate]);

  const handleReview = async (correct) => {
    if (currentIndex >= dueItems.length) return;

    const item = dueItems[currentIndex];
    setReviewing(true);

    try {
      const response = await apiFetch("/spaced-review", {
        method: "POST",
        body: JSON.stringify({
          spaced_repetition_id: item.id,
          correct: correct,
        }),
      });

      if (!response.ok) throw new Error("Failed to update review");

      // Move to next item
      setCurrentIndex(currentIndex + 1);
      setShowAnswer(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setReviewing(false);
    }
  };

  if (loading) return <div className="p-4">Loading review items...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Spaced Repetition Review
        </h1>

        {dueItems.length === 0 ? (
          <div className="bg-green-50 p-8 rounded-lg text-center border border-green-200">
            <h2 className="text-2xl font-semibold text-green-800 mb-2">
              ✓ All Caught Up!
            </h2>
            <p className="text-green-700">
              There are no items due for review right now. Great job staying on
              top of your learning!
            </p>
          </div>
        ) : (
          <>
            {/* Progress Bar */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-700 font-semibold">Progress</span>
                <span className="text-gray-600">
                  {currentIndex} / {dueItems.length}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all"
                  style={{
                    width:
                      ((currentIndex / dueItems.length) * 100).toFixed(0) + "%",
                  }}
                ></div>
              </div>
            </div>

            {currentIndex < dueItems.length ? (
              <div className="bg-white rounded-lg shadow-lg p-8">
                <div className="mb-8">
                  <p className="text-sm text-gray-500 mb-2">Question</p>
                  <h2 className="text-2xl font-semibold text-gray-800">
                    {dueItems[currentIndex].question_text ||
                      dueItems[currentIndex].question ||
                      dueItems[currentIndex].title ||
                      dueItems[currentIndex].topic ||
                      dueItems[currentIndex].source_label}
                  </h2>
                </div>

                {/* Answer Reveal */}
                <div className="mb-8">
                  {!showAnswer ? (
                    <button
                      onClick={() => setShowAnswer(true)}
                      className="w-full bg-gray-100 hover:bg-gray-200 transition text-gray-800 font-semibold py-3 px-6 rounded-lg border border-gray-300"
                    >
                      Show Answer
                    </button>
                  ) : (
                    <div className="bg-green-50 border border-green-300 rounded-lg p-6">
                      <p className="text-sm text-green-700 font-semibold mb-2">
                        Answer
                      </p>
                      <p className="text-gray-800 text-lg">
                        {dueItems[currentIndex].correct_answer ||
                          dueItems[currentIndex].summary ||
                          dueItems[currentIndex].title}
                      </p>
                    </div>
                  )}
                </div>

                {/* Confidence Buttons */}
                {showAnswer && (
                  <div className="space-y-3">
                    <p className="text-center text-gray-600 mb-4">
                      How well did you remember this?
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleReview(false)}
                        disabled={reviewing}
                        className="bg-red-500 hover:bg-red-600 disabled:opacity-50 transition text-white font-semibold py-3 px-4 rounded-lg"
                      >
                        ✗ Forgot
                      </button>
                      <button
                        onClick={() => handleReview(true)}
                        disabled={reviewing}
                        className="bg-green-500 hover:bg-green-600 disabled:opacity-50 transition text-white font-semibold py-3 px-4 rounded-lg"
                      >
                        ✓ Remembered
                      </button>
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    Due since:{" "}
                    {new Date(
                      dueItems[currentIndex].next_review_date,
                    ).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-500">
                    Ease factor:{" "}
                    {(dueItems[currentIndex].ease_factor || 2.5).toFixed(2)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-blue-50 p-8 rounded-lg text-center border border-blue-200">
                <h2 className="text-2xl font-semibold text-blue-800 mb-2">
                  ✓ Review Session Complete!
                </h2>
                <p className="text-blue-700 mb-4">
                  You've reviewed all {dueItems.length} items due today.
                </p>
                <button
                  onClick={() => setCurrentIndex(0)}
                  className="bg-blue-600 hover:bg-blue-700 transition text-white font-semibold py-2 px-6 rounded-lg"
                >
                  Start Over
                </button>
              </div>
            )}
          </>
        )}

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
            Error: {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default SpacedRepetition;
