import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../utils/apiClient";

const Analytics = () => {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await apiFetch("/analytics", {
          method: "GET",
        });

        if (response.status === 401) {
          navigate("/login");
          return;
        }

        if (!response.ok) throw new Error("Failed to fetch analytics");

        const data = await response.json();
        setAnalytics(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [navigate]);

  if (loading) return <div className="p-4">Loading analytics...</div>;
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Learning Analytics
        </h1>

        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {analytics.total_attempts === 0 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 md:col-span-2">
                No quiz attempts recorded yet. Go to Chatbot, answer questions,
                and click "Save Quiz Attempt" to populate analytics.
              </div>
            )}

            {/* Learning Velocity */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Learning Velocity</h2>
              <p className="text-3xl font-bold text-blue-600">
                {analytics.learning_velocity?.velocity?.toFixed(1) || 0}%
              </p>
              <p className="text-gray-600 text-sm mt-2">
                {analytics.learning_velocity?.trend || "stable"}
              </p>
            </div>

            {/* Total Attempts */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Total Attempts</h2>
              <p className="text-3xl font-bold text-green-600">
                {analytics.total_attempts}
              </p>
              <p className="text-gray-600 text-sm mt-2">
                Quiz attempts completed
              </p>
            </div>

            {/* Overall Performance */}
            <div className="bg-white p-6 rounded-lg shadow md:col-span-2">
              <h2 className="text-xl font-semibold mb-4">
                Overall Performance
              </h2>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-700">Average Score</span>
                    <span className="font-semibold">
                      {analytics.learning_velocity?.average_score?.toFixed(1) ||
                        0}
                      %
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{
                        width:
                          (analytics.learning_velocity?.average_score || 0) +
                          "%",
                      }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-700">Accuracy</span>
                    <span className="font-semibold">
                      {analytics.performance?.accuracy_percentage?.toFixed(1) ||
                        0}
                      %
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{
                        width:
                          (analytics.performance?.accuracy_percentage || 0) +
                          "%",
                      }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-700">Questions Tracked</span>
                    <span className="font-semibold">
                      {analytics.performance?.total_questions || 0}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full"
                      style={{
                        width:
                          Math.min(
                            100,
                            analytics.performance?.total_questions || 0,
                          ) + "%",
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Strength & Weakness Heatmap */}
            {(analytics.performance?.weak_areas?.length || 0) +
              (analytics.performance?.strong_areas?.length || 0) >
              0 && (
              <div className="bg-white p-6 rounded-lg shadow md:col-span-2">
                <h2 className="text-xl font-semibold mb-4">
                  Strength & Weakness
                </h2>
                <div className="space-y-3">
                  {analytics.performance?.weak_areas?.map((item) => (
                    <div key={`weak-${item.question_text}`}>
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-700">
                          {item.question_text || "Weak area"}
                        </span>
                        <span className="text-sm font-semibold text-red-600">
                          {item.times_wrong} wrong
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-red-600"
                          style={{ width: "30%" }}
                        ></div>
                      </div>
                    </div>
                  ))}
                  {analytics.performance?.strong_areas?.map((item) => (
                    <div key={`strong-${item.question_text}`}>
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-700">
                          {item.question_text || "Strong area"}
                        </span>
                        <span className="text-sm font-semibold text-green-600">
                          {item.times_correct} correct
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-green-600"
                          style={{ width: "80%" }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;
