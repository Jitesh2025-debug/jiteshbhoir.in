"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { getUserPermissions } from "@/lib/permissions";

type StaffProfile = {
  username: string;
  full_name: string;
  role: string;
};

type DayTrend = {
  date: string;
  label: string;
  planned: number;
  present: number;
  absent: number;
};

type DeptStat = {
  department: string;
  present: number;
  planned: number;
};

function todayIST(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function formatDateIST(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function formatTimeIST(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function Dashboard() {
  const supabase = createClient();

  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);

  const [statsLoading, setStatsLoading] = useState(true);
  const [plannedToday, setPlannedToday] = useState(0);
  const [presentToday, setPresentToday] = useState(0);
  const [lateToday, setLateToday] = useState(0);
  const [currentlyWorking, setCurrentlyWorking] = useState(0);
  const [trend, setTrend] = useState<DayTrend[]>([]);
  const [deptStats, setDeptStats] = useState<DeptStat[]>([]);
  const [recentScans, setRecentScans] = useState<
    { full_name: string; check_in: string | null; check_out: string | null; department: string | null }[]
  >([]);

  const today = todayIST();

  useEffect(() => {
    async function loadDashboard() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/";
        return;
      }

      const { data, error } = await supabase
        .from("staff_profiles")
        .select("username, full_name, role, first_login, is_active")
        .eq("id", user.id)
        .single();

      if (error || !data) {
        await supabase.auth.signOut();
        window.location.href = "/";
        return;
      }

      if (!data.is_active) {
        await supabase.auth.signOut();
        window.location.href = "/";
        return;
      }

      if (data.first_login) {
        window.location.href = "/change-password";
        return;
      }

      const userPermissions = await getUserPermissions();

      setProfile({
        username: data.username,
        full_name: data.full_name,
        role: data.role,
      });
      setPermissions(userPermissions);
      setLoading(false);
    }

    loadDashboard();
  }, [supabase]);

  async function loadStats() {
    setStatsLoading(true);
    try {
      // Active employees
      const { data: emps, error: empError } = await supabase
        .from("employees")
        .select("id, department")
        .eq("is_active", true);

      if (empError) throw empError;
      const activeCount = emps?.length || 0;

      // Today planned (roster SHIFT)
      const { data: todayRoster, error: rosterError } = await supabase
        .from("rosters")
        .select("employee_id")
        .eq("roster_date", today)
        .eq("roster_status", "SHIFT");

      if (rosterError) console.warn("Roster warning:", rosterError);

      const planned =
        todayRoster && todayRoster.length > 0
          ? todayRoster.length
          : activeCount;

      // Today attendance
      const { data: todayAtt, error: attError } = await supabase
        .from("attendance")
        .select("employee_id, check_in, check_out, full_name, department")
        .eq("attendance_date", today)
        .order("check_in", { ascending: false });

      if (attError) throw attError;

      const presentList = (todayAtt || []).filter((a) => a.check_in);
      const present = presentList.length;
      const working = presentList.filter((a) => !a.check_out).length;

      // Simple late count (check-in after 09:15 IST as example – adjust as needed)
      const late = presentList.filter((a) => {
        if (!a.check_in) return false;
        const d = new Date(a.check_in);
        const mins =
          d.getUTCHours() * 60 +
          d.getUTCMinutes() +
          330; // rough IST offset for comparison
        // Better: use actual shift start later. For now use 9:15 threshold
        const hour = new Date(a.check_in).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        const [h, m] = hour.split(":").map(Number);
        return h * 60 + m > 9 * 60 + 15; // after 09:15
      }).length;

      setPlannedToday(planned);
      setPresentToday(present);
      setLateToday(late);
      setCurrentlyWorking(working);

      // Recent scans (last 8)
      setRecentScans(
        presentList.slice(0, 8).map((a) => ({
          full_name: a.full_name || "—",
          check_in: a.check_in,
          check_out: a.check_out,
          department: a.department,
        }))
      );

      // Department stats (today)
      const deptMap = new Map<string, { present: number; planned: number }>();
      for (const e of emps || []) {
        const dept = e.department || "Other";
        if (!deptMap.has(dept)) deptMap.set(dept, { present: 0, planned: 0 });
        deptMap.get(dept)!.planned += 1;
      }
      for (const a of presentList) {
        const dept = a.department || "Other";
        if (!deptMap.has(dept)) deptMap.set(dept, { present: 0, planned: 0 });
        deptMap.get(dept)!.present += 1;
      }
      const deptArr = Array.from(deptMap.entries())
        .map(([department, v]) => ({
          department,
          present: v.present,
          planned: v.planned,
        }))
        .sort((a, b) => b.present - a.present)
        .slice(0, 6);
      setDeptStats(deptArr);

      // Last 7 days trend
      const days: DayTrend[] = [];
      const now = new Date();

      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        days.push({
          date: formatDateIST(d),
          label: d.toLocaleDateString("en-IN", {
            weekday: "short",
            day: "numeric",
          }),
          planned: 0,
          present: 0,
          absent: 0,
        });
      }

      const fromDate = days[0].date;
      const toDate = days[days.length - 1].date;

      const [weekRosterRes, weekAttRes] = await Promise.all([
        supabase
          .from("rosters")
          .select("roster_date")
          .gte("roster_date", fromDate)
          .lte("roster_date", toDate)
          .eq("roster_status", "SHIFT"),
        supabase
          .from("attendance")
          .select("attendance_date, check_in")
          .gte("attendance_date", fromDate)
          .lte("attendance_date", toDate),
      ]);

      const plannedByDay = new Map<string, number>();
      const presentByDay = new Map<string, number>();

      for (const r of weekRosterRes.data || []) {
        plannedByDay.set(
          r.roster_date,
          (plannedByDay.get(r.roster_date) || 0) + 1
        );
      }

      for (const a of weekAttRes.data || []) {
        if (!a.check_in) continue;
        presentByDay.set(
          a.attendance_date,
          (presentByDay.get(a.attendance_date) || 0) + 1
        );
      }

      for (const day of days) {
        day.planned = plannedByDay.get(day.date) ?? activeCount;
        day.present = presentByDay.get(day.date) ?? 0;
        day.absent = Math.max(0, day.planned - day.present);
      }

      setTrend(days);
    } catch (err) {
      console.error("Stats error:", err);
    } finally {
      setStatsLoading(false);
    }
  }

  useEffect(() => {
    if (!loading) {
      loadStats();
      const id = setInterval(loadStats, 60_000);
      return () => clearInterval(id);
    }
  }, [loading, today]);

  const absentToday = Math.max(0, plannedToday - presentToday);
  const attendancePct =
    plannedToday > 0
      ? Math.round((presentToday / plannedToday) * 100)
      : 0;

  function hasPermission(permission: string) {
    return permissions.includes(permission);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  function goToScan(type: "checkin" | "checkout") {
    setShowAttendanceModal(false);
    window.location.href = `/attendance/scan?type=${type}`;
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-500">Loading dashboard...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
        <h1 className="text-lg font-bold text-slate-800">Attendance Portal</h1>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium text-slate-800">
              {profile?.full_name}
            </p>
            <p className="text-xs text-slate-500 capitalize">{profile?.role}</p>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 min-h-[calc(100vh-4rem)] bg-white border-r border-slate-200 p-4">
          <nav className="space-y-1">
            <a
              href="/dashboard"
              className="block rounded-lg bg-slate-100 px-4 py-3 text-sm font-medium text-slate-800"
            >
              Dashboard
            </a>

            {hasPermission("attendance.view") && (
              <a
                href="/attendance"
                className="block rounded-lg px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Attendance
              </a>
            )}

            {hasPermission("reports.view") && (
              <a
                href="/reports"
                className="block rounded-lg px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Reports
              </a>
            )}

            {hasPermission("staff.view") && (
              <a
                href="/staff"
                className="block rounded-lg px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Staff Management
              </a>
            )}

            {hasPermission("staff.view") && (
              <a
                href="/employees"
                className="block rounded-lg px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Employees
              </a>
            )}

            {hasPermission("staff.view") && (
              <a
                href="/roster"
                className="block rounded-lg px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Roster
              </a>
            )}

            {hasPermission("settings.manage") && (
              <a
                href="/settings"
                className="block rounded-lg px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Settings
              </a>
            )}
          </nav>
        </aside>

        {/* Main */}
        <section className="flex-1 p-6 lg:p-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
              <p className="mt-1 text-sm text-slate-500">
                Welcome back, {profile?.full_name}.
              </p>
            </div>

            {hasPermission("attendance.view") && (
              <button
                type="button"
                onClick={() => setShowAttendanceModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
              >
                Mark Attendance
              </button>
            )}
          </div>

          {/* KPI Cards - Clickable */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <SummaryCard
              label="Planned Today"
              value={statsLoading ? "—" : plannedToday}
              color="slate"
              href="/roster"
            />
            <SummaryCard
              label="Present"
              value={statsLoading ? "—" : presentToday}
              color="green"
              href="/attendance"
            />
            <SummaryCard
              label="Absent"
              value={statsLoading ? "—" : absentToday}
              color="red"
              href="/attendance"
            />
            <SummaryCard
              label="Late Today"
              value={statsLoading ? "—" : lateToday}
              color="amber"
              href="/attendance"
            />
            <SummaryCard
              label="Currently Working"
              value={statsLoading ? "—" : currentlyWorking}
              color="blue"
              href="/attendance"
            />
            <SummaryCard
              label="Attendance %"
              value={statsLoading ? "—" : `${attendancePct}%`}
              color="indigo"
              href="/reports"
            />
          </div>

          {/* Charts Row */}
          <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            {/* Line Chart */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">
                    Planned vs Actual
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">Last 7 days</p>
                </div>
                <button
                  type="button"
                  onClick={loadStats}
                  disabled={statsLoading}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  {statsLoading ? "Loading..." : "Refresh"}
                </button>
              </div>
              <PlannedVsActualLineChart data={trend} />
            </div>

            {/* Bar Chart */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-800">
                  Present vs Absent
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">Last 7 days</p>
              </div>
              <PresentAbsentBarChart data={trend} />
            </div>
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Department Snapshot */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">
                    Department Snapshot
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">Today</p>
                </div>
                <a
                  href="/reports"
                  className="text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                  View all →
                </a>
              </div>

              {deptStats.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">
                  No department data yet
                </p>
              ) : (
                <div className="space-y-3">
                  {deptStats.map((d) => {
                    const pct =
                      d.planned > 0
                        ? Math.round((d.present / d.planned) * 100)
                        : 0;
                    return (
                      <div key={d.department}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-700">
                            {d.department}
                          </span>
                          <span className="text-slate-500">
                            {d.present}/{d.planned} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent Activity */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">
                    Recent Check-ins
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">Today</p>
                </div>
                <a
                  href="/attendance"
                  className="text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                  View all →
                </a>
              </div>

              {recentScans.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">
                  No check-ins yet today
                </p>
              ) : (
                <div className="space-y-2">
                  {recentScans.map((scan, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {scan.full_name}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {scan.department || "—"}
                        </p>
                      </div>
                      <div className="ml-3 shrink-0 text-right text-xs">
                        {scan.check_in && (
                          <p className="font-medium text-green-700">
                            In {formatTimeIST(scan.check_in)}
                          </p>
                        )}
                        {scan.check_out ? (
                          <p className="text-orange-600">
                            Out {formatTimeIST(scan.check_out)}
                          </p>
                        ) : (
                          <p className="text-slate-400">Still working</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Report Links */}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">
              Quick Reports
            </h3>
            <div className="flex flex-wrap gap-2">
              <QuickLink href="/attendance" label="Today's Attendance" />
              <QuickLink href="/reports" label="Daily Report" />
              <QuickLink href="/reports" label="Late Report" />
              <QuickLink href="/roster" label="Today's Roster" />
              <QuickLink href="/employees" label="Employee List" />
            </div>
          </div>
        </section>
      </div>

      {/* Mark Attendance Modal */}
      {showAttendanceModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  Mark Attendance
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Choose check-in or check-out to start scanning
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAttendanceModal(false)}
                className="rounded-lg px-3 py-1 text-xl text-slate-400 hover:bg-slate-100"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => goToScan("checkin")}
                className="group flex flex-col items-center gap-3 rounded-xl border-2 border-green-200 bg-green-50 p-6 transition hover:border-green-400 hover:bg-green-100"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white shadow-sm transition group-hover:scale-105">
                  <span className="text-lg font-bold">IN</span>
                </div>
                <div className="text-center">
                  <p className="text-base font-semibold text-green-800">
                    Check In
                  </p>
                  <p className="mt-0.5 text-xs text-green-600">
                    Mark employee arrival
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => goToScan("checkout")}
                className="group flex flex-col items-center gap-3 rounded-xl border-2 border-orange-200 bg-orange-50 p-6 transition hover:border-orange-400 hover:bg-orange-100"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-500 text-white shadow-sm transition group-hover:scale-105">
                  <span className="text-lg font-bold">OUT</span>
                </div>
                <div className="text-center">
                  <p className="text-base font-semibold text-orange-800">
                    Check Out
                  </p>
                  <p className="mt-0.5 text-xs text-orange-600">
                    Mark employee departure
                  </p>
                </div>
              </button>
            </div>

            <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">
              <p className="text-center text-xs text-slate-500">
                After selecting, scan the employee barcode to mark attendance
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ─── Small Components ───────────────────────────────────────────────────── */

function SummaryCard({
  label,
  value,
  color,
  href,
}: {
  label: string;
  value: string | number;
  color: "slate" | "green" | "red" | "amber" | "blue" | "indigo";
  href: string;
}) {
  const colors = {
    slate: "text-slate-800",
    green: "text-green-700",
    red: "text-red-600",
    amber: "text-amber-600",
    blue: "text-blue-600",
    indigo: "text-indigo-600",
  };

  return (
    <a
      href={href}
      className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
    >
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${colors[color]}`}>{value}</p>
      <p className="mt-2 text-[10px] font-medium text-slate-400 opacity-0 transition group-hover:opacity-100">
        View details →
      </p>
    </a>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white hover:text-slate-900"
    >
      {label}
    </a>
  );
}

/* ─── Line Chart ─────────────────────────────────────────────────────────── */

function PlannedVsActualLineChart({ data }: { data: DayTrend[] }) {
  if (!data.length) {
    return (
      <p className="py-16 text-center text-sm text-slate-400">
        No trend data yet
      </p>
    );
  }

  const width = 720;
  const height = 280;
  const pad = { top: 28, right: 28, bottom: 48, left: 44 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const maxY = Math.max(
    ...data.map((d) => Math.max(d.planned, d.present)),
    1
  );
  const yMax = maxY * 1.15;

  const points = data.map((d, i) => {
    const px =
      pad.left +
      (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
    return {
      x: px,
      plannedY: pad.top + innerH - (d.planned / yMax) * innerH,
      presentY: pad.top + innerH - (d.present / yMax) * innerH,
      ...d,
    };
  });

  function smoothLine(pts: { x: number; y: number }[], tension = 0.25): string {
    if (pts.length < 2) return "";
    if (pts.length === 2) {
      return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
    }
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? 0 : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }

  const plannedPts = points.map((p) => ({ x: p.x, y: p.plannedY }));
  const presentPts = points.map((p) => ({ x: p.x, y: p.presentY }));
  const plannedPath = smoothLine(plannedPts);
  const presentPath = smoothLine(presentPts);
  const areaPath =
    presentPath +
    ` L ${points[points.length - 1].x} ${pad.top + innerH}` +
    ` L ${points[0].x} ${pad.top + innerH} Z`;

  const gridLines = 4;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label="Planned vs Actual line chart"
      >
        <defs>
          <linearGradient id="presentFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {Array.from({ length: gridLines + 1 }).map((_, i) => {
          const gy = pad.top + (innerH / gridLines) * i;
          const val = Math.round(yMax - (yMax / gridLines) * i);
          return (
            <g key={i}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={gy}
                y2={gy}
                stroke="#f1f5f9"
                strokeWidth="1"
              />
              <text
                x={pad.left - 10}
                y={gy + 3}
                textAnchor="end"
                fill="#94a3b8"
                fontSize="11"
              >
                {val}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill="url(#presentFill)" />
        <path
          d={plannedPath}
          fill="none"
          stroke="#94a3b8"
          strokeWidth="2.5"
          strokeDasharray="7 5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={presentPath}
          fill="none"
          stroke="#22c55e"
          strokeWidth="2.75"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {points.map((p) => (
          <g key={p.date}>
            <circle
              cx={p.x}
              cy={p.plannedY}
              r="4"
              fill="#fff"
              stroke="#64748b"
              strokeWidth="2"
            />
            <circle
              cx={p.x}
              cy={p.presentY}
              r="4.5"
              fill="#fff"
              stroke="#16a34a"
              strokeWidth="2.25"
            />
            {p.present > 0 && (
              <text
                x={p.x}
                y={p.presentY - 10}
                textAnchor="middle"
                fill="#16a34a"
                fontSize="10"
                fontWeight="600"
              >
                {p.present}
              </text>
            )}
            <text
              x={p.x}
              y={height - 16}
              textAnchor="middle"
              fill="#64748b"
              fontSize="11"
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>

      <div className="mt-1 flex items-center justify-center gap-8 text-xs text-slate-600">
        <span className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-6 rounded border-t-2 border-dashed border-slate-400" />
          Planned
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-6 rounded bg-green-500" />
          Actual (Present)
        </span>
      </div>
    </div>
  );
}

/* ─── Bar Chart ──────────────────────────────────────────────────────────── */

function PresentAbsentBarChart({ data }: { data: DayTrend[] }) {
  if (!data.length) {
    return (
      <p className="py-16 text-center text-sm text-slate-400">
        No trend data yet
      </p>
    );
  }

  const width = 720;
  const height = 280;
  const pad = { top: 28, right: 20, bottom: 48, left: 44 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const maxY = Math.max(...data.map((d) => Math.max(d.present, d.absent)), 1);
  const yMax = maxY * 1.2;

  const barGroupWidth = innerW / data.length;
  const barWidth = Math.min(22, barGroupWidth * 0.32);
  const gap = 4;

  const gridLines = 4;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label="Present vs Absent bar chart"
      >
        {Array.from({ length: gridLines + 1 }).map((_, i) => {
          const gy = pad.top + (innerH / gridLines) * i;
          const val = Math.round(yMax - (yMax / gridLines) * i);
          return (
            <g key={i}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={gy}
                y2={gy}
                stroke="#f1f5f9"
                strokeWidth="1"
              />
              <text
                x={pad.left - 10}
                y={gy + 3}
                textAnchor="end"
                fill="#94a3b8"
                fontSize="11"
              >
                {val}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const cx = pad.left + barGroupWidth * i + barGroupWidth / 2;
          const presentH = (d.present / yMax) * innerH;
          const absentH = (d.absent / yMax) * innerH;

          return (
            <g key={d.date}>
              {/* Present bar */}
              <rect
                x={cx - barWidth - gap / 2}
                y={pad.top + innerH - presentH}
                width={barWidth}
                height={presentH}
                rx="4"
                fill="#22c55e"
              />
              {/* Absent bar */}
              <rect
                x={cx + gap / 2}
                y={pad.top + innerH - absentH}
                width={barWidth}
                height={absentH}
                rx="4"
                fill="#f87171"
              />
              {/* Labels */}
              <text
                x={cx}
                y={height - 16}
                textAnchor="middle"
                fill="#64748b"
                fontSize="11"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-1 flex items-center justify-center gap-8 text-xs text-slate-600">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-green-500" />
          Present
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-400" />
          Absent
        </span>
      </div>
    </div>
  );
}