import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

export default function AdminDashboard({ auth }) {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!auth?.user || auth.user.role !== "admin") return;
    setLoading(true);
    Promise.all([axios.get("/admin/stats"), axios.get("/admin/users")])
      .then(([statsRes, usersRes]) => {
        setStats(statsRes.data);
        setUsers(usersRes.data.users || []);
      })
      .catch((e) => {
        setError(e?.response?.data?.error || "Could not load admin data.");
      })
      .finally(() => setLoading(false));
  }, [auth]);

  async function toggleBlock(username, blocked) {
    try {
      await axios.post("/admin/block", { username, blocked });
      setUsers((prev) =>
        prev.map((user) =>
          user.username === username ? { ...user, blocked } : user,
        ),
      );
    } catch (e) {
      setError(e?.response?.data?.error || "Unable to update user status.");
    }
  }

  async function deleteUser(username) {
    if (!window.confirm(`Delete user '${username}'? This cannot be undone.`)) {
      return;
    }
    try {
      await axios.post("/admin/delete", { username });
      setUsers((prev) => prev.filter((user) => user.username !== username));
    } catch (e) {
      setError(e?.response?.data?.error || "Unable to delete user.");
    }
  }

  const StatBox = ({ label, value, icon, color }) => (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${color}`}>
        {icon}
      </div>
      <div className="text-2xl font-black text-slate-900">{value}</div>
      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{label}</div>
    </div>
  );

  if (!auth?.user || auth.user.role !== "admin") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8 bg-white rounded-[3rem] border border-slate-200 shadow-sm animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 bg-red-50 rounded-[2rem] flex items-center justify-center text-red-300 mb-8">
          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        </div>
        <h2 className="text-3xl font-extrabold text-slate-900 mb-4 tracking-tight">Admin Access Only</h2>
        <p className="text-slate-500 text-lg max-w-sm mb-10 leading-relaxed">
          This area is restricted to system administrators. Please sign in with appropriate credentials.
        </p>
        <Link to="/login" className="px-8 py-3 bg-slate-900 text-white font-bold rounded-2xl shadow-xl hover:bg-slate-800 transition-all active:scale-95">Back to Login</Link>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <header>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">System Administration</h1>
        <p className="text-slate-500 text-lg mt-1 font-medium italic">High-level overview and user management control.</p>
      </header>

      {/* Stats Grid */}
      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2 uppercase tracking-tight">
          <span className="w-2 h-2 bg-primary-500 rounded-full" /> System Metrics
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatBox label="Total Users" value={stats?.total_users ?? 0} color="bg-blue-50 text-blue-600" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} />
          <StatBox label="Active" value={stats?.active_users ?? 0} color="bg-emerald-50 text-emerald-600" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
          <StatBox label="Blocked" value={stats?.blocked_users ?? 0} color="bg-red-50 text-red-600" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>} />
          <StatBox label="Docs" value={stats?.documents_processed ?? 0} color="bg-amber-50 text-amber-600" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h4m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} />
          <StatBox label="Questions" value={stats?.questions_generated ?? 0} color="bg-purple-50 text-purple-600" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
          <StatBox label="Words" value={stats?.words_processed ?? 0} color="bg-indigo-50 text-indigo-600" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5a18.022 18.022 0 01-3.827-2.002m0 0A18.022 18.022 0 013.343 5.5m3.878 5a12.11 12.11 0 011.897-6.37M18 12a2 2 0 114 0 2 2 0 01-4 0zm0 0c0 1.103-.306 2.133-.834 3m0 0L13 21l-1.991-2.248M13 21l1.991-2.248" /></svg>} />
        </div>
      </section>

      {/* User Management Section */}
      <section className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">User Directory</h2>
          <span className="bg-slate-100 text-slate-600 px-4 py-1.5 rounded-full text-xs font-bold">{users.length} registered</span>
        </div>
        
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-bold animate-pulse">Retrieving user data...</div>
        ) : error ? (
          <div className="p-8 bg-red-50 text-red-600 font-bold m-8 rounded-2xl text-center border border-red-100">{error}</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {users.map((user) => (
              <div key={user.username} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg ${user.blocked ? "bg-red-50 text-red-500" : "bg-primary-50 text-primary-600"}`}>
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                      {user.username}
                      {user.role === "admin" && <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full uppercase">Admin</span>}
                    </div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{user.blocked ? "Blocked Account" : "Active Member"}</div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleBlock(user.username, !user.blocked)}
                    disabled={user.username === "admin"}
                    className={`px-6 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-30 ${
                      user.blocked 
                        ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" 
                        : "bg-red-50 text-red-600 hover:bg-red-100"
                    }`}
                  >
                    {user.blocked ? "Unblock" : "Block User"}
                  </button>
                  <button
                    onClick={() => deleteUser(user.username)}
                    disabled={user.username === "admin"}
                    className="px-6 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-red-600 transition-all disabled:opacity-30 shadow-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
