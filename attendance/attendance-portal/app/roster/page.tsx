"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import MainMenu from "@/components/MainMenu";
import { createClient } from "@/lib/supabase";

/* ───────────────── Types ───────────────── */

type Employee = {
  id: string;
  employee_code: string;
  barcode: string | null;
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
  roster_status: AssignmentType;
  remarks: string | null;
  created_by: string | null;
};

type AssignmentType = "SHIFT" | "OFF" | "LEAVE";

type PanelType =
  | "TODAY"
  | "ROSTERED"
  | "PENDING"
  | null;

type TodayTab =
  | "ALL"
  | "SHIFT"
  | "OFF"
  | "LEAVE";

type RosterUpsertRow = {
  employee_id: string;
  roster_date: string;
  roster_status: AssignmentType;
  shift_id: string | null;
  remarks: string | null;
  created_by?: string | null;
};

/* ───────────────── IST Helpers ───────────────── */

function todayIST() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value || "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function formatDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value || "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function parseDate(date: string) {
  return new Date(`${date}T12:00:00+05:30`);
}

function addDays(date: string, amount: number) {
  const parsed = parseDate(date);

  parsed.setDate(parsed.getDate() + amount);

  return formatDate(parsed);
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
  const [year, monthNumber] = month.split("-").map(Number);

  return formatDate(
    new Date(year, monthNumber, 0, 12, 0, 0)
  );
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);

  return new Date(
    year,
    monthNumber - 1,
    1
  ).toLocaleDateString("en-IN", {
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
  if (!error) {
    return "Something went wrong";
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object") {
    const e = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    return (
      e.message ||
      e.details ||
      e.hint ||
      e.code ||
      "Something went wrong"
    );
  }

  return "Something went wrong";
}

function chunkArray<T>(array: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size));
  }

  return chunks;
}

/* ───────────────── Main Page ───────────────── */

export default function RosterPage() {
  const supabase = useMemo(() => createClient(), []);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [rosters, setRosters] = useState<Roster[]>([]);

  const [selectedMonth, setSelectedMonth] = useState(
    () => todayIST().slice(0, 7)
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showCreate, setShowCreate] = useState(false);

  const [activePanel, setActivePanel] =
    useState<PanelType>(null);

  const [todayTab, setTodayTab] =
    useState<TodayTab>("ALL");

  const [deptFilter, setDeptFilter] =
    useState<string>("ALL");

  const [viewEmployee, setViewEmployee] =
    useState<Employee | null>(null);

  const [search, setSearch] = useState("");

  const today = todayIST();

  /* ───────────────── Load Data ───────────────── */

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const from = monthStart(selectedMonth);
      const to = monthEnd(selectedMonth);

      console.log("Loading roster:", {
        from,
        to,
        selectedMonth,
      });

      const [
        empRes,
        shiftRes,
        rosterRes,
      ] = await Promise.all([
        supabase
          .from("employees")
          .select(`
            id,
            employee_code,
            barcode,
            full_name,
            department,
            designation,
            employment_type,
            joining_date,
            is_active,
            gender,
            vendor,
            customer_account
          `)
          .eq("is_active", true)
          .order("full_name"),

        supabase
          .from("shifts")
          .select(`
            id,
            code,
            name,
            start_time,
            end_time,
            is_overnight,
            grace_minutes,
            is_active
          `)
          .order("code"),

        supabase
          .from("rosters")
          .select(`
            id,
            employee_id,
            roster_date,
            shift_id,
            roster_status,
            remarks,
            created_by
          `)
          .gte("roster_date", from)
          .lte("roster_date", to)
          .order("employee_id")
          .order("roster_date"),
      ]);

      if (empRes.error) {
        console.error("Employee load error:", empRes.error);
        throw empRes.error;
      }

      if (shiftRes.error) {
        console.error("Shift load error:", shiftRes.error);
        throw shiftRes.error;
      }

      if (rosterRes.error) {
        console.error("Roster load error:", rosterRes.error);
        throw rosterRes.error;
      }

      const loadedEmployees =
        (empRes.data || []) as Employee[];

      const loadedShifts =
        (shiftRes.data || []) as Shift[];

      const loadedRosters =
        (rosterRes.data || []) as Roster[];

      /*
        Safety cleanup.

        Even though database should prevent duplicates,
        we ensure React state contains only one roster
        per employee + date.
      */

      const uniqueRosterMap =
        new Map<string, Roster>();

      const duplicateKeys: string[] = [];

      for (const roster of loadedRosters) {
        const key =
          `${roster.employee_id}|${roster.roster_date}`;

        if (uniqueRosterMap.has(key)) {
          duplicateKeys.push(key);
        }

        uniqueRosterMap.set(key, roster);
      }

      if (duplicateKeys.length > 0) {
        console.warn(
          "Duplicate roster keys found:",
          duplicateKeys
        );
      }

      const uniqueRosters =
        Array.from(uniqueRosterMap.values());

      console.log("Roster loaded:", {
        employees: loadedEmployees.length,
        shifts: loadedShifts.length,
        rosters: uniqueRosters.length,
      });

      setEmployees(loadedEmployees);

      setShifts(loadedShifts);

      setRosters(uniqueRosters);

    } catch (err) {
      console.error(
        "Roster load error:",
        err
      );

      setError(getErrorMessage(err));

    } finally {
      setLoading(false);
    }
  }, [
    selectedMonth,
    supabase,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ───────────────── Employee Map ───────────────── */

  const empMap = useMemo(() => {
    const map =
      new Map<string, Employee>();

    for (const employee of employees) {
      map.set(employee.id, employee);
    }

    return map;
  }, [employees]);

  /* ───────────────── Roster Map ───────────────── */

  const rosterMap = useMemo(() => {
    const map =
      new Map<string, Roster>();

    for (const roster of rosters) {
      const key =
        `${roster.employee_id}|${roster.roster_date}`;

      map.set(key, roster);
    }

    return map;
  }, [rosters]);

  /* ───────────────── Month Dates ───────────────── */

  const monthDates = useMemo(() => {
    return daysBetween(
      monthStart(selectedMonth),
      monthEnd(selectedMonth)
    );
  }, [selectedMonth]);

  /* ───────────────── Roster Stats ───────────────── */

  const rosteredIds = useMemo(() => {
    return new Set(
      rosters.map(
        (roster) => roster.employee_id
      )
    );
  }, [rosters]);

  const rosteredCount =
    rosteredIds.size;

  const pendingCount =
    Math.max(
      employees.length - rosteredCount,
      0
    );

  /* ───────────────── Today Rows ───────────────── */

  const todayRows = useMemo(() => {
    return rosters
      .filter(
        (roster) =>
          roster.roster_date === today
      )
      .map((roster) => ({
        roster,
        employee:
          empMap.get(
            roster.employee_id
          ) || null,
      }))
      .filter(
        (item) =>
          item.employee !== null
      );
  }, [
    rosters,
    today,
    empMap,
  ]);

  const todayShift =
    todayRows.filter(
      (item) =>
        item.roster.roster_status ===
        "SHIFT"
    ).length;

  const todayOff =
    todayRows.filter(
      (item) =>
        item.roster.roster_status ===
        "OFF"
    ).length;

  const todayLeave =
    todayRows.filter(
      (item) =>
        item.roster.roster_status ===
        "LEAVE"
    ).length;

  /* ───────────────── Departments ───────────────── */

  const departments = useMemo(() => {
    const departmentSet =
      new Set<string>();

    employees.forEach(
      (employee) => {
        if (employee.department) {
          departmentSet.add(
            employee.department
          );
        }
      }
    );

    return Array.from(
      departmentSet
    ).sort();
  }, [employees]);

  /* ───────────────── Search ───────────────── */

  function matchSearch(employee: Employee) {
    const query =
      search.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return (
      employee.full_name
        .toLowerCase()
        .includes(query) ||
      employee.employee_code
        .toLowerCase()
        .includes(query) ||
      (employee.barcode || "")
        .toLowerCase()
        .includes(query) ||
      (employee.department || "")
        .toLowerCase()
        .includes(query)
    );
  }

  function matchDept(employee: Employee) {
    if (deptFilter === "ALL") {
      return true;
    }

    return (
      employee.department ||
      "Unassigned"
    ) === deptFilter;
  }

  /* ───────────────── Rostered List ───────────────── */

  const rosteredList = useMemo(() => {
    return employees
      .filter(
        (employee) =>
          rosteredIds.has(
            employee.id
          ) &&
          matchSearch(employee) &&
          matchDept(employee)
      )
      .sort((a, b) =>
        a.full_name.localeCompare(
          b.full_name
        )
      );
  }, [
    employees,
    rosteredIds,
    search,
    deptFilter,
  ]);

  /* ───────────────── Pending List ───────────────── */

  const pendingList = useMemo(() => {
    return employees
      .filter(
        (employee) =>
          !rosteredIds.has(
            employee.id
          ) &&
          matchSearch(employee) &&
          matchDept(employee)
      )
      .sort((a, b) =>
        a.full_name.localeCompare(
          b.full_name
        )
      );
  }, [
    employees,
    rosteredIds,
    search,
    deptFilter,
  ]);

  /* ───────────────── Today List ───────────────── */

  const todayList = useMemo(() => {
    let list = [...todayRows];

    if (todayTab === "SHIFT") {
      list = list.filter(
        (item) =>
          item.roster.roster_status ===
          "SHIFT"
      );
    }

    if (todayTab === "OFF") {
      list = list.filter(
        (item) =>
          item.roster.roster_status ===
          "OFF"
      );
    }

    if (todayTab === "LEAVE") {
      list = list.filter(
        (item) =>
          item.roster.roster_status ===
          "LEAVE"
      );
    }

    list = list.filter((item) => {
      const employee = item.employee;

      if (!employee) {
        return false;
      }

      return (
        matchSearch(employee) &&
        matchDept(employee)
      );
    });

    return list.sort(
      (a, b) =>
        (a.employee?.full_name || "")
          .localeCompare(
            b.employee?.full_name || ""
          )
    );
  }, [
    todayRows,
    todayTab,
    search,
    deptFilter,
  ]);

  /* ───────────────── Navigation ───────────────── */

  function changeMonth(delta: number) {
    const [year, monthNumber] =
      selectedMonth
        .split("-")
        .map(Number);

    const date =
      new Date(
        year,
        monthNumber - 1 + delta,
        1
      );

    setSelectedMonth(
      `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`
    );
  }

  function openPanel(panel: PanelType) {
    setActivePanel((previous) =>
      previous === panel
        ? null
        : panel
    );

    setDeptFilter("ALL");

    setSearch("");

    setTodayTab("ALL");
  }

  /* ───────────────── Create Roster ───────────────── */

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
      const {
        employeeIds,
        fromDate,
        toDate,
        type,
        shiftId,
        weekOff,
        remarks,
      } = data;

      if (!employeeIds.length) {
        throw new Error(
          "Please select at least one employee."
        );
      }

      if (!fromDate || !toDate) {
        throw new Error(
          "Please select a date range."
        );
      }

      if (fromDate > toDate) {
        throw new Error(
          "From date cannot be after To date."
        );
      }

      if (
        type === "SHIFT" &&
        !shiftId
      ) {
        throw new Error(
          "Please select a shift."
        );
      }

      const dates =
        daysBetween(
          fromDate,
          toDate
        );

      const {
        data: authData,
      } =
        await supabase.auth.getUser();

      const user =
        authData.user;

      const rosterRows:
        RosterUpsertRow[] = [];

      /*
        Generate all roster rows.
      */

      for (
        const employeeId of employeeIds
      ) {
        for (
          const date of dates
        ) {
          const day =
            parseDate(date).getDay();

          const isWeeklyOff =
            weekOff !== "" &&
            day === Number(weekOff);

          /*
            SHIFT

            Normal day = SHIFT
            Weekly off = OFF
          */

          if (type === "SHIFT") {
            rosterRows.push({
              employee_id:
                employeeId,

              roster_date:
                date,

              roster_status:
                isWeeklyOff
                  ? "OFF"
                  : "SHIFT",

              shift_id:
                isWeeklyOff
                  ? null
                  : shiftId,

              remarks:
                remarks.trim() ||
                null,

              created_by:
                user?.id || null,
            });
          }

          /*
            OFF

            No weekly off selected:
            Every selected day = OFF

            Weekly off selected:
            Only selected weekday = OFF
          */

          if (type === "OFF") {
            if (
              weekOff !== "" &&
              !isWeeklyOff
            ) {
              continue;
            }

            rosterRows.push({
              employee_id:
                employeeId,

              roster_date:
                date,

              roster_status:
                "OFF",

              shift_id:
                null,

              remarks:
                remarks.trim() ||
                null,

              created_by:
                user?.id || null,
            });
          }

          /*
            LEAVE

            No weekly off selected:
            Every selected day = LEAVE

            Weekly off selected:
            Only selected weekday = LEAVE
          */

          if (type === "LEAVE") {
            if (
              weekOff !== "" &&
              !isWeeklyOff
            ) {
              continue;
            }

            rosterRows.push({
              employee_id:
                employeeId,

              roster_date:
                date,

              roster_status:
                "LEAVE",

              shift_id:
                null,

              remarks:
                remarks.trim() ||
                null,

              created_by:
                user?.id || null,
            });
          }
        }
      }

      if (!rosterRows.length) {
        throw new Error(
          "No roster records were generated."
        );
      }

      /*
        Extra protection.

        Remove duplicate employee + date
        before sending to database.
      */

      const uniqueRowsMap =
        new Map<
          string,
          RosterUpsertRow
        >();

      for (
        const row of rosterRows
      ) {
        const key =
          `${row.employee_id}|${row.roster_date}`;

        uniqueRowsMap.set(
          key,
          row
        );
      }

      const uniqueRows =
        Array.from(
          uniqueRowsMap.values()
        );

      console.log(
        "Saving roster:",
        {
          employees:
            employeeIds.length,

          dates:
            dates.length,

          totalRecords:
            uniqueRows.length,
        }
      );

      /*
        Save in batches.

        Example:
        100 employees × 31 days
        = 3100 rows

        Batch size prevents
        request size problems.
      */

      const batches =
        chunkArray(
          uniqueRows,
          500
        );

      for (
        let index = 0;
        index < batches.length;
        index++
      ) {
        const batch =
          batches[index];

        console.log(
          `Saving roster batch ${
            index + 1
          } of ${
            batches.length
          }`
        );

        const {
          error: upsertError,
        } = await supabase
          .from("rosters")
          .upsert(
            batch,
            {
              onConflict:
                "employee_id,roster_date",
            }
          );

        if (upsertError) {
          console.error(
            "Roster upsert error:",
            {
              message:
                upsertError.message,

              details:
                upsertError.details,

              hint:
                upsertError.hint,

              code:
                upsertError.code,
            }
          );

          throw upsertError;
        }
      }

      /*
        Reload from database.
      */

      await loadData();

      setSuccess(
        `Roster saved successfully for ${
          employeeIds.length
        } employee${
          employeeIds.length > 1
            ? "s"
            : ""
        }. ${
          uniqueRows.length
        } roster record${
          uniqueRows.length > 1
            ? "s"
            : ""
        } processed.`
      );

      setShowCreate(false);

      setTimeout(() => {
        setSuccess("");
      }, 5000);

    } catch (err) {
      console.error(
        "Roster save error:",
        err
      );

      setError(
        getErrorMessage(err)
      );

    } finally {
      setSaving(false);
    }
  }

  /* ───────────────── Get Shift ───────────────── */

  function getShift(
    id: string | null
  ) {
    if (!id) {
      return null;
    }

    return (
      shifts.find(
        (shift) =>
          shift.id === id
      ) || null
    );
  }

  /* ───────────────── Render ───────────────── */

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
            onClick={() =>
              setShowCreate(true)
            }
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-indigo-600"
          >
            + Create Roster
          </button>

        </div>

        {/* Month Bar */}

        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">

          <button
            type="button"
            onClick={() =>
              changeMonth(-1)
            }
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            ←
          </button>

          <div className="min-w-[150px] text-center text-sm font-bold text-slate-800">
            {monthLabel(selectedMonth)}
          </div>

          <button
            type="button"
            onClick={() =>
              changeMonth(1)
            }
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            →
          </button>

          <button
            type="button"
            onClick={() =>
              setSelectedMonth(
                todayIST().slice(0, 7)
              )
            }
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Today
          </button>

          <button
            type="button"
            onClick={() =>
              loadData()
            }
            disabled={loading}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {loading
              ? "Loading..."
              : "Refresh"}
          </button>

        </div>

        {/* Error */}

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Success */}

        {success && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            ✓ {success}
          </div>
        )}

        {/* Cards */}

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">

          {/* TODAY */}

          <button
            type="button"
            onClick={() =>
              openPanel("TODAY")
            }
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
                  {loading
                    ? "—"
                    : todayShift}
                </div>

                <div className="text-[10px] font-medium text-slate-500">
                  Shift
                </div>
              </div>

              <div>
                <div className="text-2xl font-black text-slate-600">
                  {loading
                    ? "—"
                    : todayOff}
                </div>

                <div className="text-[10px] font-medium text-slate-500">
                  OFF
                </div>
              </div>

              <div>
                <div className="text-2xl font-black text-amber-600">
                  {loading
                    ? "—"
                    : todayLeave}
                </div>

                <div className="text-[10px] font-medium text-slate-500">
                  Leave
                </div>
              </div>

            </div>

            <div className="mt-3 text-[11px] font-medium text-blue-600">
              View list →
            </div>

          </button>

          {/* ROSTERED */}

          <button
            type="button"
            onClick={() =>
              openPanel("ROSTERED")
            }
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
              {loading
                ? "—"
                : rosteredCount}
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
            onClick={() =>
              openPanel("PENDING")
            }
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
              {loading
                ? "—"
                : pendingCount}
            </div>

            <div className="mt-1 text-xs font-semibold text-slate-600">
              Pending employees
            </div>

            <div className="mt-3 text-[11px] font-medium text-amber-600">
              View list →
            </div>

          </button>

        </div>

        {/* Active Panel */}

        {activePanel && (
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

            <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">

              <div>
                <h2 className="text-sm font-bold text-slate-800">

                  {activePanel === "TODAY" &&
                    `Today · ${shortDate(
                      today
                    )}`}

                  {activePanel ===
                    "ROSTERED" &&
                    "Rostered employees"}

                  {activePanel ===
                    "PENDING" &&
                    "Pending employees"}

                </h2>

                <p className="text-[11px] text-slate-400">
                  Click employee to view monthly roster
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setActivePanel(null)
                }
                className="self-end rounded-lg px-2 text-lg text-slate-400 hover:bg-slate-100 sm:self-auto"
              >
                ×
              </button>

            </div>

            {/* Filters */}

            <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center">

              {activePanel ===
                "TODAY" && (
                <div className="flex flex-wrap gap-1.5">

                  {(
                    [
                      "ALL",
                      "SHIFT",
                      "OFF",
                      "LEAVE",
                    ] as TodayTab[]
                  ).map((tab) => (

                    <button
                      key={tab}
                      type="button"
                      onClick={() =>
                        setTodayTab(tab)
                      }
                      className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold ${
                        todayTab === tab
                          ? "bg-slate-900 text-white"
                          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {tab === "ALL"
                        ? "All"
                        : tab}
                    </button>

                  ))}

                </div>
              )}

              <select
                value={deptFilter}
                onChange={(event) =>
                  setDeptFilter(
                    event.target.value
                  )
                }
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600"
              >

                <option value="ALL">
                  All departments
                </option>

                {departments.map(
                  (department) => (
                    <option
                      key={department}
                      value={department}
                    >
                      {department}
                    </option>
                  )
                )}

              </select>

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search name, ID..."
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] outline-none focus:border-slate-400 sm:ml-auto sm:w-48"
              />

            </div>

            {/* TODAY LIST */}

            <div className="max-h-96 overflow-y-auto">

              {activePanel ===
                "TODAY" && (

                todayList.length === 0 ? (

                  <div className="px-4 py-10 text-center text-sm text-slate-400">
                    No records
                  </div>

                ) : (

                  todayList.map(
                    ({
                      roster,
                      employee,
                    }) => {

                      const shift =
                        getShift(
                          roster.shift_id
                        );

                      if (!employee) {
                        return null;
                      }

                      return (
                        <button
                          type="button"
                          key={roster.id}
                          onClick={() =>
                            setViewEmployee(
                              employee
                            )
                          }
                          className="flex w-full items-center gap-3 border-b border-slate-50 px-4 py-3 text-left hover:bg-indigo-50"
                        >

                          <div className="min-w-0 flex-1">

                            <div className="truncate text-sm font-semibold text-slate-800">
                              {employee.full_name}
                            </div>

                            <div className="truncate text-[11px] text-slate-400">
                              {employee.employee_code}

                              {employee.department
                                ? ` · ${employee.department}`
                                : ""}
                            </div>

                          </div>

                          <div className="shrink-0 text-right">

                            {roster.roster_status ===
                              "SHIFT" && (
                              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">

                                {shift?.code ||
                                  "SHIFT"}

                                {shift
                                  ? ` ${shift.start_time.slice(
                                      0,
                                      5
                                    )}`
                                  : ""}

                              </span>
                            )}

                            {roster.roster_status ===
                              "OFF" && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                OFF
                              </span>
                            )}

                            {roster.roster_status ===
                              "LEAVE" && (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                LEAVE
                              </span>
                            )}

                          </div>

                        </button>
                      );
                    }
                  )

                )

              )}

              {/* ROSTERED LIST */}

              {activePanel ===
                "ROSTERED" && (

                rosteredList.length ===
                  0 ? (

                  <div className="px-4 py-10 text-center text-sm text-slate-400">
                    No employees
                  </div>

                ) : (

                  rosteredList.map(
                    (employee) => (

                      <button
                        type="button"
                        key={employee.id}
                        onClick={() =>
                          setViewEmployee(
                            employee
                          )
                        }
                        className="flex w-full items-center gap-3 border-b border-slate-50 px-4 py-3 text-left hover:bg-indigo-50"
                      >

                        <div className="min-w-0 flex-1">

                          <div className="truncate text-sm font-semibold text-slate-800">
                            {employee.full_name}
                          </div>

                          <div className="truncate text-[11px] text-slate-400">

                            {employee.employee_code}

                            {employee.department
                              ? ` · ${employee.department}`
                              : ""}

                          </div>

                        </div>

                        <span className="text-xs text-indigo-500">
                          Month →
                        </span>

                      </button>

                    )
                  )

                )

              )}

              {/* PENDING LIST */}

              {activePanel ===
                "PENDING" && (

                pendingList.length ===
                  0 ? (

                  <div className="px-4 py-10 text-center text-sm text-slate-400">
                    No pending employees
                  </div>

                ) : (

                  pendingList.map(
                    (employee) => (

                      <button
                        type="button"
                        key={employee.id}
                        onClick={() =>
                          setViewEmployee(
                            employee
                          )
                        }
                        className="flex w-full items-center gap-3 border-b border-slate-50 px-4 py-3 text-left hover:bg-amber-50"
                      >

                        <div className="min-w-0 flex-1">

                          <div className="truncate text-sm font-semibold text-slate-800">
                            {employee.full_name}
                          </div>

                          <div className="truncate text-[11px] text-slate-400">

                            {employee.employee_code}

                            {employee.department
                              ? ` · ${employee.department}`
                              : ""}

                          </div>

                        </div>

                        <span className="text-xs text-amber-600">
                          Month →
                        </span>

                      </button>

                    )
                  )

                )

              )}

            </div>

          </div>
        )}

        {!activePanel &&
          !loading && (
            <p className="mt-8 text-center text-sm text-slate-400">
              Click a card to view lists. Click an
              employee for monthly roster.
            </p>
          )}

        {/* Create Modal */}

        {showCreate && (
          <CreateRosterModal
            employees={employees}
            shifts={shifts.filter(
              (shift) =>
                shift.is_active
            )}
            month={selectedMonth}
            saving={saving}
            onClose={() =>
              setShowCreate(false)
            }
            onSave={createRoster}
          />
        )}

        {/* Employee Month Modal */}

        {viewEmployee && (
          <EmployeeMonthModal
            employee={viewEmployee}
            month={selectedMonth}
            monthDates={monthDates}
            rosterMap={rosterMap}
            shifts={shifts}
            onClose={() =>
              setViewEmployee(null)
            }
          />
        )}

      </div>
    </main>
  );
}

/* ─────────────────────────────────────────────── */
/* Employee Month Modal                            */
/* ─────────────────────────────────────────────── */

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

  const today =
    todayIST();

  const firstDay =
    parseDate(
      monthDates[0]
    ).getDay();

  function getShift(
    id: string | null
  ) {
    if (!id) {
      return null;
    }

    return (
      shifts.find(
        (shift) =>
          shift.id === id
      ) || null
    );
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

              {employee.department
                ? ` · ${employee.department}`
                : ""}

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

            {[
              "Sun",
              "Mon",
              "Tue",
              "Wed",
              "Thu",
              "Fri",
              "Sat",
            ].map((day) => (

              <div
                key={day}
                className="text-center text-[10px] font-bold uppercase text-slate-400"
              >
                {day}
              </div>

            ))}

            {Array.from({
              length: firstDay,
            }).map((_, index) => (

              <div
                key={`empty-${index}`}
              />

            ))}

            {monthDates.map(
              (date) => {

                const roster =
                  rosterMap.get(
                    `${employee.id}|${date}`
                  );

                const shift =
                  getShift(
                    roster?.shift_id ||
                      null
                  );

                const isToday =
                  date === today;

                let background =
                  "bg-slate-50 border-slate-100";

                let label =
                  "—";

                let sub =
                  "";

                if (
                  roster?.roster_status ===
                  "SHIFT"
                ) {

                  background =
                    "bg-blue-50 border-blue-200";

                  label =
                    shift?.code ||
                    "SHIFT";

                  sub =
                    shift
                      ? shift.start_time.slice(
                          0,
                          5
                        )
                      : "";

                }

                if (
                  roster?.roster_status ===
                  "OFF"
                ) {

                  background =
                    "bg-slate-100 border-slate-200";

                  label =
                    "OFF";

                }

                if (
                  roster?.roster_status ===
                  "LEAVE"
                ) {

                  background =
                    "bg-amber-50 border-amber-200";

                  label =
                    "LEAVE";

                }

                return (
                  <div
                    key={date}
                    className={`rounded-xl border p-2 text-center ${background} ${
                      isToday
                        ? "ring-2 ring-indigo-400"
                        : ""
                    }`}
                  >

                    <div className="text-[10px] font-semibold text-slate-400">
                      {date.slice(
                        8,
                        10
                      )}
                    </div>

                    <div className="mt-1 text-xs font-bold text-slate-800">
                      {label}
                    </div>

                    {sub && (
                      <div className="text-[9px] text-slate-500">
                        {sub}
                      </div>
                    )}

                  </div>
                );
              }
            )}

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

/* ─────────────────────────────────────────────── */
/* Create Roster Modal                             */
/* ─────────────────────────────────────────────── */

function CreateRosterModal({
  employees,
  shifts,
  month,
  saving,
  onClose,
  onSave,
}: {
  employees: Employee[];
  shifts: Shift[];
  month: string;
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

  const [selected, setSelected] =
    useState<Employee[]>([]);

  const [input, setInput] =
    useState("");

  const [
    employeeSearch,
    setEmployeeSearch,
  ] = useState("");

  const [
    fromDate,
    setFromDate,
  ] = useState(() =>
    monthStart(month)
  );

  const [
    toDate,
    setToDate,
  ] = useState(() =>
    monthEnd(month)
  );

  const [type, setType] =
    useState<AssignmentType>(
      "SHIFT"
    );

  const [shiftId, setShiftId] =
    useState("");

  const [weekOff, setWeekOff] =
    useState("");

  const [remarks, setRemarks] =
    useState("");

  const [error, setError] =
    useState("");

  const selectedIds = useMemo(() => {
    return new Set(
      selected.map(
        (employee) =>
          employee.id
      )
    );
  }, [selected]);

  function resolveEmployees(
    raw: string
  ): Employee[] {

    const tokens = raw
      .split(/[\n,;]+/)
      .map((token) =>
        token.trim()
      )
      .filter(Boolean);

    const matches:
      Employee[] = [];

    for (
      const token of tokens
    ) {

      const lower =
        token.toLowerCase();

      const exact =
        employees.find(
          (employee) =>
            employee.employee_code
              .toLowerCase() ===
              lower ||
            (employee.barcode || "")
              .toLowerCase() ===
              lower ||
            employee.full_name
              .toLowerCase() ===
              lower
        );

      if (
        exact &&
        !matches.some(
          (item) =>
            item.id === exact.id
        )
      ) {

        matches.push(exact);

        continue;

      }

      const partial =
        employees.find(
          (employee) =>
            employee.employee_code
              .toLowerCase()
              .includes(lower) ||
            (employee.barcode || "")
              .toLowerCase()
              .includes(lower) ||
            employee.full_name
              .toLowerCase()
              .includes(lower)
        );

      if (
        partial &&
        !matches.some(
          (item) =>
            item.id === partial.id
        )
      ) {

        matches.push(partial);

      }
    }

    return matches;
  }

  function addFromInput() {

    const matches =
      resolveEmployees(input);

    if (!matches.length) {

      setError(
        "No employee matched."
      );

      return;
    }

    setSelected((previous) => {

      const result =
        [...previous];

      for (
        const employee of matches
      ) {

        if (
          !result.some(
            (item) =>
              item.id === employee.id
          )
        ) {

          result.push(employee);

        }
      }

      return result;
    });

    setInput("");

    setError("");
  }

  const suggestions =
    useMemo(() => {

      const query =
        employeeSearch
          .trim()
          .toLowerCase();

      if (!query) {
        return [];
      }

      return employees
        .filter(
          (employee) =>
            !selectedIds.has(
              employee.id
            ) &&
            (
              employee.full_name
                .toLowerCase()
                .includes(query) ||

              employee.employee_code
                .toLowerCase()
                .includes(query) ||

              (employee.barcode || "")
                .toLowerCase()
                .includes(query)
            )
        )
        .slice(0, 8);

    }, [
      employeeSearch,
      employees,
      selectedIds,
    ]);

  async function submit() {

    setError("");

    if (!selected.length) {

      setError(
        "Select at least one employee."
      );

      return;
    }

    if (
      !fromDate ||
      !toDate
    ) {

      setError(
        "Select date range."
      );

      return;
    }

    if (fromDate > toDate) {

      setError(
        "From date cannot be after To date."
      );

      return;
    }

    if (
      type === "SHIFT" &&
      !shiftId
    ) {

      setError(
        "Select a shift."
      );

      return;
    }

    await onSave({
      employeeIds:
        selected.map(
          (employee) =>
            employee.id
        ),

      fromDate,

      toDate,

      type,

      shiftId:
        type === "SHIFT"
          ? shiftId
          : null,

      weekOff,

      remarks,
    });
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">

      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

        {/* Header */}

        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">

          <div>

            <h2 className="text-lg font-bold text-slate-900">
              Create Roster
            </h2>

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

        {/* Content */}

        <div className="flex-1 overflow-y-auto bg-slate-50/40 p-4 md:p-5">

          <div className="grid gap-4 lg:grid-cols-2">

            {/* Employees */}

            <section className="rounded-2xl border border-slate-200 bg-white p-4">

              <h3 className="text-sm font-bold text-slate-800">
                Employees
              </h3>

              <textarea
                value={input}
                onChange={(event) =>
                  setInput(
                    event.target.value
                  )
                }
                onKeyDown={(event) => {

                  if (
                    event.key === "Enter" &&
                    !event.shiftKey
                  ) {

                    event.preventDefault();

                    addFromInput();

                  }

                }}
                placeholder={
                  "Paste ID / name\nACH914"
                }
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
                onChange={(event) =>
                  setEmployeeSearch(
                    event.target.value
                  )
                }
                placeholder="Search..."
                className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-300"
              />

              {suggestions.length >
                0 && (

                <div className="mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">

                  {suggestions.map(
                    (employee) => (

                      <button
                        type="button"
                        key={employee.id}
                        onClick={() => {

                          setSelected(
                            (previous) => [
                              ...previous,
                              employee,
                            ]
                          );

                          setEmployeeSearch("");

                        }}
                        className="flex w-full px-3 py-2 text-left text-xs hover:bg-indigo-50"
                      >

                        <span className="font-semibold">
                          {employee.full_name}
                        </span>

                        <span className="ml-2 text-slate-400">
                          {employee.employee_code}
                        </span>

                      </button>

                    )
                  )}

                </div>

              )}

              <div className="mt-3 flex justify-between text-[10px]">

                <span className="font-bold text-slate-400">

                  Selected (
                  {selected.length}
                  )

                </span>

                <div className="flex gap-2">

                  <button
                    type="button"
                    onClick={() =>
                      setSelected(
                        [...employees]
                      )
                    }
                    className="font-semibold text-indigo-600"
                  >
                    All
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setSelected([])
                    }
                    className="text-slate-400"
                  >
                    Clear
                  </button>

                </div>

              </div>

              <div className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-2">

                {selected.length ===
                  0 ? (

                  <div className="py-4 text-center text-xs text-slate-400">
                    None selected
                  </div>

                ) : (

                  selected.map(
                    (employee) => (

                      <div
                        key={employee.id}
                        className="flex items-center justify-between rounded-lg bg-white px-2 py-1.5 text-[11px]"
                      >

                        <div>

                          <div className="font-semibold text-slate-700">
                            {employee.full_name}
                          </div>

                          <div className="text-[9px] text-slate-400">
                            {employee.employee_code}
                          </div>

                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setSelected(
                              (previous) =>
                                previous.filter(
                                  (item) =>
                                    item.id !==
                                    employee.id
                                )
                            )
                          }
                          className="text-lg text-slate-300 hover:text-red-500"
                        >
                          ×
                        </button>

                      </div>

                    )
                  )

                )}

              </div>

            </section>

            {/* Assignment */}

            <section className="rounded-2xl border border-slate-200 bg-white p-4">

              <h3 className="text-sm font-bold text-slate-800">
                Assignment
              </h3>

              {/* Dates */}

              <div className="mt-3 grid grid-cols-2 gap-2">

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">

                  <div className="text-[9px] font-semibold text-slate-400">
                    FROM
                  </div>

                  <input
                    type="date"
                    value={fromDate}
                    onChange={(event) =>
                      setFromDate(
                        event.target.value
                      )
                    }
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
                    onChange={(event) =>
                      setToDate(
                        event.target.value
                      )
                    }
                    className="mt-1 w-full bg-transparent text-sm font-bold outline-none"
                  />

                </div>

              </div>

              {/* Assignment Type */}

              <div className="mt-3 grid grid-cols-3 gap-2">

                {(
                  [
                    "SHIFT",
                    "OFF",
                    "LEAVE",
                  ] as AssignmentType[]
                ).map(
                  (assignmentType) => (

                    <button
                      key={assignmentType}
                      type="button"
                      onClick={() =>
                        setType(
                          assignmentType
                        )
                      }
                      className={`rounded-xl border p-2.5 text-xs font-bold ${
                        type ===
                        assignmentType
                          ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                          : "border-slate-200 text-slate-600"
                      }`}
                    >
                      {assignmentType}
                    </button>

                  )
                )}

              </div>

              {/* Shift */}

              {type ===
                "SHIFT" && (

                <select
                  value={shiftId}
                  onChange={(event) =>
                    setShiftId(
                      event.target.value
                    )
                  }
                  className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold"
                >

                  <option value="">
                    Select shift...
                  </option>

                  {shifts.map(
                    (shift) => (

                      <option
                        key={shift.id}
                        value={shift.id}
                      >
                        {shift.code}
                        {" — "}
                        {shift.name}
                        {" · "}
                        {shift.start_time.slice(
                          0,
                          5
                        )}
                        {" - "}
                        {shift.end_time.slice(
                          0,
                          5
                        )}
                      </option>

                    )
                  )}

                </select>

              )}

              {/* Weekly Off */}

              <select
                value={weekOff}
                onChange={(event) =>
                  setWeekOff(
                    event.target.value
                  )
                }
                className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold"
              >

                <option value="">
                  No weekly off
                </option>

                <option value="0">
                  Sunday
                </option>

                <option value="1">
                  Monday
                </option>

                <option value="2">
                  Tuesday
                </option>

                <option value="3">
                  Wednesday
                </option>

                <option value="4">
                  Thursday
                </option>

                <option value="5">
                  Friday
                </option>

                <option value="6">
                  Saturday
                </option>

              </select>

              {/* Remarks */}

              <textarea
                value={remarks}
                onChange={(event) =>
                  setRemarks(
                    event.target.value
                  )
                }
                rows={2}
                placeholder="Remarks (optional)"
                className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-indigo-300"
              />

            </section>

          </div>

          {/* Modal Error */}

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

        </div>

        {/* Footer */}

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-600 disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : "Save Roster"}
          </button>

        </div>

      </div>

    </div>
  );
}