import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json();

  const username = body.username;
  const password = body.password;

  const supabase = await createSupabaseServerClient();

  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("email")
      .eq("username", username.toLowerCase())
      .single();

  if (profileError || !profile) {
    return NextResponse.json(
      {
        error: "Invalid username or password",
      },
      { status: 401 }
    );
  }

  const { error } =
    await supabase.auth.signInWithPassword({
      email: profile.email,
      password,
    });

  if (error) {
    return NextResponse.json(
      {
        error: "Invalid username or password",
      },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
  });
}