"use client";

import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";

type Employee = {
  id: string;
  employee_code: string;
  barcode: string;
  full_name: string;
  department: string | null;
  designation: string | null;
  employment_type: "BLUE_COLLAR" | "ASSOCIATE";
  is_active: boolean;
};

type Shift = {
  id?: string;
  name: string;
  start_time: string;
  end_time: string;
  grace_minutes?: number | null;
};

type RosterRow = {
  id: string;
  employee_id: string;
  roster_date: string;
  roster_status: string;
  shift_id: string | null;
  shift?: Shift | null;
};

type ExistingAttendance = {
  id: string;
  check_in: string | null;
  check_out: string | null;
} | null;

type ScanResult = {
  type: "success" | "error" | "warning";
  title: string;
  message: string;
  employee?: Employee;
  time?: string;
  warnings?: string[];
};

type PendingScan = {
  employee: Employee;
  roster: RosterRow | null;
  warnings: string[];
  nowIso: string;
  today: string;
  existing: ExistingAttendance;
};

const LATE_GRACE_MINUTES = 15;

// ─── IST helpers ─────────────────────────────────────────────────────────────

function getISTParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });

  const parts = formatter.formatToParts(date);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value || "";

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
    weekday: get("weekday"),
  };
}

function todayIST(): string {
  const p = getISTParts();
  return `${p.year}-${p.month}-${p.day}`;
}

function formatIST(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function formatISTTimeOnly(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function nowMinutesIST(): number {
  const p = getISTParts();
  return parseInt(p.hour, 10) * 60 + parseInt(p.minute, 10);
}

function timeStringToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

function minutesToHHMM(mins: number): string {
  const normalized = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}

function nowIST(): string {
  const p = getISTParts();
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+05:30`;
}

// ─── Inner component that uses useSearchParams ───────────────────────────────

function ScanContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const typeParam = searchParams.get("type");
  const mode: "checkin" | "checkout" =
    typeParam === "checkout" ? "checkout" : "checkin";

  const [barcode, setBarcode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [recentScans, setRecentScans] = useState<ScanResult[]>([]);
  const [pending, setPending] = useState<PendingScan | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [liveClock, setLiveClock] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function tick() {
      setLiveClock(formatIST(new Date()));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, [result, scanning, pending]);

  useEffect(() => {
    function onFocus() {
      inputRef.current?.focus();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  function pushResult(res: ScanResult) {
    setResult(res);
    setRecentScans((prev) => [res, ...prev].slice(0, 12));
  }

  async function processBarcode(code: string) {
    setScanning(true);
    setResult(null);
    setPending(null);

    try {
      const { data: employee, error: empError } = await supabase
        .from("employees")
        .select(
          `
          id,
          employee_code,
          barcode,
          full_name,
          department,
          designation,
          employment_type,
          is_active
        `
        )
        .eq("barcode", code)
        .maybeSingle();

      if (empError) throw empError;

      if (!employee) {
        pushResult({
          type: "error",
          title: "Employee not found",
          message: `No employee found with barcode: ${code}`,
        });
        return;
      }

      if (!employee.is_active) {
        pushResult({
          type: "error",
          title: "Employee inactive",
          message: `${employee.full_name} (${employee.employee_code}) is deactivated.`,
          employee,
        });
        return;
      }

      const today = todayIST();
      const nowIso = nowIST();

      const { data: existing, error: attError } = await supabase
        .from("attendance")
        .select(
          `
          id,
          employee_id,
          attendance_date,
          check_in,
          check_out
        `
        )
        .eq("employee_id", employee.id)
        .eq("attendance_date", today)
        .maybeSingle();

      if (attError) throw attError;

      const { data: rosterData, error: rosterError } = await supabase
        .from("rosters")
        .select(
          `
          id,
          employee_id,
          roster_date,
          roster_status,
          shift_id
        `
        )
        .eq("employee_id", employee.id)
        .eq("roster_date", today)
        .maybeSingle();

      if (rosterError) console.warn("Roster fetch error:", rosterError);

      const roster = rosterData as RosterRow | null;
      let shift: Shift | null = null;

      if (roster?.shift_id) {
        const { data: shiftData, error: shiftError } = await supabase
          .from("shifts")
          .select("id, name, start_time, end_time, grace_minutes")
          .eq("id", roster.shift_id)
          .maybeSingle();

        if (shiftError) console.warn("Shift fetch error:", shiftError);
        shift = (shiftData as Shift | null) ?? null;
        if (roster) roster.shift = shift;
      }

      const warnings: string[] = [];

      if (roster?.roster_status === "OFF") {
        warnings.push(
          "This employee is marked as WEEK OFF today. Attendance will still be recorded."
        );
      }

      if (
        mode === "checkin" &&
        shift?.start_time &&
        roster?.roster_status !== "OFF"
      ) {
        const shiftStartMins = timeStringToMinutes(shift.start_time);
        const nowMins = nowMinutesIST();
        const grace = shift.grace_minutes ?? LATE_GRACE_MINUTES;
        const lateBy = nowMins - (shiftStartMins + grace);

        if (lateBy > 0) {
          const lateMinutes = nowMins - shiftStartMins;
          warnings.push(
            `Late by ${lateMinutes} minutes. Shift starts at ${minutesToHHMM(
              shiftStartMins
            )} (grace ${grace} min).`
          );
        }
      }

      if (!roster) {
        warnings.push(
          "No roster found for today. Shift details are not available."
        );
      }

      if (
        roster &&
        roster.roster_status !== "OFF" &&
        !shift?.start_time &&
        mode === "checkin"
      ) {
        warnings.push("Shift timing is not set in roster for today.");
      }

      if (mode === "checkin" && existing?.check_in) {
        pushResult({
          type: "warning",
          title: "Already checked in",
          message: `${employee.full_name} already checked in at ${formatISTTimeOnly(
            existing.check_in
          )} (IST).`,
          employee,
          time: existing.check_in,
          warnings,
        });
        return;
      }

      if (mode === "checkout") {
        if (!existing?.check_in) {
          pushResult({
            type: "error",
            title: "No check-in found",
            message: `${employee.full_name} has not checked in today. Cannot check out.`,
            employee,
            warnings,
          });
          return;
        }

        if (existing.check_out) {
          pushResult({
            type: "warning",
            title: "Already checked out",
            message: `${employee.full_name} already checked out at ${formatISTTimeOnly(
              existing.check_out
            )} (IST).`,
            employee,
            time: existing.check_out,
            warnings,
          });
          return;
        }
      }

      if (warnings.length > 0) {
        setPending({
          employee,
          roster,
          warnings,
          nowIso,
          today,
          existing: existing
            ? {
                id: existing.id,
                check_in: existing.check_in,
                check_out: existing.check_out,
              }
            : null,
        });
        return;
      }

      await saveAttendance({
        employee,
        nowIso,
        today,
        existing: existing
          ? {
              id: existing.id,
              check_in: existing.check_in,
              check_out: existing.check_out,
            }
          : null,
        warnings: [],
      });
    } catch (err: unknown) {
      console.error("Scan error:", err);
      const error = err as {
        message?: string;
        details?: string;
        hint?: string;
        code?: string;
      };

      pushResult({
        type: "error",
        title: "Something went wrong",
        message:
          error.message ||
          error.details ||
          error.hint ||
          "Unable to mark attendance. Please try again.",
      });
    } finally {
      setScanning(false);
      setBarcode("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  async function saveAttendance(opts: {
    employee: Employee;
    nowIso: string;
    today: string;
    existing: ExistingAttendance;
    warnings: string[];
  }) {
    const { employee, nowIso, today, existing, warnings } = opts;

    if (mode === "checkin") {
      if (existing) {
        const { error } = await supabase
          .from("attendance")
          .update({
            check_in: nowIso,
            updated_at: nowIso,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("attendance").insert({
          employee_id: employee.id,
          employee_code: employee.employee_code,
          barcode: employee.barcode,
          full_name: employee.full_name,
          department: employee.department,
          attendance_date: today,
          check_in: nowIso,
          check_out: null,
          status: "PRESENT",
        });
        if (error) throw error;
      }

      pushResult({
        type: "success",
        title: "Check-in successful",
        message: `${employee.full_name} checked in at ${formatISTTimeOnly(
          nowIso
        )} (IST).`,
        employee,
        time: nowIso,
        warnings,
      });
      return;
    }

    if (mode === "checkout") {
      if (!existing) throw new Error("Missing attendance row for checkout");

      const { error } = await supabase
        .from("attendance")
        .update({
          check_out: nowIso,
          updated_at: nowIso,
        })
        .eq("id", existing.id);

      if (error) throw error;

      pushResult({
        type: "success",
        title: "Check-out successful",
        message: `${employee.full_name} checked out at ${formatISTTimeOnly(
          nowIso
        )} (IST).`,
        employee,
        time: nowIso,
        warnings,
      });
    }
  }

  async function confirmPending() {
    if (!pending) return;
    setConfirming(true);

    try {
      await saveAttendance({
        employee: pending.employee,
        nowIso: pending.nowIso,
        today: pending.today,
        existing: pending.existing,
        warnings: pending.warnings,
      });
      setPending(null);
    } catch (err: unknown) {
      console.error("Confirm error:", err);
      const error = err as { message?: string; details?: string; hint?: string };
      pushResult({
        type: "error",
        title: "Something went wrong",
        message:
          error.message ||
          error.details ||
          error.hint ||
          "Unable to mark attendance. Please try again.",
      });
    } finally {
      setConfirming(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function cancelPending() {
    setPending(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function handleScan(event?: FormEvent) {
    event?.preventDefault();
    const code = barcode.trim();
    if (!code || scanning || pending) return;
    await processBarcode(code);
  }

  const isCheckIn = mode === "checkin";
  const pendingShift = pending?.roster?.shift ?? null;

  return (
    <main className="min-h-screen bg-slate-100">
      <header
        className={`border-b px-4 py-4 sm:px-6 ${
          isCheckIn
            ? "border-green-200 bg-green-50"
            : "border-orange-200 bg-orange-50"
        }`}
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Mark Attendance · Indian Time (IST)
            </p>
            <h1
              className={`mt-0.5 text-xl font-bold ${
                isCheckIn ? "text-green-800" : "text-orange-800"
              }`}
            >
              {isCheckIn ? "Check In" : "Check Out"}
            </h1>
            <p className="mt-1 font-mono text-sm text-slate-600">{liveClock}</p>
          </div>
          <a
            href="/dashboard"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            ← Back to Dashboard
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 text-center">
            <div
              className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full ${
                isCheckIn
                  ? "bg-green-100 text-green-600"
                  : "bg-orange-100 text-orange-600"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-800">
              Scan employee barcode
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Point the scanner or type barcode and press Enter
            </p>
          </div>

          <form onSubmit={handleScan}>
            <input
              ref={inputRef}
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              disabled={scanning || !!pending}
              autoComplete="off"
              autoFocus
              placeholder="Scan or enter barcode..."
              className={`w-full rounded-xl border-2 px-4 py-4 text-center font-mono text-lg outline-none transition focus:ring-4 disabled:bg-slate-100 ${
                isCheckIn
                  ? "border-green-300 focus:border-green-500 focus:ring-green-100"
                  : "border-orange-300 focus:border-orange-500 focus:ring-orange-100"
              }`}
            />
            <button
              type="submit"
              disabled={scanning || !!pending || !barcode.trim()}
              className={`mt-4 w-full rounded-xl py-3.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                isCheckIn
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-orange-600 hover:bg-orange-700"
              }`}
            >
              {scanning
                ? "Processing..."
                : isCheckIn
                  ? "Mark Check In"
                  : "Mark Check Out"}
            </button>
          </form>
        </div>

        {result && (
          <div
            className={`mt-5 rounded-2xl border p-5 ${
              result.type === "success"
                ? "border-green-200 bg-green-50"
                : result.type === "warning"
                  ? "border-amber-200 bg-amber-50"
                  : "border-red-200 bg-red-50"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ${
                  result.type === "success"
                    ? "bg-green-500"
                    : result.type === "warning"
                      ? "bg-amber-500"
                      : "bg-red-500"
                }`}
              >
                {result.type === "success"
                  ? "✓"
                  : result.type === "warning"
                    ? "!"
                    : "×"}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-base font-semibold ${
                    result.type === "success"
                      ? "text-green-800"
                      : result.type === "warning"
                        ? "text-amber-800"
                        : "text-red-800"
                  }`}
                >
                  {result.title}
                </p>
                <p
                  className={`mt-0.5 text-sm ${
                    result.type === "success"
                      ? "text-green-700"
                      : result.type === "warning"
                        ? "text-amber-700"
                        : "text-red-700"
                  }`}
                >
                  {result.message}
                </p>

                {result.employee && (
                  <div className="mt-3 rounded-lg bg-white/80 px-3 py-2 text-sm">
                    <p className="font-medium text-slate-800">
                      {result.employee.full_name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {result.employee.employee_code}
                      {result.employee.department
                        ? ` · ${result.employee.department}`
                        : ""}
                      {result.employee.designation
                        ? ` · ${result.employee.designation}`
                        : ""}
                    </p>
                    {result.time && (
                      <p className="mt-1 text-xs font-medium text-slate-600">
                        Time (IST): {formatIST(result.time)}
                      </p>
                    )}
                  </div>
                )}

                {result.warnings && result.warnings.length > 0 && (
                  <ul className="mt-3 space-y-1 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-800">
                    {result.warnings.map((w, i) => (
                      <li key={i}>• {w}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {recentScans.length > 0 && (
          <div className="mt-8">
            <h3 className="mb-3 text-sm font-semibold text-slate-600">
              Recent scans (this session)
            </h3>
            <div className="space-y-2">
              {recentScans.map((scan, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">
                      {scan.employee?.full_name || scan.title}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {scan.message}
                    </p>
                  </div>
                  <div className="ml-3 shrink-0 text-right">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        scan.type === "success"
                          ? "bg-green-100 text-green-700"
                          : scan.type === "warning"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                      }`}
                    >
                      {scan.type}
                    </span>
                    {scan.time && (
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {formatISTTimeOnly(scan.time)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {pending && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-amber-200 bg-amber-50 px-5 py-4">
              <h2 className="text-lg font-semibold text-amber-900">
                Attendance Warning
              </h2>
              <p className="mt-0.5 text-xs text-amber-700">
                Please review before confirming
              </p>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-xl bg-slate-50 px-4 py-3">
                <p className="font-semibold text-slate-800">
                  {pending.employee.full_name}
                </p>
                <p className="text-xs text-slate-500">
                  {pending.employee.employee_code}
                  {pending.employee.department
                    ? ` · ${pending.employee.department}`
                    : ""}
                </p>

                {pending.roster && (
                  <div className="mt-2 text-xs text-slate-600">
                    <p>
                      Shift:{" "}
                      <span className="font-medium">
                        {pendingShift?.name || "—"}
                      </span>
                    </p>
                    {pendingShift?.start_time && (
                      <p className="mt-1">
                        Timing:{" "}
                        <span className="font-medium">
                          {minutesToHHMM(
                            timeStringToMinutes(pendingShift.start_time)
                          )}
                        </span>
                        {" - "}
                        <span className="font-medium">
                          {minutesToHHMM(
                            timeStringToMinutes(pendingShift.end_time)
                          )}
                        </span>
                      </p>
                    )}
                    {pending.roster.roster_status === "OFF" && (
                      <span className="mt-2 inline-block rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                        WEEK OFF
                      </span>
                    )}
                  </div>
                )}

                <p className="mt-2 text-xs text-slate-500">
                  Current time (IST): {formatIST(pending.nowIso)}
                </p>
              </div>

              <div className="space-y-2">
                {pending.warnings.map((w, i) => (
                  <div
                    key={i}
                    className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900"
                  >
                    <span className="mt-0.5 font-bold">!</span>
                    <span>{w}</span>
                  </div>
                ))}
              </div>

              <p className="text-center text-xs text-slate-500">
                Do you still want to mark{" "}
                <strong>{isCheckIn ? "Check In" : "Check Out"}</strong>?
              </p>
            </div>

            <div className="flex gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
              <button
                type="button"
                disabled={confirming}
                onClick={cancelPending}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirming}
                onClick={confirmPending}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
                  isCheckIn
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-orange-600 hover:bg-orange-700"
                }`}
              >
                {confirming
                  ? "Saving..."
                  : isCheckIn
                    ? "Confirm Check In"
                    : "Confirm Check Out"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ─── Page (wraps with Suspense) ──────────────────────────────────────────────

export default function AttendanceScanPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-100">
          <div className="text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-green-600"></div>
            <p className="text-slate-600">Loading scanner...</p>
          </div>
        </div>
      }
    >
      <ScanContent />
    </Suspense>
  );
}