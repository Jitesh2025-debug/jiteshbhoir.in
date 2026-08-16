import { createClient } from "@/lib/supabase";

export type Permission =
  | "can_dashboard"
  | "can_attendance"
  | "can_employees"
  | "can_roster"
  | "can_reports"
  | "can_settings"
  | "can_staff";

type StaffProfile = {
  id: string;
  username: string;
  role: string;
  is_active: boolean;
  can_dashboard: boolean;
  can_attendance: boolean;
  can_employees: boolean;
  can_roster: boolean;
  can_reports: boolean;
  can_settings: boolean;
  can_staff: boolean;
};

export async function getStaffProfile(): Promise<StaffProfile | null> {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data, error } = await supabase
    .from("staff_profiles")
    .select(`
      id,
      username,
      role,
      is_active,
      can_dashboard,
      can_attendance,
      can_employees,
      can_roster,
      can_reports,
      can_settings,
      can_staff
    `)
    .eq("id", user.id)
    .single();

  if (error || !data) {
    console.error("Staff profile loading error:", error);
    return null;
  }

  return data as StaffProfile;
}

export async function hasPermission(
  permission: Permission
): Promise<boolean> {
  const profile = await getStaffProfile();

  if (!profile || !profile.is_active) {
    return false;
  }

  return profile[permission] === true;
}

export async function getUserPermissions(): Promise<Permission[]> {
  const profile = await getStaffProfile();

  if (!profile || !profile.is_active) {
    return [];
  }

  const permissions: Permission[] = [
    "can_dashboard",
    "can_attendance",
    "can_employees",
    "can_roster",
    "can_reports",
    "can_settings",
    "can_staff",
  ];

  return permissions.filter((permission) => profile[permission] === true);
}
