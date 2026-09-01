"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import MainMenu from "@/components/MainMenu";
import { createClient } from "@/lib/supabase";

type SkillLevel = "SKILLED" | "SEMI_SKILLED" | "UNSKILLED";

type Gender = "Male" | "Female" | "Other";

type Employee = {
  id: string;
  employee_code: string;
  barcode: string;
  full_name: string;
  department: string | null;
  designation: string | null;
  employment_type: SkillLevel;
  gender: Gender | null;
  vendor: string | null;
  customer_account: string | null;
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
  employment_type: SkillLevel;
  gender: Gender | "";
  vendor: string;
  customer_account: string;
  joining_date: string;
};

type BulkRow = {
  employee_code: string;
  barcode: string;
  full_name: string;
  department: string;
  designation: string;
  employment_type: SkillLevel;
  gender: Gender | "";
  vendor: string;
  customer_account: string;
  joining_date: string;
  error?: string;
  _existingId?: string;
};

type ModalMode = "single" | "bulk_add" | "bulk_edit";

const VENDORS = [
  "Jeevdani",
  "FUTURZ",
  "MACRON",
  "PSN",
];

const CUSTOMER_ACCOUNTS = [
  "MADESA",
  "Happy Ecom",
  "Flipkart",
];

const EMPTY_FORM: EmployeeForm = {
  employee_code: "",
  barcode: "",
  full_name: "",
  department: "",
  designation: "",
  employment_type: "UNSKILLED",
  gender: "",
  vendor: "",
  customer_account: "",
  joining_date: "",
};

function normalizeSkillLevel(value: string): SkillLevel {
  const v = value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (v === "SKILLED" || v === "S") {
    return "SKILLED";
  }

  if (
    v === "SEMI_SKILLED" ||
    v === "SEMI" ||
    v === "SS" ||
    v === "SEMI_SKILL"
  ) {
    return "SEMI_SKILLED";
  }

  // Associate = Semi-Skilled
  if (
    v === "ASSOCIATE" ||
    v === "ASSOC" ||
    v === "A"
  ) {
    return "SEMI_SKILLED";
  }

  // Blue Collar = Unskilled
  if (
    v === "BLUE_COLLAR" ||
    v === "BLUE" ||
    v === "BC"
  ) {
    return "UNSKILLED";
  }

  return "UNSKILLED";
}

function skillLabel(type: SkillLevel) {
  if (type === "SKILLED") return "Skilled";
  if (type === "SEMI_SKILLED") return "Semi-Skilled";
  return "Unskilled";
}

function normalizeGender(
  value: string
): Gender | "" {
  const v = value.trim().toLowerCase();

  if (v === "male" || v === "m") return "Male";
  if (v === "female" || v === "f") return "Female";
  if (v === "other" || v === "o") return "Other";

  return "";
}

/**
 * Bulk columns:
 *
 * EmpID
 * Barcode
 * Name
 * Department
 * Designation
 * Type
 * Gender
 * Vendor
 * CustomerAccount
 * JoiningDate
 */
function parseBulkText(raw: string): BulkRow[] {
  const lines = raw
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const firstLine = lines[0];

  const delimiter = firstLine.includes("\t")
    ? "\t"
    : firstLine.includes(",")
      ? ","
      : "\t";

  const rows = lines.map((line) =>
    line
      .split(delimiter)
      .map((cell) =>
        cell.trim().replace(/^"|"$/g, "")
      )
  );

  const firstCells = rows[0].map((cell) =>
    cell
      .toLowerCase()
      .replace(/\s+/g, "_")
  );

  const looksLikeHeader =
    firstCells.includes("employee_code") ||
    firstCells.includes("employeeid") ||
    firstCells.includes("emp_id") ||
    firstCells.includes("barcode") ||
    firstCells.includes("full_name") ||
    firstCells.includes("name") ||
    firstCells.includes("gender") ||
    firstCells.includes("vendor");

  const dataRows = looksLikeHeader
    ? rows.slice(1)
    : rows;

  return dataRows.map((cells) => {
    const employee_code = (
      cells[0] || ""
    ).toUpperCase();

    const barcode = cells[1] || "";
    const full_name = cells[2] || "";
    const department = cells[3] || "";
    const designation = cells[4] || "";

    const employment_type =
      normalizeSkillLevel(
        cells[5] || "UNSKILLED"
      );

    const gender = normalizeGender(
      cells[6] || ""
    );

    const vendor = cells[7] || "";
    const customer_account = cells[8] || "";

    let joining_date = cells[9] || "";

    if (joining_date) {
      const dmy = joining_date.match(
        /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/
      );

      if (dmy) {
        joining_date =
          `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
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
      vendor,
      customer_account,
      joining_date,
    };

    const errors: string[] = [];

    if (!employee_code) {
      errors.push("Employee ID required");
    }

    if (!barcode) {
      errors.push("Barcode required");
    }

    if (!full_name) {
      errors.push("Name required");
    }

    if (errors.length) {
      row.error = errors.join(", ");
    }

    return row;
  });
}

function csvEscape(value: unknown): string {
  const text = String(
    value ?? ""
  );

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n") ||
    text.includes("\r")
  ) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export default function EmployeesPage() {
  const supabase = createClient();

  const [employees, setEmployees] =
    useState<Employee[]>([]);

  const [search, setSearch] = useState("");

  const [departmentFilter, setDepartmentFilter] =
    useState("");

  const [designationFilter, setDesignationFilter] =
    useState("");

  const [typeFilter, setTypeFilter] =
    useState("");

  const [genderFilter, setGenderFilter] =
    useState("");

  const [vendorFilter, setVendorFilter] =
    useState("");

  const [customerFilter, setCustomerFilter] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("");

  const [showFilters, setShowFilters] =
    useState(true);

  const [showModal, setShowModal] =
    useState(false);

  const [editingEmployee, setEditingEmployee] =
    useState<Employee | null>(null);

  const [form, setForm] =
    useState<EmployeeForm>(EMPTY_FORM);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [isAdmin, setIsAdmin] =
    useState(false);

  const [modalMode, setModalMode] =
    useState<ModalMode>("single");

  const [bulkText, setBulkText] =
    useState("");

  const [bulkRows, setBulkRows] =
    useState<BulkRow[]>([]);

  const [showConfirm, setShowConfirm] =
    useState(false);

  const [pendingBulkAction, setPendingBulkAction] =
    useState<"add" | "edit" | null>(null);

  // ------------------------------------------------------------
  // ADMIN CHECK
  // ------------------------------------------------------------

  async function checkAdmin() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsAdmin(false);
        return;
      }

      const metaRole = String(
        user.app_metadata?.role ||
          user.user_metadata?.role ||
          ""
      )
        .toLowerCase()
        .replace(/-/g, "_");

      if (
        [
          "admin",
          "super_admin",
          "superadmin",
        ].includes(metaRole)
      ) {
        setIsAdmin(true);
        return;
      }

      const { data: profile } =
        await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

      const pRole = String(
        profile?.role || ""
      )
        .toLowerCase()
        .replace(/-/g, "_");

      setIsAdmin(
        [
          "admin",
          "super_admin",
          "superadmin",
        ].includes(pRole)
      );
    } catch {
      setIsAdmin(false);
    }
  }

  // ------------------------------------------------------------
  // LOAD EMPLOYEES
  // ------------------------------------------------------------

  async function loadEmployees() {
    setLoading(true);
    setError("");

    const { data, error: loadError } =
      await supabase
        .from("employees")
        .select(
          [
            "id",
            "employee_code",
            "barcode",
            "full_name",
            "department",
            "designation",
            "employment_type",
            "gender",
            "vendor",
            "customer_account",
            "joining_date",
            "is_active",
            "created_at",
          ].join(", ")
        )
        .order("full_name", {
          ascending: true,
        });

    if (loadError) {
      console.error(loadError);
      setError(loadError.message);
      setLoading(false);
      return;
    }

    setEmployees(
      (data || []) as unknown as Employee[]
    );

    setLoading(false);
  }

  useEffect(() => {
    checkAdmin();
    loadEmployees();
  }, []);

  // ------------------------------------------------------------
  // UNIQUE FILTER VALUES
  // ------------------------------------------------------------

  const departments = useMemo(() => {
    return Array.from(
      new Set(
        employees
          .map((e) => e.department)
          .filter(Boolean)
      )
    ).sort();
  }, [employees]);

  const designations = useMemo(() => {
    return Array.from(
      new Set(
        employees
          .map((e) => e.designation)
          .filter(Boolean)
      )
    ).sort();
  }, [employees]);

  const vendors = useMemo(() => {
    return Array.from(
      new Set(
        [
          ...VENDORS,
          ...employees
            .map((e) => e.vendor)
            .filter(Boolean),
        ]
      )
    ).sort();
  }, [employees]);

  const customerAccounts = useMemo(() => {
    return Array.from(
      new Set(
        [
          ...CUSTOMER_ACCOUNTS,
          ...employees
            .map((e) => e.customer_account)
            .filter(Boolean),
        ]
      )
    ).sort();
  }, [employees]);

  // ------------------------------------------------------------
  // FILTER EMPLOYEES
  // ------------------------------------------------------------

  const filteredEmployees = useMemo(() => {
    const value =
      search.trim().toLowerCase();

    return employees.filter((employee) => {
      const matchesSearch =
        !value ||
        employee.employee_code
          .toLowerCase()
          .includes(value) ||
        employee.barcode
          .toLowerCase()
          .includes(value) ||
        employee.full_name
          .toLowerCase()
          .includes(value) ||
        (employee.department || "")
          .toLowerCase()
          .includes(value) ||
        (employee.designation || "")
          .toLowerCase()
          .includes(value) ||
        (employee.gender || "")
          .toLowerCase()
          .includes(value) ||
        (employee.vendor || "")
          .toLowerCase()
          .includes(value) ||
        (employee.customer_account || "")
          .toLowerCase()
          .includes(value) ||
        skillLabel(
          employee.employment_type
        )
          .toLowerCase()
          .includes(value);

      const matchesDepartment =
        !departmentFilter ||
        employee.department ===
          departmentFilter;

      const matchesDesignation =
        !designationFilter ||
        employee.designation ===
          designationFilter;

      const matchesType =
        !typeFilter ||
        employee.employment_type ===
          typeFilter;

      const matchesGender =
        !genderFilter ||
        employee.gender ===
          genderFilter;

      const matchesVendor =
        !vendorFilter ||
        employee.vendor ===
          vendorFilter;

      const matchesCustomer =
        !customerFilter ||
        employee.customer_account ===
          customerFilter;

      const matchesStatus =
        !statusFilter ||
        (statusFilter === "active"
          ? employee.is_active
          : !employee.is_active);

      return (
        matchesSearch &&
        matchesDepartment &&
        matchesDesignation &&
        matchesType &&
        matchesGender &&
        matchesVendor &&
        matchesCustomer &&
        matchesStatus
      );
    });
  }, [
    employees,
    search,
    departmentFilter,
    designationFilter,
    typeFilter,
    genderFilter,
    vendorFilter,
    customerFilter,
    statusFilter,
  ]);

  // ------------------------------------------------------------
  // CSV DOWNLOAD
  // ------------------------------------------------------------

  function downloadCSV() {
    if (filteredEmployees.length === 0) {
      setError(
        "No employees available for CSV download."
      );
      return;
    }

    const headers = [
      "Employee ID",
      "Barcode",
      "Full Name",
      "Gender",
      "Department",
      "Designation",
      "Employment Type",
      "Vendor",
      "Customer Account",
      "Joining Date",
      "Status",
    ];

    const rows = filteredEmployees.map(
      (employee) => [
        employee.employee_code,
        employee.barcode,
        employee.full_name,
        employee.gender || "",
        employee.department || "",
        employee.designation || "",
        skillLabel(
          employee.employment_type
        ),
        employee.vendor || "",
        employee.customer_account || "",
        employee.joining_date || "",
        employee.is_active
          ? "Active"
          : "Inactive",
      ]
    );

    const csv = [
      headers.map(csvEscape).join(","),
      ...rows.map((row) =>
        row.map(csvEscape).join(",")
      ),
    ].join("\r\n");

    const blob = new Blob(
      ["\uFEFF" + csv],
      {
        type: "text/csv;charset=utf-8;",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    const date =
      new Date()
        .toISOString()
        .slice(0, 10);

    link.download =
      `employees_${date}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    setSuccess(
      `${filteredEmployees.length} employee records exported to CSV.`
    );
  }

  // ------------------------------------------------------------
  // CLEAR FILTERS
  // ------------------------------------------------------------

  function clearFilters() {
    setSearch("");
    setDepartmentFilter("");
    setDesignationFilter("");
    setTypeFilter("");
    setGenderFilter("");
    setVendorFilter("");
    setCustomerFilter("");
    setStatusFilter("");
  }

  const activeFilterCount = [
    departmentFilter,
    designationFilter,
    typeFilter,
    genderFilter,
    vendorFilter,
    customerFilter,
    statusFilter,
  ].filter(Boolean).length;

  // ------------------------------------------------------------
  // BULK PARSE
  // ------------------------------------------------------------

  const applyBulkParse = useCallback(
    (
      text: string,
      mode: ModalMode
    ) => {
      if (!text.trim()) {
        setBulkRows([]);
        return;
      }

      let parsed =
        parseBulkText(text);

      if (mode === "bulk_edit") {
        const byCode =
          new Map(
            employees.map((e) => [
              e.employee_code.toUpperCase(),
              e,
            ])
          );

        parsed = parsed.map((row) => {
          const existing =
            byCode.get(
              row.employee_code
            );

          if (!existing) {
            return {
              ...row,
              error: row.error
                ? `${row.error}; Not found for edit`
                : "Employee ID not found (cannot edit)",
            };
          }

          return {
            ...row,
            _existingId:
              existing.id,
          };
        });
      }

      setBulkRows(parsed);
    },
    [employees]
  );

  function handleBulkTextChange(
    value: string
  ) {
    setBulkText(value);

    applyBulkParse(
      value,
      modalMode
    );
  }

  function switchModalMode(
    mode: ModalMode
  ) {
    setModalMode(mode);
    setError("");

    if (bulkText.trim()) {
      applyBulkParse(
        bulkText,
        mode
      );
    }
  }

  const validBulkCount =
    bulkRows.filter(
      (r) => !r.error
    ).length;

  const invalidBulkCount =
    bulkRows.length -
    validBulkCount;

  // ------------------------------------------------------------
  // MODALS
  // ------------------------------------------------------------

  function openAddModal() {
    setEditingEmployee(null);

    setForm({
      ...EMPTY_FORM,
      joining_date:
        new Date()
          .toISOString()
          .slice(0, 10),
    });

    setModalMode("single");
    setBulkText("");
    setBulkRows([]);
    setError("");
    setSuccess("");
    setShowModal(true);
  }

  function openBulkAdd() {
    setEditingEmployee(null);
    setForm(EMPTY_FORM);
    setModalMode("bulk_add");
    setBulkText("");
    setBulkRows([]);
    setError("");
    setSuccess("");
    setShowModal(true);
  }

  function openBulkEdit() {
    setEditingEmployee(null);
    setForm(EMPTY_FORM);
    setModalMode("bulk_edit");
    setBulkText("");
    setBulkRows([]);
    setError("");
    setSuccess("");
    setShowModal(true);
  }

  function openEditModal(
    employee: Employee
  ) {
    setEditingEmployee(employee);

    setForm({
      employee_code:
        employee.employee_code,
      barcode:
        employee.barcode,
      full_name:
        employee.full_name,
      department:
        employee.department || "",
      designation:
        employee.designation || "",
      employment_type:
        employee.employment_type ||
        "UNSKILLED",
      gender:
        employee.gender || "",
      vendor:
        employee.vendor || "",
      customer_account:
        employee.customer_account ||
        "",
      joining_date:
        employee.joining_date || "",
    });

    setModalMode("single");
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
    setModalMode("single");
    setBulkText("");
    setBulkRows([]);
    setError("");
    setShowConfirm(false);
    setPendingBulkAction(null);
  }

  function updateForm(
    field: keyof EmployeeForm,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  // ------------------------------------------------------------
  // BULK SUBMIT
  // ------------------------------------------------------------

  function requestBulkSubmit() {
    if (!isAdmin) {
      setError(
        "Only admins can bulk add or bulk edit."
      );
      return;
    }

    if (validBulkCount === 0) {
      setError(
        modalMode === "bulk_edit"
          ? "No valid rows to update."
          : "No valid rows to import."
      );
      return;
    }

    setPendingBulkAction(
      modalMode === "bulk_edit"
        ? "edit"
        : "add"
    );

    setShowConfirm(true);
  }

  async function executeBulk() {
    if (!pendingBulkAction) {
      return;
    }

    if (!isAdmin) {
      setError(
        "Only admins can perform bulk operations."
      );
      setShowConfirm(false);
      return;
    }

    setShowConfirm(false);
    setSaving(true);
    setError("");
    setSuccess("");

    const validRows =
      bulkRows.filter(
        (r) => !r.error
      );

    try {
      if (
        pendingBulkAction === "add"
      ) {
        const payload =
          validRows.map((row) => ({
            employee_code:
              row.employee_code,
            barcode:
              row.barcode,
            full_name:
              row.full_name,
            department:
              row.department.trim() ||
              null,
            designation:
              row.designation.trim() ||
              null,
            employment_type:
              row.employment_type,
            gender:
              row.gender || null,
            vendor:
              row.vendor.trim() ||
              null,
            customer_account:
              row.customer_account.trim() ||
              null,
            joining_date:
              row.joining_date ||
              null,
            is_active: true,
          }));

        const {
          error: insertError,
        } = await supabase
          .from("employees")
          .insert(payload);

        if (insertError) {
          if (
            insertError.code ===
            "23505"
          ) {
            setError(
              "One or more Employee IDs or Barcodes already exist."
            );
          } else {
            throw insertError;
          }

          return;
        }

        setSuccess(
          invalidBulkCount > 0
            ? `${validRows.length} employees added. ${invalidBulkCount} skipped.`
            : `${validRows.length} employees added successfully.`
        );
      } else {
        let updated = 0;

        const failMessages: string[] =
          [];

        for (const row of validRows) {
          if (!row._existingId) {
            continue;
          }

          const {
            error: updateError,
          } = await supabase
            .from("employees")
            .update({
              barcode:
                row.barcode,
              full_name:
                row.full_name,
              department:
                row.department.trim() ||
                null,
              designation:
                row.designation.trim() ||
                null,
              employment_type:
                row.employment_type,
              gender:
                row.gender || null,
              vendor:
                row.vendor.trim() ||
                null,
              customer_account:
                row.customer_account.trim() ||
                null,
              joining_date:
                row.joining_date ||
                null,
              updated_at:
                new Date().toISOString(),
            })
            .eq(
              "id",
              row._existingId
            );

          if (updateError) {
            failMessages.push(
              `${row.employee_code}: ${updateError.message}`
            );
          } else {
            updated++;
          }
        }

        if (
          updated === 0 &&
          failMessages.length
        ) {
          setError(
            failMessages
              .slice(0, 3)
              .join("; ")
          );
          return;
        }

        setSuccess(
          failMessages.length
            ? `${updated} updated. ${failMessages.length} failed.`
            : `${updated} employees updated successfully.`
        );
      }

      setShowModal(false);
      setBulkText("");
      setBulkRows([]);
      setForm(EMPTY_FORM);
      setPendingBulkAction(null);

      await loadEmployees();
    } catch (err: any) {
      console.error(
        "Bulk save error:",
        err
      );

      setError(
        err?.message ||
          "Unable to save employees."
      );
    } finally {
      setSaving(false);
    }
  }

  // ------------------------------------------------------------
  // SINGLE SUBMIT
  // ------------------------------------------------------------

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (
      (
        modalMode === "bulk_add" ||
        modalMode === "bulk_edit"
      ) &&
      !editingEmployee
    ) {
      requestBulkSubmit();
      return;
    }

    const employeeCode =
      form.employee_code
        .trim()
        .toUpperCase();

    const barcode =
      form.barcode.trim();

    const fullName =
      form.full_name.trim();

    if (!employeeCode) {
      setError(
        "Please enter Employee ID."
      );
      return;
    }

    if (!barcode) {
      setError(
        "Please enter or scan the barcode."
      );
      return;
    }

    if (!fullName) {
      setError(
        "Please enter employee name."
      );
      return;
    }

    setSaving(true);

    try {
      const payload = {
        employee_code:
          employeeCode,
        barcode,
        full_name:
          fullName,
        department:
          form.department.trim() ||
          null,
        designation:
          form.designation.trim() ||
          null,
        employment_type:
          form.employment_type,
        gender:
          form.gender || null,
        vendor:
          form.vendor.trim() ||
          null,
        customer_account:
          form.customer_account.trim() ||
          null,
        joining_date:
          form.joining_date ||
          null,
      };

      if (editingEmployee) {
        const {
          error: updateError,
        } = await supabase
          .from("employees")
          .update({
            ...payload,
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            editingEmployee.id
          );

        if (updateError) {
          throw updateError;
        }

        setSuccess(
          "Employee updated successfully."
        );
      } else {
        const {
          error: insertError,
        } = await supabase
          .from("employees")
          .insert({
            ...payload,
            is_active: true,
          });

        if (insertError) {
          if (
            insertError.code ===
            "23505"
          ) {
            setError(
              "Employee ID or Barcode already exists."
            );
          } else {
            throw insertError;
          }

          return;
        }

        setSuccess(
          "Employee added successfully."
        );
      }

      setShowModal(false);
      setEditingEmployee(null);
      setForm(EMPTY_FORM);

      await loadEmployees();
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "Unable to save employee."
      );
    } finally {
      setSaving(false);
    }
  }

  // ------------------------------------------------------------
  // ACTIVATE / DEACTIVATE
  // ------------------------------------------------------------

  async function toggleEmployee(
    employee: Employee
  ) {
    setError("");
    setSuccess("");

    const action =
      employee.is_active
        ? "deactivate"
        : "activate";

    if (
      !window.confirm(
        `Are you sure you want to ${action} ${employee.full_name}?`
      )
    ) {
      return;
    }

    const {
      error: updateError,
    } = await supabase
      .from("employees")
      .update({
        is_active:
          !employee.is_active,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        employee.id
      );

    if (updateError) {
      setError(
        updateError.message
      );
      return;
    }

    setSuccess(
      employee.is_active
        ? "Employee deactivated successfully."
        : "Employee activated successfully."
    );

    await loadEmployees();
  }

  // ------------------------------------------------------------
  // UI
  // ------------------------------------------------------------

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-4 md:px-5">
      <div className="mx-auto max-w-[1600px]">

        <MainMenu />

        {/* HEADER */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800">
              Employee Management
            </h1>

            <p className="mt-0.5 text-[11px] text-slate-500">
              Manage skilled, semi-skilled and unskilled employees.
              {!isAdmin && (
                <span className="ml-1 text-amber-600">
                  (Bulk requires admin role)
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">

            <button
              type="button"
              onClick={() =>
                setShowFilters(
                  (value) => !value
                )
              }
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
            >
              {showFilters
                ? "Hide Filters"
                : "Show Filters"}
            </button>

            <button
              type="button"
              onClick={downloadCSV}
              className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              ↓ Download CSV
            </button>

            <button
              type="button"
              onClick={openBulkAdd}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
            >
              Bulk Add
            </button>

            <button
              type="button"
              onClick={openBulkEdit}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
            >
              Bulk Edit
            </button>

            <button
              type="button"
              onClick={openAddModal}
              className="rounded-md bg-slate-800 px-3.5 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-700"
            >
              + Add Employee
            </button>
          </div>
        </div>

        {/* SEARCH + FILTERS */}
        <div className="mb-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

            <div className="relative w-full sm:max-w-sm">
              <input
                type="text"
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="Search employee, ID, barcode..."
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200"
              />

              {search && (
                <button
                  type="button"
                  onClick={() =>
                    setSearch("")
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700"
                >
                  ×
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 text-[11px]">

              <div>
                <span className="text-slate-400">
                  Showing
                </span>{" "}
                <strong className="text-slate-700">
                  {
                    filteredEmployees.length
                  }
                </strong>
                <span className="text-slate-400">
                  {" "}
                  / {employees.length}
                </span>
              </div>

              <div>
                <span className="text-slate-400">
                  Active
                </span>{" "}
                <strong className="text-green-600">
                  {
                    employees.filter(
                      (e) =>
                        e.is_active
                    ).length
                  }
                </strong>
              </div>

              <div>
                <span className="text-slate-400">
                  Inactive
                </span>{" "}
                <strong className="text-red-600">
                  {
                    employees.filter(
                      (e) =>
                        !e.is_active
                    ).length
                  }
                </strong>
              </div>
            </div>
          </div>

          {showFilters && (
            <div className="mt-3 border-t border-slate-100 pt-3">

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">

                {/* Department */}
                <select
                  value={departmentFilter}
                  onChange={(e) =>
                    setDepartmentFilter(
                      e.target.value
                    )
                  }
                  className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[11px] text-slate-700 outline-none"
                >
                  <option value="">
                    All Departments
                  </option>

                  {departments.map(
                    (department) => (
                      <option
                        key={department}
                        value={department || ""}
                      >
                        {department}
                      </option>
                    )
                  )}
                </select>

                {/* Designation */}
                <select
                  value={designationFilter}
                  onChange={(e) =>
                    setDesignationFilter(
                      e.target.value
                    )
                  }
                  className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[11px] text-slate-700 outline-none"
                >
                  <option value="">
                    All Designations
                  </option>

                  {designations.map(
                    (designation) => (
                      <option
                        key={designation}
                        value={designation || ""}
                      >
                        {designation}
                      </option>
                    )
                  )}
                </select>

                {/* Type */}
                <select
                  value={typeFilter}
                  onChange={(e) =>
                    setTypeFilter(
                      e.target.value
                    )
                  }
                  className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[11px] text-slate-700 outline-none"
                >
                  <option value="">
                    All Types
                  </option>
                  <option value="SKILLED">
                    Skilled
                  </option>
                  <option value="SEMI_SKILLED">
                    Semi-Skilled
                  </option>
                  <option value="UNSKILLED">
                    Unskilled
                  </option>
                </select>

                {/* Gender */}
                <select
                  value={genderFilter}
                  onChange={(e) =>
                    setGenderFilter(
                      e.target.value
                    )
                  }
                  className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[11px] text-slate-700 outline-none"
                >
                  <option value="">
                    All Genders
                  </option>
                  <option value="Male">
                    Male
                  </option>
                  <option value="Female">
                    Female
                  </option>
                  <option value="Other">
                    Other
                  </option>
                </select>

                {/* Vendor */}
                <select
                  value={vendorFilter}
                  onChange={(e) =>
                    setVendorFilter(
                      e.target.value
                    )
                  }
                  className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[11px] text-slate-700 outline-none"
                >
                  <option value="">
                    All Vendors
                  </option>

                  {vendors.map(
                    (vendor) => (
                      <option
                        key={vendor}
                        value={vendor || ""}
                      >
                        {vendor}
                      </option>
                    )
                  )}
                </select>

                {/* Customer Account */}
                <select
                  value={customerFilter}
                  onChange={(e) =>
                    setCustomerFilter(
                      e.target.value
                    )
                  }
                  className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[11px] text-slate-700 outline-none"
                >
                  <option value="">
                    All Accounts
                  </option>

                  {customerAccounts.map(
                    (account) => (
                      <option
                        key={account}
                        value={account || ""}
                      >
                        {account}
                      </option>
                    )
                  )}
                </select>

                {/* Status */}
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(
                      e.target.value
                    )
                  }
                  className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[11px] text-slate-700 outline-none"
                >
                  <option value="">
                    All Status
                  </option>
                  <option value="active">
                    Active
                  </option>
                  <option value="inactive">
                    Inactive
                  </option>
                </select>
              </div>

              <div className="mt-2 flex items-center justify-between">

                <div className="text-[10px] text-slate-400">
                  {activeFilterCount > 0
                    ? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} applied`
                    : "No column filters applied"}
                </div>

                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* MESSAGES */}

        {error && !showModal && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
            {success}
          </div>
        )}

        {/* TABLE */}

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">

          <div className="overflow-x-auto">

            <table className="w-full min-w-[1250px] border-collapse text-xs">

              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">

                  {[
                    "Employee",
                    "Barcode",
                    "Gender",
                    "Department",
                    "Designation",
                    "Type",
                    "Vendor",
                    "Customer Account",
                    "Status",
                    "Action",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 ${
                        heading === "Action"
                          ? "text-right"
                          : "text-left"
                      }`}
                    >
                      {heading}
                    </th>
                  ))}

                </tr>
              </thead>

              <tbody>

                {loading ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-10 text-center text-xs text-slate-400"
                    >
                      Loading employees...
                    </td>
                  </tr>
                ) : filteredEmployees.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-10 text-center text-xs text-slate-500"
                    >
                      No employees found.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map(
                    (employee) => (
                      <tr
                        key={employee.id}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80"
                      >

                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-800">
                            {
                              employee.full_name
                            }
                          </div>

                          <div className="mt-0.5 text-[10px] font-medium text-slate-400">
                            {
                              employee.employee_code
                            }
                          </div>
                        </td>

                        <td className="px-3 py-2">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
                            {
                              employee.barcode
                            }
                          </span>
                        </td>

                        <td className="px-3 py-2 text-slate-600">
                          {
                            employee.gender ||
                            "—"
                          }
                        </td>

                        <td className="px-3 py-2 text-slate-600">
                          {
                            employee.department ||
                            "—"
                          }
                        </td>

                        <td className="px-3 py-2 text-slate-600">
                          {
                            employee.designation ||
                            "—"
                          }
                        </td>

                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              employee.employment_type ===
                              "SKILLED"
                                ? "bg-emerald-50 text-emerald-700"
                                : employee.employment_type ===
                                    "SEMI_SKILLED"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {skillLabel(
                              employee.employment_type
                            )}
                          </span>
                        </td>

                        <td className="px-3 py-2 text-slate-600">
                          {
                            employee.vendor ||
                            "—"
                          }
                        </td>

                        <td className="px-3 py-2 text-slate-600">
                          {
                            employee.customer_account ||
                            "—"
                          }
                        </td>

                        <td className="px-3 py-2">
                          {employee.is_active ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                              <span className="h-1 w-1 rounded-full bg-green-500" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                              <span className="h-1 w-1 rounded-full bg-red-500" />
                              Inactive
                            </span>
                          )}
                        </td>

                        <td className="px-3 py-2 text-right">

                          <div className="flex justify-end gap-1.5">

                            <button
                              type="button"
                              onClick={() =>
                                openEditModal(
                                  employee
                                )
                              }
                              className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-100"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                toggleEmployee(
                                  employee
                                )
                              }
                              className={`rounded border px-2 py-1 text-[10px] font-medium ${
                                employee.is_active
                                  ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                                  : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                              }`}
                            >
                              {employee.is_active
                                ? "Deactivate"
                                : "Activate"}
                            </button>

                          </div>

                        </td>
                      </tr>
                    )
                  )
                )}

              </tbody>
            </table>
          </div>
        </div>

        {/* ============================================================
            MODAL
        ============================================================ */}

        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-3">

            <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">

              {/* MODAL HEADER */}

              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">

                <div>
                  <h2 className="text-sm font-semibold text-slate-800">

                    {editingEmployee
                      ? "Edit Employee"
                      : modalMode ===
                          "bulk_edit"
                        ? "Bulk Edit Employees"
                        : modalMode ===
                            "bulk_add"
                          ? "Bulk Add Employees"
                          : "Add Employee"}

                  </h2>

                  <p className="mt-0.5 text-[10px] text-slate-500">

                    {editingEmployee
                      ? "Update employee information."
                      : modalMode ===
                          "bulk_edit"
                        ? "Paste rows matched by Employee ID."
                        : modalMode ===
                            "bulk_add"
                          ? "Paste Excel rows to create new employees."
                          : "Add a new employee."}

                  </p>
                </div>

                <button
                  type="button"
                  disabled={saving}
                  onClick={closeModal}
                  className="rounded px-2 py-0.5 text-lg text-slate-400 hover:bg-slate-100"
                >
                  ×
                </button>

              </div>

              {/* MODAL TABS */}

              {!editingEmployee && (
                <div className="flex shrink-0 gap-1 border-b border-slate-200 bg-slate-50 px-4 py-1.5">

                  {(
                    [
                      [
                        "single",
                        "Single",
                      ],
                      [
                        "bulk_add",
                        "Bulk Add",
                      ],
                      [
                        "bulk_edit",
                        "Bulk Edit",
                      ],
                    ] as const
                  ).map(
                    ([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() =>
                          switchModalMode(
                            mode
                          )
                        }
                        className={`rounded-md px-3 py-1 text-[11px] font-medium ${
                          modalMode ===
                          mode
                            ? "bg-white text-slate-800 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        {label}
                      </button>
                    )
                  )}

                </div>
              )}

              <form
                onSubmit={handleSubmit}
                className="flex min-h-0 flex-1 flex-col"
              >

                <div className="flex-1 overflow-y-auto p-4">

                  {/* SINGLE */}

                  {(modalMode ===
                    "single" ||
                    editingEmployee) && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

                      {/* Employee ID */}

                      <div>
                        <label className="mb-1 block text-[10px] font-semibold text-slate-600">
                          Employee ID *
                        </label>

                        <input
                          type="text"
                          value={
                            form.employee_code
                          }
                          onChange={(e) =>
                            updateForm(
                              "employee_code",
                              e.target.value
                            )
                          }
                          placeholder="EMP001"
                          disabled={saving}
                          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-mono uppercase outline-none focus:border-slate-500"
                        />
                      </div>

                      {/* Barcode */}

                      <div>
                        <label className="mb-1 block text-[10px] font-semibold text-slate-600">
                          Barcode *
                        </label>

                        <input
                          type="text"
                          value={
                            form.barcode
                          }
                          onChange={(e) =>
                            updateForm(
                              "barcode",
                              e.target.value
                            )
                          }
                          placeholder="Scan or enter"
                          disabled={saving}
                          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-mono outline-none focus:border-slate-500"
                        />
                      </div>

                      {/* NAME */}

                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-[10px] font-semibold text-slate-600">
                          Full Name *
                        </label>

                        <input
                          type="text"
                          value={
                            form.full_name
                          }
                          onChange={(e) =>
                            updateForm(
                              "full_name",
                              e.target.value
                            )
                          }
                          placeholder="Employee full name"
                          disabled={saving}
                          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-slate-500"
                        />
                      </div>

                      {/* GENDER */}

                      <div>
                        <label className="mb-1 block text-[10px] font-semibold text-slate-600">
                          Gender
                        </label>

                        <select
                          value={
                            form.gender
                          }
                          onChange={(e) =>
                            updateForm(
                              "gender",
                              e.target.value
                            )
                          }
                          disabled={saving}
                          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none"
                        >
                          <option value="">
                            Select Gender
                          </option>
                          <option value="Male">
                            Male
                          </option>
                          <option value="Female">
                            Female
                          </option>
                          <option value="Other">
                            Other
                          </option>
                        </select>
                      </div>

                      {/* SKILL TYPE */}

                      <div>
                        <label className="mb-1 block text-[10px] font-semibold text-slate-600">
                          Skill Type
                        </label>

                        <select
                          value={
                            form.employment_type
                          }
                          onChange={(e) =>
                            updateForm(
                              "employment_type",
                              e.target.value
                            )
                          }
                          disabled={saving}
                          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none"
                        >
                          <option value="SKILLED">
                            Skilled
                          </option>

                          <option value="SEMI_SKILLED">
                            Semi-Skilled
                          </option>

                          <option value="UNSKILLED">
                            Unskilled
                          </option>
                        </select>
                      </div>

                      {/* DEPARTMENT */}

                      <div>
                        <label className="mb-1 block text-[10px] font-semibold text-slate-600">
                          Department
                        </label>

                        <input
                          type="text"
                          value={
                            form.department
                          }
                          onChange={(e) =>
                            updateForm(
                              "department",
                              e.target.value
                            )
                          }
                          placeholder="Outbound"
                          disabled={saving}
                          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs outline-none"
                        />
                      </div>

                      {/* DESIGNATION */}

                      <div>
                        <label className="mb-1 block text-[10px] font-semibold text-slate-600">
                          Designation
                        </label>

                        <input
                          type="text"
                          value={
                            form.designation
                          }
                          onChange={(e) =>
                            updateForm(
                              "designation",
                              e.target.value
                            )
                          }
                          placeholder="Picker"
                          disabled={saving}
                          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs outline-none"
                        />
                      </div>

                      {/* VENDOR DROPDOWN */}

                      <div>
                        <label className="mb-1 block text-[10px] font-semibold text-slate-600">
                          Vendor
                        </label>

                        <select
                          value={
                            form.vendor
                          }
                          onChange={(e) =>
                            updateForm(
                              "vendor",
                              e.target.value
                            )
                          }
                          disabled={saving}
                          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none"
                        >
                          <option value="">
                            Select Vendor
                          </option>

                          {VENDORS.map(
                            (vendor) => (
                              <option
                                key={vendor}
                                value={vendor}
                              >
                                {vendor}
                              </option>
                            )
                          )}
                        </select>
                      </div>

                      {/* CUSTOMER ACCOUNT DROPDOWN */}

                      <div>
                        <label className="mb-1 block text-[10px] font-semibold text-slate-600">
                          Customer Account
                        </label>

                        <select
                          value={
                            form.customer_account
                          }
                          onChange={(e) =>
                            updateForm(
                              "customer_account",
                              e.target.value
                            )
                          }
                          disabled={saving}
                          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none"
                        >
                          <option value="">
                            Select Customer Account
                          </option>

                          {CUSTOMER_ACCOUNTS.map(
                            (account) => (
                              <option
                                key={account}
                                value={account}
                              >
                                {account}
                              </option>
                            )
                          )}
                        </select>
                      </div>

                      {/* JOINING DATE */}

                      <div>
                        <label className="mb-1 block text-[10px] font-semibold text-slate-600">
                          Joining Date
                        </label>

                        <input
                          type="date"
                          value={
                            form.joining_date
                          }
                          onChange={(e) =>
                            updateForm(
                              "joining_date",
                              e.target.value
                            )
                          }
                          disabled={saving}
                          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs outline-none"
                        />
                      </div>

                    </div>
                  )}

                  {/* BULK */}

                  {(modalMode ===
                    "bulk_add" ||
                    modalMode ===
                      "bulk_edit") &&
                    !editingEmployee && (
                      <div className="space-y-3">

                        {!isAdmin && (
                          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            You are not an admin. You can preview data, but only admins can save bulk changes.
                          </div>
                        )}

                        <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5 text-[11px] text-slate-600">

                          <p className="font-semibold text-slate-700">
                            {modalMode ===
                            "bulk_edit"
                              ? "Bulk Edit — match by Employee ID"
                              : "Bulk Add — create new"}
                          </p>

                          <code className="mt-1 block overflow-x-auto rounded bg-white px-2 py-1 font-mono text-[10px] text-slate-800">
                            Emp ID | Barcode | Full Name | Department | Designation | Type | Gender | Vendor | Customer Account | Joining Date
                          </code>

                          <p className="mt-1 text-[10px] text-slate-500">
                            Type: Skilled / Semi-Skilled / Unskilled / Associate.
                            Associate automatically becomes Semi-Skilled.
                          </p>

                        </div>

                        <textarea
                          value={bulkText}
                          onChange={(e) =>
                            handleBulkTextChange(
                              e.target.value
                            )
                          }
                          placeholder={`EMP001\t1234567890\tJohn Doe\tOutbound\tPicker\tSkilled\tMale\tJeevdani\tMADESA\t2026-08-22`}
                          disabled={saving}
                          rows={7}
                          className="w-full rounded-md border border-slate-300 px-2.5 py-2 font-mono text-[11px] outline-none focus:border-slate-500"
                        />

                        {bulkRows.length >
                          0 && (
                          <div>

                            <div className="mb-1.5 flex items-center justify-between">

                              <p className="text-[10px] font-semibold text-slate-600">
                                Preview (
                                {
                                  bulkRows.length
                                }{" "}
                                rows)
                              </p>

                              <div className="flex gap-2 text-[10px]">

                                <span className="text-green-600">
                                  {
                                    validBulkCount
                                  }{" "}
                                  valid
                                </span>

                                {invalidBulkCount >
                                  0 && (
                                  <span className="text-red-600">
                                    {
                                      invalidBulkCount
                                    }{" "}
                                    invalid
                                  </span>
                                )}

                              </div>

                            </div>

                            <div className="max-h-48 overflow-auto rounded-md border border-slate-200">

                              <table className="w-full min-w-[800px] border-collapse text-left text-[10px]">

                                <thead className="sticky top-0 bg-slate-100">
                                  <tr>
                                    {[
                                      "#",
                                      "Emp ID",
                                      "Name",
                                      "Type",
                                      "Vendor",
                                      "Account",
                                      "Status",
                                    ].map(
                                      (
                                        heading
                                      ) => (
                                        <th
                                          key={
                                            heading
                                          }
                                          className="px-1.5 py-1 font-semibold text-slate-500"
                                        >
                                          {
                                            heading
                                          }
                                        </th>
                                      )
                                    )}
                                  </tr>
                                </thead>

                                <tbody>

                                  {bulkRows.map(
                                    (
                                      row,
                                      index
                                    ) => (
                                      <tr
                                        key={
                                          index
                                        }
                                        className={
                                          row.error
                                            ? "bg-red-50"
                                            : "hover:bg-slate-50"
                                        }
                                      >

                                        <td className="px-1.5 py-1 text-slate-400">
                                          {index +
                                            1}
                                        </td>

                                        <td className="px-1.5 py-1 font-medium">
                                          {
                                            row.employee_code
                                          }
                                        </td>

                                        <td className="px-1.5 py-1">
                                          {
                                            row.full_name
                                          }
                                        </td>

                                        <td className="px-1.5 py-1">
                                          {skillLabel(
                                            row.employment_type
                                          )}
                                        </td>

                                        <td className="px-1.5 py-1">
                                          {
                                            row.vendor ||
                                            "—"
                                          }
                                        </td>

                                        <td className="px-1.5 py-1">
                                          {
                                            row.customer_account ||
                                            "—"
                                          }
                                        </td>

                                        <td className="px-1.5 py-1">

                                          {row.error ? (
                                            <span className="text-red-600">
                                              {
                                                row.error
                                              }
                                            </span>
                                          ) : (
                                            <span className="text-green-600">
                                              OK
                                            </span>
                                          )}

                                        </td>

                                      </tr>
                                    )
                                  )}

                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                      </div>
                    )}

                  {error && (
                    <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] text-red-700">
                      {error}
                    </div>
                  )}

                </div>

                {/* FOOTER */}

                <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2.5">

                  <button
                    type="button"
                    disabled={saving}
                    onClick={closeModal}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      saving ||
                      (
                        (
                          modalMode ===
                            "bulk_add" ||
                          modalMode ===
                            "bulk_edit"
                        ) &&
                        !editingEmployee &&
                        validBulkCount ===
                          0
                      )
                    }
                    className="rounded-md bg-slate-800 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving
                      ? "Saving..."
                      : editingEmployee
                        ? "Update Employee"
                        : modalMode ===
                            "bulk_edit"
                          ? `Update ${
                              validBulkCount ||
                              ""
                            } Employee${
                              validBulkCount ===
                              1
                                ? ""
                                : "s"
                            }`
                          : modalMode ===
                              "bulk_add"
                            ? `Save ${
                                validBulkCount ||
                                ""
                              } Employee${
                                validBulkCount ===
                                1
                                  ? ""
                                  : "s"
                              }`
                            : "Save Employee"}
                  </button>

                </div>

              </form>
            </div>
          </div>
        )}

        {/* CONFIRM */}

        {showConfirm &&
          pendingBulkAction && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 p-4">

              <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl">

                <h3 className="text-sm font-semibold text-slate-800">
                  Confirm bulk{" "}
                  {
                    pendingBulkAction ===
                    "edit"
                      ? "update"
                      : "add"
                  }
                </h3>

                <p className="mt-2 text-xs text-slate-600">
                  You are about to{" "}
                  <strong>
                    {
                      pendingBulkAction ===
                      "edit"
                        ? "update"
                        : "create"
                    }{" "}
                    {validBulkCount} employee
                    {validBulkCount ===
                    1
                      ? ""
                      : "s"}
                  </strong>
                  .
                </p>

                <div className="mt-4 flex justify-end gap-2">

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setShowConfirm(
                        false
                      );
                      setPendingBulkAction(
                        null
                      );
                    }}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={
                      executeBulk
                    }
                    className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    {saving
                      ? "Processing..."
                      : pendingBulkAction ===
                          "edit"
                        ? "Yes, update"
                        : "Yes, create"}
                  </button>

                </div>
              </div>
            </div>
          )}

      </div>
    </main>
  );
}
