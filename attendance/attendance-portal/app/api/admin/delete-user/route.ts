import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(req: NextRequest) {
  try {
    const { user_id } = await req.json();

    if (!user_id) {
      return NextResponse.json(
        { error: "User ID required" },
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

    // Delete from staff_profiles first
    await supabase
      .from("staff_profiles")
      .delete()
      .eq("id", user_id);

    // Delete auth user
    const { error: deleteError } =
      await supabase.auth.admin.deleteUser(user_id);

    if (deleteError) {
      console.error("Delete error:", deleteError);
      return NextResponse.json(
        {
          error:
            deleteError.message ||
            "Failed to delete user",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: true },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Delete user API error:", error);
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
