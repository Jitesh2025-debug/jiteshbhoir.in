"use client";

import Link from "next/link";
import MainMenu from "@/components/MainMenu";


export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8">
      <MainMenu />
      <div className="mx-auto max-w-6xl">

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800">
            Settings
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage attendance portal configuration.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">

          {/* Shift Setup */}
          <Link
            href="/settings/shifts"
            className="group rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-2xl">
              🕐
            </div>

            <h2 className="text-lg font-semibold text-slate-800 group-hover:text-slate-600">
              Shift Setup
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Create and manage employee shifts, timings, overnight shifts
              and grace periods.
            </p>

            <div className="mt-4 text-sm font-medium text-slate-700">
              Manage Shifts →
            </div>
          </Link>

          {/* Attendance Rules */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-2xl">
              ⚙️
            </div>

            <h2 className="text-lg font-semibold text-slate-800">
              Attendance Rules
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Manage attendance rules, mispunch handling and other attendance
              settings.
            </p>

            <div className="mt-4 text-sm font-medium text-slate-400">
              Coming next
            </div>
          </div>

          {/* Leave Setup */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-2xl">
              📅
            </div>

            <h2 className="text-lg font-semibold text-slate-800">
              Leave Setup
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Configure leave types and leave-related settings.
            </p>

            <div className="mt-4 text-sm font-medium text-slate-400">
              Coming next
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}