"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
<<<<<<< HEAD

=======
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
import MainMenu from "@/components/MainMenu";
import { createClient } from "@/lib/supabase";

type SkillLevel = "SKILLED" | "SEMI_SKILLED" | "UNSKILLED";

<<<<<<< HEAD
type Gender = "Male" | "Female" | "Other";
=======
type Gender = "Male" | "Female" | "Other" | "";
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)

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
<<<<<<< HEAD
  gender: Gender | "";
=======
  gender: Gender;
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
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
<<<<<<< HEAD
  gender: Gender | "";
=======
  gender: Gender;
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
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
<<<<<<< HEAD
];
=======
] as const;
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)

const CUSTOMER_ACCOUNTS = [
  "MADESA",
  "Happy Ecom",
  "Flipkart",
<<<<<<< HEAD
];
=======
] as const;
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)

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

/* -------------------------------------------------------------------------- */
/* NORMALIZATION                                                               */
/* -------------------------------------------------------------------------- */

function normalizeSkillLevel(value: string): SkillLevel {
<<<<<<< HEAD
  const v = value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
=======
  const v = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)

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

<<<<<<< HEAD
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
=======
  // Associate should always be stored as Semi-Skilled
  if (v === "ASSOCIATE" || v === "ASSOC" || v === "A") {
    return "SEMI_SKILLED";
  }

  if (
    v === "UNSKILLED" ||
    v === "UNSKILL" ||
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
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

<<<<<<< HEAD
function normalizeGender(
  value: string
): Gender | "" {
  const v = value.trim().toLowerCase();

  if (v === "male" || v === "m") return "Male";
  if (v === "female" || v === "f") return "Female";
  if (v === "other" || v === "o") return "Other";
=======
function normalizeGender(value: string): Gender {
  const v = value.trim().toLowerCase();

  if (v === "male" || v === "m") {
    return "Male";
  }

  if (v === "female" || v === "f") {
    return "Female";
  }

  if (v === "other" || v === "o") {
    return "Other";
  }
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)

  return "";
}

/**
<<<<<<< HEAD
 * Bulk columns:
=======
 * Converts different user inputs into the exact Vendor value
 * that we want to store in Supabase.
 */
function normalizeVendor(value: string): string {
  const v = value.trim().toLowerCase();

  if (v === "jeevdani") return "Jeevdani";
  if (v === "futurz") return "FUTURZ";
  if (v === "macron") return "MACRON";
  if (v === "psn") return "PSN";

  return value.trim();
}

/**
 * Converts different user inputs into the exact Customer Account
 * value that we want to store in Supabase.
 */
function normalizeCustomerAccount(value: string): string {
  const v = value.trim().toLowerCase();

  if (v === "madesa") return "MADESA";

  if (
    v === "happy ecom" ||
    v === "happyecom" ||
    v === "happy-ecom"
  ) {
    return "Happy Ecom";
  }

  if (v === "flipkart") return "Flipkart";

  return value.trim();
}

/* -------------------------------------------------------------------------- */
/* BULK PARSER                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Columns:
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
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
<<<<<<< HEAD
      .map((cell) =>
        cell.trim().replace(/^"|"$/g, "")
      )
  );

  const firstCells = rows[0].map((cell) =>
    cell
      .toLowerCase()
      .replace(/\s+/g, "_")
=======
      .map((cell) => cell.trim().replace(/^"|"$/g, ""))
  );

  const firstCells = rows[0].map((cell) =>
    cell.toLowerCase().replace(/\s+/g, "_")
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
  );

  const looksLikeHeader =
    firstCells.includes("employee_code") ||
    firstCells.includes("employeeid") ||
    firstCells.includes("emp_id") ||
    firstCells.includes("barcode") ||
    firstCells.includes("full_name") ||
    firstCells.includes("name") ||
    firstCells.includes("gender") ||
    firstCells.includes("vendor") ||
    firstCells.includes("customer_account");

  const dataRows = looksLikeHeader
    ? rows.slice(1)
    : rows;

  return dataRows.map((cells) => {
<<<<<<< HEAD
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
=======
    const employee_code = (cells[0] || "").trim().toUpperCase();
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)

    const barcode = (cells[1] || "").trim();

    const full_name = (cells[2] || "").trim();

    const department = (cells[3] || "").trim();

    const designation = (cells[4] || "").trim();

    const employment_type = normalizeSkillLevel(cells[5] || "");

    const gender = normalizeGender(cells[6] || "");

    const vendor = normalizeVendor(cells[7] || "");

    const customer_account = normalizeCustomerAccount(cells[8] || "");

    let joining_date = (cells[9] || "").trim();

    /* Convert DD/MM/YYYY or DD-MM-YYYY to YYYY-MM-DD */
    if (joining_date) {
      const dmy = joining_date.match(
        /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/
      );

      if (dmy) {
<<<<<<< HEAD
        joining_date =
          `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
=======
        joining_date = `${dmy[3]}-${dmy[2].padStart(
          2,
          "0"
        )}-${dmy[1].padStart(2, "0")}`;
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
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

<<<<<<< HEAD
    if (errors.length) {
=======
    if (errors.length > 0) {
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
      row.error = errors.join(", ");
    }

    return row;
  });
}

<<<<<<< HEAD
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
=======
/* -------------------------------------------------------------------------- */
/* PAGE                                                                       */
/* -------------------------------------------------------------------------- */
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)

export default function EmployeesPage() {
  const supabase = createClient();

<<<<<<< HEAD
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
=======
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);

  const [editingEmployee, setEditingEmployee] =
    useState<Employee | null>(null);

  const [form, setForm] = useState<EmployeeForm>(EMPTY_FORM);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const [isAdmin, setIsAdmin] = useState(false);

  const [modalMode, setModalMode] =
    useState<ModalMode>("single");

  const [bulkText, setBulkText] = useState("");

  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);

  const [showConfirm, setShowConfirm] = useState(false);
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)

  const [pendingBulkAction, setPendingBulkAction] =
    useState<"add" | "edit" | null>(null);

<<<<<<< HEAD
  // ------------------------------------------------------------
  // ADMIN CHECK
  // ------------------------------------------------------------
=======
  /* ------------------------------------------------------------------------ */
  /* ADMIN CHECK                                                              */
  /* ------------------------------------------------------------------------ */
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)

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
<<<<<<< HEAD
        [
          "admin",
          "super_admin",
          "superadmin",
        ].includes(metaRole)
=======
        ["admin", "super_admin", "superadmin"].includes(
          metaRole
        )
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
      ) {
        setIsAdmin(true);
        return;
      }

<<<<<<< HEAD
      const { data: profile } =
        await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

      const pRole = String(
        profile?.role || ""
      )
=======
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const profileRole = String(profile?.role || "")
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
        .toLowerCase()
        .replace(/-/g, "_");

      setIsAdmin(
<<<<<<< HEAD
        [
          "admin",
          "super_admin",
          "superadmin",
        ].includes(pRole)
=======
        ["admin", "super_admin", "superadmin"].includes(
          profileRole
        )
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
      );
    } catch {
      setIsAdmin(false);
    }
  }

<<<<<<< HEAD
  // ------------------------------------------------------------
  // LOAD EMPLOYEES
  // ------------------------------------------------------------
=======
  /* ------------------------------------------------------------------------ */
  /* LOAD EMPLOYEES                                                           */
  /* ------------------------------------------------------------------------ */
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)

  async function loadEmployees() {
    setLoading(true);
    setError("");

<<<<<<< HEAD
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
=======
    const { data, error: loadError } = await supabase
      .from("employees")
      .select(
        "id, employee_code, barcode, full_name, department, designation, employment_type, gender, vendor, customer_account, joining_date, is_active, created_at"
      )
      .order("full_name", { ascending: true });
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)

    if (loadError) {
      console.error(loadError);
      setError(loadError.message);
      setLoading(false);
      return;
    }

<<<<<<< HEAD
    setEmployees(
      (data || []) as Employee[]
    );
=======
    setEmployees((data || []) as Employee[]);
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)

    setLoading(false);
  }

  useEffect(() => {
    checkAdmin();
    loadEmployees();
  }, []);

<<<<<<< HEAD
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
=======
  /* ------------------------------------------------------------------------ */
  /* BULK PARSE                                                               */
  /* ------------------------------------------------------------------------ */
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)

  const applyBulkParse = useCallback(
    (
      text: string,
      mode: ModalMode
    ) => {
      if (!text.trim()) {
        setBulkRows([]);
        return;
      }

<<<<<<< HEAD
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
=======
      let parsed = parseBulkText(text);

      if (mode === "bulk_edit") {
        const byCode = new Map(
          employees.map((employee) => [
            employee.employee_code.toUpperCase(),
            employee,
          ])
        );

        parsed = parsed.map((row) => {
          const existing = byCode.get(
            row.employee_code.toUpperCase()
          );
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)

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
<<<<<<< HEAD
            _existingId:
              existing.id,
=======
            _existingId: existing.id,
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
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

<<<<<<< HEAD
    applyBulkParse(
      value,
      modalMode
    );
=======
    applyBulkParse(value, modalMode);
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
  }

  function switchModalMode(
    mode: ModalMode
  ) {
    setModalMode(mode);

    setError("");

    if (bulkText.trim()) {
<<<<<<< HEAD
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
=======
      applyBulkParse(bulkText, mode);
    }
  }

  const validBulkCount = bulkRows.filter(
    (row) => !row.error
  ).length;

  const invalidBulkCount =
    bulkRows.length - validBulkCount;

  /* ------------------------------------------------------------------------ */
  /* MODALS                                                                    */
  /* ------------------------------------------------------------------------ */
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)

  function openAddModal() {
    setEditingEmployee(null);

    setForm({
      ...EMPTY_FORM,
<<<<<<< HEAD
      joining_date:
        new Date()
          .toISOString()
          .slice(0, 10),
=======
      joining_date: new Date()
        .toISOString()
        .slice(0, 10),
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
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
<<<<<<< HEAD
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
=======
      employee_code: employee.employee_code,
      barcode: employee.barcode,
      full_name: employee.full_name,
      department: employee.department || "",
      designation: employee.designation || "",
      employment_type:
        employee.employment_type || "UNSKILLED",
      gender: employee.gender || "",
      vendor: normalizeVendor(employee.vendor || ""),
      customer_account: normalizeCustomerAccount(
        employee.customer_account || ""
      ),
      joining_date: employee.joining_date || "",
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
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

<<<<<<< HEAD
  // ------------------------------------------------------------
  // BULK SUBMIT
  // ------------------------------------------------------------
=======
  /* ------------------------------------------------------------------------ */
  /* BULK SUBMIT                                                              */
  /* ------------------------------------------------------------------------ */
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)

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
<<<<<<< HEAD
      modalMode === "bulk_edit"
        ? "edit"
        : "add"
=======
      modalMode === "bulk_edit" ? "edit" : "add"
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
    );

    setShowConfirm(true);
  }

  async function executeBulk() {
<<<<<<< HEAD
    if (!pendingBulkAction) {
      return;
    }
=======
    if (!pendingBulkAction) return;
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)

    if (!isAdmin) {
      setError(
        "Only admins can perform bulk operations."
      );
<<<<<<< HEAD
=======

>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
      setShowConfirm(false);

      return;
    }

    setShowConfirm(false);

    setSaving(true);

    setError("");

    setSuccess("");

<<<<<<< HEAD
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
=======
    const validRows = bulkRows.filter(
      (row) => !row.error
    );

    try {
      /* -------------------------------------------------------------------- */
      /* BULK ADD                                                             */
      /* -------------------------------------------------------------------- */

      if (pendingBulkAction === "add") {
        const payload = validRows.map((row) => ({
          employee_code: row.employee_code
            .trim()
            .toUpperCase(),

          barcode: row.barcode.trim(),

          full_name: row.full_name.trim(),

          department:
            row.department.trim() || null,

          designation:
            row.designation.trim() || null,

          employment_type:
            normalizeSkillLevel(
              row.employment_type
            ),

          gender: row.gender || null,

          vendor:
            normalizeVendor(row.vendor) || null,

          customer_account:
            normalizeCustomerAccount(
              row.customer_account
            ) || null,

          joining_date:
            row.joining_date || null,

          is_active: true,
        }));

        const { error: insertError } =
          await supabase
            .from("employees")
            .insert(payload);
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)

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
<<<<<<< HEAD
        let updated = 0;

        const failMessages: string[] =
          [];
=======
        /* ------------------------------------------------------------------ */
        /* BULK EDIT                                                          */
        /* ------------------------------------------------------------------ */

        let updated = 0;

        const failMessages: string[] = [];
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)

        for (const row of validRows) {
          if (!row._existingId) {
            continue;
          }

<<<<<<< HEAD
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
=======
          const { error: updateError } =
            await supabase
              .from("employees")
              .update({
                barcode: row.barcode.trim(),

                full_name:
                  row.full_name.trim(),

                department:
                  row.department.trim() ||
                  null,

                designation:
                  row.designation.trim() ||
                  null,

                employment_type:
                  normalizeSkillLevel(
                    row.employment_type
                  ),

                gender: row.gender || null,

                vendor:
                  normalizeVendor(row.vendor) ||
                  null,

                customer_account:
                  normalizeCustomerAccount(
                    row.customer_account
                  ) || null,

                joining_date:
                  row.joining_date || null,

                updated_at:
                  new Date().toISOString(),
              })
              .eq("id", row._existingId);
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)

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
<<<<<<< HEAD
=======

>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
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

<<<<<<< HEAD
  // ------------------------------------------------------------
  // SINGLE SUBMIT
  // ------------------------------------------------------------
=======
  /* ------------------------------------------------------------------------ */
  /* SINGLE SUBMIT                                                            */
  /* ------------------------------------------------------------------------ */
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    setSuccess("");

    if (
<<<<<<< HEAD
      (
        modalMode === "bulk_add" ||
        modalMode === "bulk_edit"
      ) &&
=======
      (modalMode === "bulk_add" ||
        modalMode === "bulk_edit") &&
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
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
<<<<<<< HEAD
      setError(
        "Please enter Employee ID."
      );
=======
      setError("Please enter Employee ID.");

>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
      return;
    }

    if (!barcode) {
      setError(
        "Please enter or scan the barcode."
      );
<<<<<<< HEAD
=======

>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
      return;
    }

    if (!fullName) {
      setError(
        "Please enter employee name."
      );
<<<<<<< HEAD
=======

>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
      return;
    }

    setSaving(true);
<<<<<<< HEAD

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

=======

    try {
      const normalizedEmploymentType =
        normalizeSkillLevel(
          form.employment_type
        );

      const normalizedVendor =
        normalizeVendor(form.vendor);

      const normalizedCustomerAccount =
        normalizeCustomerAccount(
          form.customer_account
        );

      /* -------------------------------------------------------------------- */
      /* EDIT                                                                 */
      /* -------------------------------------------------------------------- */

      if (editingEmployee) {
        const { error: updateError } =
          await supabase
            .from("employees")
            .update({
              employee_code: employeeCode,

              barcode,

              full_name: fullName,

              department:
                form.department.trim() ||
                null,

              designation:
                form.designation.trim() ||
                null,

              employment_type:
                normalizedEmploymentType,

              gender:
                form.gender || null,

              vendor:
                normalizedVendor || null,

              customer_account:
                normalizedCustomerAccount ||
                null,

              joining_date:
                form.joining_date || null,

              updated_at:
                new Date().toISOString(),
            })
            .eq(
              "id",
              editingEmployee.id
            );

>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
        if (updateError) {
          throw updateError;
        }

        setSuccess(
          "Employee updated successfully."
        );
      } else {
<<<<<<< HEAD
        const {
          error: insertError,
        } = await supabase
          .from("employees")
          .insert({
            ...payload,
            is_active: true,
          });
=======
        /* ------------------------------------------------------------------ */
        /* ADD                                                                  */
        /* ------------------------------------------------------------------ */

        const { error: insertError } =
          await supabase
            .from("employees")
            .insert({
              employee_code: employeeCode,

              barcode,

              full_name: fullName,

              department:
                form.department.trim() ||
                null,

              designation:
                form.designation.trim() ||
                null,

              employment_type:
                normalizedEmploymentType,

              gender:
                form.gender || null,

              vendor:
                normalizedVendor || null,

              customer_account:
                normalizedCustomerAccount ||
                null,

              joining_date:
                form.joining_date || null,

              is_active: true,
            });
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)

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

<<<<<<< HEAD
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

=======
  /* ------------------------------------------------------------------------ */
  /* ACTIVATE / DEACTIVATE                                                    */
  /* ------------------------------------------------------------------------ */

  async function toggleEmployee(
    employee: Employee
  ) {
    setError("");

    setSuccess("");

    const action = employee.is_active
      ? "deactivate"
      : "activate";

    if (
      !window.confirm(
        `Are you sure you want to ${action} ${employee.full_name}?`
      )
    ) {
      return;
    }

    const { error: updateError } =
      await supabase
        .from("employees")
        .update({
          is_active:
            !employee.is_active,

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", employee.id);

    if (updateError) {
      setError(updateError.message);

      return;
    }

>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
    setSuccess(
      employee.is_active
        ? "Employee deactivated successfully."
        : "Employee activated successfully."
    );

    await loadEmployees();
  }

<<<<<<< HEAD
  // ------------------------------------------------------------
  // UI
  // ------------------------------------------------------------
=======
  /* ------------------------------------------------------------------------ */
  /* SEARCH                                                                   */
  /* ------------------------------------------------------------------------ */

  const filteredEmployees = useMemo(() => {
    const value =
      search.trim().toLowerCase();

    if (!value) {
      return employees;
    }

    return employees.filter(
      (employee) => {
        return (
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
            .includes(value)
        );
      }
    );
  }, [employees, search]);
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)

  /* ------------------------------------------------------------------------ */
  /* UI                                                                       */
  /* ------------------------------------------------------------------------ */

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
              Manage skilled, semi-skilled and
              unskilled employees.

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
<<<<<<< HEAD
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="Search employee, ID, barcode..."
=======
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search name, ID, barcode, vendor, account..."
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
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

<<<<<<< HEAD
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
=======
            <div className="flex gap-4 text-[11px]">
              <div>
                <span className="text-slate-400">
                  Total
                </span>{" "}
                <strong className="text-slate-700">
                  {employees.length}
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
                </strong>
              </div>

              <div>
                <span className="text-slate-400">
<<<<<<< HEAD
=======
                  Active
                </span>{" "}
                <strong className="text-green-600">
                  {
                    employees.filter(
                      (employee) =>
                        employee.is_active
                    ).length
                  }
                </strong>
              </div>

              <div>
                <span className="text-slate-400">
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
                  Inactive
                </span>{" "}
                <strong className="text-red-600">
                  {
                    employees.filter(
<<<<<<< HEAD
                      (e) =>
                        !e.is_active
=======
                      (employee) =>
                        !employee.is_active
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
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
<<<<<<< HEAD

=======
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
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
<<<<<<< HEAD
                  ].map((heading) => (
                    <th
                      key={heading}
                      className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 ${
                        heading === "Action"
=======
                  ].map((header) => (
                    <th
                      key={header}
                      className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 ${
                        header === "Action"
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
                          ? "text-right"
                          : "text-left"
                      }`}
                    >
<<<<<<< HEAD
                      {heading}
=======
                      {header}
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
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
<<<<<<< HEAD
                      className="px-4 py-10 text-center text-xs text-slate-500"
                    >
                      No employees found.
=======
                      className="px-4 py-10 text-center"
                    >
                      <div className="text-xs font-medium text-slate-500">
                        No employees found.
                      </div>
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map(
                    (employee) => (
                      <tr
                        key={employee.id}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80"
                      >
<<<<<<< HEAD

=======
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
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
<<<<<<< HEAD
                            {
                              employee.barcode
                            }
=======
                            {employee.barcode}
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
                          </span>
                        </td>

                        <td className="px-3 py-2 text-slate-600">
<<<<<<< HEAD
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
=======
                          {employee.gender ||
                            "—"}
                        </td>

                        <td className="px-3 py-2 text-slate-600">
                          {employee.department ||
                            "—"}
                        </td>

                        <td className="px-3 py-2 text-slate-600">
                          {employee.designation ||
                            "—"}
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
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
<<<<<<< HEAD
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
=======
                          {employee.vendor ||
                            "—"}
                        </td>

                        <td className="px-3 py-2 text-slate-600">
                          {employee.customer_account ||
                            "—"}
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
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
<<<<<<< HEAD

                          <div className="flex justify-end gap-1.5">

=======
                          <div className="flex justify-end gap-1.5">
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
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
<<<<<<< HEAD

                          </div>

=======
                          </div>
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
                        </td>
                      </tr>
                    )
                  )
                )}

              </tbody>
            </table>
          </div>
        </div>

<<<<<<< HEAD
        {/* ============================================================
            MODAL
        ============================================================ */}
=======
        {/* ------------------------------------------------------------------ */}
        {/* MODAL                                                              */}
        {/* ------------------------------------------------------------------ */}
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)

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
<<<<<<< HEAD
                        ? "Paste rows matched by Employee ID."
=======
                        ? "Paste rows matched by Employee ID to update existing records."
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
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

<<<<<<< HEAD
              {/* MODAL TABS */}

=======
              {/* TABS */}
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
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
<<<<<<< HEAD
                        className={`rounded-md px-3 py-1 text-[11px] font-medium ${
=======
                        className={`rounded-md px-3 py-1 text-[11px] font-medium transition ${
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
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
<<<<<<< HEAD

=======
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
                </div>
              )}

              <form
                onSubmit={handleSubmit}
                className="flex min-h-0 flex-1 flex-col"
              >

                <div className="flex-1 overflow-y-auto p-4">
<<<<<<< HEAD

                  {/* SINGLE */}
=======
                  {/* -------------------------------------------------------- */}
                  {/* SINGLE FORM                                               */}
                  {/* -------------------------------------------------------- */}
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)

                  {(modalMode ===
                    "single" ||
                    editingEmployee) && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
<<<<<<< HEAD

                      {/* Employee ID */}

=======
                      {/* Employee ID */}
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold text-slate-600">
                          Employee ID *
                        </label>

                        <input
                          type="text"
                          value={
                            form.employee_code
                          }
<<<<<<< HEAD
                          onChange={(e) =>
                            updateForm(
                              "employee_code",
                              e.target.value
=======
                          onChange={(event) =>
                            updateForm(
                              "employee_code",
                              event.target.value
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
                            )
                          }
                          placeholder="EMP001"
                          disabled={saving}
<<<<<<< HEAD
                          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-mono uppercase outline-none focus:border-slate-500"
=======
                          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs uppercase outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200 disabled:bg-slate-100"
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
                        />
                      </div>

                      {/* Barcode */}
<<<<<<< HEAD

=======
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold text-slate-600">
                          Barcode *
                        </label>

                        <input
                          type="text"
<<<<<<< HEAD
                          value={
                            form.barcode
                          }
                          onChange={(e) =>
                            updateForm(
                              "barcode",
                              e.target.value
=======
                          value={form.barcode}
                          onChange={(event) =>
                            updateForm(
                              "barcode",
                              event.target.value
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
                            )
                          }
                          placeholder="Scan or enter"
                          disabled={saving}
<<<<<<< HEAD
                          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-mono outline-none focus:border-slate-500"
                        />
                      </div>

                      {/* NAME */}

=======
                          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200 disabled:bg-slate-100"
                        />
                      </div>

                      {/* Full Name */}
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-[10px] font-semibold text-slate-600">
                          Full Name *
                        </label>

                        <input
                          type="text"
                          value={
                            form.full_name
                          }
<<<<<<< HEAD
                          onChange={(e) =>
                            updateForm(
                              "full_name",
                              e.target.value
=======
                          onChange={(event) =>
                            updateForm(
                              "full_name",
                              event.target.value
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
                            )
                          }
                          placeholder="Employee full name"
                          disabled={saving}
                          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-slate-500"
                        />
                      </div>

<<<<<<< HEAD
                      {/* GENDER */}

=======
                      {/* Gender */}
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold text-slate-600">
                          Gender
                        </label>

                        <select
<<<<<<< HEAD
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
=======
                          value={form.gender}
                          onChange={(event) =>
                            updateForm(
                              "gender",
                              event.target.value
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
                            )
                          }
                          disabled={saving}
                          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none"
                        >
<<<<<<< HEAD
                          <option value="SKILLED">
                            Skilled
                          </option>

                          <option value="SEMI_SKILLED">
                            Semi-Skilled
                          </option>

                          <option value="UNSKILLED">
                            Unskilled
=======
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
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
                          </option>
                        </select>
                      </div>

<<<<<<< HEAD
                      {/* DEPARTMENT */}

=======
                      {/* Skill Type */}
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold text-slate-600">
                          Skill Type
                        </label>

                        <select
                          value={
                            form.employment_type
                          }
                          onChange={(event) =>
                            updateForm(
                              "employment_type",
                              event.target.value
                            )
                          }
                          disabled={saving}
                          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200 disabled:bg-slate-100"
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

                      {/* Department */}
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold text-slate-600">
                          Department
                        </label>

                        <input
                          type="text"
                          value={
                            form.department
                          }
<<<<<<< HEAD
                          onChange={(e) =>
                            updateForm(
                              "department",
                              e.target.value
=======
                          onChange={(event) =>
                            updateForm(
                              "department",
                              event.target.value
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
                            )
                          }
                          placeholder="Outbound"
                          disabled={saving}
<<<<<<< HEAD
                          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs outline-none"
                        />
                      </div>

                      {/* DESIGNATION */}

=======
                          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200 disabled:bg-slate-100"
                        />
                      </div>

                      {/* Designation */}
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold text-slate-600">
                          Designation
                        </label>

                        <input
                          type="text"
                          value={
                            form.designation
                          }
<<<<<<< HEAD
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
=======
                          onChange={(event) =>
                            updateForm(
                              "designation",
                              event.target.value
                            )
                          }
                          placeholder="Picker / Associate / DEO"
                          disabled={saving}
                          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200 disabled:bg-slate-100"
                        />
                      </div>

                      {/* ---------------------------------------------------- */}
                      {/* VENDOR DROPDOWN                                      */}
                      {/* ---------------------------------------------------- */}
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)

                      <div>
                        <label className="mb-1 block text-[10px] font-semibold text-slate-600">
                          Vendor
                        </label>

                        <select
<<<<<<< HEAD
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
=======
                          value={form.vendor}
                          onChange={(event) =>
                            updateForm(
                              "vendor",
                              event.target.value
                            )
                          }
                          disabled={saving}
                          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200 disabled:bg-slate-100"
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
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

<<<<<<< HEAD
                      {/* CUSTOMER ACCOUNT DROPDOWN */}
=======
                      {/* ---------------------------------------------------- */}
                      {/* CUSTOMER ACCOUNT DROPDOWN                           */}
                      {/* ---------------------------------------------------- */}
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)

                      <div>
                        <label className="mb-1 block text-[10px] font-semibold text-slate-600">
                          Customer Account
                        </label>

                        <select
                          value={
                            form.customer_account
                          }
<<<<<<< HEAD
                          onChange={(e) =>
                            updateForm(
                              "customer_account",
                              e.target.value
                            )
                          }
                          disabled={saving}
                          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none"
=======
                          onChange={(event) =>
                            updateForm(
                              "customer_account",
                              event.target.value
                            )
                          }
                          disabled={saving}
                          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200 disabled:bg-slate-100"
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
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

<<<<<<< HEAD
                      {/* JOINING DATE */}

=======
                      {/* Joining Date */}
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold text-slate-600">
                          Joining Date
                        </label>

                        <input
                          type="date"
                          value={
                            form.joining_date
                          }
<<<<<<< HEAD
                          onChange={(e) =>
                            updateForm(
                              "joining_date",
                              e.target.value
=======
                          onChange={(event) =>
                            updateForm(
                              "joining_date",
                              event.target.value
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
                            )
                          }
                          disabled={saving}
                          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs outline-none"
                        />
                      </div>

                    </div>
                  )}

<<<<<<< HEAD
                  {/* BULK */}
=======
                  {/* -------------------------------------------------------- */}
                  {/* BULK ADD / BULK EDIT                                     */}
                  {/* -------------------------------------------------------- */}
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)

                  {(modalMode ===
                    "bulk_add" ||
                    modalMode ===
                      "bulk_edit") &&
                    !editingEmployee && (
                      <div className="space-y-3">

                        {!isAdmin && (
                          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
<<<<<<< HEAD
                            You are not an admin. You can preview data, but only admins can save bulk changes.
=======
                            You are not an admin. You can
                            preview paste data, but only
                            admins can save bulk changes.
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
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
<<<<<<< HEAD
                            Emp ID | Barcode | Full Name | Department | Designation | Type | Gender | Vendor | Customer Account | Joining Date
                          </code>

                          <p className="mt-1 text-[10px] text-slate-500">
                            Type: Skilled / Semi-Skilled / Unskilled / Associate.
                            Associate automatically becomes Semi-Skilled.
                          </p>

=======
                            Emp ID | Barcode | Full
                            Name | Department |
                            Designation | Type | Gender |
                            Vendor | Customer Account |
                            Joining Date
                          </code>

                          <p className="mt-1 text-[10px] text-slate-500">
                            Type: Skilled / Semi-Skilled /
                            Unskilled / Associate.
                            Associate is automatically saved
                            as Semi-Skilled.
                            Gender: Male / Female / Other
                            (or M / F).
                          </p>

                          <p className="mt-1 text-[10px] text-slate-500">
                            Vendor: Jeevdani / FUTURZ /
                            MACRON / PSN.
                          </p>

                          <p className="text-[10px] text-slate-500">
                            Customer Account: MADESA / Happy
                            Ecom / Flipkart.
                          </p>

                          {modalMode ===
                            "bulk_edit" && (
                            <p className="text-[10px] text-slate-500">
                              Unknown Employee IDs are
                              marked invalid.
                            </p>
                          )}
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
                        </div>

                        <textarea
                          value={bulkText}
<<<<<<< HEAD
                          onChange={(e) =>
                            handleBulkTextChange(
                              e.target.value
                            )
                          }
                          placeholder={`EMP001\t1234567890\tJohn Doe\tOutbound\tPicker\tSkilled\tMale\tJeevdani\tMADESA\t2026-08-22`}
=======
                          onChange={(event) =>
                            handleBulkTextChange(
                              event.target.value
                            )
                          }
                          placeholder={`EMP001\t1234567890\tJohn Doe\tOutbound\tPicker\tSkilled\tMale\tJeevdani\tMADESA\t2024-01-15`}
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
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
<<<<<<< HEAD
                                        heading
                                      ) => (
                                        <th
                                          key={
                                            heading
=======
                                        header
                                      ) => (
                                        <th
                                          key={
                                            header
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
                                          }
                                          className="px-1.5 py-1 font-semibold text-slate-500"
                                        >
                                          {
<<<<<<< HEAD
                                            heading
=======
                                            header
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
                                          }
                                        </th>
                                      )
                                    )}
                                  </tr>
                                </thead>

                                <tbody>
<<<<<<< HEAD

=======
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
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
<<<<<<< HEAD

=======
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
                                        <td className="px-1.5 py-1 text-slate-400">
                                          {index +
                                            1}
                                        </td>

                                        <td className="px-1.5 py-1 font-medium">
<<<<<<< HEAD
                                          {
                                            row.employee_code
                                          }
                                        </td>

                                        <td className="px-1.5 py-1">
                                          {
                                            row.full_name
                                          }
=======
                                          {row.employee_code ||
                                            "—"}
                                        </td>

                                        <td className="px-1.5 py-1">
                                          {row.full_name ||
                                            "—"}
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
                                        </td>

                                        <td className="px-1.5 py-1">
                                          {skillLabel(
                                            row.employment_type
                                          )}
                                        </td>

                                        <td className="px-1.5 py-1">
<<<<<<< HEAD
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

=======
                                          {row.vendor ||
                                            "—"}
                                        </td>

                                        <td className="px-1.5 py-1">
                                          {row.customer_account ||
                                            "—"}
                                        </td>

                                        <td className="px-1.5 py-1">
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
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
<<<<<<< HEAD

                                        </td>

                                      </tr>
                                    )
                                  )}

=======
                                        </td>
                                      </tr>
                                    )
                                  )}
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                      </div>
                    )}

                  {/* ERROR */}
                  {error && (
                    <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] text-red-700">
                      {error}
                    </div>
                  )}

                </div>

                {/* FOOTER */}
<<<<<<< HEAD

=======
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
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
<<<<<<< HEAD
                      (
                        (
                          modalMode ===
                            "bulk_add" ||
                          modalMode ===
                            "bulk_edit"
                        ) &&
=======
                      ((modalMode ===
                        "bulk_add" ||
                        modalMode ===
                          "bulk_edit") &&
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
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

<<<<<<< HEAD
        {/* CONFIRM */}
=======
        {/* ------------------------------------------------------------------ */}
        {/* CONFIRM BULK                                                       */}
        {/* ------------------------------------------------------------------ */}
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)

        {showConfirm &&
          pendingBulkAction && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 p-4">
<<<<<<< HEAD

              <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl">

                <h3 className="text-sm font-semibold text-slate-800">
                  Confirm bulk{" "}
                  {
                    pendingBulkAction ===
                    "edit"
                      ? "update"
                      : "add"
                  }
=======
              <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl">
                <h3 className="text-sm font-semibold text-slate-800">
                  Confirm bulk{" "}
                  {pendingBulkAction ===
                  "edit"
                    ? "update"
                    : "add"}
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
                </h3>

                <p className="mt-2 text-xs text-slate-600">
                  You are about to{" "}
                  <strong>
<<<<<<< HEAD
                    {
                      pendingBulkAction ===
                      "edit"
                        ? "update"
                        : "create"
                    }{" "}
=======
                    {pendingBulkAction ===
                    "edit"
                      ? "update"
                      : "create"}{" "}
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
                    {validBulkCount} employee
                    {validBulkCount ===
                    1
                      ? ""
                      : "s"}
                  </strong>
<<<<<<< HEAD
=======

                  {invalidBulkCount >
                    0 && (
                    <>
                      {" "}
                      (
                      {
                        invalidBulkCount
                      }{" "}
                      invalid row
                      {invalidBulkCount ===
                      1
                        ? ""
                        : "s"}{" "}
                      skipped)
                    </>
                  )}
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
                  .
                </p>

                <div className="mt-4 flex justify-end gap-2">
<<<<<<< HEAD

=======
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setShowConfirm(
                        false
                      );
<<<<<<< HEAD
=======

>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
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
<<<<<<< HEAD

=======
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
                </div>
              </div>
            </div>
          )}
<<<<<<< HEAD

=======
>>>>>>> 57b7790 (Update dashboard, employees, reports and roster UI)
      </div>
    </main>
  );
}
