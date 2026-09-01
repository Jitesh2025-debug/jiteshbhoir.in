"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import MainMenu from "@/components/MainMenu";
import { createClient } from "@/lib/supabase";

/* ───────────────── Types ───────────────── */

type Employee = {
  id: string;
  employee_code: string;
  barcode: string;
  full_name: string;
  department: string | null;
  designation: string | null;
  employment_type: string;
  joining_date: string | null;
  is_active: boolean;
  gender: string | null;
  vendor: string | null;
  customer_account: string | null;
};

type Shift = {
  id: string;
  code: string;
  name: string;
  start_time: string;
  end_time: string;
  is_overnight: boolean;
  grace_minutes: number;
  is_active: boolean;
};

type Roster = {
  id: string;
  employee_id: string;
  roster_date: string;
  shift_id: string | null;
  roster_status: string;
  remarks: string | null;
  created_by: string | null;
};

type AssignmentType = "SHIFT" | "OFF" | "LEAVE";
type PanelType = "TODAY" | "ROSTERED" | "PENDING" | null;
type TodayTab = "ALL" | "SHIFT" | "OFF" | "LEAVE";

/* ───────────────── IST helpers ───────────────── */

function todayIST() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function formatDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function parseDate(date: string) {
  return new Date(`${date}T12:00:00+05:30`);
}

function addDays(date: string, amount: number) {
  const d = parseDate(date);
  d.setDate(d.getDate() + amount);
  return formatDate(d);
}

function daysBetween(from: string, to: string) {
  const result: string[] = [];
  let current = from;
  while (current <= to) {
    result.push(current);
    current = addDays(current, 1);
  }
  return result;
}

function monthStart(month: string) {
  return `${month}-01`;
}

function monthEnd(month: string) {
  const [year, mon] = month.split("-").map(Number);
  return formatDate(new Date(year, mon, 0));
}

function monthLabel(month: string) {
  const [year, mon] = month.split("-").map(Number);
  return new Date(year, mon - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function shortDate(date: string) {
  return parseDate(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getErrorMessage(error: unknown) {
  if (!error) return "Something went wrong";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object") {
    const e = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };
    return e.message || e.details || e.hint || e.code || "Something went wrong";
  }
  return "Something went wrong";
}

/* ───────────────── Main ───────────────── */

export default function RosterPage() {
  const supabase = useMemo(() => createClient(), []);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [rosters, setRosters] = useState<Roster[]>([]);

  const [selectedMonth, setSelectedMonth] = useState(() =>
    todayIST().slice(0, 7)
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [todayTab, setTodayTab] = useState<TodayTab>("ALL");
  const [deptFilter, setDeptFilter] = useState<string>("ALL");
  const [viewEmployee, setViewEmployee] = useState<Employee | null>(null);
  const [search, setSearch] = useState("");

  const today = todayIST();

  /* ── Load ── */
  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const from = monthStart(selectedMonth);
      const to = monthEnd(selectedMonth);

      const [empRes, shiftRes, rosterRes] = await Promise.all([
        supabase
          .from("employees")
          .select(
            `id, employee_code, barcode, full_name, department, designation,
             employment_type, joining_date, is_active, gender, vendor, customer_account`
          )
          .eq("is_active", true)
          .order("full_name"),
        supabase
          .from("shifts")
          .select(
            `id, code, name, start_time, end_time, is_overnight, grace_minutes, is_active`
          )
          .eq("is_active", true)
          .order("code"),
        supabase
          .from("rosters")
          .select(
            `id, employee_id, roster_date, shift_id, roster_status, remarks, created_by`
          )
          .gte("roster_date", from)
          .lte("roster_date", to)
          .order("roster_date"),
      ]);

      if (empRes.error) throw empRes.error;
      if (shiftRes.error) throw shiftRes.error;
      if (rosterRes.error) throw rosterRes.error;

      setEmployees(empRes.data || []);
      setShifts(shiftRes.data || []);
      setRosters(rosterRes.data || []);
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ── Maps & stats ── */
  const empMap = useMemo(() => {
    const m = new Map<string, Employee>();
    employees.forEach((e) => m.set(e.id, e));
    return m;
  }, [employees]);

  const rosterMap = useMemo(() => {
    const m = new Map<string, Roster>();
    rosters.forEach((r) => m.set(`${r.employee_id}|${r.roster_date}`, r));
    return m;
  }, [rosters]);

  const monthDates = useMemo(
    () => daysBetween(monthStart(selectedMonth), monthEnd(selectedMonth)),
    [selectedMonth]
  );

  const rosteredIds = useMemo(
    () => new Set(rosters.map((r) => r.employee_id)),
    [rosters]
  );

  const rosteredCount = rosteredIds.size;
  const pendingCount = Math.max(employees.length - rosteredCount, 0);

  const todayRows = useMemo(() => {
    return rosters
      .filter((r) => r.roster_date === today)
      .map((r) => ({
        roster: r,
        employee: empMap.get(r.employee_id) || null,
      }))
      .filter((x) => x.employee);
  }, [rosters, today, empMap]);

  const todayShift = todayRows.filter((x) => x.roster.roster_status === "SHIFT")
    .length;
  const todayOff = todayRows.filter((x) => x.roster.roster_status === "OFF")
    .length;
  const todayLeave = todayRows.filter((x) => x.roster.roster_status === "LEAVE")
    .length;

  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set).sort();
  }, [employees]);

  /* ── Filtered lists ── */
  function matchSearch(e: Employee) {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      e.full_name.toLowerCase().includes(q) ||
      e.employee_code.toLowerCase().includes(q) ||
      (e.department || "").toLowerCase().includes(q)
    );
  }

  function matchDept(e: Employee) {
    if (deptFilter === "ALL") return true;
    return (e.department || "Unassigned") === deptFilter;
  }

  const rosteredList = useMemo(() => {
    return employees
      .filter((e) => rosteredIds.has(e.id) && matchSearch(e) && matchDept(e))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [employees, rosteredIds, search, deptFilter]);

  const pendingList = useMemo(() => {
    return employees
      .filter((e) => !rosteredIds.has(e.id) && matchSearch(e) && matchDept(e))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [employees, rosteredIds, search, deptFilter]);

  const todayList = useMemo(() => {
    let list = todayRows;
    if (todayTab === "SHIFT")
      list = list.filter((x) => x.roster.roster_status === "SHIFT");
    if (todayTab === "OFF")
      list = list.filter((x) => x.roster.roster_status === "OFF");
    if (todayTab === "LEAVE")
      list = list.filter((x) => x.roster.roster_status === "LEAVE");

    list = list.filter((x) => {
      const e = x.employee!;
      return matchSearch(e) && matchDept(e);
    });

    return list.sort((a, b) =>
      (a.employee?.full_name || "").localeCompare(b.employee?.full_name || "")
    );
  }, [todayRows, todayTab, search, deptFilter]);

  /* ── Nav ── */
  function changeMonth(delta: number) {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setSelectedMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }

  function openPanel(panel: PanelType) {
    setActivePanel((prev) => (prev === panel ? null : panel));
    setDeptFilter("ALL");
    setSearch("");
    setTodayTab("ALL");
  }

  /* ── Create roster ── */
  async function createRoster(data: {
    employeeIds: string[];
    fromDate: string;
    toDate: string;
    type: AssignmentType;
    shiftId: string | null;
    weekOff: string;
    remarks: string;
  }) {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const { employeeIds, fromDate, toDate, type, shiftId, weekOff, remarks } =
        data;

      if (!employeeIds.length)
        throw new Error("Please select at least one employee.");
      if (!fromDate || !toDate) throw new Error("Please select a date range.");
      if (fromDate > toDate)
        throw new Error("From date cannot be after To date.");
      if (type === "SHIFT" && !shiftId) throw new Error("Please select a shift.");

      const dates = daysBetween(fromDate, toDate);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      for (const employeeId of employeeIds) {
        for (const date of dates) {
          const day = parseDate(date).getDay();
          const isWeeklyOff = weekOff !== "" && day === Number(weekOff);

          let rosterStatus: AssignmentType = type;
          let selectedShiftId: string | null =
            type === "SHIFT" ? shiftId : null;

          if (type === "SHIFT" && isWeeklyOff) {
            rosterStatus = "OFF";
            selectedShiftId = null;
          }
          if (
            (type === "OFF" || type === "LEAVE") &&
            weekOff !== "" &&
            !isWeeklyOff
          ) {
            continue;
          }

          const { data: existingRows, error: findErr } = await supabase
            .from("rosters")
            .select("id")
            .eq("employee_id", employeeId)
            .eq("roster_date", date)
            .order("created_at", { ascending: false })
            .limit(1);

          if (findErr) throw findErr;
          const existing = existingRows?.[0];

          if (existing?.id) {
            const { error } = await supabase
              .from("rosters")
              .update({
                roster_status: rosterStatus,
                shift_id: selectedShiftId,
                remarks: remarks || null,
                ...(user?.id ? { created_by: user.id } : {}),
              })
              .eq("id", existing.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from("rosters").insert({
              employee_id: employeeId,
              roster_date: date,
              roster_status: rosterStatus,
              shift_id: selectedShiftId,
              remarks: remarks || null,
              ...(user?.id ? { created_by: user.id } : {}),
            });
            if (error) throw error;
          }
        }
      }

      setSuccess(
        `${employeeIds.length} employee${
          employeeIds.length > 1 ? "s" : ""
        } rostered successfully.`
      );
      setShowCreate(false);
      await loadData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function getShift(id: string | null) {
    if (!id) return null;
    return shifts.find((s) => s.id === id) || null;
  }

  /* ── Render ── */
  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-800">
      <div className="mx-auto max-w-[1400px] px-4 py-5 md:px-6">
        <MainMenu />

        {/* Header */}
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 md:text-3xl">
              Roster
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Shifts · Weekly offs · Leave · IST
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-indigo-600"
          >
            + Create Roster
          </button>
        </div>

        {/* Month bar */}
        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            ←
          </button>
          <div className="min-w-[130px] text-center text-sm font-bold text-slate-800">
            {monthLabel(selectedMonth)}
          </div>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            →
          </button>
          <button
            type="button"
            onClick={() => setSelectedMonth(todayIST().slice(0, 7))}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => loadData()}
            disabled={loading}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? "…" : "Refresh"}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            ✓ {success}
          </div>
        )}

        {/* 3 Cards */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* TODAY */}
          <button
            type="button"
            onClick={() => openPanel("TODAY")}
            className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 ${
              activePanel === "TODAY"
                ? "border-blue-300 ring-4 ring-blue-50"
                : "border-slate-200"
            }`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Today · {shortDate(today)}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-2xl font-black text-blue-700">
                  {loading ? "—" : todayShift}
                </div>
                <div className="text-[10px] font-medium text-slate-500">Shift</div>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-600">
                  {loading ? "—" : todayOff}
                </div>
                <div className="text-[10px] font-medium text-slate-500">OFF</div>
              </div>
              <div>
                <div className="text-2xl font-black text-amber-600">
                  {loading ? "—" : todayLeave}
                </div>
                <div className="text-[10px] font-medium text-slate-500">Leave</div>
              </div>
            </div>
            <div className="mt-3 text-[11px] font-medium text-blue-600">
              View list →
            </div>
          </button>

          {/* ROSTERED */}
          <button
            type="button"
            onClick={() => openPanel("ROSTERED")}
            className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 ${
              activePanel === "ROSTERED"
                ? "border-indigo-300 ring-4 ring-indigo-50"
                : "border-slate-200"
            }`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              This month
            </div>
            <div className="mt-2 text-3xl font-black text-slate-900">
              {loading ? "—" : rosteredCount}
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-600">
              Rostered employees
            </div>
            <div className="mt-3 text-[11px] font-medium text-indigo-600">
              View list →
            </div>
          </button>

          {/* PENDING */}
          <button
            type="button"
            onClick={() => openPanel("PENDING")}
            className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 ${
              activePanel === "PENDING"
                ? "border-amber-300 ring-4 ring-amber-50"
                : "border-slate-200"
            }`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Needs action
            </div>
            <div className="mt-2 text-3xl font-black text-slate-900">
              {loading ? "—" : pendingCount}
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-600">
              Pending employees
            </div>
            <div className="mt-3 text-[11px] font-medium text-amber-600">
              View list →
            </div>
          </button>
        </div>

        {/* Panel */}
        {activePanel && (
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  {activePanel === "TODAY" && `Today · ${shortDate(today)}`}
                  {activePanel === "ROSTERED" && "Rostered employees"}
                  {activePanel === "PENDING" && "Pending employees"}
                </h2>
                <p className="text-[11px] text-slate-400">
                  Click employee to view monthly roster
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActivePanel(null)}
                className="self-end rounded-lg px-2 text-lg text-slate-400 hover:bg-slate-100 sm:self-auto"
              >
                ×
              </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center">
              {activePanel === "TODAY" && (
                <div className="flex flex-wrap gap-1.5">
                  {(["ALL", "SHIFT", "OFF", "LEAVE"] as TodayTab[]).map(
                    (tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setTodayTab(tab)}
                        className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold ${
                          todayTab === tab
                            ? "bg-slate-900 text-white"
                            : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {tab === "ALL" ? "All" : tab}
                      </button>
                    )
                  )}
                </div>
              )}

              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600"
              >
                <option value="ALL">All departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, ID…"
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] outline-none focus:border-slate-400 sm:ml-auto sm:w-48"
              />
            </div>

            {/* List */}
            <div className="max-h-96 overflow-y-auto">
              {activePanel === "TODAY" &&
                (todayList.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-slate-400">
                    No records
                  </div>
                ) : (
                  todayList.map(({ roster, employee }) => {
                    const shift = getShift(roster.shift_id);
                    return (
                      <button
                        type="button"
                        key={roster.id}
                        onClick={() => setViewEmployee(employee)}
                        className="flex w-full items-center gap-3 border-b border-slate-50 px-4 py-3 text-left hover:bg-indigo-50"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-slate-800">
                            {employee!.full_name}
                          </div>
                          <div className="truncate text-[11px] text-slate-400">
                            {employee!.employee_code}
                            {employee!.department
                              ? ` · ${employee!.department}`
                              : ""}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          {roster.roster_status === "SHIFT" && (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                              {shift?.code || "SHIFT"}
                              {shift ? ` ${shift.start_time.slice(0, 5)}` : ""}
                            </span>
                          )}
                          {roster.roster_status === "OFF" && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                              OFF
                            </span>
                          )}
                          {roster.roster_status === "LEAVE" && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                              LEAVE
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                ))}

              {activePanel === "ROSTERED" &&
                (rosteredList.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-slate-400">
                    No employees
                  </div>
                ) : (
                  rosteredList.map((e) => (
                    <button
                      type="button"
                      key={e.id}
                      onClick={() => setViewEmployee(e)}
                      className="flex w-full items-center gap-3 border-b border-slate-50 px-4 py-3 text-left hover:bg-indigo-50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-800">
                          {e.full_name}
                        </div>
                        <div className="truncate text-[11px] text-slate-400">
                          {e.employee_code}
                          {e.department ? ` · ${e.department}` : ""}
                        </div>
                      </div>
                      <span className="text-xs text-indigo-500">Month →</span>
                    </button>
                  ))
                ))}

              {activePanel === "PENDING" &&
                (pendingList.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-slate-400">
                    No pending employees
                  </div>
                ) : (
                  pendingList.map((e) => (
                    <button
                      type="button"
                      key={e.id}
                      onClick={() => setViewEmployee(e)}
                      className="flex w-full items-center gap-3 border-b border-slate-50 px-4 py-3 text-left hover:bg-amber-50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-800">
                          {e.full_name}
                        </div>
                        <div className="truncate text-[11px] text-slate-400">
                          {e.employee_code}
                          {e.department ? ` · ${e.department}` : ""}
                        </div>
                      </div>
                      <span className="text-xs text-amber-600">Month →</span>
                    </button>
                  ))
                ))}
            </div>
          </div>
        )}

        {!activePanel && !loading && (
          <p className="mt-8 text-center text-sm text-slate-400">
            Click a card to view lists. Click an employee for monthly roster.
          </p>
        )}

        {showCreate && (
          <CreateRosterModal
            employees={employees}
            shifts={shifts}
            saving={saving}
            onClose={() => setShowCreate(false)}
            onSave={createRoster}
          />
        )}

        {viewEmployee && (
          <EmployeeMonthModal
            employee={viewEmployee}
            month={selectedMonth}
            monthDates={monthDates}
            rosterMap={rosterMap}
            shifts={shifts}
            onClose={() => setViewEmployee(null)}
          />
        )}
      </div>
    </main>
  );
}

/* ───────────────── Employee month modal ───────────────── */

function EmployeeMonthModal({
  employee,
  month,
  monthDates,
  rosterMap,
  shifts,
  onClose,
}: {
  employee: Employee;
  month: string;
  monthDates: string[];
  rosterMap: Map<string, Roster>;
  shifts: Shift[];
  onClose: () => void;
}) {
  const today = todayIST();
  const firstDay = parseDate(monthDates[0]).getDay();

  function getShift(id: string | null) {
    if (!id) return null;
    return shifts.find((s) => s.id === id) || null;
  }

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {employee.full_name}
            </h2>
            <p className="text-xs text-slate-500">
              {employee.employee_code}
              {employee.department ? ` · ${employee.department}` : ""}
              {" · "}
              {monthLabel(month)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-2 text-xl text-slate-400 hover:bg-slate-100"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-7 gap-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div
                key={d}
                className="text-center text-[10px] font-bold uppercase text-slate-400"
              >
                {d}
              </div>
            ))}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`e-${i}`} />
            ))}
            {monthDates.map((date) => {
              const roster = rosterMap.get(`${employee.id}|${date}`);
              const shift = getShift(roster?.shift_id || null);
              const isToday = date === today;

              let bg = "bg-slate-50 border-slate-100";
              let label = "—";
              let sub = "";

              if (roster?.roster_status === "SHIFT") {
                bg = "bg-blue-50 border-blue-200";
                label = shift?.code || "SHIFT";
                sub = shift ? shift.start_time.slice(0, 5) : "";
              } else if (roster?.roster_status === "OFF") {
                bg = "bg-slate-100 border-slate-200";
                label = "OFF";
              } else if (roster?.roster_status === "LEAVE") {
                bg = "bg-amber-50 border-amber-200";
                label = "LEAVE";
              }

              return (
                <div
                  key={date}
                  className={`rounded-xl border p-2 text-center ${bg} ${
                    isToday ? "ring-2 ring-indigo-400" : ""
                  }`}
                >
                  <div className="text-[10px] font-semibold text-slate-400">
                    {date.slice(8, 10)}
                  </div>
                  <div className="mt-1 text-xs font-bold text-slate-800">
                    {label}
                  </div>
                  {sub && (
                    <div className="text-[9px] text-slate-500">{sub}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-slate-100 px-5 py-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────── Create Roster Modal ───────────────── */

function CreateRosterModal({
  employees,
  shifts,
  saving,
  onClose,
  onSave,
}: {
  employees: Employee[];
  shifts: Shift[];
  saving: boolean;
  onClose: () => void;
  onSave: (data: {
    employeeIds: string[];
    fromDate: string;
    toDate: string;
    type: AssignmentType;
    shiftId: string | null;
    weekOff: string;
    remarks: string;
  }) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Employee[]>([]);
  const [input, setInput] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [type, setType] = useState<AssignmentType>("SHIFT");
  const [shiftId, setShiftId] = useState("");
  const [weekOff, setWeekOff] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");

  const selectedIds = useMemo(
    () => new Set(selected.map((e) => e.id)),
    [selected]
  );

  function resolveEmployees(raw: string): Employee[] {
    const tokens = raw
      .split(/[\n,;]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    const matches: Employee[] = [];

    for (const token of tokens) {
      const lower = token.toLowerCase();
      const exact = employees.find(
        (e) =>
          e.employee_code.toLowerCase() === lower ||
          e.barcode.toLowerCase() === lower ||
          e.full_name.toLowerCase() === lower
      );
      if (exact && !matches.some((x) => x.id === exact.id)) {
        matches.push(exact);
        continue;
      }
      const partial = employees.find(
        (e) =>
          e.employee_code.toLowerCase().includes(lower) ||
          e.barcode.toLowerCase().includes(lower) ||
          e.full_name.toLowerCase().includes(lower)
      );
      if (partial && !matches.some((x) => x.id === partial.id)) {
        matches.push(partial);
      }
    }
    return matches;
  }

  function addFromInput() {
    const matches = resolveEmployees(input);
    if (!matches.length) {
      setError("No employee matched.");
      return;
    }
    setSelected((prev) => {
      const result = [...prev];
      for (const emp of matches) {
        if (!result.some((x) => x.id === emp.id)) result.push(emp);
      }
      return result;
    });
    setInput("");
    setError("");
  }

  const suggestions = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    if (!q) return [];
    return employees
      .filter(
        (e) =>
          !selectedIds.has(e.id) &&
          (e.full_name.toLowerCase().includes(q) ||
            e.employee_code.toLowerCase().includes(q) ||
            e.barcode.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [employeeSearch, employees, selectedIds]);

  async function submit() {
    setError("");
    if (!selected.length) {
      setError("Select at least one employee.");
      return;
    }
    if (!fromDate || !toDate) {
      setError("Select date range.");
      return;
    }
    if (fromDate > toDate) {
      setError("From date cannot be after To date.");
      return;
    }
    if (type === "SHIFT" && !shiftId) {
      setError("Select a shift.");
      return;
    }
    await onSave({
      employeeIds: selected.map((e) => e.id),
      fromDate,
      toDate,
      type,
      shiftId: type === "SHIFT" ? shiftId : null,
      weekOff,
      remarks,
    });
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Create Roster</h2>
            <p className="text-[11px] text-slate-400">
              Assign shift, OFF or leave
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl px-2 text-xl text-slate-400 hover:bg-slate-100"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50/40 p-4 md:p-5">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Select employees */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-bold text-slate-800">Employees</h3>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    addFromInput();
                  }
                }}
                placeholder={"Paste ID / name\nACH914"}
                rows={3}
                className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs outline-none focus:border-indigo-300"
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={addFromInput}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white"
                >
                  Add
                </button>
              </div>

              <input
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                placeholder="Search…"
                className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-300"
              />
              {suggestions.length > 0 && (
                <div className="mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                  {suggestions.map((e) => (
                    <button
                      type="button"
                      key={e.id}
                      onClick={() => {
                        setSelected((prev) => [...prev, e]);
                        setEmployeeSearch("");
                      }}
                      className="flex w-full px-3 py-2 text-left text-xs hover:bg-indigo-50"
                    >
                      <span className="font-semibold">{e.full_name}</span>
                      <span className="ml-2 text-slate-400">
                        {e.employee_code}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-3 flex justify-between text-[10px]">
                <span className="font-bold text-slate-400">
                  Selected ({selected.length})
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelected(employees)}
                    className="font-semibold text-indigo-600"
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected([])}
                    className="text-slate-400"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-2">
                {selected.length === 0 ? (
                  <div className="py-4 text-center text-xs text-slate-400">
                    None selected
                  </div>
                ) : (
                  selected.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between rounded-lg bg-white px-2 py-1.5 text-[11px]"
                    >
                      <span className="font-semibold text-slate-700">
                        {e.full_name}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSelected((prev) =>
                            prev.filter((x) => x.id !== e.id)
                          )
                        }
                        className="text-slate-300 hover:text-red-500"
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Assignment */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-bold text-slate-800">Assignment</h3>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[9px] font-semibold text-slate-400">
                    FROM
                  </div>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="mt-1 w-full bg-transparent text-sm font-bold outline-none"
                  />
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[9px] font-semibold text-slate-400">
                    TO
                  </div>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="mt-1 w-full bg-transparent text-sm font-bold outline-none"
                  />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {(["SHIFT", "OFF", "LEAVE"] as AssignmentType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`rounded-xl border p-2.5 text-xs font-bold ${
                      type === t
                        ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {type === "SHIFT" && (
                <select
                  value={shiftId}
                  onChange={(e) => setShiftId(e.target.value)}
                  className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold"
                >
                  <option value="">Select shift…</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
              )}

              <select
                value={weekOff}
                onChange={(e) => setWeekOff(e.target.value)}
                className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold"
              >
                <option value="">No weekly off</option>
                <option value="0">Sunday</option>
                <option value="1">Monday</option>
                <option value="2">Tuesday</option>
                <option value="3">Wednesday</option>
                <option value="4">Thursday</option>
                <option value="5">Friday</option>
                <option value="6">Saturday</option>
              </select>

              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                placeholder="Remarks (optional)"
                className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
              />
            </section>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-600 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Roster"}
          </button>
        </div>
      </div>
    </div>
  );
}