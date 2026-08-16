"use client";

import { useCallback, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";

type AttendanceRow = {
  id: string;
  employee_id: string;
  employee_code: string | null;
  full_name: string | null;
  department: string | null;
  attendance_date: string;
  check_in: string | null;
  check_out: string | null;
  status: string | null;
};

type RosterRow = {
  employee_id: string;
  roster_date: string;
  roster_status: string;
  shift_id: string | null;
};

type ShiftRow = {
  id: string;
  code: string;
  name: string;
  start_time: string;
  end_time: string;
};

type EmployeeRow = {
  id: string;
  employee_code?: string | null;
  full_name: string | null;
  department: string | null;
  is_active: boolean;
};

type DetailRow = {
  date: string;
  employee_id: string;
  employee_code: string;
  full_name: string;
  department: string;
  shift: string;
  in_time: string;
  out_time: string;
  working_hours: string;
  ot_hours: string;
  status: string;
};

type DayMark = "P" | "A" | "H" | "L" | "O" | "-"; // Present, Absent, Half, Leave, Off, none

function todayIST(): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const g = (t: string) => p.find((x) => x.type === t)?.value || "";
  return `${g("year")}-${g("month")}-${g("day")}`;
}

function formatTimeIST(iso: string | null) {
  if (!iso) return "";

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function formatDateDisplay(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00+05:30`);

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function hoursBetween(checkIn: string | null, checkOut: string | null): number {
  if (!checkIn || !checkOut) return 0;
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  if (ms <= 0) return 0;
  return Math.round((ms / 3600000) * 10) / 10; // 1 decimal
}

function otHours(worked: number, standard = 8): number {
  if (worked <= standard) return 0;
  return Math.round((worked - standard) * 10) / 10;
}

function statusLabel(
  checkIn: string | null,
  checkOut: string | null,
  rosterStatus?: string
): string {
  if (rosterStatus === "LEAVE") return "Leave";
  if (rosterStatus === "OFF") return "Week Off";
  if (!checkIn) return "Absent";
  if (!checkOut) return "Present";
  const h = hoursBetween(checkIn, checkOut);
  if (h < 4) return "Absent";
  return "Present";
}

function downloadTextFile(filename: string, content: string, mime = "text/csv;charset=utf-8;") {
  const blob = new Blob(["\uFEFF" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const supabase = createClient();

  const [tab, setTab] = useState<"DETAIL" | "CALENDAR">("DETAIL");

  // Detail filters
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(todayIST());

  // Calendar month
  const [calMonth, setCalMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });

  const [detailRows, setDetailRows] = useState<DetailRow[]>([]);
  const [calendarMatrix, setCalendarMatrix] = useState<
  {
    employee_id: string;
    employee_code: string;
    full_name: string;
    department: string;
    days: Record<string, DayMark>;
    totalWorkingHours: number;
    totalOTHours: number;
  }[]
>([]);
  const [calDays, setCalDays] = useState<string[]>([]);

  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ─── Load DETAIL report ────────────────────────────────────────────────────
  const loadDetail = useCallback(async () => {
    if (!fromDate || !toDate || fromDate > toDate) {
      setError("Invalid date range.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const [attRes, rosterRes, shiftRes] = await Promise.all([
        supabase
          .from("attendance")
          .select(
            "id, employee_id, employee_code, full_name, department, attendance_date, check_in, check_out, status"
          )
          .gte("attendance_date", fromDate)
          .lte("attendance_date", toDate),
        supabase
          .from("rosters")
          .select("employee_id, roster_date, roster_status, shift_id")
          .gte("roster_date", fromDate)
          .lte("roster_date", toDate),
        supabase.from("shifts").select("id, code, name, start_time, end_time"),
      ]);

      if (attRes.error) throw attRes.error;

      const attendance = (attRes.data || []) as AttendanceRow[];
      const rosters = (rosterRes.data || []) as RosterRow[];
      const shifts = (shiftRes.data || []) as ShiftRow[];

      const shiftMap = new Map(shifts.map((s) => [s.id, s]));
      const rosterMap = new Map(
        rosters.map((r) => [`${r.employee_id}_${r.roster_date}`, r])
      );

      const built: DetailRow[] = attendance.map((a) => {
        const key = `${a.employee_id}_${a.attendance_date}`;
        const roster = rosterMap.get(key);
        const shift = roster?.shift_id
          ? shiftMap.get(roster.shift_id)
          : null;
        const worked = hoursBetween(a.check_in, a.check_out);
        const status = statusLabel(
          a.check_in,
          a.check_out,
          roster?.roster_status
        );

        return {
          date: a.attendance_date,
          employee_id: a.employee_id,
          employee_code: a.employee_code || "",
          full_name: a.full_name || "",
          department: a.department || "",
          shift: shift
            ? `${shift.code}`
            : roster?.roster_status === "OFF"
              ? "OFF"
              : roster?.roster_status === "LEAVE"
                ? "LEAVE"
                : "",
          in_time: formatTimeIST(a.check_in),
          out_time: formatTimeIST(a.check_out),
          working_hours: worked ? String(worked) : "",
          ot_hours: worked ? String(otHours(worked)) : "",
          status,
        };
      });

      built.sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return a.full_name.localeCompare(b.full_name);
      });

      setDetailRows(built);
    } catch (err: unknown) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load detail report."
      );
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, supabase]);

  // ─── Load CALENDAR (monthly P/A/H/L) ───────────────────────────────────────
  const loadCalendar = useCallback(async () => {
    const [y, m] = calMonth.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const days: string[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      days.push(
        `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      );
    }

    setCalDays(days);

    const from = days[0];
    const to = days[days.length - 1];

    setLoading(true);
    setError("");

    try {
      const [empRes, attRes, rosterRes] = await Promise.all([
        supabase
          .from("employees")
          .select("id, employee_code, full_name, department, is_active")
          .eq("is_active", true)
          .order("full_name"),
        supabase
          .from("attendance")
          .select("employee_id, attendance_date, check_in, check_out")
          .gte("attendance_date", from)
          .lte("attendance_date", to),
        supabase
          .from("rosters")
          .select("employee_id, roster_date, roster_status")
          .gte("roster_date", from)
          .lte("roster_date", to),
      ]);

      if (empRes.error) throw empRes.error;

      const employees = (empRes.data || []) as EmployeeRow[];
      const attendance = (attRes.data || []) as AttendanceRow[];
      const rosters = (rosterRes.data || []) as RosterRow[];

      const attMap = new Map<string, { check_in: string | null; check_out: string | null }>();
      for (const a of attendance) {
        attMap.set(`${a.employee_id}_${a.attendance_date}`, {
          check_in: a.check_in,
          check_out: a.check_out,
        });
      }

      const rosterMap = new Map<string, string>();
      for (const r of rosters) {
        rosterMap.set(`${r.employee_id}_${r.roster_date}`, r.roster_status);
      }

      const matrix = employees.map((emp) => {
        const dayMarks: Record<string, DayMark> = {};
        const today = todayIST();

        for (const day of days) {
          const key = `${emp.id}_${day}`;
          const rosterStatus = rosterMap.get(key);
          const att = attMap.get(key);

          if (day > today) {
            dayMarks[day] = "-";
            continue;
          }

          if (rosterStatus === "LEAVE") {
  dayMarks[day] = "L";
  continue;
}

if (rosterStatus === "OFF") {
  dayMarks[day] = "O";
  continue;
}

if (att?.check_in) {
  const worked = hoursBetween(att.check_in, att.check_out);

  if (!att.check_out) {
    dayMarks[day] = "P";
  } else if (worked >= 4) {
    dayMarks[day] = "P";
  } else {
    dayMarks[day] = "A";
  }

  continue;
}

if (rosterStatus) {
  dayMarks[day] = "A";
  continue;
}

dayMarks[day] = "-";
        }
        let totalWorkingHours = 0;
        let totalOTHours = 0;

        for (const day of days) {
          const att = attMap.get(`${emp.id}_${day}`);

          if (att?.check_in && att?.check_out) {
            const worked = hoursBetween(att.check_in, att.check_out);
            totalWorkingHours += worked;
            totalOTHours += otHours(worked);
          }
        }

        return {
          employee_id: emp.id,
          employee_code: emp.employee_code || "",
          full_name: emp.full_name || "",
          department: emp.department || "",
          days: dayMarks,
          totalWorkingHours: Number(totalWorkingHours.toFixed(1)),
          totalOTHours: Number(totalOTHours.toFixed(1)),
        };
      });

      setCalendarMatrix(matrix);
    } catch (err: unknown) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load calendar."
      );
    } finally {
      setLoading(false);
    }
  }, [calMonth, supabase]);

  function refreshReport() {
    if (tab === "DETAIL") {
      void loadDetail();
      return;
    }

    void loadCalendar();
  }

  // ─── Filters ───────────────────────────────────────────────────────────────
  const departments = useMemo(() => {
    const set = new Set<string>();
    const source =
      tab === "DETAIL"
        ? detailRows.map((r) => r.department)
        : calendarMatrix.map((r) => r.department);
    for (const d of source) if (d) set.add(d);
    return ["ALL", ...Array.from(set).sort()];
  }, [detailRows, calendarMatrix, tab]);

  const filteredDetail = useMemo(() => {
    const q = search.trim().toLowerCase();
    return detailRows.filter((r) => {
      if (department !== "ALL" && r.department !== department) return false;
      if (!q) return true;
      return (
        r.full_name.toLowerCase().includes(q) ||
        r.employee_code.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q)
      );
    });
  }, [detailRows, search, department]);

  const filteredCalendar = useMemo(() => {
    const q = search.trim().toLowerCase();
    return calendarMatrix.filter((r) => {
      if (department !== "ALL" && r.department !== department) return false;
      if (!q) return true;
      return (
        r.full_name.toLowerCase().includes(q) ||
        r.employee_code.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q)
      );
    });
  }, [calendarMatrix, search, department]);

  // ─── Downloads ─────────────────────────────────────────────────────────────
  function downloadDetailCSV() {
    if (!filteredDetail.length) {
      setError("No rows to download.");
      return;
    }
    const headers = [
      "Date",
      "Employee ID",
      "Employee Name",
      "Department",
      "Shift",
      "In Time",
      "Out Time",
      "Working Hours",
      "OT Hours",
      "Status",
    ];
    const lines = filteredDetail.map((r) =>
      [
        formatDateDisplay(r.date),
        r.employee_code,
        `"${r.full_name.replace(/"/g, '""')}"`,
        `"${r.department.replace(/"/g, '""')}"`,
        r.shift,
        r.in_time,
        r.out_time,
        r.working_hours,
        r.ot_hours,
        r.status,
      ].join(",")
    );
    downloadTextFile(
      `attendance-detail_${fromDate}_to_${toDate}.csv`,
      [headers.join(","), ...lines].join("\n")
    );
  }

  function downloadCalendarCSV() {
    if (!filteredCalendar.length) {
      setError("No calendar data to download.");
      return;
    }
    const dayHeaders = calDays.map((d) => String(Number(d.slice(8))));
    const headers = [
      "Employee ID",
      "Employee Name",
      "Department",
      ...dayHeaders,
      "P",
      "A",
      "H",
      "L",
      "O",
    ];

    const lines = filteredCalendar.map((r) => {
      const marks = calDays.map((d) => r.days[d] || "-");
      const counts = { P: 0, A: 0, H: 0, L: 0, O: 0 };
      for (const m of marks) {
        if (m in counts) counts[m as keyof typeof counts] += 1;
      }
      return [
        r.employee_code,
        `"${r.full_name.replace(/"/g, '""')}"`,
        `"${r.department.replace(/"/g, '""')}"`,
        ...marks,
        counts.P,
        counts.A,
        counts.H,
        counts.L,
        counts.O,
      ].join(",");
    });

    downloadTextFile(
      `attendance-calendar_${calMonth}.csv`,
      [headers.join(","), ...lines].join("\n")
    );
  }

  function markColor(m: DayMark) {
    switch (m) {
      case "P":
        return "bg-green-100 text-green-800";
      case "A":
        return "bg-red-100 text-red-700";
      case "H":
        return "bg-amber-100 text-amber-800";
      case "L":
        return "bg-blue-100 text-blue-800";
      case "O":
        return "bg-slate-100 text-slate-500";
      default:
        return "text-slate-300";
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 md:px-6">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">
              Attendance Reports
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Detail register and monthly P / A / H / L calendar
            </p>
          </div>
          <a
            href="/dashboard"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            ← Dashboard
          </a>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-1 rounded-lg border border-slate-200 bg-white p-1 w-fit">
          <button
            type="button"
            onClick={() => {
              setTab("DETAIL");
              queueMicrotask(() => void loadDetail());
            }}
            className={`rounded-md px-4 py-1.5 text-xs font-semibold ${
              tab === "DETAIL"
                ? "bg-slate-800 text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            Detail Report
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("CALENDAR");
              queueMicrotask(() => void loadCalendar());
            }}
            className={`rounded-md px-4 py-1.5 text-xs font-semibold ${
              tab === "CALENDAR"
                ? "bg-slate-800 text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            Monthly Calendar (P/A/H/L)
          </button>
        </div>

        {/* Filters */}
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-end gap-2">
            {tab === "DETAIL" ? (
              <>
                <div>
                  <label className="mb-0.5 block text-[10px] font-semibold text-slate-500">
                    From
                  </label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => {
                      setFromDate(e.target.value);
                      queueMicrotask(() => void loadDetail());
                    }}
                    className="rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] font-semibold text-slate-500">
                    To
                  </label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => {
                      setToDate(e.target.value);
                      queueMicrotask(() => void loadDetail());
                    }}
                    className="rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="mb-0.5 block text-[10px] font-semibold text-slate-500">
                  Month
                </label>
                <input
                  type="month"
                  value={calMonth}
                  onChange={(e) => {
                    setCalMonth(e.target.value);
                    queueMicrotask(() => void loadCalendar());
                  }}
                  className="rounded border border-slate-300 px-2 py-1 text-xs"
                />
              </div>
            )}

            <div>
              <label className="mb-0.5 block text-[10px] font-semibold text-slate-500">
                Department
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="rounded border border-slate-300 px-2 py-1 text-xs"
              >
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d === "ALL" ? "All" : d}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-[140px] flex-1">
              <label className="mb-0.5 block text-[10px] font-semibold text-slate-500">
                Search
              </label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name / ID / Dept"
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </div>

            <button
              type="button"
              onClick={refreshReport}
              disabled={loading}
              className="rounded bg-slate-800 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Load"}
            </button>

            <button
              type="button"
              onClick={() =>
                tab === "DETAIL" ? downloadDetailCSV() : downloadCalendarCSV()
              }
              disabled={loading}
              className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Download CSV
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>

        {/* ── DETAIL TABLE ───────────────────────────────────────────────── */}
        {tab === "DETAIL" && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[11px] leading-tight">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-500">
                    <th className="whitespace-nowrap px-2 py-1.5">Date</th>
                    <th className="whitespace-nowrap px-2 py-1.5">Employee ID</th>
                    <th className="whitespace-nowrap px-2 py-1.5">Employee Name</th>
                    <th className="whitespace-nowrap px-2 py-1.5">Department</th>
                    <th className="whitespace-nowrap px-2 py-1.5">Shift</th>
                    <th className="whitespace-nowrap px-2 py-1.5">In Time</th>
                    <th className="whitespace-nowrap px-2 py-1.5">Out Time</th>
                    <th className="whitespace-nowrap px-2 py-1.5">Working Hours</th>
                    <th className="whitespace-nowrap px-2 py-1.5">OT Hours</th>
                    <th className="whitespace-nowrap px-2 py-1.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="px-3 py-10 text-center text-slate-400">
                        Loading...
                      </td>
                    </tr>
                  ) : filteredDetail.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-3 py-10 text-center text-slate-400">
                        No records
                      </td>
                    </tr>
                  ) : (
                    filteredDetail.map((r, i) => (
                      <tr
                        key={`${r.employee_id}_${r.date}_${i}`}
                        className="border-b border-slate-50 hover:bg-slate-50/70"
                      >
                        <td className="whitespace-nowrap px-2 py-1 text-slate-600">
                          {formatDateDisplay(r.date)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1 font-mono text-slate-600">
                          {r.employee_code || "—"}
                        </td>
                        <td className="max-w-[130px] truncate px-2 py-1 font-medium text-slate-800">
                          {r.full_name || "—"}
                        </td>
                        <td className="max-w-[90px] truncate px-2 py-1 text-slate-500">
                          {r.department || "—"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1 text-slate-600">
                          {r.shift || "—"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1 text-green-700">
                          {r.in_time || "—"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1 text-orange-700">
                          {r.out_time || "—"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1 text-slate-700">
                          {r.working_hours || "—"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1 text-slate-700">
                          {r.ot_hours || "—"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1">
                          <span
                            className={`rounded px-1 py-0.5 text-[9px] font-semibold ${
                              r.status === "Present"
                                ? "bg-green-50 text-green-700"
                                : r.status === "Absent"
                                  ? "bg-red-50 text-red-600"
                                  : r.status === "Half Day"
                                    ? "bg-amber-50 text-amber-700"
                                    : r.status === "Leave"
                                      ? "bg-blue-50 text-blue-700"
                                      : "bg-slate-50 text-slate-500"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── CALENDAR MATRIX ────────────────────────────────────────────── */}
        {tab === "CALENDAR" && (
          <>
            <div className="mb-2 flex flex-wrap gap-3 text-[10px] text-slate-600">
              <span>
                <span className="mr-1 inline-block rounded bg-green-100 px-1 font-bold text-green-800">
                  P
                </span>
                Present
              </span>
              <span>
                <span className="mr-1 inline-block rounded bg-red-100 px-1 font-bold text-red-700">
                  A
                </span>
                Absent
              </span>
              <span>
                <span className="mr-1 inline-block rounded bg-amber-100 px-1 font-bold text-amber-800">
                  H
                </span>
                Half Day
              </span>
              <span>
                <span className="mr-1 inline-block rounded bg-blue-100 px-1 font-bold text-blue-800">
                  L
                </span>
                Leave
              </span>
              <span>
                <span className="mr-1 inline-block rounded bg-slate-100 px-1 font-bold text-slate-500">
                  O
                </span>
                Week Off
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="border-collapse text-[10px] leading-none">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="sticky left-0 z-10 min-w-[70px] border-r border-slate-200 bg-slate-50 px-2 py-1.5 text-left font-semibold text-slate-500">
                        ID
                      </th>
                      <th className="sticky left-[70px] z-10 min-w-[120px] border-r border-slate-200 bg-slate-50 px-2 py-1.5 text-left font-semibold text-slate-500">
                        Name
                      </th>
                      {calDays.map((d) => (
                        <th
                          key={d}
                          className="min-w-[22px] px-0.5 py-1.5 text-center font-semibold text-slate-400"
                        >
                          {Number(d.slice(8))}
                        </th>
                      ))}
                      <th className="px-1 py-1.5 text-center font-semibold text-green-700">
                        P
                      </th>
                      <th className="px-1 py-1.5 text-center font-semibold text-red-600">
                        A
                      </th>
                      <th className="px-1 py-1.5 text-center font-semibold text-amber-700">
                        H
                      </th>
                      <th className="px-1 py-1.5 text-center font-semibold text-blue-700">
                        L
                      </th>
                      <th className="px-1 py-1.5 text-center font-semibold text-slate-700">
  O
</th>

<th className="px-1 py-1.5 text-center font-semibold text-indigo-700">
  WH
</th>

<th className="px-1 py-1.5 text-center font-semibold text-purple-700">
  OT
</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td
                          colSpan={calDays.length + 9}
                          className="px-3 py-10 text-center text-slate-400"
                        >
                          Loading calendar...
                        </td>
                      </tr>
                    ) : filteredCalendar.length === 0 ? (
                      <tr>
                        <td
                          colSpan={calDays.length + 6}
                          className="px-3 py-10 text-center text-slate-400"
                        >
                          No employees
                        </td>
                      </tr>
                    ) : (
                      filteredCalendar.map((r) => {
                        const counts = { P: 0, A: 0, H: 0, L: 0 };
                        for (const d of calDays) {
                          const m = r.days[d];
                          if (m === "P") counts.P++;
                          if (m === "A") counts.A++;
                          if (m === "H") counts.H++;
                          if (m === "L") counts.L++;
                        }
                        return (
                          <tr
                            key={r.employee_id}
                            className="border-b border-slate-50 hover:bg-slate-50/50"
                          >
                            <td className="sticky left-0 z-10 border-r border-slate-100 bg-white px-2 py-0.5 font-mono text-slate-500">
                              {r.employee_code || "—"}
                            </td>
                            <td className="sticky left-[70px] z-10 max-w-[120px] truncate border-r border-slate-100 bg-white px-2 py-0.5 font-medium text-slate-800">
                              {r.full_name || "—"}
                            </td>
                            {calDays.map((d) => {
                              const m = r.days[d] || "-";
                              return (
                                <td
                                  key={d}
                                  className={`px-0.5 py-0.5 text-center font-bold ${markColor(m)}`}
                                >
                                  {m === "-" ? "" : m}
                                </td>
                              );
                            })}
                            <td className="px-1 py-0.5 text-center font-semibold text-green-700">
                              {counts.P}
                            </td>
                            <td className="px-1 py-0.5 text-center font-semibold text-red-600">
                              {counts.A}
                            </td>
                            <td className="px-1 py-0.5 text-center font-semibold text-amber-700">
                              {counts.H}
                            </td>
                            <td className="px-1 py-0.5 text-center font-semibold text-blue-700">
                              {counts.L}
                            </td>
                            <td className="px-1 py-0.5 text-center font-semibold text-slate-600">
  {Object.values(r.days).filter(
    (m) => m === "O"
  ).length}
</td>

<td className="px-1 py-0.5 text-center font-semibold text-indigo-700">
  {r.totalWorkingHours}
</td>

<td className="px-1 py-0.5 text-center font-semibold text-purple-700">
  {r.totalOTHours}
</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}