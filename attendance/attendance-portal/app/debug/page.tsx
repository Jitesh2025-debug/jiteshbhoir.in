"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

export default function DebugPage() {
  const supabase = createClient();
  const [debug, setDebug] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function check() {
      try {
        // Check current user
        const {
          data: { user },
        } = await supabase.auth.getUser();

        // Try to fetch staff
        const { data: staff, error: staffError } =
          await supabase
            .from("staff_profiles")
            .select("*");

        // Check if can insert
        const { data: testInsert, error: insertError } =
          await supabase
            .from("staff_profiles")
            .select("count", { count: "exact" });

        setDebug({
          currentUser: user?.email || "Not logged in",
          staffCount: testInsert?.length || 0,
          staffData: staff || [],
          staffError: staffError?.message || "No error",
          insertError: insertError?.message || "No error",
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        setDebug({ error: err.message });
      } finally {
        setLoading(false);
      }
    }

    check();
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <h1 className="text-2xl font-bold mb-6">Debug Info</h1>

      <div className="bg-white p-6 rounded-lg shadow">
        <pre className="whitespace-pre-wrap overflow-auto">
          {JSON.stringify(debug, null, 2)}
        </pre>
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 p-4 rounded-lg">
        <p className="text-sm">
          <strong>Possible Issues:</strong>
        </p>
        <ul className="text-sm mt-2 list-disc list-inside">
          <li>
            If staffError shows permission error - check
            RLS policies
          </li>
          <li>
            If staffCount is 0 - data might not be
            creating
          </li>
          <li>
            Check browser console for API errors (F12)
          </li>
          <li>
            Check Supabase dashboard Auth users table
          </li>
        </ul>
      </div>
    </main>
  );
}
