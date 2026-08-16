"use client";

import Link from "next/link";

export default function MainMenu() {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">

      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
      >
        ← Main Menu
      </Link>

    </div>
  );
}