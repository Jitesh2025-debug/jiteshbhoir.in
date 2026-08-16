import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const checks = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env
      .NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: !!process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env
      .SUPABASE_SERVICE_ROLE_KEY,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  };

  return NextResponse.json(checks);
}
