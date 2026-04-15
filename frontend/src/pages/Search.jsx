import React, { useState } from "react";
import axios from "axios";
import { Search, Loader2, BookOpen, Clock, FileText } from "lucide-react";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError("");
    try {
      const res = await axios.post("/api/search", { query });
      setResults(res.data.results || []);
    } catch (err) {
      setError("Failed to perform semantic search. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          Semantic Search
        </h1>
        <p className="text-lg text-slate-600">
          Search your study history by concepts and meaning, not just keywords.
        </p>
      </div>

      <form onSubmit={handleSearch} className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary-600 transition-colors">
          <Search size={24} />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for concepts like 'neural networks' or 'photosynthesis'..."
          className="block w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-lg"
        />
        <button
          type="submit"
          disabled={loading}
          className="absolute right-3 top-3 px-6 py-2 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          {loading ? <Loader2 className="animate-spin" /> : "Search"}
        </button>
      </form>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl font-medium">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {results.length > 0 ? (
          results.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => (window.location.href = `/dashboard?id=${item.id}`)}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-50 text-primary-600 rounded-lg">
                    <FileText size={20} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">
                    {item.title || "Untitled Summary"}
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                  <span className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
                  {Math.round(item.similarity * 100)}% Match
                </div>
              </div>
              <p className="text-slate-600 line-clamp-3 mb-4 leading-relaxed">
                {item.summary}
              </p>
              <div className="flex flex-wrap gap-4 text-sm text-slate-500 font-medium">
                <div className="flex items-center gap-1.5">
                  <BookOpen size={16} />
                  {item.topic || "General"}
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock size={16} />
                  {new Date(item.created_at * 1000).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))
        ) : query && !loading ? (
          <div className="text-center py-12 text-slate-500 font-medium">
            No related summaries found for your search.
          </div>
        ) : null}
      </div>
    </div>
  );
}
