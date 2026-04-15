import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import Navbar from "./components/Navbar.jsx";
import Home from "./pages/Home.jsx";
import About from "./pages/About.jsx";
import Chatbot from "./pages/Chatbot.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import UserDashboard from "./pages/UserDashboard.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import Analytics from "./pages/Analytics.jsx";
import Recommendations from "./pages/Recommendations.jsx";
import SpacedRepetition from "./pages/SpacedRepetition.jsx";
import Export from "./pages/Export.jsx";
import { clearSession, loadSession, saveSession } from "./utils/authStorage.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

axios.defaults.baseURL = API_BASE_URL;

function ProtectedRoute({ auth, children, adminOnly = false }) {
  if (!auth?.token) {
    return <Navigate to="/login" replace />;
  }
  if (adminOnly && auth.user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  const [auth, setAuth] = useState(loadSession());
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    if (auth?.token) {
      axios.defaults.headers.common.Authorization = `Bearer ${auth.token}`;
    } else {
      delete axios.defaults.headers.common.Authorization;
    }
  }, [auth]);

  useEffect(() => {
    if (!auth?.token) return;

    setLoadingProfile(true);
    axios
      .get("/auth/me")
      .then((res) => {
        if (res.data?.user) {
          const next = { token: auth.token, user: res.data.user };
          saveSession(next);
          setAuth(next);
        } else {
          handleLogoutCleanup();
        }
      })
      .catch(() => {
        handleLogoutCleanup();
      })
      .finally(() => setLoadingProfile(false));
  }, []);

  function handleSessionChange(session) {
    saveSession(session);
    setAuth(session);
  }

  function handleLogoutCleanup() {
    clearSession();
    setAuth(null);
  }

  function handleLogout() {
    axios.post("/auth/logout").finally(() => {
      handleLogoutCleanup();
      window.location.href = "/";
    });
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
        <Navbar auth={auth} onLogout={handleLogout} />
        <main className="grow">
          {loadingProfile ? (
            <div className="flex items-center justify-center h-[60vh]">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                <p className="text-slate-500 font-medium">
                  Loading your profile...
                </p>
              </div>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/about" element={<About auth={auth} />} />
                <Route
                  path="/chatbot"
                  element={
                    <ProtectedRoute auth={auth}>
                      <Chatbot auth={auth} />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/login"
                  element={<Login onLogin={handleSessionChange} />}
                />
                <Route
                  path="/signup"
                  element={<Signup onSignup={handleSessionChange} />}
                />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute auth={auth}>
                      <UserDashboard auth={auth} />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute auth={auth} adminOnly={true}>
                      <AdminDashboard auth={auth} />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/analytics"
                  element={
                    <ProtectedRoute auth={auth}>
                      <Analytics />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/recommendations"
                  element={
                    <ProtectedRoute auth={auth}>
                      <Recommendations />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/spaced-repetition"
                  element={
                    <ProtectedRoute auth={auth}>
                      <SpacedRepetition />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/export"
                  element={
                    <ProtectedRoute auth={auth}>
                      <Export />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          )}
        </main>
        <footer className="bg-white border-t border-slate-200 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-500 text-sm">
            <p>© 2026 Text2Test. Runs against your local Flask server.</p>
            <p className="mt-1">Built for privacy and performance.</p>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
}
