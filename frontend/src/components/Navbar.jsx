import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

function NavLink({ to, active, onClick, children, className = "" }) {
  const baseClasses =
    "px-4 py-2 text-sm font-medium transition-colors duration-200 rounded-lg";
  const activeClasses = "text-primary-600 bg-primary-50";
  const inactiveClasses =
    "text-slate-600 hover:text-primary-600 hover:bg-slate-50";

  return (
    <Link
      to={to}
      className={`${baseClasses} ${active ? activeClasses : inactiveClasses} ${className}`}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}

export default function Navbar({ auth, onLogout }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const closeMenu = () => setMobileMenuOpen(false);
  const isActive = (path) => location.pathname === path;

  return (
    <nav
      className={`sticky top-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-white/80 backdrop-blur-md shadow-sm border-b border-slate-200"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center">
            <Link
              to="/"
              className="flex items-center gap-2 group"
              onClick={closeMenu}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white shadow-lg shadow-primary-500/20 group-hover:scale-105 transition-transform">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">
                Text2Test
              </span>
            </Link>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            <NavLink to="/" active={isActive("/")}>
              Home
            </NavLink>
            <NavLink to="/about" active={isActive("/about")}>
              About
            </NavLink>
            <NavLink to="/chatbot" active={isActive("/chatbot")}>
              Chatbot
            </NavLink>
            {auth?.user && (
              <>
                <NavLink to="/dashboard" active={isActive("/dashboard")}>
                  Dashboard
                </NavLink>
                <NavLink to="/analytics" active={isActive("/analytics")}>
                  Analytics
                </NavLink>
                <NavLink
                  to="/recommendations"
                  active={isActive("/recommendations")}
                >
                  Recommendations
                </NavLink>
                <NavLink
                  to="/spaced-repetition"
                  active={isActive("/spaced-repetition")}
                >
                  Review
                </NavLink>
                <NavLink to="/export" active={isActive("/export")}>
                  Export
                </NavLink>
                <NavLink to="/search" active={isActive("/search")}>
                  Search
                </NavLink>
              </>
            )}
            {auth?.user?.role === "admin" && (
              <NavLink to="/admin" active={isActive("/admin")}>
                Admin
              </NavLink>
            )}

            <div className="h-6 w-px bg-slate-200 mx-2" />

            {auth?.user ? (
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-500 font-medium">
                  Hi, {auth.user.username}
                </span>
                <button
                  onClick={onLogout}
                  className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-all shadow-sm active:scale-95"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-primary-600 transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 border border-slate-900 rounded-lg hover:bg-slate-800 transition-all shadow-md active:scale-95"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {mobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      <div
        className={`md:hidden transition-all duration-300 overflow-hidden ${mobileMenuOpen ? "max-h-96 opacity-100 border-b border-slate-200 bg-white" : "max-h-0 opacity-0"}`}
      >
        <div className="px-2 pt-2 pb-3 space-y-1">
          <NavLink
            to="/"
            active={isActive("/")}
            onClick={closeMenu}
            className="block"
          >
            Home
          </NavLink>
          <NavLink
            to="/about"
            active={isActive("/about")}
            onClick={closeMenu}
            className="block"
          >
            About
          </NavLink>
          <NavLink
            to="/chatbot"
            active={isActive("/chatbot")}
            onClick={closeMenu}
            className="block"
          >
            Chatbot
          </NavLink>
          {auth?.user && (
            <>
              <NavLink
                to="/dashboard"
                active={isActive("/dashboard")}
                onClick={closeMenu}
                className="block"
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/analytics"
                active={isActive("/analytics")}
                onClick={closeMenu}
                className="block"
              >
                Analytics
              </NavLink>
              <NavLink
                to="/recommendations"
                active={isActive("/recommendations")}
                onClick={closeMenu}
                className="block"
              >
                Recommendations
              </NavLink>
              <NavLink
                to="/spaced-repetition"
                active={isActive("/spaced-repetition")}
                onClick={closeMenu}
                className="block"
              >
                Review
              </NavLink>
              <NavLink
                to="/export"
                active={isActive("/export")}
                onClick={closeMenu}
                className="block"
              >
                Export
              </NavLink>
              <NavLink
                to="/search"
                active={isActive("/search")}
                onClick={closeMenu}
                className="block"
              >
                Search
              </NavLink>
            </>
          )}
          {auth?.user?.role === "admin" && (
            <NavLink
              to="/admin"
              active={isActive("/admin")}
              onClick={closeMenu}
              className="block"
            >
              Admin
            </NavLink>
          )}
          <div className="pt-4 pb-2 border-t border-slate-100">
            {auth?.user ? (
              <button
                onClick={() => {
                  onLogout();
                  closeMenu();
                }}
                className="w-full text-left px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                Logout
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2 px-2">
                <Link
                  to="/login"
                  onClick={closeMenu}
                  className="flex justify-center items-center px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  onClick={closeMenu}
                  className="flex justify-center items-center px-4 py-2 text-sm font-semibold text-white bg-slate-900 border border-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
