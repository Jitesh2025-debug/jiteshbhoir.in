"use client";
export const dynamic = "force-dynamic";
import { useEffect, useRef, useState } from "react";
import MainMenu from "@/components/MainMenu";
import { createClient } from "@/lib/supabase";

type Employee = {
  id: string;
  employee_code: string;
  barcode: string;
  full_name: string;
  department: string | null;
};

type Attendance = {
  id: string;
  employee_code: string;
  full_name: string;
  department: string | null;
  check_in: string;
};

export default function AttendancePage() {
  const supabase = createClient();

  const inputRef = useRef<HTMLInputElement>(null);

  const [barcode, setBarcode] = useState("");

  const [employee, setEmployee] =
    useState<Employee | null>(null);

  const [attendance, setAttendance] = useState<
    Attendance[]
  >([]);

  const [message, setMessage] = useState("");

  const [error, setError] = useState("");

  async function loadAttendance() {
    const p = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const g = (t: string) => p.find((x) => x.type === t)?.value || "";
    const today = `${g("year")}-${g("month")}-${g("day")}`;

    const { data } = await supabase
      .from("attendance")
      .select(
        "id, employee_code, full_name, department, check_in"
      )
      .eq("attendance_date", today)
      .order("check_in", {
        ascending: false,
      });

    setAttendance(data || []);
  }

  useEffect(() => {
    loadAttendance();

    inputRef.current?.focus();
  }, []);

  async function handleScan(
    event: React.FormEvent
  ) {
    event.preventDefault();

    setError("");
    setMessage("");
    setEmployee(null);

    if (!barcode.trim()) {
      return;
    }

    const { data: employeeData } =
      await supabase
        .from("employees")
        .select(
          "id, employee_code, barcode, full_name, department"
        )
        .eq("barcode", barcode.trim())
        .eq("is_active", true)
        .single();

    if (!employeeData) {
      setError("Employee not found.");
      setBarcode("");

      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);

      return;
    }

    const p = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const g = (t: string) => p.find((x) => x.type === t)?.value || "";
    const today = `${g("year")}-${g("month")}-${g("day")}`;

    const { data: existing } =
      await supabase
        .from("attendance")
        .select("id")
        .eq("employee_id", employeeData.id)
        .eq("attendance_date", today)
        .maybeSingle();

    if (existing) {
      setEmployee(employeeData);

      setError(
        "Attendance already marked today."
      );

      setBarcode("");

      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);

      return;
    }

    const { error: insertError } =
      await supabase
        .from("attendance")
        .insert({
          employee_id: employeeData.id,
          employee_code:
            employeeData.employee_code,
          barcode: employeeData.barcode,
          full_name: employeeData.full_name,
          department:
            employeeData.department,
        });

    if (insertError) {
      setError(insertError.message);

      return;
    }

    setEmployee(employeeData);

    setMessage(
      "Attendance marked successfully."
    );

    setBarcode("");

    await loadAttendance();

    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">

      <div className="mx-auto max-w-7xl">

        <MainMenu />

        <div className="mb-6">

          <h1 className="text-2xl font-bold">
            Attendance
          </h1>

          <p className="text-sm text-slate-500">
            Scan employee barcode to mark
            attendance.
          </p>

        </div>

        <div className="grid gap-6 lg:grid-cols-3">

          <div className="rounded-xl border bg-white p-6 lg:col-span-1">

            <form onSubmit={handleScan}>

              <label className="mb-2 block text-sm font-medium">

                Scan Barcode

              </label>

              <input
                ref={inputRef}
                type="text"
                value={barcode}
                onChange={(e) =>
                  setBarcode(e.target.value)
                }
                autoComplete="off"
                placeholder="Scan here..."
                className="w-full rounded-lg border px-4 py-3 text-lg"
              />

            </form>

            {message && (
              <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
                {message}
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {employee && (

              <div className="mt-6 rounded-xl border bg-slate-50 p-4">

                <h2 className="mb-4 font-semibold">

                  Employee Details

                </h2>

                <div className="space-y-2 text-sm">

                  <p>
                    <strong>Name:</strong>{" "}
                    {employee.full_name}
                  </p>

                  <p>
                    <strong>Employee ID:</strong>{" "}
                    {employee.employee_code}
                  </p>

                  <p>
                    <strong>Department:</strong>{" "}
                    {employee.department ||
                      "-"}
                  </p>

                </div>

              </div>

            )}

          </div>

          <div className="rounded-xl border bg-white p-6 lg:col-span-2">

            <div className="mb-4 flex items-center justify-between">

              <h2 className="font-semibold">

                Today's Attendance

              </h2>

              <div className="rounded-lg bg-slate-100 px-4 py-2 text-sm">

                Present: {attendance.length}

              </div>

            </div>

            <div className="overflow-x-auto">

              <table className="w-full">

                <thead>

                  <tr className="border-b">

                    <th className="px-4 py-3 text-left">

                      Employee ID

                    </th>

                    <th className="px-4 py-3 text-left">

                      Name

                    </th>

                    <th className="px-4 py-3 text-left">

                      Department

                    </th>

                    <th className="px-4 py-3 text-left">

                      Check In

                    </th>

                  </tr>

                </thead>

                <tbody>

                  {attendance.map((item) => (

                    <tr
                      key={item.id}
                      className="border-b"
                    >

                      <td className="px-4 py-3">
                        {item.employee_code}
                      </td>

                      <td className="px-4 py-3">
                        {item.full_name}
                      </td>

                      <td className="px-4 py-3">
                        {item.department || "-"}
                      </td>

                      <td className="px-4 py-3">

                        {new Date(
                          item.check_in
                        ).toLocaleTimeString()}

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          </div>

        </div>

      </div>

    </main>
  );
}