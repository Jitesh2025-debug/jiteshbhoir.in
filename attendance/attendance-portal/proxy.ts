import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

const routePermissions: Record<string, string> = {
  "/dashboard": "can_dashboard",
  "/attendance": "can_attendance",
  "/employees": "can_employees",
  "/roster": "can_roster",
  "/reports": "can_reports",
  "/settings": "can_settings",
  "/staff": "can_staff",
};

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Find the permission required for this route.
  const requiredPermission = Object.entries(routePermissions).find(
    ([route]) =>
      pathname === route || pathname.startsWith(`${route}/`)
  )?.[1];

  // Routes without permission requirements continue normally.
  if (!requiredPermission) {
    return response;
  }

  // User isn't logged in.
  if (!user) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Get the user's staff profile and permissions.
  const { data: profile, error } = await supabase
    .from("staff_profiles")
    .select(`
      id,
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

  if (error || !profile) {
    console.error("Proxy staff profile error:", error);

    await supabase.auth.signOut();

    return NextResponse.redirect(new URL("/", request.url));
  }

  // Inactive users cannot access protected pages.
  if (!profile.is_active) {
    await supabase.auth.signOut();

    return NextResponse.redirect(new URL("/", request.url));
  }

  // Check the requested page permission.
  const allowed = profile[requiredPermission as keyof typeof profile] === true;

  if (!allowed) {
    return NextResponse.redirect(
      new URL("/dashboard?error=access-denied", request.url)
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/attendance/:path*",
    "/employees/:path*",
    "/roster/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/staff/:path*",
  ],
};
