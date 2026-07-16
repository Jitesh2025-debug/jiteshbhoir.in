"use server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function loginAction(
  username: string,
  password: string
) {
  const supabase = await createSupabaseServerClient();

  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("email")
      .eq("username", username.toLowerCase())
      .single();

  if (profileError || !profile) {
    return {
      error: "Invalid username or password",
    };
  }

  const { error } =
    await supabase.auth.signInWithPassword({
      email: profile.email,
      password,
    });

  if (error) {
    return {
      error: "Invalid username or password",
    };
  }

  redirect("/dashboard");
}