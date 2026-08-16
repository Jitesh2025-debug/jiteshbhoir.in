import { createClient } from "@/lib/supabase";

export async function getUserPermissions(): Promise<string[]> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("staff_permissions")
    .select(`
      permissions (
        permission_key
      )
    `)
    .eq("staff_id", user.id);

  if (error || !data) {
    console.error("Permission loading error:", error);
    return [];
  }

  return data
    .map((item) => {
      const permission = Array.isArray(item.permissions)
        ? item.permissions[0]
        : item.permissions;

      return permission?.permission_key;
    })
    .filter((permission): permission is string => Boolean(permission));
}