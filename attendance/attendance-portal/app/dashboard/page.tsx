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

function AnimatedNumber({ value }: { value: number | string }) {
  const [display, setDisplay] = useState(0);
  const isNumber = typeof value === "number";

  useEffect(() => {
    if (!isNumber) return;
    let start = 0;
    const end = value as number;
    const startTime = performance.now();
    const duration = 850;

    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (end - start) * ease));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value, isNumber]);

  if (!isNumber) return <>{value}</>;
  return <>{display}</>;
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
  const [genderStats, setGenderStats] = useState({ male: 0, female: 0, other: 0 });
  const [vendorStats, setVendorStats] = useState<VendorStat[]>([]);
  const [skillStats, setSkillStats] = useState<SkillStat>({ skilled: 0, semi: 0, unskilled: 0 });
  const [darkMode, setDarkMode] = useState(true);

  const today = todayIST();

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light") setDarkMode(false);
    else setDarkMode(true);
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  useEffect(() => {
    async function loadDashboard() {
      const { data: { user } } = await supabase.auth.getUser();
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

      type EmpInfo = { department: string; gender: string | null; vendor: string; skill: string };
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

      let male = 0, female = 0, other = 0;
      for (const a of presentList) {
        const g = (empMap.get(a.employee_id)?.gender || "").toLowerCase().trim();
        if (g === "male" || g === "m") male++;
        else if (g === "female" || g === "f") female++;
        else other++;
      }
      setGenderStats({ male, female, other });

      let skilled = 0, semi = 0, unskilled = 0;
      for (const a of presentList) {
        const s = empMap.get(a.employee_id)?.skill || "UNSKILLED";
        if (s === "SKILLED") skilled++;
        else if (s === "SEMI_SKILLED") semi++;
        else unskilled++;
      }
      setSkillStats({ skilled, semi, unskilled });

      const deptMap = new Map<string, { present: number; absent: number; off: number; leave: number }>();
      const ensure = (d: string) => {
        if (!deptMap.has(d)) deptMap.set(d, { present: 0, absent: 0, off: 0, leave: 0 });
        return deptMap.get(d)!;
      };

      for (const id of shiftIds) {
        const dept = empMap.get(id)?.department || "Other";
        if (presentIds.has(id)) ensure(dept).present++;
        else ensure(dept).absent++;
      }
      for (const id of offIds) ensure(empMap.get(id)?.department || "Other").off++;
      for (const id of leaveIds) ensure(empMap.get(id)?.department || "Other").leave++;

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
          .sort((a, b) => b.present + b.absent + b.off + b.leave - (a.present + a.absent + a.off + a.leave))
          .slice(0, 12)
      );

      const vendorMap = new Map<string, { present: number; absent: number }>();
      for (const e of emps || []) {
        const v = e.vendor?.trim() || "No Vendor";
        if (!vendorMap.has(v)) vendorMap.set(v, { present: 0, absent: 0 });
      }

      const plannedSet = shiftIds.size > 0 ? shiftIds : new Set((emps || []).map((e) => e.id));

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
          label: d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" }),
          planned: 0,
          present: 0,
          absent: 0,
        });
      }

      const fromDate = days[0].date;
      const toDate = days[days.length - 1].date;

      const [weekRosterRes, weekAttRes] = await Promise.all([
        supabase.from("rosters").select("roster_date").gte("roster_date", fromDate).lte("roster_date", toDate).eq("roster_status", "SHIFT"),
        supabase.from("attendance").select("attendance_date, check_in").gte("attendance_date", fromDate).lte("attendance_date", toDate),
      ]);

      const plannedByDay = new Map<string, number>();
      const presentByDay = new Map<string, number>();

      for (const r of weekRosterRes.data || []) {
        plannedByDay.set(r.roster_date, (plannedByDay.get(r.roster_date) || 0) + 1);
      }
      for (const a of weekAttRes.data || []) {
        if (!a.check_in) continue;
        presentByDay.set(a.attendance_date, (presentByDay.get(a.attendance_date) || 0) + 1);
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
  const attendancePct = plannedToday > 0 ? Math.round((presentToday / plannedToday) * 100) : 0;

  // Departments with lowest attendance (for Needs Attention)
  const lowAttendanceDepts = [...deptDayStats]
    .map((d) => {
      const total = d.present + d.absent || 1;
      return { ...d, pct: Math.round((d.present / total) * 100) };
    })
    .filter((d) => d.pct < 70)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 4);

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
      <main className="flex min-h-screen items-center justify-center bg-[#0B0F19]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-slate-700 border-t-blue-500" />
          <p className="text-sm text-slate-400">Loading dashboard…</p>
        </div>
      </main>
    );
  }

  const nav = [
    { href: "/dashboard", label: "Dashboard", show: true, active: true },
    { href: "/attendance", label: "Attendance", show: hasPermission("can_attendance") },
    { href: "/employees", label: "Employees", show: hasPermission("can_employees") },
    { href: "/roster", label: "Roster", show: hasPermission("can_roster") },
    { href: "/reports", label: "Reports", show: hasPermission("can_reports") },
    { href: "/staff", label: "Staff", show: hasPermission("can_staff") },
    { href: "/settings", label: "Settings", show: hasPermission("can_settings") },
  ];

  return (
    <main className={`min-h-screen transition-colors duration-300 ${darkMode ? "bg-[#0B0F19] text-slate-100" : "bg-[#F1F5F9] text-slate-900"}`}>
      <div className="mx-auto flex min-h-screen max-w-[1500px]">
        
        {/* Sidebar */}
        <aside className={`${showMenu ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-50 w-[240px] border-r transition-all duration-300 lg:static lg:translate-x-0 ${
          darkMode ? "border-slate-800/80 bg-[#0F1420]" : "border-slate-200 bg-white"
        }`}>
          <div className={`flex h-16 items-center gap-3 border-b px-5 ${darkMode ? "border-slate-800/80" : "border-slate-200"}`}>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              A
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">Attendance</p>
              <p className={`text-[11px] ${darkMode ? "text-slate-500" : "text-slate-400"}`}>Portal</p>
            </div>
          </div>

          <nav className="space-y-1 p-3">
            {nav.filter(n => n.show).map((n) => (
              <a
                key={n.href}
                href={n.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  n.active
                    ? darkMode 
                      ? "bg-blue-600/15 text-blue-400" 
                      : "bg-blue-50 text-blue-700"
                    : darkMode
                      ? "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {n.label}
              </a>
            ))}

            <button
              type="button"
              onClick={handleLogout}
              className={`mt-6 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                darkMode 
                  ? "text-slate-500 hover:bg-rose-500/10 hover:text-rose-400" 
                  : "text-slate-500 hover:bg-rose-50 hover:text-rose-600"
              }`}
            >
              Log out
            </button>
          </nav>
        </aside>

        {showMenu && (
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setShowMenu(false)} />
        )}

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          
          {/* Header */}
          <header className={`sticky top-0 z-30 flex h-16 items-center justify-between border-b px-5 sm:px-8 ${
            darkMode ? "border-slate-800/80 bg-[#0B0F19]/80 backdrop-blur-xl" : "border-slate-200 bg-white/80 backdrop-blur-xl"
          }`}>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                className={`rounded-lg p-2 lg:hidden ${darkMode ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"}`}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <h1 className="text-sm font-semibold">Dashboard</h1>
                <p className={`text-xs ${darkMode ? "text-slate-500" : "text-slate-400"}`}>Workforce overview · {today}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setDarkMode(!darkMode)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${
                  darkMode 
                    ? "border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-800" 
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {darkMode ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>

              {hasPermission("can_attendance") && (
                <button
                  type="button"
                  onClick={() => setShowAttendanceModal(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                >
                  + Mark Attendance
                </button>
              )}

              <div className={`ml-1 flex items-center gap-3 border-l pl-4 ${darkMode ? "border-slate-800" : "border-slate-200"}`}>
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-medium">{profile?.full_name}</p>
                  <p className={`text-xs capitalize ${darkMode ? "text-slate-500" : "text-slate-400"}`}>{profile?.role}</p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                  {(profile?.full_name || "A").charAt(0)}
                </div>
              </div>
            </div>
          </header>

          {/* Content */}
          <div className="flex-1 p-5 sm:p-8">
            
            {/* Greeting */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold tracking-tight sm:text-[28px]">
                Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {profile?.full_name?.split(" ")[0] || "there"}
              </h2>
              <p className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                Here’s what’s happening with your workforce today
              </p>
            </div>

            {/* KPI Cards */}
            <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
              {[
                { label: "Planned", value: plannedToday, href: "/roster", accent: "bg-slate-500" },
                { label: "Present", value: presentToday, href: "/attendance?filter=present", accent: "bg-emerald-500" },
                { label: "Absent", value: absentToday, href: "/attendance?filter=absent", accent: "bg-rose-500" },
                { label: "Late", value: lateToday, href: "/attendance?filter=late", accent: "bg-amber-500" },
                { label: "Working", value: currentlyWorking, href: "/attendance?filter=working", accent: "bg-sky-500" },
                { label: "Attendance", value: `${attendancePct}%`, href: "/reports", accent: "bg-blue-500" },
              ].map((kpi) => (
                <a
                  key={kpi.label}
                  href={kpi.href}
                  className={`group relative overflow-hidden rounded-xl border p-5 transition-all duration-200 hover:-translate-y-0.5 ${
                    darkMode 
                      ? "border-slate-800 bg-[#121826] hover:border-slate-700 hover:bg-[#151c2c]" 
                      : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
                  }`}
                >
                  <div className={`mb-4 h-1.5 w-8 rounded-full ${kpi.accent}`} />
                  <p className={`text-xs font-medium ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{kpi.label}</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight">
                    {statsLoading ? "—" : typeof kpi.value === "number" ? <AnimatedNumber value={kpi.value} /> : kpi.value}
                  </p>
                </a>
              ))}
            </div>

            {/* Main Charts + Needs Attention */}
            <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
              {/* Trend Chart */}
              <div className="xl:col-span-2">
                <div className={`rounded-xl border p-6 ${darkMode ? "border-slate-800 bg-[#121826]" : "border-slate-200 bg-white"}`}>
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold">Attendance Trend</h3>
                      <p className={`text-xs ${darkMode ? "text-slate-500" : "text-slate-400"}`}>Planned vs Actual · Last 7 days</p>
                    </div>
                    <button
                      type="button"
                      onClick={loadStats}
                      disabled={statsLoading}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                        darkMode 
                          ? "text-slate-400 hover:bg-slate-800 hover:text-slate-200" 
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                      } disabled:opacity-50`}
                    >
                      Refresh
                    </button>
                  </div>
                  <PlannedVsActualLineChart data={trend} dark={darkMode} />
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* Attendance Rate */}
                <div className={`rounded-xl border p-6 ${darkMode ? "border-slate-800 bg-[#121826]" : "border-slate-200 bg-white"}`}>
                  <h3 className="mb-4 text-base font-semibold">Attendance Rate</h3>
                  <div className="relative mx-auto flex h-32 w-32 items-center justify-center">
                    <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke={darkMode ? "#1e293b" : "#e2e8f0"} strokeWidth="8" />
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${attendancePct * 2.51} 251`}
                        className="transition-all duration-1000"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold">
                        {statsLoading ? "—" : <AnimatedNumber value={attendancePct} />}
                        {!statsLoading && <span className="text-base opacity-70">%</span>}
                      </span>
                    </div>
                  </div>
                  <p className={`mt-3 text-center text-xs ${darkMode ? "text-slate-500" : "text-slate-400"}`}>
                    {presentToday} of {plannedToday} planned
                  </p>
                </div>

                {/* Needs Attention - NEW */}
                <div className={`rounded-xl border p-6 ${darkMode ? "border-slate-800 bg-[#121826]" : "border-slate-200 bg-white"}`}>
                  <h3 className="mb-4 text-base font-semibold">Needs Attention</h3>
                  
                  <div className="space-y-4">
                    {/* Late */}
                    <div className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${
                      darkMode ? "bg-amber-500/10" : "bg-amber-50"
                    }`}>
                      <div className="flex items-center gap-2.5">
                        <div className="h-2 w-2 rounded-full bg-amber-500" />
                        <span className="text-sm font-medium">Late Arrivals</span>
                      </div>
                      <span className="text-sm font-bold text-amber-500">{lateToday}</span>
                    </div>

                    {/* Low attendance departments */}
                    {lowAttendanceDepts.length > 0 ? (
                      <div>
                        <p className={`mb-2 text-xs font-medium ${darkMode ? "text-slate-500" : "text-slate-400"}`}>
                          Low Attendance Departments
                        </p>
                        <div className="space-y-2">
                          {lowAttendanceDepts.map((d) => (
                            <div key={d.department} className="flex items-center justify-between text-sm">
                              <span className={darkMode ? "text-slate-300" : "text-slate-700"}>{d.department}</span>
                              <span className={`font-semibold ${d.pct < 50 ? "text-rose-500" : "text-amber-500"}`}>
                                {d.pct}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className={`text-sm ${darkMode ? "text-slate-500" : "text-slate-400"}`}>
                        All departments above 70%
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Gender + Skill */}
            <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className={`rounded-xl border p-6 ${darkMode ? "border-slate-800 bg-[#121826]" : "border-slate-200 bg-white"}`}>
                <h3 className="mb-1 text-base font-semibold">Present by Gender</h3>
                <p className={`mb-5 text-xs ${darkMode ? "text-slate-500" : "text-slate-400"}`}>Today</p>
                {statsLoading ? <EmptyState /> : presentToday === 0 ? <EmptyState text="No check-ins yet" /> : (
                  <div className="space-y-5">
                    <ProgressRow label="Male" value={genderStats.male} total={presentToday} color="bg-blue-500" dark={darkMode} />
                    <ProgressRow label="Female" value={genderStats.female} total={presentToday} color="bg-pink-500" dark={darkMode} />
                    {genderStats.other > 0 && (
                      <ProgressRow label="Other" value={genderStats.other} total={presentToday} color="bg-slate-400" dark={darkMode} />
                    )}
                  </div>
                )}
              </div>

              <div className={`rounded-xl border p-6 ${darkMode ? "border-slate-800 bg-[#121826]" : "border-slate-200 bg-white"}`}>
                <h3 className="mb-1 text-base font-semibold">Present by Skill</h3>
                <p className={`mb-5 text-xs ${darkMode ? "text-slate-500" : "text-slate-400"}`}>Today</p>
                <SkillBlock stats={skillStats} loading={statsLoading} dark={darkMode} />
              </div>
            </div>

            {/* Department */}
            <div className="mb-8">
              <div className={`rounded-xl border p-6 ${darkMode ? "border-slate-800 bg-[#121826]" : "border-slate-200 bg-white"}`}>
                <h3 className="mb-1 text-base font-semibold">Department Today</h3>
                <p className={`mb-5 text-xs ${darkMode ? "text-slate-500" : "text-slate-400"}`}>Present · Absent · OFF · Leave</p>
                <DepartmentList data={deptDayStats} dark={darkMode} />
              </div>
            </div>

            {/* Vendors */}
            <div className="mb-8">
              <div className={`rounded-xl border p-6 ${darkMode ? "border-slate-800 bg-[#121826]" : "border-slate-200 bg-white"}`}>
                <h3 className="mb-1 text-base font-semibold">Vendor-wise Today</h3>
                <p className={`mb-5 text-xs ${darkMode ? "text-slate-500" : "text-slate-400"}`}>Present vs Absent</p>
                {statsLoading ? <EmptyState /> : vendorStats.length === 0 ? <EmptyState text="No vendor data" /> : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                    {vendorStats.map((v) => (
                      <VendorCard key={v.vendor} stat={v} dark={darkMode} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showAttendanceModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-sm overflow-hidden rounded-2xl border shadow-2xl ${
            darkMode ? "border-slate-700 bg-[#121826]" : "border-slate-200 bg-white"
          }`}>
            <div className={`flex items-center justify-between border-b px-5 py-4 ${darkMode ? "border-slate-800" : "border-slate-100"}`}>
              <h2 className="text-base font-semibold">Mark Attendance</h2>
              <button
                type="button"
                onClick={() => setShowAttendanceModal(false)}
                className={`rounded-lg p-1.5 transition ${darkMode ? "text-slate-400 hover:bg-slate-800" : "text-slate-400 hover:bg-slate-100"}`}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">
              <button
                type="button"
                onClick={() => goToScan("checkin")}
                className={`flex flex-col items-center gap-3 rounded-xl border py-7 transition ${
                  darkMode 
                    ? "border-slate-700 bg-slate-800/50 hover:border-emerald-500/40 hover:bg-emerald-500/10" 
                    : "border-slate-200 bg-slate-50 hover:border-emerald-300 hover:bg-emerald-50"
                }`}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-white">
                  IN
                </span>
                <span className="text-sm font-semibold">Check In</span>
              </button>
              <button
                type="button"
                onClick={() => goToScan("checkout")}
                className={`flex flex-col items-center gap-3 rounded-xl border py-7 transition ${
                  darkMode 
                    ? "border-slate-700 bg-slate-800/50 hover:border-orange-500/40 hover:bg-orange-500/10" 
                    : "border-slate-200 bg-slate-50 hover:border-orange-300 hover:bg-orange-50"
                }`}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-white">
                  OUT
                </span>
                <span className="text-sm font-semibold">Check Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ─── Components ─── */

function ProgressRow({ label, value, total, color, dark }: { label: string; value: number; total: number; color: string; dark: boolean }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-sm">
        <span className={dark ? "text-slate-400" : "text-slate-600"}>{label}</span>
        <span className="font-medium">
          {value} <span className={`text-xs ${dark ? "text-slate-500" : "text-slate-400"}`}>({pct}%)</span>
        </span>
      </div>
      <div className={`h-1.5 overflow-hidden rounded-full ${dark ? "bg-slate-800" : "bg-slate-100"}`}>
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SkillBlock({ stats, loading, dark }: { stats: SkillStat; loading: boolean; dark: boolean }) {
  if (loading) return <EmptyState />;
  const total = stats.skilled + stats.semi + stats.unskilled;
  if (!total) return <EmptyState text="No present yet" />;
  return (
    <div className="space-y-5">
      <ProgressRow label="Skilled" value={stats.skilled} total={total} color="bg-blue-500" dark={dark} />
      <ProgressRow label="Semi-skilled" value={stats.semi} total={total} color="bg-indigo-500" dark={dark} />
      <ProgressRow label="Unskilled" value={stats.unskilled} total={total} color="bg-slate-400" dark={dark} />
    </div>
  );
}

function DepartmentList({ data, dark }: { data: DeptDayStat[]; dark: boolean }) {
  if (!data.length) return <EmptyState text="No department data" />;
  return (
    <div className="space-y-3">
      <div className={`mb-4 flex flex-wrap gap-4 text-[11px] font-medium ${dark ? "text-slate-500" : "text-slate-400"}`}>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Present</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-500" /> Absent</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sky-400" /> OFF</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Leave</span>
      </div>
      {data.map((d) => {
        const t = d.present + d.absent + d.off + d.leave || 1;
        const pct = Math.round((d.present / t) * 100);
        return (
          <a
            key={d.department}
            href={`/attendance?department=${encodeURIComponent(d.department)}`}
            className={`block rounded-lg border px-4 py-3.5 transition ${
              dark 
                ? "border-slate-800 bg-slate-800/40 hover:border-slate-700 hover:bg-slate-800/70" 
                : "border-slate-100 bg-slate-50 hover:border-slate-200 hover:bg-white"
            }`}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">{d.department}</span>
              <span className={`text-xs font-semibold ${dark ? "text-emerald-400" : "text-emerald-600"}`}>{pct}%</span>
            </div>
            <div className={`flex h-1.5 overflow-hidden rounded-full ${dark ? "bg-slate-900" : "bg-white"}`}>
              <div className="bg-emerald-500" style={{ width: `${(d.present / t) * 100}%` }} />
              <div className="bg-slate-500" style={{ width: `${(d.absent / t) * 100}%` }} />
              <div className="bg-sky-400" style={{ width: `${(d.off / t) * 100}%` }} />
              <div className="bg-amber-400" style={{ width: `${(d.leave / t) * 100}%` }} />
            </div>
            <div className={`mt-2 flex justify-between text-[11px] ${dark ? "text-slate-500" : "text-slate-400"}`}>
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

function VendorCard({ stat, dark }: { stat: VendorStat; dark: boolean }) {
  const total = stat.present + stat.absent;
  const pct = total > 0 ? Math.round((stat.present / total) * 100) : 0;

  return (
    <div className={`rounded-lg border p-4 text-center transition ${
      dark 
        ? "border-slate-800 bg-slate-800/40 hover:border-slate-700 hover:bg-slate-800/70" 
        : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
    }`}>
      <p className="truncate text-xs font-medium" title={stat.vendor}>{stat.vendor}</p>
      <p className="mt-1.5 text-xl font-bold">{total === 0 ? "—" : `${pct}%`}</p>
      <p className={`mt-1 text-[11px] ${dark ? "text-slate-500" : "text-slate-400"}`}>
        <span className={dark ? "text-emerald-400" : "text-emerald-600"}>{stat.present}</span>
        {" / "}
        <span>{stat.absent}</span>
      </p>
    </div>
  );
}

function EmptyState({ text = "Loading…" }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-12 text-sm text-slate-500">
      {text}
    </div>
  );
}

function PlannedVsActualLineChart({ data, dark }: { data: DayTrend[]; dark: boolean }) {
  if (!data.length) return <EmptyState text="No trend data" />;

  const width = 560;
  const height = 190;
  const pad = { top: 12, right: 10, bottom: 28, left: 30 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const maxY = Math.max(...data.map((d) => Math.max(d.planned, d.present)), 1);
  const yMax = maxY * 1.15;

  const points = data.map((d, i) => {
    const px = pad.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
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
  const area = presentPath + ` L ${points[points.length - 1].x} ${pad.top + innerH} L ${points[0].x} ${pad.top + innerH} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity={dark ? "0.2" : "0.12"} />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#areaFill)" />
      <path d={plannedPath} fill="none" stroke={dark ? "#334155" : "#cbd5e1"} strokeWidth="1.5" strokeDasharray="4 3" />
      <path d={presentPath} fill="none" stroke="#3b82f6" strokeWidth="2.5" />
      {points.map((p) => (
        <g key={p.date}>
          <circle cx={p.x} cy={p.presentY} r="3.5" fill={dark ? "#0B0F19" : "#fff"} stroke="#3b82f6" strokeWidth="2" />
          <text x={p.x} y={height - 7} textAnchor="middle" fill={dark ? "#64748b" : "#94a3b8"} fontSize="10">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}