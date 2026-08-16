"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import MainMenu from "@/components/MainMenu";
import { createClient } from "@/lib/supabase";

type Employee = {
  id: string;
  employee_code: string;
  barcode: string;
  full_name: string;
  department: string | null;
  designation: string | null;
  employment_type: "BLUE_COLLAR" | "ASSOCIATE";
  gender: "Male" | "Female" | "Other" | null;
  joining_date: string | null;
  is_active: boolean;
  created_at: string;
};

type EmployeeForm = {
  employee_code: string;
  barcode: string;
  full_name: string;
  department: string;
  designation: string;
  employment_type: "BLUE_COLLAR" | "ASSOCIATE";
  gender: "Male" | "Female" | "Other" | "";
  joining_date: string;
};

type BulkRow = {
  employee_code: string;
  barcode: string;
  full_name: string;
  department: string;
  designation: string;
  employment_type: "BLUE_COLLAR" | "ASSOCIATE";
  gender: "Male" | "Female" | "Other" | "";
  joining_date: string;
  error?: string;
};

const EMPTY_FORM: EmployeeForm = {
  employee_code: "",
  barcode: "",
  full_name: "",
  department: "",
  designation: "",
  employment_type: "BLUE_COLLAR",
  gender: "",
  joining_date: "",
};

function normalizeEmploymentType(
  value: string
): "BLUE_COLLAR" | "ASSOCIATE" {
  const v = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (v === "ASSOCIATE" || v === "ASSOC" || v === "A") {
    return "ASSOCIATE";
  }
  return "BLUE_COLLAR";
}

function normalizeGender(value: string): "Male" | "Female" | "Other" | "" {
  const v = value.trim().toLowerCase();
  if (v === "male" || v === "m") return "Male";
  if (v === "female" || v === "f") return "Female";
  if (v === "other" || v === "o") return "Other";
  return "";
}

function parseBulkText(raw: string): BulkRow[] {
  const lines = raw
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const firstLine = lines[0];
  const delimiter = firstLine.includes("\t")
    ? "\t"
    : firstLine.includes(",")
      ? ","
      : "\t";

  const rows: string[][] = lines.map((line) =>
    line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ""))
  );

  const firstCells = rows[0].map((c) => c.toLowerCase().replace(/\s+/g, "_"));
  const looksLikeHeader =
    firstCells.includes("employee_code") ||
    firstCells.includes("employeeid") ||
    firstCells.includes("emp_id") ||
    firstCells.includes("barcode") ||
    firstCells.includes("full_name") ||
    firstCells.includes("name") ||
    firstCells.includes("gender");

  const dataRows = looksLikeHeader ? rows.slice(1) : rows;

  return dataRows.map((cells) => {
    // New order:
    // 0: employee_code | 1: barcode | 2: full_name | 3: department | 4: designation | 5: employment_type | 6: gender | 7: joining_date
    const employee_code = (cells[0] || "").toUpperCase();
    const barcode = cells[1] || "";
    const full_name = cells[2] || "";
    const department = cells[3] || "";
    const designation = cells[4] || "";
    const employment_type = normalizeEmploymentType(cells[5] || "BLUE_COLLAR");
    const gender = normalizeGender(cells[6] || "");
    let joining_date = cells[7] || "";

    if (joining_date) {
      const dmy = joining_date.match(
        /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/
      );
      if (dmy) {
        joining_date = `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
      }
    }

    const row: BulkRow = {
      employee_code,
      barcode,
      full_name,
      department,
      designation,
      employment_type,
      gender,
      joining_date,
    };

    const errors: string[] = [];
    if (!employee_code) errors.push("Employee ID required");
    if (!barcode) errors.push("Barcode required");
    if (!full_name) errors.push("Name required");

    if (errors.length) {
      row.error = errors.join(", ");
    }

    return row;
  });
}

export default function EmployeesPage() {
  const supabase = createClient();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmployeeForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [addMode, setAddMode] = useState<"single" | "bulk">("single");
  const [bulkText, setBulkText] = useState("");
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);

  async function loadEmployees() {
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from("employees")
      .select(
        "id, employee_code, barcode, full_name, department, designation, employment_type, gender, joining_date, is_active, created_at"
      )
      .order("full_name", { ascending: true });

    if (loadError) {
      console.error("Employee load error:", loadError);
      setError(loadError.message);
      setLoading(false);
      return;
    }
    setEmployees(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadEmployees();
  }, []);

  const filteredEmployees = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return employees;
    return employees.filter((employee) => {
      return (
        employee.employee_code.toLowerCase().includes(value) ||
        employee.barcode.toLowerCase().includes(value) ||
        employee.full_name.toLowerCase().includes(value) ||
        (employee.department || "").toLowerCase().includes(value) ||
        (employee.designation || "").toLowerCase().includes(value) ||
        (employee.gender || "").toLowerCase().includes(value)
      );
    });
  }, [employees, search]);

  function openAddModal() {
    setEditingEmployee(null);
    setForm({
      ...EMPTY_FORM,
      joining_date: new Date().toISOString().slice(0, 10),
    });
    setAddMode("single");
    setBulkText("");
    setBulkRows([]);
    setError("");
    setSuccess("");
    setShowModal(true);
  }

  function openEditModal(employee: Employee) {
    setEditingEmployee(employee);
    setForm({
      employee_code: employee.employee_code,
      barcode: employee.barcode,
      full_name: employee.full_name,
      department: employee.department || "",
      designation: employee.designation || "",
      employment_type: employee.employment_type,
      gender: employee.gender || "",
      joining_date: employee.joining_date || "",
    });
    setAddMode("single");
    setBulkText("");
    setBulkRows([]);
    setError("");
    setSuccess("");
    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;
    setShowModal(false);
    setEditingEmployee(null);
    setForm(EMPTY_FORM);
    setAddMode("single");
    setBulkText("");
    setBulkRows([]);
    setError("");
  }

  function updateForm(field: keyof EmployeeForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleBulkTextChange(value: string) {
    setBulkText(value);
    if (!value.trim()) {
      setBulkRows([]);
      return;
    }
    setBulkRows(parseBulkText(value));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    // ─── BULK MODE ───────────────────────────────────────────────
    if (addMode === "bulk" && !editingEmployee) {
      if (bulkRows.length === 0) {
        setError("Please paste employee data first.");
        return;
      }

      const validRows = bulkRows.filter((r) => !r.error);
      const invalidCount = bulkRows.length - validRows.length;

      if (validRows.length === 0) {
        setError(
          "No valid rows to import. Please fix the errors shown in the preview."
        );
        return;
      }

      setSaving(true);
      try {
        const payload = validRows.map((row) => ({
          employee_code: row.employee_code,
          barcode: row.barcode,
          full_name: row.full_name,
          department: row.department.trim() || null,
          designation: row.designation.trim() || null,
          employment_type: row.employment_type,
          gender: row.gender || null,
          joining_date: row.joining_date || null,
          is_active: true,
        }));

        const { error: insertError } = await supabase
          .from("employees")
          .insert(payload);

        if (insertError) {
          if (insertError.code === "23505") {
            setError(
              "One or more Employee IDs or Barcodes already exist. Please remove duplicates and try again."
            );
          } else {
            throw insertError;
          }
          return;
        }

        const msg =
          invalidCount > 0
            ? `${validRows.length} employees added. ${invalidCount} row(s) skipped due to errors.`
            : `${validRows.length} employees added successfully.`;
        setSuccess(msg);
        setShowModal(false);
        setBulkText("");
        setBulkRows([]);
        setForm(EMPTY_FORM);
        await loadEmployees();
      } catch (err: any) {
        console.error("Bulk employee save error:", err);
        setError(err?.message || "Unable to save employees.");
      } finally {
        setSaving(false);
      }
      return;
    }

    // ─── SINGLE MODE ─────────────────────────────────────────────
    const employeeCode = form.employee_code.trim().toUpperCase();
    const barcode = form.barcode.trim();
    const fullName = form.full_name.trim();

    if (!employeeCode) {
      setError("Please enter Employee ID.");
      return;
    }
    if (!barcode) {
      setError("Please enter or scan the barcode.");
      return;
    }
    if (!fullName) {
      setError("Please enter employee name.");
      return;
    }

    setSaving(true);
    try {
      if (editingEmployee) {
        const { error: updateError } = await supabase
          .from("employees")
          .update({
            employee_code: employeeCode,
            barcode,
            full_name: fullName,
            department: form.department.trim() || null,
            designation: form.designation.trim() || null,
            employment_type: form.employment_type,
            gender: form.gender || null,
            joining_date: form.joining_date || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingEmployee.id);

        if (updateError) throw updateError;
        setSuccess("Employee updated successfully.");
      } else {
        const { error: insertError } = await supabase
          .from("employees")
          .insert({
            employee_code: employeeCode,
            barcode,
            full_name: fullName,
            department: form.department.trim() || null,
            designation: form.designation.trim() || null,
            employment_type: form.employment_type,
            gender: form.gender || null,
            joining_date: form.joining_date || null,
            is_active: true,
          });

        if (insertError) {
          if (insertError.code === "23505") {
            setError("Employee ID or Barcode already exists.");
          } else {
            throw insertError;
          }
          return;
        }
        setSuccess("Employee added successfully.");
      }

      setShowModal(false);
      setEditingEmployee(null);
      setForm(EMPTY_FORM);
      await loadEmployees();
    } catch (err: any) {
      console.error("Employee save error:", err);
      setError(err?.message || "Unable to save employee.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleEmployee(employee: Employee) {
    setError("");
    setSuccess("");
    const action = employee.is_active ? "deactivate" : "activate";
    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${employee.full_name}?`
    );
    if (!confirmed) return;

    const { error: updateError } = await supabase
      .from("employees")
      .update({
        is_active: !employee.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", employee.id);

    if (updateError) {
      console.error("Employee status error:", updateError);
      setError(updateError.message);
      return;
    }

    setSuccess(
      employee.is_active
        ? "Employee deactivated successfully."
        : "Employee activated successfully."
    );
    await loadEmployees();
  }

  const validBulkCount = bulkRows.filter((r) => !r.error).length;
  const invalidBulkCount = bulkRows.length - validBulkCount;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 md:px-6">
      <div className="mx-auto max-w-[1500px]">
        <MainMenu />

        {/* HEADER */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Employee Management
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage blue-collar and associate employees for attendance.
            </p>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
          >
            + Add Employee
          </button>
        </div>

        {/* SEARCH / SUMMARY */}
        <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-md">
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, Employee ID, barcode or gender..."
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 hover:text-slate-700"
                >
                  ×
                </button>
              )}
            </div>
            <div className="flex gap-5 text-sm">
              <div>
                <span className="text-slate-400">Total</span>{" "}
                <strong className="text-slate-700">{employees.length}</strong>
              </div>
              <div>
                <span className="text-slate-400">Active</span>{" "}
                <strong className="text-green-600">
                  {employees.filter((e) => e.is_active).length}
                </strong>
              </div>
              <div>
                <span className="text-slate-400">Inactive</span>{" "}
                <strong className="text-red-600">
                  {employees.filter((e) => !e.is_active).length}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* ALERTS */}
        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        {/* TABLE */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Employee
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Barcode
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Gender
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Department
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Designation
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-12 text-center text-sm text-slate-400"
                    >
                      Loading employees...
                    </td>
                  </tr>
                ) : filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <div className="text-sm font-medium text-slate-500">
                        No employees found.
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        Add an employee or change your search.
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((employee) => (
                    <tr
                      key={employee.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">
                          {employee.full_name}
                        </div>
                        <div className="mt-0.5 text-xs font-medium text-slate-400">
                          {employee.employee_code}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700">
                          {employee.barcode}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {employee.gender || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {employee.department || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {employee.designation || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                          {employee.employment_type === "BLUE_COLLAR"
                            ? "Blue Collar"
                            : "Associate"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {employee.is_active ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(employee)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleEmployee(employee)}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                              employee.is_active
                                ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                                : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                            }`}
                          >
                            {employee.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ADD / EDIT MODAL */}
        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4">
            <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              {/* MODAL HEADER */}
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">
                    {editingEmployee ? "Edit Employee" : "Add Employee"}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {editingEmployee
                      ? "Update employee information."
                      : "Add a blue-collar or associate employee (single or bulk)."}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={closeModal}
                  className="rounded-lg px-3 py-1 text-xl text-slate-400 hover:bg-slate-100"
                >
                  ×
                </button>
              </div>

              {/* MODE TOGGLE */}
              {!editingEmployee && (
                <div className="flex shrink-0 gap-1 border-b border-slate-200 bg-slate-50 px-5 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAddMode("single");
                      setError("");
                    }}
                    className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                      addMode === "single"
                        ? "bg-white text-slate-800 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Single
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddMode("bulk");
                      setError("");
                    }}
                    className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                      addMode === "bulk"
                        ? "bg-white text-slate-800 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Bulk Paste
                  </button>
                </div>
              )}

              <form
                onSubmit={handleSubmit}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="flex-1 overflow-y-auto p-5">
                  {/* ─── SINGLE FORM ─── */}
                  {(addMode === "single" || editingEmployee) && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                          Employee ID *
                        </label>
                        <input
                          type="text"
                          value={form.employee_code}
                          onChange={(e) =>
                            updateForm("employee_code", e.target.value)
                          }
                          placeholder="EMP001"
                          disabled={saving}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm uppercase outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                          Barcode *
                        </label>
                        <input
                          type="text"
                          value={form.barcode}
                          onChange={(e) =>
                            updateForm("barcode", e.target.value)
                          }
                          placeholder="Scan or enter barcode"
                          disabled={saving}
                          autoComplete="off"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          value={form.full_name}
                          onChange={(e) =>
                            updateForm("full_name", e.target.value)
                          }
                          placeholder="Employee full name"
                          disabled={saving}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                          Gender
                        </label>
                        <select
                          value={form.gender}
                          onChange={(e) =>
                            updateForm("gender", e.target.value)
                          }
                          disabled={saving}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                        >
                          <option value="">Select Gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                          Employee Type
                        </label>
                        <select
                          value={form.employment_type}
                          onChange={(e) =>
                            updateForm("employment_type", e.target.value)
                          }
                          disabled={saving}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                        >
                          <option value="BLUE_COLLAR">Blue Collar</option>
                          <option value="ASSOCIATE">Associate</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                          Department
                        </label>
                        <input
                          type="text"
                          value={form.department}
                          onChange={(e) =>
                            updateForm("department", e.target.value)
                          }
                          placeholder="Outbound"
                          disabled={saving}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                          Designation
                        </label>
                        <input
                          type="text"
                          value={form.designation}
                          onChange={(e) =>
                            updateForm("designation", e.target.value)
                          }
                          placeholder="Associate"
                          disabled={saving}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                          Joining Date
                        </label>
                        <input
                          type="date"
                          value={form.joining_date}
                          onChange={(e) =>
                            updateForm("joining_date", e.target.value)
                          }
                          disabled={saving}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                        />
                      </div>
                    </div>
                  )}

                  {/* ─── BULK PASTE ─── */}
                  {addMode === "bulk" && !editingEmployee && (
                    <div className="space-y-4">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                        <p className="font-semibold text-slate-700">
                          How to use
                        </p>
                        <ol className="mt-1 list-inside list-decimal space-y-0.5">
                          <li>Copy rows from Excel (with or without header).</li>
                          <li>Paste into the box below.</li>
                          <li>Review the preview and click Save.</li>
                        </ol>
                        <p className="mt-2 font-medium text-slate-700">
                          Column order (required):
                        </p>
                        <code className="mt-1 block overflow-x-auto rounded bg-white px-2 py-1.5 font-mono text-[11px] text-slate-800">
                          Employee ID | Barcode | Full Name | Department |
                          Designation | Type | Gender | Joining Date
                        </code>
                        <p className="mt-1.5 text-[11px] text-slate-500">
                          Gender accepts: <span className="font-medium">Male</span> /{" "}
                          <span className="font-medium">Female</span> /{" "}
                          <span className="font-medium">Other</span> (or M / F).
                          Type: BLUE_COLLAR / ASSOCIATE.
                        </p>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                          Paste Excel data *
                        </label>
                        <textarea
                          value={bulkText}
                          onChange={(e) =>
                            handleBulkTextChange(e.target.value)
                          }
                          placeholder={`EMP001\t1234567890\tJohn Doe\tOutbound\tPicker\tBLUE_COLLAR\tMale\t2024-01-15\nEMP002\t0987654321\tJane Smith\tInbound\tAssociate\tASSOCIATE\tFemale\t15/01/2024`}
                          disabled={saving}
                          rows={8}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-xs outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                        />
                      </div>

                      {bulkRows.length > 0 && (
                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-xs font-semibold text-slate-600">
                              Preview ({bulkRows.length} rows)
                            </p>
                            <div className="flex gap-3 text-xs">
                              <span className="text-green-600">
                                {validBulkCount} valid
                              </span>
                              {invalidBulkCount > 0 && (
                                <span className="text-red-600">
                                  {invalidBulkCount} invalid
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="max-h-56 overflow-auto rounded-lg border border-slate-200">
                            <table className="w-full min-w-[800px] border-collapse text-left text-xs">
                              <thead className="sticky top-0 bg-slate-100">
                                <tr>
                                  <th className="px-2 py-1.5 font-semibold text-slate-500">#</th>
                                  <th className="px-2 py-1.5 font-semibold text-slate-500">Emp ID</th>
                                  <th className="px-2 py-1.5 font-semibold text-slate-500">Barcode</th>
                                  <th className="px-2 py-1.5 font-semibold text-slate-500">Name</th>
                                  <th className="px-2 py-1.5 font-semibold text-slate-500">Gender</th>
                                  <th className="px-2 py-1.5 font-semibold text-slate-500">Dept</th>
                                  <th className="px-2 py-1.5 font-semibold text-slate-500">Type</th>
                                  <th className="px-2 py-1.5 font-semibold text-slate-500">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {bulkRows.map((row, idx) => (
                                  <tr
                                    key={idx}
                                    className={
                                      row.error
                                        ? "bg-red-50"
                                        : "hover:bg-slate-50"
                                    }
                                  >
                                    <td className="px-2 py-1.5 text-slate-400">
                                      {idx + 1}
                                    </td>
                                    <td className="px-2 py-1.5 font-medium">
                                      {row.employee_code || "—"}
                                    </td>
                                    <td className="px-2 py-1.5 font-mono">
                                      {row.barcode || "—"}
                                    </td>
                                    <td className="px-2 py-1.5">
                                      {row.full_name || "—"}
                                    </td>
                                    <td className="px-2 py-1.5">
                                      {row.gender || "—"}
                                    </td>
                                    <td className="px-2 py-1.5">
                                      {row.department || "—"}
                                    </td>
                                    <td className="px-2 py-1.5">
                                      {row.employment_type === "ASSOCIATE"
                                        ? "Associate"
                                        : "Blue Collar"}
                                    </td>
                                    <td className="px-2 py-1.5">
                                      {row.error ? (
                                        <span className="text-red-600">
                                          {row.error}
                                        </span>
                                      ) : (
                                        <span className="text-green-600">
                                          OK
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {error && (
                    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                      {error}
                    </div>
                  )}
                </div>

                {/* FOOTER */}
                <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={closeModal}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      saving ||
                      (addMode === "bulk" &&
                        !editingEmployee &&
                        validBulkCount === 0)
                    }
                    className="rounded-lg bg-slate-800 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving
                      ? "Saving..."
                      : editingEmployee
                        ? "Update Employee"
                        : addMode === "bulk"
                          ? `Save ${validBulkCount || ""} Employee${validBulkCount === 1 ? "" : "s"}`
                          : "Save Employee"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}