"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase";

export default function Home() {
  const supabase = createClient();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    const cleanUsername = username.trim().toLowerCase();

    if (!cleanUsername || !password) {
      setError("Please enter username and password.");
      setLoading(false);
      return;
    }

    const email = `${cleanUsername}@attendance.local`;

    const { data, error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (loginError || !data.user) {
  console.error("Supabase login error:", loginError);

  setError(
    loginError?.message || "Login failed. Please check the credentials."
  );

  setLoading(false);
  return;
}

    const { data: profile, error: profileError } = await supabase
      .from("staff_profiles")
      .select("username, full_name, role, first_login, is_active")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile) {
      await supabase.auth.signOut();
      setError("Staff profile not found.");
      setLoading(false);
      return;
    }

    if (!profile.is_active) {
      await supabase.auth.signOut();
      setError("Your account is inactive. Please contact the administrator.");
      setLoading(false);
      return;
    }

    if (profile.first_login) {
      window.location.href = "/change-password";
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800">
            Attendance Portal
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Internal Staff Access
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8">

          <h2 className="text-xl font-semibold text-slate-800">
            Sign in
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Enter your staff credentials to continue.
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-5">

            {/* Username */}
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                Username
              </label>

              <input
                id="username"
                name="username"
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter username"
                autoComplete="username"
                disabled={loading}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                Password
              </label>

              <input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                disabled={loading}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Login */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-slate-800 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>

          </form>

          {/* Forgot Password */}
          <div className="mt-5 text-center">
            <button
              type="button"
              className="text-sm text-slate-600 hover:text-slate-900 hover:underline"
            >
              Forgot Password?
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-slate-400">
          Internal Use Only
        </p>

      </div>
    </main>
  );
}