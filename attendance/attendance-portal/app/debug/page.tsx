"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";

type SupabaseErrorInfo = {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
};

type CheckResult = {
  ok: boolean;
  count?: number | null;
  error?: SupabaseErrorInfo;
};

type DebugInfo = {
  timestamp?: string;
  environment?: string;
  supabaseUrlConfigured?: boolean;
  publishableKeyConfigured?: boolean;
  currentUser?: {
    id: string;
    email: string | null;
  } | null;
  staffProfile?: CheckResult;
  employees?: CheckResult;
  shifts?: CheckResult;
  rosters?: CheckResult;
  error?: SupabaseErrorInfo;
};

function serializeError(error: unknown): SupabaseErrorInfo {
  if (!error || typeof error !== "object") {
    return { message: String(error || "Unknown error") };
  }

  const value = error as {
    message?: string;
    details?: string;
    hint?: string;
    code?: string;
  };

  return {
    message: value.message || "Unknown Supabase error",
    details: value.details,
    hint: value.hint,
    code: value.code,
  };
}

function resultFrom<T>(
  data: T[] | null,
  error: unknown,
  count?: number | null
): CheckResult {
  return error
    ? { ok: false, error: serializeError(error) }
    : { ok: true, count: count ?? data?.length ?? 0 };
}

export default function DebugPage() {
  const supabase = useMemo(() => createClient(), []);
  const [debug, setDebug] = useState<DebugInfo>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function check() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        const [staffRes, employeesRes, shiftsRes, rostersRes] =
          await Promise.all([
            supabase
              .from("staff_profiles")
              .select("id", { count: "exact", head: true }),
            supabase
              .from("employees")
              .select("id", { count: "exact", head: true }),
            supabase
              .from("shifts")
              .select("id, code, name, start_time, end_time, is_active", {
                count: "exact",
                head: true,
              }),
            supabase
              .from("rosters")
              .select("id", { count: "exact", head: true }),
          ]);

        setDebug({
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV,
          supabaseUrlConfigured: Boolean(
            process.env.NEXT_PUBLIC_SUPABASE_URL
          ),
          publishableKeyConfigured: Boolean(
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
          ),
          currentUser: authError
            ? null
            : user
              ? { id: user.id, email: user.email || null }
              : null,
          staffProfile: resultFrom(null, staffRes.error, staffRes.count),
          employees: resultFrom(null, employeesRes.error, employeesRes.count),
          shifts: resultFrom(null, shiftsRes.error, shiftsRes.count),
          rosters: resultFrom(null, rostersRes.error, rostersRes.count),
          ...(authError
            ? { error: serializeError(authError) }
            : {}),
        });
      } catch (error) {
        setDebug({ error: serializeError(error) });
      } finally {
        setLoading(false);
      }
    }

    check();
  }, [supabase]);

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <h1 className="mb-2 text-2xl font-bold">Supabase Diagnostics</h1>
      <p className="mb-6 text-sm text-slate-600">
        This checks configuration, authentication, table access, and RLS. No
        secret keys are displayed.
      </p>

      <div className="bg-white p-6 rounded-lg shadow">
        {loading ? (
          <p>Checking Supabase…</p>
        ) : (
          <pre className="whitespace-pre-wrap overflow-auto text-sm">
            {JSON.stringify(debug, null, 2)}
          </pre>
        )}
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 p-4 rounded-lg">
        <p className="text-sm">
          <strong>How to read the result:</strong>
        </p>
        <ul className="text-sm mt-2 list-disc list-inside">
          <li>
            Error code <code>42501</code> means an RLS permission problem.
          </li>
          <li>
            Error code <code>42P01</code> means the table does not exist.
          </li>
          <li>
            An empty table count with no error means access works but no rows
            are visible to this user.
          </li>
          <li>
            The <code>shifts</code> and <code>rosters</code> results directly
            diagnose the roster problem.
          </li>
        </ul>
      </div>
    </main>
  );
}
