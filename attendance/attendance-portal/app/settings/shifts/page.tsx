"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import MainMenu from "@/components/MainMenu";

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

export default function ShiftSetupPage() {
  const supabase = createClient();

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [overnight, setOvernight] = useState(false);
  const [graceMinutes, setGraceMinutes] = useState("15");
  const [isActive, setIsActive] = useState(true);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadShifts() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("shifts")
      .select("*")
      .order("start_time", { ascending: true });

    if (error) {
      console.error(error);
      setError(error.message);
    } else {
      setShifts(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadShifts();
  }, []);

  function resetForm() {
    setEditingId(null);
    setCode("");
    setName("");
    setStartTime("");
    setEndTime("");
    setOvernight(false);
    setGraceMinutes("15");
    setIsActive(true);
    setError("");
  }

  function openAddForm() {
    resetForm();
    setShowForm(true);
  }

  function openEditForm(shift: Shift) {
    setEditingId(shift.id);
    setCode(shift.code);
    setName(shift.name);
    setStartTime(shift.start_time.slice(0, 5));
    setEndTime(shift.end_time.slice(0, 5));
    setOvernight(shift.is_overnight);
    setGraceMinutes(String(shift.grace_minutes));
    setIsActive(shift.is_active);
    setError("");
    setMessage("");
    setShowForm(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setMessage("");

    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();
    const grace = Number(graceMinutes);

    if (!cleanCode || !cleanName || !startTime || !endTime) {
      setError("Please complete all required fields.");
      return;
    }

    if (!Number.isInteger(grace) || grace < 0 || grace > 180) {
      setError("Grace period must be between 0 and 180 minutes.");
      return;
    }

    setSaving(true);

    const shiftData = {
      code: cleanCode,
      name: cleanName,
      start_time: startTime,
      end_time: endTime,
      is_overnight: overnight,
      grace_minutes: grace,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      const { error } = await supabase
        .from("shifts")
        .update(shiftData)
        .eq("id", editingId);

      if (error) {
        console.error(error);
        setError(error.message);
        setSaving(false);
        return;
      }

      setMessage("Shift updated successfully.");
    } else {
      const { error } = await supabase
        .from("shifts")
        .insert(shiftData);

      if (error) {
        console.error(error);
        setError(error.message);
        setSaving(false);
        return;
      }

      setMessage("Shift created successfully.");
    }

    setSaving(false);
    setShowForm(false);
    resetForm();
    await loadShifts();
  }

  async function toggleShift(shift: Shift) {
    setError("");
    setMessage("");

    const { error } = await supabase
      .from("shifts")
      .update({
        is_active: !shift.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", shift.id);

    if (error) {
      console.error(error);
      setError(error.message);
      return;
    }

    setMessage(
      `${shift.name} ${shift.is_active ? "deactivated" : "activated"} successfully.`
    );

    await loadShifts();
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8">
    
      <div className="mx-auto max-w-7xl">
      <MainMenu />
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

          <div>
            <h1 className="text-3xl font-bold text-slate-800">
              Shift Setup
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Configure shifts used for roster and attendance.
            </p>
          </div>

          <button
            type="button"
            onClick={openAddForm}
            className="rounded-lg bg-slate-800 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
          >
            + Add Shift
          </button>

        </div>

        {/* Messages */}
        {message && (
          <div className="mt-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Add/Edit Form */}
        {showForm && (
          <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">

            <div className="flex items-center justify-between">

              <div>
                <h2 className="text-xl font-semibold text-slate-800">
                  {editingId ? "Edit Shift" : "Add Shift"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Define the shift timing and attendance rules.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="text-sm text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>

            </div>

            <form
              onSubmit={handleSubmit}
              className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2"
            >

              {/* Code */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Shift Code *
                </label>

                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Example: N"
                  maxLength={10}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              {/* Name */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Shift Name *
                </label>

                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Example: Night Shift"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              {/* Start */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Start Time *
                </label>

                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              {/* End */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  End Time *
                </label>

                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              {/* Grace */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Grace Period (minutes)
                </label>

                <input
                  type="number"
                  min="0"
                  max="180"
                  value={graceMinutes}
                  onChange={(e) => setGraceMinutes(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              {/* Overnight */}
              <div className="flex items-center gap-3 pt-8">

                <input
                  id="overnight"
                  type="checkbox"
                  checked={overnight}
                  onChange={(e) => setOvernight(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />

                <label
                  htmlFor="overnight"
                  className="text-sm font-medium text-slate-700"
                >
                  Overnight / Night Shift
                </label>

              </div>

              {/* Active */}
              <div className="flex items-center gap-3">

                <input
                  id="active"
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />

                <label
                  htmlFor="active"
                  className="text-sm font-medium text-slate-700"
                >
                  Active Shift
                </label>

              </div>

              {/* Submit */}
              <div className="flex items-end justify-end">

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-slate-800 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : editingId
                    ? "Update Shift"
                    : "Create Shift"}
                </button>

              </div>

            </form>
          </div>
        )}

        {/* Shift List */}
        <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm">

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Loading shifts...
            </div>
          ) : shifts.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No shifts configured.
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full text-left text-sm">

                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Code</th>
                    <th className="px-6 py-4">Shift</th>
                    <th className="px-6 py-4">Start</th>
                    <th className="px-6 py-4">End</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Grace</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">

                  {shifts.map((shift) => (
                    <tr key={shift.id} className="hover:bg-slate-50">

                      <td className="px-6 py-4 font-semibold text-slate-800">
                        {shift.code}
                      </td>

                      <td className="px-6 py-4 text-slate-700">
                        {shift.name}
                      </td>

                      <td className="px-6 py-4 text-slate-600">
                        {shift.start_time.slice(0, 5)}
                      </td>

                      <td className="px-6 py-4 text-slate-600">
                        {shift.end_time.slice(0, 5)}
                      </td>

                      <td className="px-6 py-4">

                        {shift.is_overnight ? (
                          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                            Overnight
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                            Normal
                          </span>
                        )}

                      </td>

                      <td className="px-6 py-4 text-slate-600">
                        {shift.grace_minutes} min
                      </td>

                      <td className="px-6 py-4">

                        {shift.is_active ? (
                          <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                            Active
                          </span>
                        ) : (
                          <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                            Inactive
                          </span>
                        )}

                      </td>

                      <td className="px-6 py-4">

                        <div className="flex justify-end gap-2">

                          <button
                            type="button"
                            onClick={() => openEditForm(shift)}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleShift(shift)}
                            className={`rounded-lg px-3 py-2 text-xs font-medium ${
                              shift.is_active
                                ? "border border-red-200 text-red-600 hover:bg-red-50"
                                : "border border-green-200 text-green-600 hover:bg-green-50"
                            }`}
                          >
                            {shift.is_active ? "Deactivate" : "Activate"}
                          </button>

                        </div>

                      </td>

                    </tr>
                  ))}

                </tbody>

              </table>

            </div>
          )}

        </div>

      </div>
    </main>
  );
}