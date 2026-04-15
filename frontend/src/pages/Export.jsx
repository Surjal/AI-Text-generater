import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../utils/apiClient";

const Export = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [exportFormat, setExportFormat] = useState("markdown");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await apiFetch("/user/history", {
          method: "GET",
        });

        if (response.status === 401) {
          navigate("/login");
          return;
        }

        if (!response.ok) throw new Error("Failed to fetch history");

        const data = await response.json();
        setHistory(Array.isArray(data.history) ? data.history : data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [navigate]);

  const handleExport = async () => {
    if (!selectedHistory) {
      setError("Please select a document to export");
      return;
    }

    setExporting(true);

    try {
      const response = await apiFetch("/export", {
        method: "POST",
        body: JSON.stringify({
          history_id: selectedHistory.id || selectedHistory._id,
          format: exportFormat,
          title: selectedHistory.title || "Export",
          summary: selectedHistory.summary || "",
          mcq_items: selectedHistory.mcq || [],
          fill_blank_items: selectedHistory.fill_blanks || [],
        }),
      });

      if (!response.ok) throw new Error("Export failed");

      const data = await response.json();

      // Create download link
      const element = document.createElement("a");
      element.setAttribute(
        "href",
        "data:text/plain;charset=utf-8," + encodeURIComponent(data.content),
      );
      element.setAttribute("download", data.filename);
      element.style.display = "none";
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);

      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <div className="p-4">Loading history...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Export Study Material
        </h1>

        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Select Document */}
          <div className="mb-8">
            <label className="block text-gray-700 font-semibold mb-3">
              Select Document to Export
            </label>
            <select
              value={selectedHistory?.id || selectedHistory?._id || ""}
              onChange={(e) => {
                const selected = history.find(
                  (h) => (h.id || h._id) === e.target.value,
                );
                setSelectedHistory(selected);
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Choose a document --</option>
              {history.map((item) => (
                <option key={item.id || item._id} value={item.id || item._id}>
                  {item.title || "Untitled Document"}
                </option>
              ))}
            </select>
          </div>

          {/* Select Format */}
          <div className="mb-8">
            <label className="block text-gray-700 font-semibold mb-3">
              Export Format
            </label>
            <div className="grid grid-cols-3 gap-4">
              <label
                className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 transition"
                style={{
                  borderColor:
                    exportFormat === "markdown" ? "rgb(59, 130, 246)" : "",
                }}
              >
                <input
                  type="radio"
                  name="format"
                  value="markdown"
                  checked={exportFormat === "markdown"}
                  onChange={(e) => setExportFormat(e.target.value)}
                  className="mr-3"
                />
                <span className="font-semibold">Markdown</span>
              </label>
              <label
                className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 transition"
                style={{
                  borderColor:
                    exportFormat === "anki" ? "rgb(59, 130, 246)" : "",
                }}
              >
                <input
                  type="radio"
                  name="format"
                  value="anki"
                  checked={exportFormat === "anki"}
                  onChange={(e) => setExportFormat(e.target.value)}
                  className="mr-3"
                />
                <span className="font-semibold">Anki</span>
              </label>
              <label
                className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 transition"
                style={{
                  borderColor:
                    exportFormat === "json" ? "rgb(59, 130, 246)" : "",
                }}
              >
                <input
                  type="radio"
                  name="format"
                  value="json"
                  checked={exportFormat === "json"}
                  onChange={(e) => setExportFormat(e.target.value)}
                  className="mr-3"
                />
                <span className="font-semibold">JSON</span>
              </label>
            </div>
          </div>

          {/* Format Info */}
          <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              {exportFormat === "markdown" &&
                "📝 Markdown format is best for reading in any text editor or note-taking app"}
              {exportFormat === "anki" &&
                "🧠 Anki format lets you study with spaced repetition in Anki desktop or AnkiDroid"}
              {exportFormat === "json" &&
                "💾 JSON format is suitable for integration with other apps or tools"}
            </p>
          </div>

          {/* Export Button */}
          <button
            onClick={handleExport}
            disabled={!selectedHistory || exporting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-white font-semibold py-3 px-6 rounded-lg"
          >
            {exporting ? "Exporting..." : "Download Export"}
          </button>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-semibold text-gray-800 mb-2">📝 Markdown</h3>
            <p className="text-sm text-gray-600">
              Clean formatted text with headings, bullet points, and links
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-semibold text-gray-800 mb-2">🧠 Anki</h3>
            <p className="text-sm text-gray-600">
              CSV format importable into Anki for spaced repetition learning
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-semibold text-gray-800 mb-2">💾 JSON</h3>
            <p className="text-sm text-gray-600">
              Structured data format for programmatic access and integration
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Export;
