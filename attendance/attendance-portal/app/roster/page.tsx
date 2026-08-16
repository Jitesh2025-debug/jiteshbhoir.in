"use client";

import { useEffect, useMemo, useState } from "react";
import MainMenu from "@/components/MainMenu";
import { createClient } from "@/lib/supabase";

type Employee = {
  id: string;
  employee_id: string;
  full_name: string | null;
  department: string | null;
  is_active: boolean;
};

type Shift = {
  id: string;
  code: string;
  name: string;
  start_time: string;
  end_time: string;
  is_overnight: boolean;
  is_active: boolean;
};

type Roster = {
  id: string;
  employee_id: string;
  roster_date: string;
  shift_id: string | null;
  roster_status: "SHIFT" | "OFF" | "LEAVE";
};

type ViewMode = "15DAYS" | "MONTH";

const DAYS = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
];

const SHIFT_COLORS = [
  {
    cell: "border-blue-200 bg-blue-50 hover:border-blue-300 hover:bg-blue-100",
    text: "text-blue-700",
    sub: "text-blue-600",
    legend: "border-blue-200 bg-blue-100",
  },
  {
    cell: "border-purple-200 bg-purple-50 hover:border-purple-300 hover:bg-purple-100",
    text: "text-purple-700",
    sub: "text-purple-600",
    legend: "border-purple-200 bg-purple-100",
  },
  {
    cell: "border-cyan-200 bg-cyan-50 hover:border-cyan-300 hover:bg-cyan-100",
    text: "text-cyan-700",
    sub: "text-cyan-600",
    legend: "border-cyan-200 bg-cyan-100",
  },
  {
    cell: "border-indigo-200 bg-indigo-50 hover:border-indigo-300 hover:bg-indigo-100",
    text: "text-indigo-700",
    sub: "text-indigo-600",
    legend: "border-indigo-200 bg-indigo-100",
  },
  {
    cell: "border-pink-200 bg-pink-50 hover:border-pink-300 hover:bg-pink-100",
    text: "text-pink-700",
    sub: "text-pink-600",
    legend: "border-pink-200 bg-pink-100",
  },
  {
    cell: "border-teal-200 bg-teal-50 hover:border-teal-300 hover:bg-teal-100",
    text: "text-teal-700",
    sub: "text-teal-600",
    legend: "border-teal-200 bg-teal-100",
  },
  {
    cell: "border-orange-200 bg-orange-50 hover:border-orange-300 hover:bg-orange-100",
    text: "text-orange-700",
    sub: "text-orange-600",
    legend: "border-orange-200 bg-orange-100",
  },
  {
    cell: "border-lime-200 bg-lime-50 hover:border-lime-300 hover:bg-lime-100",
    text: "text-lime-700",
    sub: "text-lime-600",
    legend: "border-lime-200 bg-lime-100",
  },
];

export default function RosterPage() {
  const supabase = createClient();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [rosters, setRosters] = useState<Roster[]>([]);

  const [viewMode, setViewMode] = useState<ViewMode>("15DAYS");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const p = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
    }).formatToParts(new Date());
    const g = (t: string) => p.find((x) => x.type === t)?.value || "";
    return `${g("year")}-${g("month")}`;
  });
  const [period, setPeriod] = useState<"FIRST" | "SECOND">("FIRST");

  const [selectedCell, setSelectedCell] = useState<{
    employeeId: string;
    date: string;
  } | null>(null);

  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [showCopyRoster, setShowCopyRoster] = useState(false);

  const [rosterSearch, setRosterSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ─── Date helpers ──────────────────────────────────────────────────────────
  function formatDate(date: Date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function parseMonth(value: string) {
    const [year, month] = value.split("-").map(Number);
    return { year, month };
  }

  function getDaysInMonth(year: number, month: number) {
    return new Date(year, month, 0).getDate();
  }

  const dates = useMemo(() => {
    const { year, month } = parseMonth(selectedMonth);
    const daysInMonth = getDaysInMonth(year, month);

    let startDay = 1;
    let endDay = daysInMonth;

    if (viewMode === "15DAYS") {
      if (period === "FIRST") {
        startDay = 1;
        endDay = Math.min(15, daysInMonth);
      } else {
        startDay = 16;
        endDay = daysInMonth;
      }
    }

    const result: Date[] = [];
    for (let day = startDay; day <= endDay; day++) {
      result.push(new Date(year, month - 1, day));
    }
    return result;
  }, [selectedMonth, viewMode, period]);

  const startDate = dates.length > 0 ? formatDate(dates[0]) : "";
  const endDate = dates.length > 0 ? formatDate(dates[dates.length - 1]) : "";

  // ─── Search filter ─────────────────────────────────────────────────────────
  const filteredRosterEmployees = useMemo(() => {
    const value = rosterSearch.trim().toLowerCase();
    if (!value) return employees;

    return employees.filter(
      (emp) =>
        (emp.full_name || "").toLowerCase().includes(value) ||
        (emp.employee_id || "").toLowerCase().includes(value) ||
        (emp.department || "").toLowerCase().includes(value)
    );
  }, [employees, rosterSearch]);

  // ─── Load data ─────────────────────────────────────────────────────────────
  async function loadRoster() {
  setLoading(true);
  setError("");

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;
    if (!user) throw new Error("Not authenticated");

    // 1. Employees
    const { data: employeeData, error: employeeError } = await supabase
      .from("employees")
      .select("*")
      .eq("is_active", true)
      .order("full_name");

    if (employeeError) {
      console.error("Employees error:", employeeError);
      throw employeeError;
    }

    // 2. Shifts
    const { data: shiftData, error: shiftError } = await supabase
      .from("shifts")
      .select("*")
      .eq("is_active", true)
      .order("code");

    if (shiftError) {
      console.error("Shifts error:", shiftError);
      throw shiftError;
    }

    // 3. Rosters
    if (!startDate || !endDate) {
      throw new Error("Invalid date range");
    }

    const { data: rosterData, error: rosterError } = await supabase
      .from("rosters")
      .select("*")
      .gte("roster_date", startDate)
      .lte("roster_date", endDate);

    if (rosterError) {
      console.error("Rosters error:", rosterError);
      throw rosterError;
    }

    setEmployees(employeeData || []);
    setShifts(shiftData || []);
    setRosters(rosterData || []);
  } catch (err: any) {
    console.error("Roster load error:", err);
    console.error("Details:", {
      message: err?.message,
      code: err?.code,
      details: err?.details,
      hint: err?.hint,
    });
    setError(
      err?.message ||
        err?.details ||
        err?.hint ||
        "Unable to load roster."
    );
  } finally {
    setLoading(false);
  }
}

  useEffect(() => {
    if (startDate && endDate) {
      loadRoster();
    }
  }, [startDate, endDate]);

  // ─── Helpers ───────────────────────────────────────────────────────────────
  function getRoster(employeeId: string, date: string) {
    return rosters.find(
      (item) => item.employee_id === employeeId && item.roster_date === date
    );
  }

  function getShift(shiftId: string | null) {
    if (!shiftId) return null;
    return shifts.find((s) => s.id === shiftId) || null;
  }

  function getShiftColor(shiftId: string | null) {
    if (!shiftId) return SHIFT_COLORS[0];
    const index = shifts.findIndex((s) => s.id === shiftId);
    if (index < 0) return SHIFT_COLORS[0];
    return SHIFT_COLORS[index % SHIFT_COLORS.length];
  }

  // ─── Assign single cell ────────────────────────────────────────────────────
  async function assignRoster(
    employeeId: string,
    date: string,
    status: "SHIFT" | "OFF" | "LEAVE",
    shiftId: string | null
  ) {
    setSaving(true);
    setError("");

    try {
      const existing = getRoster(employeeId, date);

      if (existing) {
        const { error } = await supabase
          .from("rosters")
          .update({
            roster_status: status,
            shift_id: shiftId,
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("rosters").insert({
          employee_id: employeeId,
          roster_date: date,
          roster_status: status,
          shift_id: shiftId,
        });

        if (error) throw error;
      }

      setSelectedCell(null);
      await loadRoster();
    } catch (err: any) {
      console.error("Roster save error:", err);
      setError(
        err?.message ||
          err?.details ||
          err?.hint ||
          "Unable to save roster assignment."
      );
    } finally {
      setSaving(false);
    }
  }

  // ─── Month navigation ──────────────────────────────────────────────────────
  function changeMonth(amount: number) {
    const { year, month } = parseMonth(selectedMonth);
    const date = new Date(year, month - 1 + amount, 1);
    setSelectedMonth(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    );
  }

  function monthLabel() {
    const { year, month } = parseMonth(selectedMonth);
    return new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });
  }

  function getDayName(date: Date) {
    return date.toLocaleDateString("en-IN", { weekday: "short" });
  }

  function getDayNumber(date: Date) {
    return date.getDate();
  }

  function isToday(date: Date) {
    return formatDate(new Date()) === formatDate(date);
  }

  function getRosterCellClass(
    status: "SHIFT" | "OFF" | "LEAVE" | undefined,
    shiftId: string | null | undefined
  ) {
    if (status === "SHIFT") {
      return getShiftColor(shiftId || null).cell;
    }
    switch (status) {
      case "OFF":
        return "border-slate-200 bg-slate-100 hover:border-slate-300 hover:bg-slate-200";
      case "LEAVE":
        return "border-amber-200 bg-amber-50 hover:border-amber-300 hover:bg-amber-100";
      default:
        return "border-dashed border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50";
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 md:px-6">
      <div className="mx-auto max-w-[1600px]">
        <MainMenu />

        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Roster Planner</h1>
            <p className="mt-1 text-sm text-slate-500">
              Plan employee shifts, weekly offs and leave.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowCopyRoster(true)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Copy Previous
            </button>
            <button
              type="button"
              onClick={() => setShowBulkAssign(true)}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-700"
            >
              Bulk Assign
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg border border-slate-300 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setViewMode("15DAYS")}
                className={`rounded-md px-4 py-2 text-sm font-medium ${
                  viewMode === "15DAYS"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500"
                }`}
              >
                15 Days
              </button>
              <button
                type="button"
                onClick={() => setViewMode("MONTH")}
                className={`rounded-md px-4 py-2 text-sm font-medium ${
                  viewMode === "MONTH"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500"
                }`}
              >
                Monthly
              </button>
            </div>

            {viewMode === "15DAYS" && (
              <select
                value={period}
                onChange={(e) =>
                  setPeriod(e.target.value as "FIRST" | "SECOND")
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-500"
              >
                <option value="FIRST">1st - 15th</option>
                <option value="SECOND">16th - Month End</option>
              </select>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-600 hover:bg-slate-50"
              >
                ←
              </button>
              <div className="min-w-[150px] text-center text-sm font-semibold text-slate-700">
                {monthLabel()}
              </div>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-600 hover:bg-slate-50"
              >
                →
              </button>
            </div>

            <button
  type="button"
  onClick={() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1; // 1-12
    const day = today.getDate();

    // Jump to current month
    setSelectedMonth(
      `${year}-${String(month).padStart(2, "0")}`
    );

    // In 15-day view, also jump to the correct half of the month
    if (viewMode === "15DAYS") {
      setPeriod(day <= 15 ? "FIRST" : "SECOND");
    }
  }}
  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
>
  Today
</button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Roster table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-700">
                Employee Roster
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                {filteredRosterEmployees.length} of {employees.length} employees
              </p>
            </div>

            <div className="relative w-full sm:w-80">
              <input
                type="text"
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                placeholder="Search by name, ID or department..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-9 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
              {rosterSearch && (
                <button
                  type="button"
                  onClick={() => setRosterSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-max border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="sticky left-0 z-20 min-w-[220px] border-r border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Employee
                  </th>
                  {dates.map((date) => (
                    <th
                      key={formatDate(date)}
                      className={`min-w-[75px] border-r border-slate-200 px-2 py-3 text-center ${
                        isToday(date) ? "bg-blue-50" : ""
                      }`}
                    >
                      <div className="text-xs font-medium text-slate-400">
                        {getDayName(date)}
                      </div>
                      <div className="mt-1 text-sm font-bold text-slate-700">
                        {getDayNumber(date)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={dates.length + 1}
                      className="px-6 py-12 text-center text-sm text-slate-400"
                    >
                      Loading roster...
                    </td>
                  </tr>
                ) : filteredRosterEmployees.length === 0 ? (
                  <tr>
                    <td
                      colSpan={dates.length + 1}
                      className="px-6 py-12 text-center text-sm text-slate-400"
                    >
                      {rosterSearch
                        ? "No employee found matching your search."
                        : "No active employees found."}
                    </td>
                  </tr>
                ) : (
                  filteredRosterEmployees.map((employee) => (
                    <tr
                      key={employee.id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-4 py-3">
                        <div className="font-medium text-slate-800">
                          {employee.full_name || employee.employee_id}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-400">
                          {employee.employee_id}
                          {employee.department
                            ? ` · ${employee.department}`
                            : ""}
                        </div>
                      </td>

                      {dates.map((date) => {
                        const dateString = formatDate(date);
                        const roster = getRoster(employee.id, dateString);
                        const shift = getShift(roster?.shift_id || null);
                        const shiftColor = getShiftColor(
                          roster?.shift_id || null
                        );

                        return (
                          <td
                            key={dateString}
                            className={`border-r border-slate-100 p-1 ${
                              isToday(date) ? "bg-blue-50/40" : ""
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedCell({
                                  employeeId: employee.id,
                                  date: dateString,
                                })
                              }
                              className={`flex h-16 w-full min-w-[70px] flex-col items-center justify-center rounded-lg border transition ${getRosterCellClass(
                                roster?.roster_status,
                                roster?.shift_id
                              )}`}
                            >
                              {roster?.roster_status === "SHIFT" ? (
                                <>
                                  <span
                                    className={`text-sm font-bold ${shiftColor.text}`}
                                  >
                                    {shift?.code || "SHIFT"}
                                  </span>
                                  <span
                                    className={`mt-1 text-[10px] ${shiftColor.sub}`}
                                  >
                                    {shift
                                      ? shift.start_time.slice(0, 5)
                                      : ""}
                                    {shift?.is_overnight && (
                                      <span className="ml-1">🌙</span>
                                    )}
                                  </span>
                                </>
                              ) : roster?.roster_status === "OFF" ? (
                                <span className="text-xs font-bold text-slate-600">
                                  OFF
                                </span>
                              ) : roster?.roster_status === "LEAVE" ? (
                                <span className="text-xs font-bold text-amber-700">
                                  LEAVE
                                </span>
                              ) : (
                                <span className="text-xl text-slate-300">+</span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-5 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded border border-slate-200 bg-slate-100" />
            OFF
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded border border-amber-200 bg-amber-100" />
            Leave
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded border border-dashed border-slate-300 bg-white" />
            Not Assigned
          </div>
          {shifts.map((shift) => {
            const color = getShiftColor(shift.id);
            return (
              <div key={shift.id} className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded border ${color.legend}`} />
                <span>
                  {shift.code} – {shift.name}
                </span>
              </div>
            );
          })}
        </div>

        {/* Modals */}
        {selectedCell && (
          <RosterModal
            employees={employees}
            shifts={shifts}
            roster={getRoster(selectedCell.employeeId, selectedCell.date)}
            currentShift={getShift(
              getRoster(selectedCell.employeeId, selectedCell.date)?.shift_id ||
                null
            )}
            date={selectedCell.date}
            saving={saving}
            onClose={() => setSelectedCell(null)}
            onAssign={(status, shiftId) =>
              assignRoster(
                selectedCell.employeeId,
                selectedCell.date,
                status,
                shiftId
              )
            }
          />
        )}

        {showBulkAssign && (
          <BulkAssignModal
            employees={employees}
            shifts={shifts}
            onClose={() => setShowBulkAssign(false)}
            onComplete={async () => {
              setShowBulkAssign(false);
              await loadRoster();
            }}
          />
        )}

        {showCopyRoster && (
          <CopyRosterModal
            selectedMonth={selectedMonth}
            period={period}
            viewMode={viewMode}
            onClose={() => setShowCopyRoster(false)}
            onComplete={async () => {
              setShowCopyRoster(false);
              await loadRoster();
            }}
          />
        )}
      </div>
    </main>
  );
}

/* ============================================================
   ROSTER MODAL
============================================================ */
function RosterModal({
  employees,
  shifts,
  roster,
  currentShift,
  date,
  saving,
  onClose,
  onAssign,
}: {
  employees: Employee[];
  shifts: Shift[];
  roster: Roster | undefined;
  currentShift: Shift | null | undefined;
  date: string;
  saving: boolean;
  onClose: () => void;
  onAssign: (
    status: "SHIFT" | "OFF" | "LEAVE",
    shiftId: string | null
  ) => void;
}) {
  const employee = employees.find((item) => item.id === roster?.employee_id);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              {roster ? "Edit Roster" : "Assign Roster"}
            </h2>
            <div className="mt-1 text-xs text-slate-500">
              {employee?.full_name || employee?.employee_id || "Employee"} •{" "}
              {new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
                weekday: "short",
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-xl text-slate-400 hover:bg-slate-100"
          >
            ×
          </button>
        </div>

        <div className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Select Shift
            </p>
            {roster && (
              <span className="text-xs text-slate-500">
                Current:{" "}
                <strong>
                  {roster.roster_status === "SHIFT"
                    ? currentShift?.code || "Shift"
                    : roster.roster_status}
                </strong>
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {shifts.map((shift) => (
              <button
                key={shift.id}
                type="button"
                disabled={saving}
                onClick={() => onAssign("SHIFT", shift.id)}
                className={`rounded-xl border p-3 text-left transition ${
                  roster?.shift_id === shift.id
                    ? "border-blue-400 bg-blue-50 ring-2 ring-blue-100"
                    : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-800">
                    {shift.code}
                  </span>
                  {shift.is_overnight && (
                    <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[8px] font-bold text-indigo-600">
                      NIGHT
                    </span>
                  )}
                </div>
                <div className="mt-1 truncate text-xs font-medium text-slate-700">
                  {shift.name}
                </div>
                <div className="mt-1 text-[10px] text-slate-500">
                  {shift.start_time.slice(0, 5)} – {shift.end_time.slice(0, 5)}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => onAssign("OFF", null)}
              className={`rounded-xl border p-3 text-left ${
                roster?.roster_status === "OFF"
                  ? "border-slate-400 bg-slate-100"
                  : "border-slate-200 bg-slate-50 hover:bg-slate-100"
              }`}
            >
              <div className="text-sm font-semibold text-slate-700">OFF</div>
              <div className="text-xs text-slate-400">Weekly Off</div>
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => onAssign("LEAVE", null)}
              className={`rounded-xl border p-3 text-left ${
                roster?.roster_status === "LEAVE"
                  ? "border-amber-400 bg-amber-100"
                  : "border-amber-200 bg-amber-50 hover:bg-amber-100"
              }`}
            >
              <div className="text-sm font-semibold text-amber-700">LEAVE</div>
              <div className="text-xs text-amber-500">Employee Leave</div>
            </button>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   BULK ASSIGN MODAL
============================================================ */
function BulkAssignModal({
  employees,
  shifts,
  onClose,
  onComplete,
}: {
  employees: Employee[];
  shifts: Shift[];
  onClose: () => void;
  onComplete: () => void;
}) {
  const supabase = createClient();

  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [assignmentType, setAssignmentType] = useState<
    "SHIFT" | "OFF" | "LEAVE"
  >("SHIFT");
  const [weekOffDay, setWeekOffDay] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filteredEmployees = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return employees;

    return employees.filter(
      (emp) =>
        (emp.full_name || "").toLowerCase().includes(value) ||
        (emp.employee_id || "").toLowerCase().includes(value) ||
        (emp.department || "").toLowerCase().includes(value)
    );
  }, [employees, search]);

  function toggleEmployee(id: string) {
    setSelectedEmployees((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function selectAllFiltered() {
    const ids = filteredEmployees.map((e) => e.id);
    setSelectedEmployees((current) => [...new Set([...current, ...ids])]);
  }

  function clearAll() {
    setSelectedEmployees([]);
  }

  function getDatesBetween(start: string, end: string) {
    const result: string[] = [];
    const current = new Date(start + "T00:00:00");
    const last = new Date(end + "T00:00:00");

    while (current <= last) {
      result.push(current.toISOString().slice(0, 10));
      current.setDate(current.getDate() + 1);
    }
    return result;
  }

  async function handleBulkAssign() {
  setError("");

  if (selectedEmployees.length === 0) {
    setError("Please select at least one employee.");
    return;
  }
  if (!fromDate || !toDate) {
    setError("Please select the date range.");
    return;
  }
  if (fromDate > toDate) {
    setError("From date cannot be after To date.");
    return;
  }
  if (assignmentType === "SHIFT" && !shiftId) {
    setError("Please select a shift.");
    return;
  }

  setSaving(true);

  try {
    const dates = getDatesBetween(fromDate, toDate);

    const records: {
      employee_id: string;
      roster_date: string;
      roster_status: "SHIFT" | "OFF" | "LEAVE";
      shift_id: string | null;
    }[] = [];

    for (const empId of selectedEmployees) {
      for (const date of dates) {
        const day = new Date(date + "T00:00:00").getDay();
        const isWeekOffDay =
          weekOffDay !== "" && day === Number(weekOffDay);

        // ── OFF assignment ──────────────────────────────────────────
        // If a weekly-off day is chosen → only mark those weekdays
        // If no weekly-off day → mark every day in the range as OFF
        if (assignmentType === "OFF") {
          if (weekOffDay !== "" && !isWeekOffDay) {
            continue; // skip non-week-off days
          }

          records.push({
            employee_id: empId,
            roster_date: date,
            roster_status: "OFF",
            shift_id: null,
          });
          continue;
        }

        // ── LEAVE assignment ────────────────────────────────────────
        // Same rule: if weekly-off day is set, only mark that weekday
        if (assignmentType === "LEAVE") {
          if (weekOffDay !== "" && !isWeekOffDay) {
            continue;
          }

          records.push({
            employee_id: empId,
            roster_date: date,
            roster_status: "LEAVE",
            shift_id: null,
          });
          continue;
        }

        // ── SHIFT assignment ────────────────────────────────────────
        // Normal days → selected shift
        // Chosen weekly-off day → OFF
        if (isWeekOffDay) {
          records.push({
            employee_id: empId,
            roster_date: date,
            roster_status: "OFF",
            shift_id: null,
          });
        } else {
          records.push({
            employee_id: empId,
            roster_date: date,
            roster_status: "SHIFT",
            shift_id: shiftId,
          });
        }
      }
    }

    if (records.length === 0) {
      setError(
        "No days matched your selection. Check the date range and weekly-off day."
      );
      setSaving(false);
      return;
    }

    // Save records (same as before)
    for (const record of records) {
      const { data: existing, error: existingError } = await supabase
        .from("rosters")
        .select("id")
        .eq("employee_id", record.employee_id)
        .eq("roster_date", record.roster_date)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing) {
        const { error } = await supabase
          .from("rosters")
          .update({
            roster_status: record.roster_status,
            shift_id: record.shift_id,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rosters").insert(record);
        if (error) throw error;
      }
    }

    onComplete();
  } catch (err: any) {
    console.error("Bulk roster error:", err);
    setError(err?.message || "Unable to bulk assign roster.");
  } finally {
    setSaving(false);
  }
}

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              Bulk Assign Roster
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Assign shift and weekly off to multiple employees.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xl text-slate-400 hover:bg-slate-100"
          >
            ×
          </button>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {/* Employees list */}
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Employees
                </label>
                <span className="text-xs font-semibold text-slate-500">
                  {selectedEmployees.length} selected
                </span>
              </div>

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, ID or department..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
              />

              <div className="mt-2 flex justify-between">
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="text-[11px] font-medium text-slate-600 hover:underline"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-[11px] text-slate-400 hover:underline"
                >
                  Clear
                </button>
              </div>

              <div className="mt-2 max-h-36 overflow-y-auto rounded-lg border border-slate-200">
                {filteredEmployees.length === 0 ? (
                  <div className="px-3 py-5 text-center text-xs text-slate-400">
                    No employee found.
                  </div>
                ) : (
                  filteredEmployees.map((employee) => (
                    <label
                      key={employee.id}
                      className="flex cursor-pointer items-center gap-2 border-b border-slate-100 px-3 py-2 last:border-0 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEmployees.includes(employee.id)}
                        onChange={() => toggleEmployee(employee.id)}
                        className="h-3.5 w-3.5 rounded border-slate-300"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium text-slate-700">
                          {employee.full_name || employee.employee_id}
                        </div>
                        <div className="truncate text-[10px] text-slate-400">
                          {employee.employee_id}
                          {employee.department
                            ? ` · ${employee.department}`
                            : ""}
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Settings */}
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-500">
                    From
                  </label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-500">
                    To
                  </label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-500">
                    Assignment
                  </label>
                  <select
                    value={assignmentType}
                    onChange={(e) =>
                      setAssignmentType(
                        e.target.value as "SHIFT" | "OFF" | "LEAVE"
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs"
                  >
                    <option value="SHIFT">Shift</option>
                    <option value="OFF">OFF</option>
                    <option value="LEAVE">Leave</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-500">
                    Weekly Off
                  </label>
                  <select
                    value={weekOffDay}
                    onChange={(e) => setWeekOffDay(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs"
                  >
                    <option value="">No weekly off</option>
                    {DAYS.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {assignmentType === "SHIFT" && (
                <div className="mt-2">
                  <label className="mb-1 block text-[11px] font-semibold text-slate-500">
                    Shift
                  </label>
                  <select
                    value={shiftId}
                    onChange={(e) => setShiftId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs"
                  >
                    <option value="">Select Shift</option>
                    {shifts.map((shift) => (
                      <option key={shift.id} value={shift.id}>
                        {shift.code} – {shift.name} (
                        {shift.start_time.slice(0, 5)} –{" "}
                        {shift.end_time.slice(0, 5)})
                        {shift.is_overnight ? " • NIGHT" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {weekOffDay !== "" && (
                <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[10px] text-slate-500">
                  <strong>
                    {
                      DAYS.find((d) => d.value === Number(weekOffDay))
                        ?.label
                    }
                  </strong>{" "}
                  will be marked as <strong>OFF</strong> for selected
                  employees.
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
          <div className="text-xs text-slate-500">
            <strong>{selectedEmployees.length}</strong> employee
            {selectedEmployees.length !== 1 ? "s" : ""} selected
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleBulkAssign}
              className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Assigning..." : "Assign Roster"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   COPY ROSTER MODAL
============================================================ */
function CopyRosterModal({
  selectedMonth,
  period,
  viewMode,
  onClose,
  onComplete,
}: {
  selectedMonth: string;
  period: "FIRST" | "SECOND";
  viewMode: ViewMode;
  onClose: () => void;
  onComplete: () => void;
}) {
  const supabase = createClient();

  const [copyType, setCopyType] = useState<"15DAYS" | "MONTH">(
    viewMode === "MONTH" ? "MONTH" : "15DAYS"
  );
  const [includeLeave, setIncludeLeave] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function getDates(start: Date, count: number) {
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      result.push(d.toISOString().slice(0, 10));
    }
    return result;
  }

  async function copyRange(
    sourceDates: string[],
    destinationDates: string[]
  ) {
    for (let i = 0; i < sourceDates.length; i++) {
      const sourceDate = sourceDates[i];
      const destinationDate = destinationDates[i];

      const { data: sourceRows, error: sourceError } = await supabase
        .from("rosters")
        .select("employee_id, shift_id, roster_status")
        .eq("roster_date", sourceDate);

      if (sourceError) throw sourceError;
      if (!sourceRows?.length) continue;

      for (const row of sourceRows) {
        if (row.roster_status === "LEAVE" && !includeLeave) continue;

        const { data: existing, error: existingError } = await supabase
          .from("rosters")
          .select("id")
          .eq("employee_id", row.employee_id)
          .eq("roster_date", destinationDate)
          .maybeSingle();

        if (existingError) throw existingError;
        if (existing && !replaceExisting) continue;

        if (existing) {
          const { error } = await supabase
            .from("rosters")
            .update({
              shift_id: row.shift_id,
              roster_status: row.roster_status,
            })
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("rosters").insert({
            employee_id: row.employee_id,
            roster_date: destinationDate,
            shift_id: row.shift_id,
            roster_status: row.roster_status,
          });
          if (error) throw error;
        }
      }
    }
  }

  async function handleCopy() {
    setError("");
    setSaving(true);

    try {
      const { year, month } = parseMonthLocal(selectedMonth);

      if (copyType === "15DAYS") {
        const sourceStart =
          period === "FIRST"
            ? new Date(year, month - 1, 1)
            : new Date(year, month - 1, 16);

        const sourceDates = getDates(sourceStart, 15);
        const destinationDates = sourceDates.map((date) => {
          const d = new Date(date + "T00:00:00");
          d.setDate(d.getDate() + 15);
          return d.toISOString().slice(0, 10);
        });

        await copyRange(sourceDates, destinationDates);
      } else {
        const previousMonthStart = new Date(year, month - 2, 1);
        const previousDays = new Date(year, month - 1, 0).getDate();
        const currentDays = new Date(year, month, 0).getDate();
        const copyDays = Math.min(previousDays, currentDays);

        const sourceDates = getDates(previousMonthStart, copyDays);
        const destinationDates = sourceDates.map((_, index) =>
          new Date(year, month - 1, index + 1).toISOString().slice(0, 10)
        );

        await copyRange(sourceDates, destinationDates);
      }

      onComplete();
    } catch (err: any) {
      console.error("Copy roster error:", err);
      setError(err?.message || "Unable to copy roster.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              Copy Previous Roster
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Copy an existing roster into the next period.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-xl text-slate-400 hover:bg-slate-100"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              Copy Type
            </label>
            <select
              value={copyType}
              onChange={(e) =>
                setCopyType(e.target.value as "15DAYS" | "MONTH")
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="15DAYS">
                Previous 15 Days → Next 15 Days
              </option>
              <option value="MONTH">Previous Month → Current Month</option>
            </select>
          </div>

          <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <input
              type="checkbox"
              checked={includeLeave}
              onChange={(e) => setIncludeLeave(e.target.checked)}
              className="h-4 w-4"
            />
            <div>
              <div className="text-sm font-medium text-slate-700">
                Copy Leave
              </div>
              <div className="text-xs text-slate-400">
                Leave assignments will also be copied.
              </div>
            </div>
          </label>

          <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(e) => setReplaceExisting(e.target.checked)}
              className="h-4 w-4"
            />
            <div>
              <div className="text-sm font-medium text-slate-700">
                Replace Existing
              </div>
              <div className="text-xs text-slate-400">
                Existing roster entries will be replaced.
              </div>
            </div>
          </label>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleCopy}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? "Copying..." : "Copy Roster"}
          </button>
        </div>
      </div>
    </div>
  );
}

function parseMonthLocal(value: string) {
  const [year, month] = value.split("-").map(Number);
  return { year, month };
}