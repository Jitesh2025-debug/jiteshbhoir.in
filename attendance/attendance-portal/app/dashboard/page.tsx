"use client";

import { useEffect, useState } from "react";
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

type DeptDayStat = {
  department: string;
  present: number;
  absent: number;
  off: number;
  leave: number;
};

type VendorStat = {
  vendor: string;
  present: number;
  absent: number;
};

type SkillStat = {
  skilled: number;
  semi: number;
  unskilled: number;
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

export default function Dashboard() {
  const supabase = createClient();

  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);

  const [plannedToday, setPlannedToday] = useState(0);
  const [presentToday, setPresentToday] = useState(0);
  const [lateToday, setLateToday] = useState(0);
  const [currentlyWorking, setCurrentlyWorking] = useState(0);

  const [trend, setTrend] = useState<DayTrend[]>([]);
  const [deptDayStats, setDeptDayStats] = useState<DeptDayStat[]>([]);
  const [genderStats, setGenderStats] = useState({
    male: 0,
    female: 0,
    other: 0,
  });
  const [vendorStats, setVendorStats] = useState<VendorStat[]>([]);
  const [skillStats, setSkillStats] = useState<SkillStat>({
    skilled: 0,
    semi: 0,
    unskilled: 0,
  });

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

      if (error || !data || !data.is_active) {
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
      const { data: emps, error: empError } = await supabase
        .from("employees")
        .select("id, department, gender, vendor, employment_type")
        .eq("is_active", true);
      if (empError) throw empError;

      type EmpInfo = {
        department: string;
        gender: string | null;
        vendor: string;
        skill: string;
      };
      const empMap = new Map<string, EmpInfo>();
      (emps || []).forEach((e) => {
        empMap.set(e.id, {
          department: e.department || "Other",
          gender: e.gender || null,
          vendor: e.vendor?.trim() || "No Vendor",
          skill: (e.employment_type || "UNSKILLED").toUpperCase(),
        });
      });
      const activeCount = emps?.length || 0;

      const { data: todayRoster } = await supabase
        .from("rosters")
        .select("employee_id, roster_status")
        .eq("roster_date", today);

      const shiftIds = new Set<string>();
      const offIds = new Set<string>();
      const leaveIds = new Set<string>();
      for (const r of todayRoster || []) {
        if (r.roster_status === "SHIFT") shiftIds.add(r.employee_id);
        else if (r.roster_status === "OFF") offIds.add(r.employee_id);
        else if (r.roster_status === "LEAVE") leaveIds.add(r.employee_id);
      }
      const planned = shiftIds.size > 0 ? shiftIds.size : activeCount;

      const { data: todayAtt, error: attError } = await supabase
        .from("attendance")
        .select("employee_id, check_in, check_out")
        .eq("attendance_date", today)
        .order("check_in", { ascending: false });
      if (attError) throw attError;

      const presentList = (todayAtt || []).filter((a) => a.check_in);
      const presentIds = new Set(presentList.map((a) => a.employee_id));
      const present = presentList.length;
      const working = presentList.filter((a) => !a.check_out).length;

      const late = presentList.filter((a) => {
        if (!a.check_in) return false;
        const hour = new Date(a.check_in).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        const [h, m] = hour.split(":").map(Number);
        return h * 60 + m > 9 * 60 + 15;
      }).length;

      setPlannedToday(planned);
      setPresentToday(present);
      setLateToday(late);
      setCurrentlyWorking(working);

      let male = 0,
        female = 0,
        other = 0;
      for (const a of presentList) {
        const g = (empMap.get(a.employee_id)?.gender || "").toLowerCase().trim();
        if (g === "male" || g === "m") male++;
        else if (g === "female" || g === "f") female++;
        else other++;
      }
      setGenderStats({ male, female, other });

      let skilled = 0,
        semi = 0,
        unskilled = 0;
      for (const a of presentList) {
        const s = empMap.get(a.employee_id)?.skill || "UNSKILLED";
        if (s === "SKILLED") skilled++;
        else if (s === "SEMI_SKILLED") semi++;
        else unskilled++;
      }
      setSkillStats({ skilled, semi, unskilled });

      const deptMap = new Map<
        string,
        { present: number; absent: number; off: number; leave: number }
      >();
      const ensure = (d: string) => {
        if (!deptMap.has(d))
          deptMap.set(d, { present: 0, absent: 0, off: 0, leave: 0 });
        return deptMap.get(d)!;
      };
      for (const id of shiftIds) {
        const dept = empMap.get(id)?.department || "Other";
        if (presentIds.has(id)) ensure(dept).present++;
        else ensure(dept).absent++;
      }
      for (const id of offIds) ensure(empMap.get(id)?.department || "Other").off++;
      for (const id of leaveIds)
        ensure(empMap.get(id)?.department || "Other").leave++;

      if (!shiftIds.size && !offIds.size && !leaveIds.size) {
        for (const e of emps || []) {
          const dept = e.department || "Other";
          if (presentIds.has(e.id)) ensure(dept).present++;
          else ensure(dept).absent++;
        }
      }

      setDeptDayStats(
        Array.from(deptMap.entries())
          .map(([department, v]) => ({ department, ...v }))
          .sort(
            (a, b) =>
              b.present + b.absent + b.off + b.leave -
              (a.present + a.absent + a.off + a.leave)
          )
          .slice(0, 12)
      );

      const vendorMap = new Map<string, { present: number; absent: number }>();
      for (const e of emps || []) {
        const v = e.vendor?.trim() || "No Vendor";
        if (!vendorMap.has(v)) vendorMap.set(v, { present: 0, absent: 0 });
      }
      const plannedSet =
        shiftIds.size > 0 ? shiftIds : new Set((emps || []).map((e) => e.id));
      for (const id of plannedSet) {
        const v = empMap.get(id)?.vendor || "No Vendor";
        if (!vendorMap.has(v)) vendorMap.set(v, { present: 0, absent: 0 });
        if (presentIds.has(id)) vendorMap.get(v)!.present++;
        else vendorMap.get(v)!.absent++;
      }
      for (const a of presentList) {
        if (plannedSet.has(a.employee_id)) continue;
        const v = empMap.get(a.employee_id)?.vendor || "No Vendor";
        if (!vendorMap.has(v)) vendorMap.set(v, { present: 0, absent: 0 });
        vendorMap.get(v)!.present++;
      }
      setVendorStats(
        Array.from(vendorMap.entries())
          .map(([vendor, v]) => ({ vendor, ...v }))
          .sort((a, b) => a.vendor.localeCompare(b.vendor))
      );

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
        plannedByDay.set(r.roster_date, (plannedByDay.get(r.roster_date) || 0) + 1);
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
      console.error(err);
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
    plannedToday > 0 ? Math.round((presentToday / plannedToday) * 100) : 0;

  function hasPermission(p: string) {
    return permissions.includes(p);
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
      <main className="flex min-h-screen items-center justify-center bg-[#f3f4f8]">
        <p className="text-sm text-slate-400">Loading…</p>
      </main>
    );
  }

  const nav = [
    { href: "/dashboard", label: "Dashboard", show: true, active: true },
    {
      href: "/attendance",
      label: "Attendance",
      show: hasPermission("can_attendance"),
    },
    {
      href: "/employees",
      label: "Employees",
      show: hasPermission("can_employees"),
    },
    { href: "/roster", label: "Roster", show: hasPermission("can_roster") },
    { href: "/reports", label: "Reports", show: hasPermission("can_reports") },
    {
      href: "/staff",
      label: "Staff Management",
      show: hasPermission("can_staff"),
    },
    {
      href: "/settings",
      label: "Settings",
      show: hasPermission("can_settings"),
    },
  ];

  return (
    <main className="min-h-screen bg-[#f3f4f8] text-slate-700">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-white/60 bg-white/90 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="rounded-xl bg-[#f3f4f8] p-2 text-slate-500 lg:hidden"
            >
              ☰
            </button>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00b4d8] text-sm font-bold text-white">
                A
              </span>
              <span className="text-base font-bold text-slate-800">
                Attendance Portal
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-800">
                {profile?.full_name}
              </p>
              <p className="text-[11px] capitalize text-slate-400">
                {profile?.role}
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 text-xs font-bold text-white">
              {(profile?.full_name || "A").charAt(0)}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px]">
        {/* Sidebar – Boardto style */}
        <aside
          className={`${
            showMenu ? "block" : "hidden"
          } w-full shrink-0 border-r border-slate-100 bg-white p-4 lg:block lg:w-[220px]`}
        >
          <nav className="space-y-1">
            {nav
              .filter((n) => n.show)
              .map((n) => (
                <a
                  key={n.href}
                  href={n.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    n.active
                      ? "bg-[#00b4d8] text-white shadow-md shadow-cyan-500/20"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  }`}
                >
                  {n.label}
                </a>
              ))}
            <button
              type="button"
              onClick={handleLogout}
              className="mt-4 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50"
            >
              Logout
            </button>
          </nav>
        </aside>

        {/* Main */}
        <section className="min-w-0 flex-1 p-4 sm:p-6">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
              <p className="mt-0.5 text-sm text-slate-400">
                Today’s workforce overview
              </p>
            </div>
            {hasPermission("can_attendance") && (
              <button
                type="button"
                onClick={() => setShowAttendanceModal(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#00b4d8] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 hover:bg-cyan-600"
              >
                + Mark Attendance
              </button>
            )}
          </div>

          {/* KPI cards – icon circles like Boardto */}
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <StatCard
              icon="📋"
              iconBg="bg-slate-100"
              label="Planned Today"
              value={statsLoading ? "—" : plannedToday}
              href="/roster"
              accent="text-slate-800"
            />
            <StatCard
              icon="✓"
              iconBg="bg-emerald-100"
              label="Present"
              value={statsLoading ? "—" : presentToday}
              href="/attendance?filter=present"
              accent="text-emerald-600"
            />
            <StatCard
              icon="!"
              iconBg="bg-rose-100"
              label="Absent"
              value={statsLoading ? "—" : absentToday}
              href="/attendance?filter=absent"
              accent="text-rose-500"
            />
            <StatCard
              icon="⏱"
              iconBg="bg-amber-100"
              label="Late Today"
              value={statsLoading ? "—" : lateToday}
              href="/attendance?filter=late"
              accent="text-amber-500"
            />
            <StatCard
              icon="⚡"
              iconBg="bg-blue-100"
              label="Working"
              value={statsLoading ? "—" : currentlyWorking}
              href="/attendance?filter=working"
              accent="text-blue-600"
            />
            <StatCard
              icon="%"
              iconBg="bg-indigo-100"
              label="Attendance"
              value={statsLoading ? "—" : `${attendancePct}%`}
              href="/reports"
              accent="text-indigo-600"
            />
          </div>

          {/* Charts row */}
          <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
            <WhiteCard
              title="Planned vs Actual"
              subtitle="Last 7 days"
              action={
                <button
                  type="button"
                  onClick={loadStats}
                  disabled={statsLoading}
                  className="rounded-full bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                >
                  Refresh
                </button>
              }
            >
              <PlannedVsActualLineChart data={trend} />
            </WhiteCard>

            <WhiteCard title="Present by Gender" subtitle="Today">
              {statsLoading ? (
                <EmptyState />
              ) : presentToday === 0 ? (
                <EmptyState text="No check-ins yet" />
              ) : (
                <div className="space-y-5 pt-1">
                  <ProgressRow
                    label="Male"
                    value={genderStats.male}
                    total={presentToday}
                    color="bg-blue-500"
                  />
                  <ProgressRow
                    label="Female"
                    value={genderStats.female}
                    total={presentToday}
                    color="bg-pink-500"
                  />
                  {genderStats.other > 0 && (
                    <ProgressRow
                      label="Other"
                      value={genderStats.other}
                      total={presentToday}
                      color="bg-slate-400"
                    />
                  )}
                </div>
              )}
            </WhiteCard>

            <WhiteCard title="Present by Skill" subtitle="Today">
              <SkillBlock stats={skillStats} loading={statsLoading} />
            </WhiteCard>
          </div>

          {/* Department */}
          <div className="mb-5">
            <WhiteCard
              title="Department Today"
              subtitle="Present · Absent · OFF · Leave — click to open"
            >
              <DepartmentList data={deptDayStats} />
            </WhiteCard>
          </div>

          {/* Vendors */}
          <div className="mb-5">
            <WhiteCard title="Vendor-wise Today" subtitle="Present vs Absent">
              {statsLoading ? (
                <EmptyState />
              ) : vendorStats.length === 0 ? (
                <EmptyState text="No vendor data" />
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {vendorStats.map((v, i) => (
                    <VendorCard key={v.vendor} stat={v} index={i} />
                  ))}
                </div>
              )}
            </WhiteCard>
          </div>
        </section>
      </div>

      {showAttendanceModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-2 shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="text-lg font-bold text-slate-800">
                Mark Attendance
              </h2>
              <button
                type="button"
                onClick={() => setShowAttendanceModal(false)}
                className="rounded-full px-2 text-xl text-slate-400 hover:bg-slate-50"
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 p-3">
              <button
                type="button"
                onClick={() => goToScan("checkin")}
                className="flex flex-col items-center gap-3 rounded-2xl bg-emerald-50 p-6 hover:bg-emerald-100"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-white">
                  IN
                </span>
                <span className="text-sm font-semibold text-emerald-800">
                  Check In
                </span>
              </button>
              <button
                type="button"
                onClick={() => goToScan("checkout")}
                className="flex flex-col items-center gap-3 rounded-2xl bg-orange-50 p-6 hover:bg-orange-100"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-white">
                  OUT
                </span>
                <span className="text-sm font-semibold text-orange-800">
                  Check Out
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ════════ Boardto-style UI ════════ */

const ICON_COLORS = [
  "bg-pink-400",
  "bg-emerald-400",
  "bg-sky-400",
  "bg-orange-400",
  "bg-violet-400",
  "bg-amber-400",
  "bg-rose-400",
  "bg-cyan-400",
];

function StatCard({
  icon,
  iconBg,
  label,
  value,
  href,
  accent,
}: {
  icon: string;
  iconBg: string;
  label: string;
  value: string | number;
  href: string;
  accent: string;
}) {
  return (
    <a
      href={href}
      className="rounded-3xl bg-white p-4 shadow-[0_4px_24px_rgba(0,0,0,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]"
    >
      <div
        className={`mb-3 flex h-10 w-10 items-center justify-center rounded-full text-sm ${iconBg}`}
      >
        {icon}
      </div>
      <p className="text-[11px] font-medium text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${accent}`}>{value}</p>
    </a>
  );
}

function WhiteCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-[11px] text-slate-400">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function ProgressRow({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-sm">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="font-bold text-slate-800">
          {value}{" "}
          <span className="text-[11px] font-semibold text-slate-400">
            {pct}%
          </span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function SkillBlock({
  stats,
  loading,
}: {
  stats: SkillStat;
  loading: boolean;
}) {
  if (loading) return <EmptyState />;
  const total = stats.skilled + stats.semi + stats.unskilled;
  if (!total) return <EmptyState text="No present yet" />;
  return (
    <div className="space-y-5 pt-1">
      <ProgressRow
        label="Skilled"
        value={stats.skilled}
        total={total}
        color="bg-indigo-500"
      />
      <ProgressRow
        label="Semi-skilled"
        value={stats.semi}
        total={total}
        color="bg-violet-500"
      />
      <ProgressRow
        label="Unskilled"
        value={stats.unskilled}
        total={total}
        color="bg-cyan-500"
      />
    </div>
  );
}

function DepartmentList({ data }: { data: DeptDayStat[] }) {
  if (!data.length) return <EmptyState text="No department data" />;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-[10px] font-semibold text-slate-400">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /> Present
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-rose-400" /> Absent
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-sky-400" /> OFF
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-400" /> Leave
        </span>
      </div>
      {data.map((d) => {
        const t = d.present + d.absent + d.off + d.leave || 1;
        const pct = Math.round((d.present / t) * 100);
        return (
          <a
            key={d.department}
            href={`/attendance?department=${encodeURIComponent(d.department)}`}
            className="block rounded-2xl bg-[#f8f9fc] px-3 py-3 transition hover:bg-slate-50"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">
                {d.department}
              </span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                {pct}% present
              </span>
            </div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-white">
              <div
                className="bg-emerald-400"
                style={{ width: `${(d.present / t) * 100}%` }}
              />
              <div
                className="bg-rose-400"
                style={{ width: `${(d.absent / t) * 100}%` }}
              />
              <div
                className="bg-sky-400"
                style={{ width: `${(d.off / t) * 100}%` }}
              />
              <div
                className="bg-amber-400"
                style={{ width: `${(d.leave / t) * 100}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-slate-400">
              <span>P {d.present}</span>
              <span>A {d.absent}</span>
              <span>O {d.off}</span>
              <span>L {d.leave}</span>
            </div>
          </a>
        );
      })}
    </div>
  );
}

function VendorCard({ stat, index }: { stat: VendorStat; index: number }) {
  const present = stat.present;
  const absent = stat.absent;
  const total = present + absent;
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;
  const size = 88;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const presentLen = total > 0 ? (present / total) * c : 0;
  const iconBg = ICON_COLORS[index % ICON_COLORS.length];

  return (
    <div className="rounded-3xl bg-[#f8f9fc] p-4 text-center transition hover:bg-white hover:shadow-md">
      <div
        className={`mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white ${iconBg}`}
      >
        {stat.vendor.slice(0, 1).toUpperCase()}
      </div>
      <div className="relative mx-auto" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={stroke}
          />
          {total > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="#10b981"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${presentLen} ${c - presentLen}`}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-slate-800">
            {total === 0 ? "—" : `${pct}%`}
          </span>
        </div>
      </div>
      <p className="mt-2 truncate text-xs font-bold text-slate-700" title={stat.vendor}>
        {stat.vendor}
      </p>
      <p className="mt-1 text-[10px] text-slate-400">
        <span className="font-semibold text-emerald-600">{present}</span>
        {" / "}
        <span className="font-semibold text-rose-400">{absent}</span>
      </p>
    </div>
  );
}

function EmptyState({ text = "Loading…" }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-12 text-sm text-slate-400">
      {text}
    </div>
  );
}

function PlannedVsActualLineChart({ data }: { data: DayTrend[] }) {
  if (!data.length) return <EmptyState text="No trend data" />;

  const width = 560;
  const height = 200;
  const pad = { top: 12, right: 8, bottom: 28, left: 28 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const maxY = Math.max(...data.map((d) => Math.max(d.planned, d.present)), 1);
  const yMax = maxY * 1.1;

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

  function smooth(pts: { x: number; y: number }[], t = 0.25) {
    if (pts.length < 2) return "";
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      d += ` C ${p1.x + (p2.x - p0.x) * t} ${p1.y + (p2.y - p0.y) * t}, ${
        p2.x - (p3.x - p1.x) * t
      } ${p2.y - (p3.y - p1.y) * t}, ${p2.x} ${p2.y}`;
    }
    return d;
  }

  const plannedPath = smooth(points.map((p) => ({ x: p.x, y: p.plannedY })));
  const presentPath = smooth(points.map((p) => ({ x: p.x, y: p.presentY })));
  const area =
    presentPath +
    ` L ${points[points.length - 1].x} ${pad.top + innerH} L ${points[0].x} ${
      pad.top + innerH
    } Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        <defs>
          <linearGradient id="gGreen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#gGreen)" />
        <path
          d={plannedPath}
          fill="none"
          stroke="#cbd5e1"
          strokeWidth="2"
          strokeDasharray="5 4"
        />
        <path d={presentPath} fill="none" stroke="#10b981" strokeWidth="2.5" />
        {points.map((p) => (
          <g key={p.date}>
            <circle
              cx={p.x}
              cy={p.presentY}
              r="3.5"
              fill="#fff"
              stroke="#10b981"
              strokeWidth="2"
            />
            <text
              x={p.x}
              y={height - 6}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize="9"
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}