"use client";

import { useState } from "react";

export default function LoginForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

 async function handleSubmit(
  e: React.FormEvent<HTMLFormElement>
) {
  e.preventDefault();

  setError("");
  setLoading(true);

  const formData = new FormData(e.currentTarget);

  const response = await fetch("/api/login", {
    method: "POST",
    body: JSON.stringify({
      username: formData.get("username"),
      password: formData.get("password"),
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    setError(result.error);
    setLoading(false);
    return;
  }

  window.location.href = "/dashboard";
}

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div>
        <label className="text-sm">
          Username
        </label>

        <input
          name="username"
          type="text"
          className="w-full rounded-md border p-2"
          placeholder="Enter username"
          required
        />
      </div>

      <div>
        <label className="text-sm">
          Password
        </label>

        <input
          name="password"
          type="password"
          className="w-full rounded-md border p-2"
          placeholder="Enter password"
          required
        />
      </div>

      <button
        disabled={loading}
        type="submit"
        className="w-full rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? "Logging in..." : "Login"}
      </button>
    </form>
  );
}