"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

type PermissionKey =
  | "can_dashboard"
  | "can_attendance"
  | "can_employees"
  | "can_roster"
  | "can_reports"
  | "can_settings"
  | "can_staff";

type Staff = {
  id: string;
  username: string;
  full_name: string;
  role: string;
  first_login: boolean;
  is_active: boolean;

  can_dashboard: boolean;
  can_attendance: boolean;
  can_employees: boolean;
  can_roster: boolean;
  can_reports: boolean;
  can_settings: boolean;
  can_staff: boolean;
};

type UserForm = {
  username: string;
  full_name: string;
  role: string;

  can_dashboard: boolean;
  can_attendance: boolean;
  can_employees: boolean;
  can_roster: boolean;
  can_reports: boolean;
  can_settings: boolean;
  can_staff: boolean;
};

const permissionLabels: {
  key: PermissionKey;
  label: string;
}[] = [
  {
    key: "can_dashboard",
    label: "Dashboard",
  },
  {
    key: "can_attendance",
    label: "Attendance",
  },
  {
    key: "can_employees",
    label: "Employees",
  },
  {
    key: "can_roster",
    label: "Roster",
  },
  {
    key: "can_reports",
    label: "Reports",
  },
  {
    key: "can_settings",
    label: "Settings",
  },
  {
    key: "can_staff",
    label: "Staff Management",
  },
];

function getRolePermissions(role: string): Partial<UserForm> {
  switch (role) {
    case "admin":
      return {
        can_dashboard: true,
        can_attendance: true,
        can_employees: true,
        can_roster: true,
        can_reports: true,
        can_settings: true,
        can_staff: true,
      };

    case "manager":
      return {
        can_dashboard: true,
        can_attendance: true,
        can_employees: true,
        can_roster: true,
        can_reports: true,
        can_settings: false,
        can_staff: false,
      };

    case "operator":
      return {
        can_dashboard: true,
        can_attendance: true,
        can_employees: true,
        can_roster: false,
        can_reports: false,
        can_settings: true,
        can_staff: false,
      };

    case "viewer":
      return {
        can_dashboard: true,
        can_attendance: false,
        can_employees: false,
        can_roster: false,
        can_reports: false,
        can_settings: false,
        can_staff: false,
      };

    default:
      return {
        can_dashboard: true,
        can_attendance: false,
        can_employees: false,
        can_roster: false,
        can_reports: false,
        can_settings: false,
        can_staff: false,
      };
  }
}

function getDefaultUserForm(): UserForm {
  return {
    username: "",
    full_name: "",
    role: "operator",

    can_dashboard: true,
    can_attendance: true,
    can_employees: true,
    can_roster: false,
    can_reports: false,
    can_settings: true,
    can_staff: false,
  };
}

export default function StaffPage() {
  const supabase = createClient();

  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreateModal, setShowCreateModal] =
    useState(false);

  const [showEditModal, setShowEditModal] =
    useState(false);

  const [showDeleteModal, setShowDeleteModal] =
    useState(false);

  const [creating, setCreating] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [generatedPassword, setGeneratedPassword] =
    useState("");

  const [deleteUserId, setDeleteUserId] =
    useState<string | null>(null);

  const [editingUserId, setEditingUserId] =
    useState<string | null>(null);

  const [newUser, setNewUser] =
    useState<UserForm>(getDefaultUserForm());

  const [editUser, setEditUser] =
    useState<UserForm>(getDefaultUserForm());

  function generatePassword(): string {
    const length = 12;

    const charset =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";

    let password = "";

    for (let i = 0; i < length; i++) {
      password += charset.charAt(
        Math.floor(Math.random() * charset.length)
      );
    }

    return password;
  }

  function applyRoleToForm(
    form: UserForm,
    role: string
  ): UserForm {
    return {
      ...form,
      role,
      ...getRolePermissions(role),
    };
  }

  async function createNewUser() {
    if (
      !newUser.username.trim() ||
      !newUser.full_name.trim()
    ) {
      alert("Please fill in all required fields.");
      return;
    }

    setCreating(true);
    setError("");

    try {
      const password = generatePassword();

      const username = newUser.username
        .trim()
        .toLowerCase();

      const email =
        `${username}@attendance.local`;

      setGeneratedPassword(password);

      const response = await fetch(
        "/api/admin/create-user",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username,
            full_name: newUser.full_name.trim(),
            email,
            password,
            role: newUser.role,
            permissions: {
              can_dashboard:
                newUser.can_dashboard,
              can_attendance:
                newUser.can_attendance,
              can_employees:
                newUser.can_employees,
              can_roster:
                newUser.can_roster,
              can_reports:
                newUser.can_reports,
              can_settings:
                newUser.can_settings,
              can_staff:
                newUser.can_staff,
            },
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            `Failed to create user: ${response.status}`
        );
      }

      await loadStaff();

      setNewUser(getDefaultUserForm());
    } catch (err: any) {
      console.error("User creation error:", err);

      setError(
        err?.message ||
          "Failed to create user."
      );

      setGeneratedPassword("");
    } finally {
      setCreating(false);
    }
  }

  function openEditModal(person: Staff) {
    setEditingUserId(person.id);

    setEditUser({
      username: person.username,
      full_name: person.full_name,
      role: person.role,

      can_dashboard: person.can_dashboard,
      can_attendance: person.can_attendance,
      can_employees: person.can_employees,
      can_roster: person.can_roster,
      can_reports: person.can_reports,
      can_settings: person.can_settings,
      can_staff: person.can_staff,
    });

    setError("");
    setShowEditModal(true);
  }

  async function saveEditUser() {
    if (!editingUserId) {
      return;
    }

    if (!editUser.full_name.trim()) {
      alert("Full name is required.");
      return;
    }

    setSavingEdit(true);
    setError("");

    try {
      const { error } = await supabase
        .from("staff_profiles")
        .update({
          full_name: editUser.full_name.trim(),
          role: editUser.role,

          can_dashboard:
            editUser.can_dashboard,

          can_attendance:
            editUser.can_attendance,

          can_employees:
            editUser.can_employees,

          can_roster:
            editUser.can_roster,

          can_reports:
            editUser.can_reports,

          can_settings:
            editUser.can_settings,

          can_staff:
            editUser.can_staff,
        })
        .eq("id", editingUserId);

      if (error) {
        throw new Error(error.message);
      }

      await loadStaff();

      setShowEditModal(false);
      setEditingUserId(null);

      alert("User updated successfully.");
    } catch (err: any) {
      console.error(
        "User update error:",
        err
      );

      setError(
        err?.message ||
          "Failed to update user."
      );
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteUser(userId: string) {
    setDeleting(true);
    setError("");

    try {
      const response = await fetch(
        "/api/admin/delete-user",
        {
          method: "DELETE",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            user_id: userId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to delete user."
        );
      }

      await loadStaff();

      setShowDeleteModal(false);
      setDeleteUserId(null);
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to delete user."
      );
    } finally {
      setDeleting(false);
    }
  }

  async function loadStaff() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/";
        return;
      }

      const {
        data: currentUser,
        error: permError,
      } = await supabase
        .from("staff_profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (permError) {
        console.error(
          "Permission check error:",
          permError
        );

        setError(
          "Unable to check permissions. Please refresh."
        );

        setLoading(false);
        return;
      }

      if (currentUser?.role !== "admin") {
        setError(
          "Only administrators can access this page."
        );

        setLoading(false);
        return;
      }

      const {
        data,
        error,
      } = await supabase
        .from("staff_profiles")
        .select("*")
        .order("full_name");

      if (error) {
        console.error(
          "Staff fetch error:",
          error
        );

        setError(
          `Error loading staff: ${error.message}`
        );

        setLoading(false);
        return;
      }

      setStaff(
        (data || []) as Staff[]
      );

      setLoading(false);
    } catch (err: any) {
      console.error(
        "Unexpected error:",
        err
      );

      setError(
        `Unexpected error: ${
          err?.message || "Unknown error"
        }`
      );

      setLoading(false);
    }
  }

  async function updatePermission(
    id: string,
    field: PermissionKey,
    value: boolean
  ) {
    const { error } =
      await supabase
        .from("staff_profiles")
        .update({
          [field]: value,
        })
        .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    setStaff((prev) =>
      prev.map((person) =>
        person.id === id
          ? {
              ...person,
              [field]: value,
            }
          : person
      )
    );
  }

  async function updateStatus(
    id: string,
    value: boolean
  ) {
    const { error } =
      await supabase
        .from("staff_profiles")
        .update({
          is_active: value,
        })
        .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadStaff();
  }

  useEffect(() => {
    loadStaff();
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-500">
          Loading staff management...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Staff Management
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage users, roles and page access.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              setNewUser(
                getDefaultUserForm()
              );

              setGeneratedPassword("");
              setError("");
              setShowCreateModal(true);
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Create New User
          </button>

          <a
            href="/dashboard"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Dashboard
          </a>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Staff Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1250px] text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-3 text-left">
                Name
              </th>

              <th className="p-3 text-left">
                Username
              </th>

              <th className="p-3 text-center">
                Role
              </th>

              <th className="p-3 text-center">
                Dashboard
              </th>

              <th className="p-3 text-center">
                Attendance
              </th>

              <th className="p-3 text-center">
                Employees
              </th>

              <th className="p-3 text-center">
                Roster
              </th>

              <th className="p-3 text-center">
                Reports
              </th>

              <th className="p-3 text-center">
                Settings
              </th>

              <th className="p-3 text-center">
                Staff
              </th>

              <th className="p-3 text-center">
                Active
              </th>

              <th className="p-3 text-center">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {staff.map((person) => (
              <tr
                key={person.id}
                className="border-t border-slate-200 hover:bg-slate-50"
              >
                <td className="p-3 font-medium text-slate-800">
                  {person.full_name}
                </td>

                <td className="p-3 text-slate-600">
                  {person.username}
                </td>

                <td className="p-3 text-center">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                      person.role === "admin"
                        ? "bg-purple-100 text-purple-700"
                        : person.role === "manager"
                        ? "bg-blue-100 text-blue-700"
                        : person.role === "operator"
                        ? "bg-green-100 text-green-700"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {person.role}
                  </span>
                </td>

                {permissionLabels.map(
                  (permission) => (
                    <td
                      key={permission.key}
                      className="p-3 text-center"
                    >
                      <input
                        type="checkbox"
                        checked={
                          person[
                            permission.key
                          ]
                        }
                        onChange={(e) =>
                          updatePermission(
                            person.id,
                            permission.key,
                            e.target.checked
                          )
                        }
                        className="h-4 w-4 cursor-pointer"
                      />
                    </td>
                  )
                )}

                <td className="p-3 text-center">
                  <button
                    onClick={() =>
                      updateStatus(
                        person.id,
                        !person.is_active
                      )
                    }
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      person.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {person.is_active
                      ? "Active"
                      : "Inactive"}
                  </button>
                </td>

                <td className="p-3 text-center">
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() =>
                        openEditModal(person)
                      }
                      className="rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-200"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => {
                        setDeleteUserId(
                          person.id
                        );

                        setShowDeleteModal(
                          true
                        );
                      }}
                      className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* =========================
          CREATE USER MODAL
         ========================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl max-h-[90vh]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  Create New User
                </h2>

                <p className="text-sm text-slate-500">
                  Create login and assign access.
                </p>
              </div>

              <button
                onClick={() => {
                  setShowCreateModal(
                    false
                  );
                  setGeneratedPassword("");
                }}
                className="text-2xl text-slate-400 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            {generatedPassword ? (
              <>
                <div className="rounded-xl border-2 border-green-300 bg-green-50 p-5">
                  <p className="mb-3 font-bold text-green-700">
                    ✓ User Created Successfully
                  </p>

                  <p className="mb-2 text-sm text-green-700">
                    <strong>
                      Username:
                    </strong>{" "}
                    {newUser.username}
                  </p>

                  <p className="mb-2 text-sm text-green-700">
                    <strong>
                      Temporary Password:
                    </strong>
                  </p>

                  <div className="mb-4 rounded-lg border-2 border-green-200 bg-white p-3 font-mono text-sm break-all">
                    {generatedPassword}
                  </div>

                  <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800">
                    ⚠️ Share this password
                    securely. The user must
                    change it on first login.
                  </div>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        generatedPassword
                      );

                      alert(
                        "Password copied to clipboard!"
                      );
                    }}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                  >
                    Copy Password
                  </button>
                </div>

                <div className="mt-5 flex justify-end">
                  <button
                    onClick={() => {
                      setShowCreateModal(
                        false
                      );
                      setGeneratedPassword(
                        ""
                      );
                    }}
                    className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createNewUser();
                }}
                className="space-y-5"
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Full Name *
                    </label>

                    <input
                      type="text"
                      value={
                        newUser.full_name
                      }
                      onChange={(e) =>
                        setNewUser({
                          ...newUser,
                          full_name:
                            e.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                      placeholder="John Doe"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Username *
                    </label>

                    <input
                      type="text"
                      value={
                        newUser.username
                      }
                      onChange={(e) =>
                        setNewUser({
                          ...newUser,
                          username:
                            e.target.value.toLowerCase(),
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                      placeholder="john.doe"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Role
                  </label>

                  <select
                    value={newUser.role}
                    onChange={(e) =>
                      setNewUser(
                        applyRoleToForm(
                          newUser,
                          e.target.value
                        )
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="admin">
                      Admin
                    </option>

                    <option value="manager">
                      Manager
                    </option>

                    <option value="operator">
                      Operator
                    </option>

                    <option value="viewer">
                      Viewer
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-3 block text-sm font-semibold text-slate-700">
                    Page Permissions
                  </label>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {permissionLabels.map(
                      (permission) => (
                        <label
                          key={
                            permission.key
                          }
                          className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={
                              newUser[
                                permission.key
                              ]
                            }
                            onChange={(e) =>
                              setNewUser({
                                ...newUser,
                                [permission.key]:
                                  e.target.checked,
                              })
                            }
                            className="h-4 w-4"
                          />

                          <span className="text-sm text-slate-700">
                            {permission.label}
                          </span>
                        </label>
                      )
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t pt-5">
                  <button
                    type="button"
                    onClick={() =>
                      setShowCreateModal(
                        false
                      )
                    }
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={creating}
                    className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {creating
                      ? "Creating..."
                      : "Create User"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* =========================
          EDIT USER MODAL
         ========================= */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl max-h-[90vh]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  Edit User
                </h2>

                <p className="text-sm text-slate-500">
                  Change role and control page access.
                </p>
              </div>

              <button
                onClick={() =>
                  setShowEditModal(
                    false
                  )
                }
                className="text-2xl text-slate-400 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <div className="space-y-5">
              {/* Name / Username */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Full Name
                  </label>

                  <input
                    type="text"
                    value={
                      editUser.full_name
                    }
                    onChange={(e) =>
                      setEditUser({
                        ...editUser,
                        full_name:
                          e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Username
                  </label>

                  <input
                    type="text"
                    value={
                      editUser.username
                    }
                    disabled
                    className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500"
                  />

                  <p className="mt-1 text-xs text-slate-400">
                    Username cannot be changed here.
                  </p>
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Role
                </label>

                <select
                  value={editUser.role}
                  onChange={(e) =>
                    setEditUser(
                      applyRoleToForm(
                        editUser,
                        e.target.value
                      )
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="admin">
                    Admin
                  </option>

                  <option value="manager">
                    Manager
                  </option>

                  <option value="operator">
                    Operator
                  </option>

                  <option value="viewer">
                    Viewer
                  </option>
                </select>

                <p className="mt-1 text-xs text-slate-500">
                  Selecting a role applies its default permissions. You can then customize individual permissions.
                </p>
              </div>

              {/* Permissions */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-700">
                    Page Permissions
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      setEditUser({
                        ...editUser,
                        can_dashboard: true,
                        can_attendance: true,
                        can_employees: true,
                        can_roster: true,
                        can_reports: true,
                        can_settings: true,
                        can_staff: true,
                      })
                    }
                    className="text-xs font-medium text-blue-600 hover:text-blue-800"
                  >
                    Grant All
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {permissionLabels.map(
                    (permission) => (
                      <label
                        key={
                          permission.key
                        }
                        className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={
                            editUser[
                              permission.key
                            ]
                          }
                          onChange={(e) =>
                            setEditUser({
                              ...editUser,
                              [permission.key]:
                                e.target.checked,
                            })
                          }
                          className="h-4 w-4"
                        />

                        <span className="text-sm text-slate-700">
                          {permission.label}
                        </span>
                      </label>
                    )
                  )}
                </div>
              </div>

              {/* Permission Summary */}
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Current Access
                </p>

                <div className="flex flex-wrap gap-2">
                  {permissionLabels
                    .filter(
                      (permission) =>
                        editUser[
                          permission.key
                        ]
                    )
                    .map(
                      (permission) => (
                        <span
                          key={
                            permission.key
                          }
                          className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700"
                        >
                          {permission.label}
                        </span>
                      )
                    )}

                  {!permissionLabels.some(
                    (permission) =>
                      editUser[
                        permission.key
                      ]
                  ) && (
                    <span className="text-xs text-red-600">
                      No page access
                    </span>
                  )}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-2 border-t pt-5">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(
                      false
                    );
                    setEditingUserId(
                      null
                    );
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={saveEditUser}
                  disabled={savingEdit}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingEdit
                    ? "Saving..."
                    : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================
          DELETE MODAL
         ========================= */}
      {showDeleteModal &&
        deleteUserId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <h2 className="mb-3 text-lg font-bold text-red-600">
                Delete User
              </h2>

              <p className="mb-6 text-sm leading-6 text-slate-600">
                Are you sure you want to delete this
                user? This action cannot be undone and
                the user will no longer be able to login.
              </p>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowDeleteModal(
                      false
                    );
                    setDeleteUserId(
                      null
                    );
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  onClick={() =>
                    deleteUser(
                      deleteUserId
                    )
                  }
                  disabled={deleting}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting
                    ? "Deleting..."
                    : "Delete User"}
                </button>
              </div>
            </div>
          </div>
        )}
    </main>
  );
}
