import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
   const {
  username,
  full_name,
  password,
  role,
  permissions,
} = await req.json();

const email =
  `${username.trim().toLowerCase()}@attendance.local`;

    // Validate inputs
    if (!username || !full_name || !password) {
  return NextResponse.json(
    { error: "Missing required fields" },
    { status: 400 }
  );
}

    // Create admin client with service role
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    console.log("Creating user:", { username, full_name, email });

    // Create auth user
    const { data: authData, error: authError } =
  await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      username,
      full_name,
    },
  });

    if (authError) {
      console.error("Auth error:", authError);
      return NextResponse.json(
        {
          error:
            authError.message ||
            "Failed to create user",
        },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        {
          error: "User creation returned no user",
        },
        { status: 400 }
      );
    }

    console.log("Auth user created:", authData.user.id);

    // Create staff profile
    const { error: profileError } = await supabase
      .from("staff_profiles")
      .insert({
        id: authData.user.id,
        username,
        full_name,
        role: role || "operator",
        first_login: true,
        is_active: true,
        can_dashboard:
          permissions.can_dashboard || false,
        can_attendance:
          permissions.can_attendance || false,
        can_employees:
          permissions.can_employees || false,
        can_roster: permissions.can_roster || false,
        can_reports: permissions.can_reports || false,
        can_settings:
          permissions.can_settings || false,
        can_staff: permissions.can_staff || false,
      });

    if (profileError) {
      console.error("Profile error:", profileError);
      // Delete the user if profile creation fails
      await supabase.auth.admin.deleteUser(
        authData.user.id
      );

      return NextResponse.json(
        {
          error:
            "Failed to create user profile",
        },
        { status: 400 }
      );
    }

    console.log("Staff profile created successfully");

    return NextResponse.json(
      {
        success: true,
        user: authData.user,
        message: "User created successfully. They can now login.",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Create user API error:", error);
    return NextResponse.json(
      {
        error:
          error.message ||
          "Internal server error",
      },
      { status: 500 }
    );
  }
}
