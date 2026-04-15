import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../utils/apiClient";

const Recommendations = () => {
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("saved");

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const response = await apiFetch("/recommendations", {
          method: "GET",
        });

        if (response.status === 401) {
          navigate("/login");
          return;
        }

        if (!response.ok) throw new Error("Failed to fetch recommendations");

        const data = await response.json();
        setRecommendations(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [navigate]);

  if (loading) return <div className="p-4">Loading recommendations...</div>;
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>;

  const renderRecommendation = (rec, index) => (
    <div
      key={index}
      className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition mb-4 border-l-4 border-blue-500"
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-lg font-semibold text-gray-800">
          {rec.recommended_topic || rec.topic || rec.recommendation}
        </h3>
        <span
          className={`px-3 py-1 rounded-full text-sm font-semibold ${
            rec.priority_score >= 0.8
              ? "bg-red-100 text-red-800"
              : rec.priority_score >= 0.6
                ? "bg-yellow-100 text-yellow-800"
                : "bg-green-100 text-green-800"
          }`}
        >
          {(rec.priority_score * 100).toFixed(0)}% Priority
        </span>
      </div>
      <p className="text-gray-600 mb-2">{rec.reason || rec.description}</p>
      {(rec.difficulty_level || rec.difficulty) && (
        <div className="text-sm text-gray-500">
          <span className="font-semibold">Suggested Difficulty:</span>{" "}
          {rec.difficulty_level || rec.difficulty}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Study Recommendations
        </h1>

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-8 border-b">
          <button
            onClick={() => setActiveTab("saved")}
            className={`pb-3 px-4 font-semibold transition ${
              activeTab === "saved"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Saved Recommendations
          </button>
          <button
            onClick={() => setActiveTab("dynamic")}
            className={`pb-3 px-4 font-semibold transition ${
              activeTab === "dynamic"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Dynamic Suggestions
          </button>
        </div>

        {/* Saved Recommendations */}
        {activeTab === "saved" && (
          <div>
            <p className="text-gray-600 mb-4">
              recommendations based on your performance
            </p>
            {recommendations?.saved_recommendations?.length > 0 ? (
              recommendations.saved_recommendations.map((rec, idx) =>
                renderRecommendation(rec, idx),
              )
            ) : (
              <div className="bg-blue-50 p-4 rounded-lg text-blue-800 border border-blue-200">
                No saved recommendations yet. Complete some quizzes to get
                personalized suggestions!
              </div>
            )}
          </div>
        )}

        {/* Dynamic Recommendations */}
        {activeTab === "dynamic" && (
          <div>
            <p className="text-gray-600 mb-4">
              {recommendations?.dynamic_recommendations?.length || 0} dynamic
              recommendations generated from your recent performance
            </p>
            {recommendations?.dynamic_recommendations?.length > 0 ? (
              recommendations.dynamic_recommendations.map((rec, idx) =>
                renderRecommendation(rec, idx),
              )
            ) : (
              <div className="bg-blue-50 p-4 rounded-lg text-blue-800 border border-blue-200">
                No dynamic recommendations available yet. Keep learning to
                receive fresh suggestions!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Recommendations;
