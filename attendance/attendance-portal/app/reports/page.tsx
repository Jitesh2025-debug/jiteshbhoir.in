"use client";

import { useCallback, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";

/* ───────────────── Types ───────────────── */

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
  is_overnight?: boolean | null;
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

type DayMark = "P" | "A" | "H" | "L" | "O" | "-";

const OT_GRACE_MINUTES = 30;
const STANDARD_HOURS = 8;

/* ───────────────── IST / period helpers ───────────────── */

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

/** Payroll cycle: 26 previous month → 25 current (or 26 current → 25 next if day >= 26) */
function payrollPeriodFromRef(refYmd: string): { from: string; to: string; label: string } {
  const [y, m, d] = refYmd.split("-").map(Number);

  let fromY = y;
  let fromM = m;
  let toY = y;
  let toM = m;

  if (d >= 26) {
    // 26 this month → 25 next month
    fromY = y;
    fromM = m;
    toM = m + 1;
    toY = y;
    if (toM > 12) {
      toM = 1;
      toY = y + 1;
    }
  } else {
    // 26 previous month → 25 this month
    toY = y;
    toM = m;
    fromM = m - 1;
    fromY = y;
    if (fromM < 1) {
      fromM = 12;
      fromY = y - 1;
    }
  }

  const from = `${fromY}-${String(fromM).padStart(2, "0")}-26`;
  const to = `${toY}-${String(toM).padStart(2, "0")}-25`;
  return { from, to, label: `${from} → ${to}` };
}

/** Days from 26→25 for a cycle identified by the month of the 25th (YYYY-MM of end month) */
function payrollDaysForEndMonth(endMonth: string): string[] {
  // endMonth = YYYY-MM of the month that contains day 25
  const [ey, em] = endMonth.split("-").map(Number);
  let fromY = ey;
  let fromM = em - 1;
  if (fromM < 1) {
    fromM = 12;
    fromY = ey - 1;
  }
  const from = `${fromY}-${String(fromM).padStart(2, "0")}-26`;
  const to = `${ey}-${String(em).padStart(2, "0")}-25`;

  const days: string[] = [];
  let cur = from;
  while (cur <= to) {
    days.push(cur);
    const dt = new Date(`${cur}T12:00:00+05:30`);
    dt.setDate(dt.getDate() + 1);
    cur = dt.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  }
  return days;
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
  return Math.round((ms / 3_600_000) * 10) / 10;
}

/** OT: checkout required; only if > 30 min after shift end; value = full minutes after end (in hours, 1 decimal) */
function calcOtHours(
  checkOutIso: string | null,
  shiftEndHHMM: string | null | undefined,
  attendanceDate: string,
  isOvernight = false
): number {
  if (!checkOutIso || !shiftEndHHMM) return 0;

  const endTime = shiftEndHHMM.slice(0, 5);
  let endDate = attendanceDate;
  if (isOvernight) {
    const d = new Date(`${attendanceDate}T12:00:00+05:30`);
    d.setDate(d.getDate() + 1);
    endDate = d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  }

  const shiftEnd = new Date(`${endDate}T${endTime}:00+05:30`);
  const checkOut = new Date(checkOutIso);
  const diffMin = Math.floor((checkOut.getTime() - shiftEnd.getTime()) / 60_000);

  if (diffMin <= OT_GRACE_MINUTES) return 0;
  return Math.round((diffMin / 60) * 10) / 10;
}

function resolveStatus(opts: {
  attStatus: string | null | undefined;
  checkIn: string | null;
  checkOut: string | null;
  rosterStatus?: string;
}): string {
  const { attStatus, checkIn, checkOut, rosterStatus } = opts;

  if (attStatus === "ABSENT") return "Absent";
  if (attStatus === "HALF_DAY") return "Half Day";
  if (attStatus === "LEAVE" || rosterStatus === "LEAVE") return "Leave";
  if (rosterStatus === "OFF") return "Week Off";

  if (!checkIn) {
    if (rosterStatus === "SHIFT") return "Absent";
    return "Absent";
  }

  if (!checkOut) return "Present"; // still working / open

  const h = hoursBetween(checkIn, checkOut);
  if (h > 0 && h < 4) return "Half Day";
  return "Present";
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob(["\uFEFF" + content], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ───────────────── Page ───────────────── */

export default function ReportsPage() {
  const supabase = createClient();
  const today = todayIST();
  const defaultPeriod = payrollPeriodFromRef(today);

  const [tab, setTab] = useState<"DETAIL" | "CALENDAR">("DETAIL");

  const [fromDate, setFromDate] = useState(defaultPeriod.from);
  const [toDate, setToDate] = useState(defaultPeriod.to);

  /** Calendar uses end-month of payroll cycle (month of the 25th) */
  const [calEndMonth, setCalEndMonth] = useState(() =>
    defaultPeriod.to.slice(0, 7)
  );

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

  /* ── DETAIL ── */
  const loadDetail = useCallback(async () => {
    if (!fromDate || !toDate || fromDate > toDate) {
      setError("Invalid date range.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const [attRes, rosterRes, shiftRes, empRes] = await Promise.all([
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
        supabase
          .from("shifts")
          .select("id, code, name, start_time, end_time, is_overnight"),
        supabase
          .from("employees")
          .select("id, employee_code, full_name, department, is_active")
          .eq("is_active", true),
      ]);

      if (attRes.error) throw attRes.error;

      const attendance = (attRes.data || []) as AttendanceRow[];
      const rosters = (rosterRes.data || []) as RosterRow[];
      const shifts = (shiftRes.data || []) as ShiftRow[];
      const employees = (empRes.data || []) as EmployeeRow[];

      const empMap = new Map(employees.map((e) => [e.id, e]));
      const shiftMap = new Map(shifts.map((s) => [s.id, s]));
      const rosterMap = new Map(
        rosters.map((r) => [`${r.employee_id}_${r.roster_date}`, r])
      );
      const attKeySet = new Set(
        attendance.map((a) => `${a.employee_id}_${a.attendance_date}`)
      );

      const built: DetailRow[] = [];

      // From attendance rows
      for (const a of attendance) {
        const key = `${a.employee_id}_${a.attendance_date}`;
        const roster = rosterMap.get(key);
        const shift = roster?.shift_id ? shiftMap.get(roster.shift_id) : null;
        const emp = empMap.get(a.employee_id);

        const worked = hoursBetween(a.check_in, a.check_out);
        const ot = calcOtHours(
          a.check_out,
          shift?.end_time,
          a.attendance_date,
          !!shift?.is_overnight
        );
        const status = resolveStatus({
          attStatus: a.status,
          checkIn: a.check_in,
          checkOut: a.check_out,
          rosterStatus: roster?.roster_status,
        });

        built.push({
          date: a.attendance_date,
          employee_id: a.employee_id,
          employee_code: a.employee_code || emp?.employee_code || "",
          full_name: a.full_name || emp?.full_name || "",
          department: a.department || emp?.department || "",
          shift: shift
            ? shift.code
            : roster?.roster_status === "OFF"
              ? "OFF"
              : roster?.roster_status === "LEAVE"
                ? "LEAVE"
                : "",
          in_time: formatTimeIST(a.check_in),
          out_time: formatTimeIST(a.check_out),
          working_hours: worked ? String(worked) : "",
          ot_hours: ot ? String(ot) : "",
          status,
        });
      }

      // Roster SHIFT / OFF / LEAVE with no attendance row
      for (const r of rosters) {
        const key = `${r.employee_id}_${r.roster_date}`;
        if (attKeySet.has(key)) continue;

        const emp = empMap.get(r.employee_id);
        if (!emp) continue;
        const shift = r.shift_id ? shiftMap.get(r.shift_id) : null;

        let status = "Absent";
        let shiftLabel = shift?.code || "";
        if (r.roster_status === "OFF") {
          status = "Week Off";
          shiftLabel = "OFF";
        } else if (r.roster_status === "LEAVE") {
          status = "Leave";
          shiftLabel = "LEAVE";
        }

        built.push({
          date: r.roster_date,
          employee_id: r.employee_id,
          employee_code: emp.employee_code || "",
          full_name: emp.full_name || "",
          department: emp.department || "",
          shift: shiftLabel,
          in_time: "",
          out_time: "",
          working_hours: "",
          ot_hours: "",
          status,
        });
      }

      built.sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return a.full_name.localeCompare(b.full_name);
      });

      setDetailRows(built);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load detail.");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, supabase]);

  /* ── CALENDAR (26→25) ── */
  const loadCalendar = useCallback(async () => {
    const days = payrollDaysForEndMonth(calEndMonth);
    setCalDays(days);
    if (!days.length) return;

    const from = days[0];
    const to = days[days.length - 1];

    setLoading(true);
    setError("");

    try {
      const [empRes, attRes, rosterRes, shiftRes] = await Promise.all([
        supabase
          .from("employees")
          .select("id, employee_code, full_name, department, is_active")
          .eq("is_active", true)
          .order("full_name"),
        supabase
          .from("attendance")
          .select(
            "employee_id, attendance_date, check_in, check_out, status"
          )
          .gte("attendance_date", from)
          .lte("attendance_date", to),
        supabase
          .from("rosters")
          .select("employee_id, roster_date, roster_status, shift_id")
          .gte("roster_date", from)
          .lte("roster_date", to),
        supabase
          .from("shifts")
          .select("id, code, name, start_time, end_time, is_overnight"),
      ]);

      if (empRes.error) throw empRes.error;

      const employees = (empRes.data || []) as EmployeeRow[];
      const attendance = (attRes.data || []) as AttendanceRow[];
      const rosters = (rosterRes.data || []) as RosterRow[];
      const shifts = (shiftRes.data || []) as ShiftRow[];
      const shiftMap = new Map(shifts.map((s) => [s.id, s]));

      const attMap = new Map<
        string,
        {
          check_in: string | null;
          check_out: string | null;
          status: string | null;
        }
      >();
      for (const a of attendance) {
        attMap.set(`${a.employee_id}_${a.attendance_date}`, {
          check_in: a.check_in,
          check_out: a.check_out,
          status: a.status,
        });
      }

      const rosterMap = new Map<string, RosterRow>();
      for (const r of rosters) {
        rosterMap.set(`${r.employee_id}_${r.roster_date}`, r);
      }

      const matrix = employees.map((emp) => {
        const dayMarks: Record<string, DayMark> = {};
        let totalWorkingHours = 0;
        let totalOTHours = 0;

        for (const day of days) {
          const key = `${emp.id}_${day}`;
          const roster = rosterMap.get(key);
          const rosterStatus = roster?.roster_status;
          const att = attMap.get(key);
          const shift = roster?.shift_id
            ? shiftMap.get(roster.shift_id)
            : null;

          if (day > today) {
            dayMarks[day] = "-";
            continue;
          }

          if (att?.status === "ABSENT") {
            dayMarks[day] = "A";
            continue;
          }
          if (att?.status === "HALF_DAY") {
            dayMarks[day] = "H";
            continue;
          }
          if (rosterStatus === "LEAVE" || att?.status === "LEAVE") {
            dayMarks[day] = "L";
            continue;
          }
          if (rosterStatus === "OFF") {
            dayMarks[day] = "O";
            continue;
          }

          if (att?.check_in) {
            const worked = hoursBetween(att.check_in, att.check_out);
            if (att.check_out) {
              totalWorkingHours += worked;
              totalOTHours += calcOtHours(
                att.check_out,
                shift?.end_time,
                day,
                !!shift?.is_overnight
              );
              dayMarks[day] = worked > 0 && worked < 4 ? "H" : "P";
            } else {
              dayMarks[day] = "P";
            }
            continue;
          }

          if (rosterStatus === "SHIFT") {
            dayMarks[day] = "A";
            continue;
          }

          dayMarks[day] = "-";
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
      setError(err instanceof Error ? err.message : "Failed to load calendar.");
    } finally {
      setLoading(false);
    }
  }, [calEndMonth, supabase, today]);

  function refreshReport() {
    if (tab === "DETAIL") void loadDetail();
    else void loadCalendar();
  }

  function applyCurrentPayrollCycle() {
    const p = payrollPeriodFromRef(todayIST());
    setFromDate(p.from);
    setToDate(p.to);
    setCalEndMonth(p.to.slice(0, 7));
  }

  /* ── Filters ── */
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

  /* ── CSV ── */
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
    const dayHeaders = calDays.map((d) => d.slice(8));
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
      "WH",
      "OT",
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
        r.totalWorkingHours,
        r.totalOTHours,
      ].join(",");
    });
    downloadTextFile(
      `attendance-calendar_${calDays[0]}_to_${calDays[calDays.length - 1]}.csv`,
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

  const cycleLabel =
    tab === "DETAIL"
      ? `${fromDate} → ${toDate}`
      : calDays.length
        ? `${calDays[0]} → ${calDays[calDays.length - 1]}`
        : "";

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 md:px-6">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">
              Attendance Reports
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Cycle 26→25 · OT only if checkout &amp; &gt;30 min after shift end
              {cycleLabel ? ` · ${cycleLabel}` : ""}
            </p>
          </div>
          <a
            href="/dashboard"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            ← Dashboard
          </a>
        </div>

        <div className="mb-4 flex gap-1 w-fit rounded-lg border border-slate-200 bg-white p-1">
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
            Monthly Calendar (26→25)
          </button>
        </div>

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
                    onChange={(e) => setFromDate(e.target.value)}
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
                    onChange={(e) => setToDate(e.target.value)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="mb-0.5 block text-[10px] font-semibold text-slate-500">
                  Cycle end month (contains 25th)
                </label>
                <input
                  type="month"
                  value={calEndMonth}
                  onChange={(e) => setCalEndMonth(e.target.value)}
                  className="rounded border border-slate-300 px-2 py-1 text-xs"
                />
              </div>
            )}

            <button
              type="button"
              onClick={applyCurrentPayrollCycle}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              This cycle (26→25)
            </button>

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

        {/* DETAIL */}
        {tab === "DETAIL" && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[11px] leading-tight">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-1.5">Date</th>
                    <th className="px-2 py-1.5">Employee ID</th>
                    <th className="px-2 py-1.5">Employee Name</th>
                    <th className="px-2 py-1.5">Department</th>
                    <th className="px-2 py-1.5">Shift</th>
                    <th className="px-2 py-1.5">In Time</th>
                    <th className="px-2 py-1.5">Out Time</th>
                    <th className="px-2 py-1.5">Working Hours</th>
                    <th className="px-2 py-1.5">OT Hours</th>
                    <th className="px-2 py-1.5">Status</th>
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
                        No records — click Load
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
                        <td className="whitespace-nowrap px-2 py-1 text-violet-700">
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
                                      : r.status === "Week Off"
                                        ? "bg-slate-100 text-slate-500"
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

        {/* CALENDAR */}
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
                          title={d}
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
                      <th className="px-1 py-1.5 text-center font-semibold text-slate-600">
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
                          colSpan={calDays.length + 9}
                          className="px-3 py-10 text-center text-slate-400"
                        >
                          No employees — click Load
                        </td>
                      </tr>
                    ) : (
                      filteredCalendar.map((r) => {
                        const counts = { P: 0, A: 0, H: 0, L: 0, O: 0 };
                        for (const d of calDays) {
                          const m = r.days[d];
                          if (m === "P") counts.P++;
                          if (m === "A") counts.A++;
                          if (m === "H") counts.H++;
                          if (m === "L") counts.L++;
                          if (m === "O") counts.O++;
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
                              {counts.O}
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