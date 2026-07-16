import { createSupabaseClient } from "@/lib/supabase/client";

const supabase = createSupabaseClient();

export async function login(email: string, password: string) {
  return await supabase.auth.signInWithPassword({
    email,
    password,
  });
}

export async function logout() {
  return await supabase.auth.signOut();
}