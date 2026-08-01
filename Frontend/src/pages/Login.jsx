import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Megaphone, Lock, Mail, Loader2, ArrowRight } from "lucide-react";
import api from "../utils/api";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@campaignflow.com");
  const [password, setPassword] = useState("adminpassword");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await api.post("/auth/login", { email, password });
      api.setToken(data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      navigate("/");
    } catch (err) {
      setError(err.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-800 flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Ambient glowing blurs */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-violet-200/50 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-200/40 blur-[130px] pointer-events-none" />
      <div className="absolute top-[35%] right-[15%] w-[40%] h-[40%] rounded-full bg-purple-200/30 blur-[110px] pointer-events-none" />

      {/* Main card with glassmorphism */}
      <div className="w-full max-w-md bg-white/70 backdrop-blur-md border border-white/40 p-8 rounded-3xl shadow-xl relative z-10 transition-all duration-300">
        {/* Header Branding */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="bg-violet-600 p-3.5 rounded-2xl text-white shadow-xl shadow-violet-650/20 mb-4 animate-bounce">
            <Megaphone className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Welcome Back
          </h1>
          <p className="text-xs text-slate-500 mt-2 font-medium">
            Log in to manage your campaigns and responses
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 text-xs rounded-2xl flex items-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-650 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@campaignflow.com"
                className="w-full text-sm pl-11 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-805 focus:outline-none focus:border-violet-500 focus:bg-white placeholder-slate-400 transition-all duration-200"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-650 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-sm pl-11 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-805 focus:outline-none focus:border-violet-500 focus:bg-white placeholder-slate-400 transition-all duration-200"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold py-3 rounded-2xl shadow-xl shadow-violet-600/10 hover:shadow-violet-650/25 active:scale-98 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group text-sm"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <span>Access Dashboard</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </>
            )}
          </button>
        </form>

        {/* Demo instructions */}
        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400 font-medium">
            Demo Credentials:
          </p>
          <p className="text-[11px] text-slate-500 mt-1 font-semibold">
            admin@campaignflow.com / adminpassword
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
