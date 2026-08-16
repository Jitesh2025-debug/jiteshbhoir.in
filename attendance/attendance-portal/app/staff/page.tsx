"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

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

type NewUserForm = {
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

export default function StaffPage() {
  const supabase = createClient();

  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [newUser, setNewUser] = useState<NewUserForm>({
    username: "",
    full_name: "",
    role: "operator",
    can_dashboard: true,
    can_attendance: false,
    can_employees: false,
    can_roster: false,
    can_reports: false,
    can_settings: false,
    can_staff: false,
  });

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

  async function createNewUser() {
  if (
    !newUser.username ||
    !newUser.full_name
  ) {
    alert("Please fill in all required fields");
    return;
  }

  setCreating(true);
  setError("");

  try {
    const password = generatePassword();

    const email =
      `${newUser.username.trim().toLowerCase()}@attendance.local`;

    setGeneratedPassword(password);

    console.log("Creating user with data:", {
      username: newUser.username,
      full_name: newUser.full_name,
      email,
      password: "***",
    });

      // Call API endpoint to create user
      const response = await fetch(
        "/api/admin/create-user",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
          username: newUser.username,
          full_name: newUser.full_name,
          email,
          password,
          role: newUser.role,
          permissions: {
              can_dashboard: newUser.can_dashboard,
              can_attendance: newUser.can_attendance,
              can_employees: newUser.can_employees,
              can_roster: newUser.can_roster,
              can_reports: newUser.can_reports,
              can_settings: newUser.can_settings,
              can_staff: newUser.can_staff,
            },
          }),
        }
      );

      const data = await response.json();

      console.log("API response:", {
        status: response.status,
        data,
      });

      if (!response.ok) {
        console.error("API error:", data);
        throw new Error(
          data.error || `Failed: ${response.status}`
        );
      }

      setError("");

      // Wait a moment then refresh the list
      await new Promise((resolve) =>
        setTimeout(resolve, 2000)
      );

      console.log("Reloading staff list...");

      // Reload staff list
      await loadStaff();

      // Reset form but keep password visible
      setNewUser({
        username: "",
        full_name: "",
        role: "operator",
        can_dashboard: true,
        can_attendance: false,
        can_employees: false,
        can_roster: false,
        can_reports: false,
        can_settings: false,
        can_staff: false,
      });
    } catch (err: any) {
      console.error("User creation error:", err);
      setError(
        err.message ||
          "Failed to create user. Check browser console for details."
      );
      setGeneratedPassword("");
    } finally {
      setCreating(false);
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
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ user_id: userId }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to delete user"
        );
      }

      // Refresh staff list
      await loadStaff();
      setShowDeleteModal(false);
      setDeleteUserId(null);
    } catch (err: any) {
      setError(
        err.message ||
          "Failed to delete user. Please try again."
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

      const { data: currentUser, error: permError } =
        await supabase
          .from("staff_profiles")
          .select("role")
          .eq("id", user.id)
          .single();

      if (permError) {
        console.error("Permission check error:", permError);
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

      const { data, error } = await supabase
        .from("staff_profiles")
        .select("*")
        .order("full_name");

      if (error) {
        console.error("Staff fetch error:", error);
        setError(
          `Error loading staff: ${error.message}`
        );
        setLoading(false);
        return;
      }

      console.log("Loaded staff:", data);
      setStaff(data || []);
      setLoading(false);
    } catch (err: any) {
      console.error("Unexpected error:", err);
      setError(
        `Unexpected error: ${err.message}`
      );
      setLoading(false);
    }
  }

  async function updatePermission(
    id: string,
    field: keyof Staff,
    value: boolean
  ) {
    const { error } = await supabase
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

  async function updateStatus(id: string, value: boolean) {
    const { error } = await supabase
      .from("staff_profiles")
      .update({
        is_active: value,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    loadStaff();
  }

  useEffect(() => {
    loadStaff();
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        Loading...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Staff Management
        </h1>

        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowCreateModal(true);
              setGeneratedPassword("");
            }}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            + Create New User
          </button>

          <a
            href="/dashboard"
            className="rounded border px-4 py-2 text-sm"
          >
            Dashboard
          </a>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Username</th>
              <th className="p-3 text-center">Dashboard</th>
              <th className="p-3 text-center">
                Attendance
              </th>
              <th className="p-3 text-center">
                Employees
              </th>
              <th className="p-3 text-center">Roster</th>
              <th className="p-3 text-center">Reports</th>
              <th className="p-3 text-center">
                Settings
              </th>
              <th className="p-3 text-center">Staff</th>
              <th className="p-3 text-center">Active</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>

          <tbody>
            {staff.map((person) => (
              <tr
                key={person.id}
                className="border-t"
              >
                <td className="p-3">{person.full_name}</td>

                <td className="p-3">{person.username}</td>

                <td className="p-3 text-center">
                  <input
                    type="checkbox"
                    checked={person.can_dashboard}
                    onChange={(e) =>
                      updatePermission(
                        person.id,
                        "can_dashboard",
                        e.target.checked
                      )
                    }
                  />
                </td>

                <td className="p-3 text-center">
                  <input
                    type="checkbox"
                    checked={person.can_attendance}
                    onChange={(e) =>
                      updatePermission(
                        person.id,
                        "can_attendance",
                        e.target.checked
                      )
                    }
                  />
                </td>

                <td className="p-3 text-center">
                  <input
                    type="checkbox"
                    checked={person.can_employees}
                    onChange={(e) =>
                      updatePermission(
                        person.id,
                        "can_employees",
                        e.target.checked
                      )
                    }
                  />
                </td>

                <td className="p-3 text-center">
                  <input
                    type="checkbox"
                    checked={person.can_roster}
                    onChange={(e) =>
                      updatePermission(
                        person.id,
                        "can_roster",
                        e.target.checked
                      )
                    }
                  />
                </td>

                <td className="p-3 text-center">
                  <input
                    type="checkbox"
                    checked={person.can_reports}
                    onChange={(e) =>
                      updatePermission(
                        person.id,
                        "can_reports",
                        e.target.checked
                      )
                    }
                  />
                </td>

                <td className="p-3 text-center">
                  <input
                    type="checkbox"
                    checked={person.can_settings}
                    onChange={(e) =>
                      updatePermission(
                        person.id,
                        "can_settings",
                        e.target.checked
                      )
                    }
                  />
                </td>

                <td className="p-3 text-center">
                  <input
                    type="checkbox"
                    checked={person.can_staff}
                    onChange={(e) =>
                      updatePermission(
                        person.id,
                        "can_staff",
                        e.target.checked
                      )
                    }
                  />
                </td>

                <td className="p-3 text-center">
                  <button
                    onClick={() =>
                      updateStatus(
                        person.id,
                        !person.is_active
                      )
                    }
                    className={`rounded px-3 py-1 text-xs ${
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
                  <button
                    onClick={() => {
                      setDeleteUserId(person.id);
                      setShowDeleteModal(true);
                    }}
                    className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="w-full max-w-2xl bg-white rounded-lg shadow-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">
                Create New User
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setGeneratedPassword("");
                }}
                className="text-2xl"
              >
                ×
              </button>
            </div>

            {generatedPassword && (
              <div className="mb-4 rounded-lg border-2 border-green-300 bg-green-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm font-bold text-green-700">
                    ✓ User Created Successfully!
                  </span>
                </div>
                <div className="text-sm text-green-700">
                  <p className="mb-2">
                    <strong>Username:</strong>{" "}
                    {newUser.username}
                  </p>
                  <p className="mb-2">
                    <strong>Temporary Password:</strong>
                  </p>
                  <div className="mb-3 rounded bg-white p-2 font-mono text-sm break-all border-2 border-green-200">
                    {generatedPassword}
                  </div>
                  <p className="text-xs mb-3 bg-yellow-50 border border-yellow-200 rounded p-2">
                    ⚠️ <strong>Important:</strong> Share
                    this password securely with the user
                    (NOT via email). They must change it
                    on their first login.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          generatedPassword
                        );
                        alert(
                          "Password copied to clipboard!"
                        );
                      }}
                      className="rounded bg-green-600 px-3 py-1 text-white text-xs hover:bg-green-700"
                    >
                      Copy Password
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!generatedPassword && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createNewUser();
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={newUser.full_name}
                      onChange={(e) =>
                        setNewUser({
                          ...newUser,
                          full_name: e.target.value,
                        })
                      }
                      className="w-full rounded border px-3 py-2 text-sm"
                      placeholder="John Doe"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Username *
                    </label>
                    <input
                      type="text"
                      value={newUser.username}
                      onChange={(e) =>
                        setNewUser({
                          ...newUser,
                          username: e.target.value.toLowerCase(),
                        })
                      }
                      className="w-full rounded border px-3 py-2 text-sm"
                      placeholder="john.doe"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Role
                    </label>
                    <select
                      value={newUser.role}
                      onChange={(e) =>
                        setNewUser({
                          ...newUser,
                          role: e.target.value,
                        })
                      }
                      className="w-full rounded border px-3 py-2 text-sm"
                    >
                      <option value="admin">Admin</option>
                      <option value="manager">
                        Manager
                      </option>
                      <option value="operator">
                        Operator
                      </option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-3">
                    Page Permissions
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
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
                    ].map((perm) => (
                      <label
                        key={perm.key}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="checkbox"
                          checked={
                            newUser[
                              perm.key as keyof NewUserForm
                            ] as boolean
                          }
                          onChange={(e) =>
                            setNewUser({
                              ...newUser,
                              [perm.key]:
                                e.target.checked,
                            })
                          }
                          className="rounded"
                        />
                        <span className="text-sm">
                          {perm.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setGeneratedPassword("");
                    }}
                    className="rounded border px-4 py-2 text-sm hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:bg-blue-400"
                  >
                    {creating ? "Creating..." : "Create User"}
                  </button>
                </div>
              </form>
            )}

            {generatedPassword && (
              <div className="flex gap-2 justify-end pt-4 border-t mt-4">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setGeneratedPassword("");
                  }}
                  className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deleteUserId && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-bold mb-4 text-red-600">
              Delete User
            </h2>

            <p className="mb-6 text-slate-600">
              Are you sure you want to delete this user?
              This action cannot be undone. The user will
              no longer be able to login.
            </p>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteUserId(null);
                }}
                className="rounded border px-4 py-2 text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteUser(deleteUserId)}
                disabled={deleting}
                className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:bg-red-400"
              >
                {deleting ? "Deleting..." : "Delete User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
