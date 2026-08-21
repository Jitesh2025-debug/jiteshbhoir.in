"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import MainMenu from "@/components/MainMenu";
import { createClient } from "@/lib/supabase";

type AttendanceRow = {
  id: string;
  employee_id: string;
  employee_code: string;
  full_name: string;
  department: string | null;
  gender: string | null;
  check_in: string | null;
  check_out: string | null;
};

type AbsentRow = {
  employee_id: string;
  employee_code: string;
  full_name: string;
  department: string | null;
  gender: string | null;
};

type FilterType = "all" | "present" | "absent" | "late" | "working";

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
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function isLate(checkIn: string | null): boolean {
  if (!checkIn) return false;
  const hour = new Date(checkIn).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [h, m] = hour.split(":").map(Number);
  return h * 60 + m > 9 * 60 + 15;
}

function normalizeGender(g: string | null | undefined): string {
  if (!g) return "Other";
  const v = g.trim().toLowerCase();
  if (v === "m" || v === "male" || v === "man") return "Male";
  if (v === "f" || v === "female" || v === "woman") return "Female";
  return "Other";
}

const FILTERS: { key: FilterType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "present", label: "Present" },
  { key: "absent", label: "Absent" },
  { key: "late", label: "Late" },
  { key: "working", label: "Working" },
];

function AttendanceContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const router = useRouter();

  const urlFilter = (searchParams.get("filter") as FilterType) || "all";
  const [filter, setFilter] = useState<FilterType>(urlFilter);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string | null>(null);
  const [genderFilter, setGenderFilter] = useState<string | null>(null);

  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [absentRows, setAbsentRows] = useState<AbsentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setFilter(urlFilter);
  }, [urlFilter]);

  async function loadData(currentFilter: FilterType) {
    setLoading(true);
    const today = todayIST();

    try {
      if (currentFilter === "absent") {
        const { data: roster } = await supabase
          .from("rosters")
          .select("employee_id")
          .eq("roster_date", today)
          .eq("roster_status", "SHIFT");

        const rosterIds = (roster || []).map((r) => r.employee_id);

        if (rosterIds.length === 0) {
          setAbsentRows([]);
          setRows([]);
          return;
        }

        const { data: att } = await supabase
          .from("attendance")
          .select("employee_id")
          .eq("attendance_date", today)
          .not("check_in", "is", null);

        const presentIds = new Set((att || []).map((a) => a.employee_id));
        const absentIds = rosterIds.filter((id) => !presentIds.has(id));

        if (absentIds.length === 0) {
          setAbsentRows([]);
          setRows([]);
          return;
        }

        const { data: emps } = await supabase
          .from("employees")
          .select("id, employee_code, full_name, department, gender")
          .in("id", absentIds)
          .eq("is_active", true);

        setAbsentRows(
          (emps || []).map((e) => ({
            employee_id: e.id,
            employee_code: e.employee_code,
            full_name: e.full_name,
            department: e.department,
            gender: e.gender ?? null,
          }))
        );
        setRows([]);
      } else {
        // Prefer selecting gender from attendance if denormalized; otherwise join employees
        const { data } = await supabase
          .from("attendance")
          .select(
            `
            id,
            employee_id,
            employee_code,
            full_name,
            department,
            check_in,
            check_out,
            employees ( gender )
          `
          )
          .eq("attendance_date", today)
          .order("check_in", { ascending: false });

        let list = (data || []).map((a: any) => ({
          id: a.id,
          employee_id: a.employee_id,
          employee_code: a.employee_code,
          full_name: a.full_name,
          department: a.department,
          gender: a.employees?.gender ?? a.gender ?? null,
          check_in: a.check_in,
          check_out: a.check_out,
        })) as AttendanceRow[];

        if (currentFilter === "present") {
          list = list.filter((a) => a.check_in);
        } else if (currentFilter === "late") {
          list = list.filter((a) => a.check_in && isLate(a.check_in));
        } else if (currentFilter === "working") {
          list = list.filter((a) => a.check_in && !a.check_out);
        }

        setRows(list);
        setAbsentRows([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData(filter);
    // reset secondary filters when status filter changes
    setDeptFilter(null);
    setGenderFilter(null);
  }, [filter]);

  function changeFilter(newFilter: FilterType) {
    setFilter(newFilter);
    setSearch("");
    setDeptFilter(null);
    setGenderFilter(null);
    const url =
      newFilter === "all" ? "/attendance" : `/attendance?filter=${newFilter}`;
    router.push(url);
  }

  // ── Apply search + dept + gender filters ───────────────────────────────
  const filteredRows = useMemo(() => {
    let list = rows;
    if (deptFilter) {
      list = list.filter(
        (r) => (r.department || "Unassigned") === deptFilter
      );
    }
    if (genderFilter) {
      list = list.filter(
        (r) => normalizeGender(r.gender) === genderFilter
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.full_name.toLowerCase().includes(q) ||
          r.employee_code.toLowerCase().includes(q) ||
          (r.department || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [rows, search, deptFilter, genderFilter]);

  const filteredAbsent = useMemo(() => {
    let list = absentRows;
    if (deptFilter) {
      list = list.filter(
        (r) => (r.department || "Unassigned") === deptFilter
      );
    }
    if (genderFilter) {
      list = list.filter(
        (r) => normalizeGender(r.gender) === genderFilter
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.full_name.toLowerCase().includes(q) ||
          r.employee_code.toLowerCase().includes(q) ||
          (r.department || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [absentRows, search, deptFilter, genderFilter]);

  const displayCount =
    filter === "absent" ? filteredAbsent.length : filteredRows.length;

  // ── Snapshot data (from unfiltered status list so cards stay stable) ───
  const sourceForSnapshots =
    filter === "absent" ? absentRows : rows;

  const deptSnapshot = useMemo(() => {
    const map = new Map<string, number>();
    sourceForSnapshots.forEach((r) => {
      const d = r.department || "Unassigned";
      map.set(d, (map.get(d) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [sourceForSnapshots]);

  const genderSnapshot = useMemo(() => {
    const map = new Map<string, number>();
    sourceForSnapshots.forEach((r) => {
      const g = normalizeGender(r.gender);
      map.set(g, (map.get(g) || 0) + 1);
    });
    // Prefer fixed order
    const order = ["Male", "Female", "Other"];
    return order
      .filter((g) => map.has(g))
      .map((name) => ({ name, count: map.get(name)! }));
  }, [sourceForSnapshots]);

  // ── Download CSV ────────────────────────────────────────────────────────
  function downloadCSV() {
    const today = todayIST();
    let csvContent = "";
    let filename = `attendance_${filter}_${today}.csv`;

    if (filter === "absent") {
      csvContent = "Employee ID,Name,Department,Gender,Status\n";
      filteredAbsent.forEach((r) => {
        csvContent += `"${r.employee_code}","${r.full_name}","${
          r.department || ""
        }","${normalizeGender(r.gender)}","Absent"\n`;
      });
    } else {
      csvContent =
        "Employee ID,Name,Department,Gender,Check In,Check Out,Status\n";
      filteredRows.forEach((r) => {
        const late = isLate(r.check_in);
        const working = r.check_in && !r.check_out;
        const status = working ? "Working" : late ? "Late" : "Present";

        csvContent += `"${r.employee_code}","${r.full_name}","${
          r.department || ""
        }","${normalizeGender(r.gender)}","${formatTimeIST(
          r.check_in
        )}","${formatTimeIST(r.check_out)}","${status}"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  const titles: Record<FilterType, string> = {
    all: "Today's Attendance",
    present: "Present Today",
    absent: "Absent Today",
    late: "Late Today",
    working: "Currently Working",
  };

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl p-4 sm:p-6">
        <MainMenu />

        {/* Header */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">
              {titles[filter]}
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              {filter === "absent"
                ? "On roster but not checked in"
                : "Attendance records for today"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
              {displayCount} records
            </span>
            <button
              onClick={() => loadData(filter)}
              disabled={loading}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
            <button
              onClick={downloadCSV}
              disabled={loading || displayCount === 0}
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              Download CSV
            </button>
          </div>
        </div>

        {/* Filter Tabs + Search */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => changeFilter(f.key)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
                  filter === f.key
                    ? "bg-slate-800 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, ID, dept..."
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-xs text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* ── Department Snapshot ───────────────────────────────────────── */}
        {!loading && deptSnapshot.length > 0 && (
          <div className="mb-4">
            <div className="mb-1.5 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Department
              </h2>
              {deptFilter && (
                <button
                  onClick={() => setDeptFilter(null)}
                  className="text-[11px] font-medium text-slate-500 hover:text-slate-800"
                >
                  Clear dept filter
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {deptSnapshot.map((d) => {
                const active = deptFilter === d.name;
                return (
                  <button
                    key={d.name}
                    onClick={() =>
                      setDeptFilter(active ? null : d.name)
                    }
                    className={`rounded-lg border px-3 py-2 text-left transition ${
                      active
                        ? "border-slate-800 bg-slate-800 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-[11px] font-medium opacity-80">
                      {d.name}
                    </div>
                    <div className="text-sm font-bold tabular-nums">
                      {d.count}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Gender Snapshot ───────────────────────────────────────────── */}
        {!loading && genderSnapshot.length > 0 && (
          <div className="mb-5">
            <div className="mb-1.5 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Gender
              </h2>
              {genderFilter && (
                <button
                  onClick={() => setGenderFilter(null)}
                  className="text-[11px] font-medium text-slate-500 hover:text-slate-800"
                >
                  Clear gender filter
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {genderSnapshot.map((g) => {
                const active = genderFilter === g.name;
                const color =
                  g.name === "Male"
                    ? active
                      ? "border-blue-700 bg-blue-700 text-white"
                      : "border-blue-100 bg-blue-50 text-blue-800 hover:border-blue-200"
                    : g.name === "Female"
                    ? active
                      ? "border-pink-700 bg-pink-700 text-white"
                      : "border-pink-100 bg-pink-50 text-pink-800 hover:border-pink-200"
                    : active
                    ? "border-slate-700 bg-slate-700 text-white"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300";
                return (
                  <button
                    key={g.name}
                    onClick={() =>
                      setGenderFilter(active ? null : g.name)
                    }
                    className={`rounded-lg border px-3 py-2 text-left transition ${color}`}
                  >
                    <div className="text-[11px] font-medium opacity-80">
                      {g.name}
                    </div>
                    <div className="text-sm font-bold tabular-nums">
                      {g.count}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Active secondary filters hint */}
        {(deptFilter || genderFilter) && (
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span>Filtered by:</span>
            {deptFilter && (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 font-medium text-slate-700">
                {deptFilter}
              </span>
            )}
            {genderFilter && (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 font-medium text-slate-700">
                {genderFilter}
              </span>
            )}
          </div>
        )}

        {/* Table Card */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400">
              Loading records...
            </div>
          ) : filter === "absent" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-4 py-2.5 font-medium text-slate-500">
                      Emp ID
                    </th>
                    <th className="px-4 py-2.5 font-medium text-slate-500">
                      Name
                    </th>
                    <th className="px-4 py-2.5 font-medium text-slate-500">
                      Department
                    </th>
                    <th className="px-4 py-2.5 font-medium text-slate-500">
                      Gender
                    </th>
                    <th className="px-4 py-2.5 font-medium text-slate-500">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAbsent.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-12 text-center text-slate-400"
                      >
                        {search || deptFilter || genderFilter
                          ? "No matching records"
                          : "No absentees found"}
                      </td>
                    </tr>
                  ) : (
                    filteredAbsent.map((item) => (
                      <tr
                        key={item.employee_id}
                        className="border-b border-slate-50 hover:bg-slate-50/50"
                      >
                        <td className="px-4 py-2.5 font-medium text-slate-700">
                          {item.employee_code}
                        </td>
                        <td className="px-4 py-2.5 text-slate-800">
                          {item.full_name}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">
                          {item.department || "—"}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">
                          {normalizeGender(item.gender)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">
                            Absent
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-4 py-2.5 font-medium text-slate-500">
                      Emp ID
                    </th>
                    <th className="px-4 py-2.5 font-medium text-slate-500">
                      Name
                    </th>
                    <th className="px-4 py-2.5 font-medium text-slate-500">
                      Department
                    </th>
                    <th className="px-4 py-2.5 font-medium text-slate-500">
                      Gender
                    </th>
                    <th className="px-4 py-2.5 font-medium text-slate-500">
                      Check In
                    </th>
                    <th className="px-4 py-2.5 font-medium text-slate-500">
                      Check Out
                    </th>
                    <th className="px-4 py-2.5 font-medium text-slate-500">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-12 text-center text-slate-400"
                      >
                        {search || deptFilter || genderFilter
                          ? "No matching records"
                          : "No records found"}
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((item) => {
                      const late = isLate(item.check_in);
                      const working = item.check_in && !item.check_out;

                      return (
                        <tr
                          key={item.id}
                          className="border-b border-slate-50 hover:bg-slate-50/50"
                        >
                          <td className="px-4 py-2.5 font-medium text-slate-700">
                            {item.employee_code}
                          </td>
                          <td className="px-4 py-2.5 text-slate-800">
                            {item.full_name}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">
                            {item.department || "—"}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">
                            {normalizeGender(item.gender)}
                          </td>
                          <td className="px-4 py-2.5 text-slate-700">
                            {formatTimeIST(item.check_in)}
                          </td>
                          <td className="px-4 py-2.5 text-slate-700">
                            {item.check_out
                              ? formatTimeIST(item.check_out)
                              : "—"}
                          </td>
                          <td className="px-4 py-2.5">
                            {working ? (
                              <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                                Working
                              </span>
                            ) : late ? (
                              <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                                Late
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                                Present
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );

}

export default function AttendancePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="text-sm text-slate-500">
            Loading attendance...
          </div>
        </div>
      }
    >
      <AttendanceContent />
    </Suspense>
  );
}
