import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/auth/server";

function reject(reason: string, status: number) {
  return NextResponse.json(
    { status: "failed", boundary: "supabase_auth", reason },
    { status },
  );
}

export async function POST(request: NextRequest) {
  if (process.env.ENABLE_SMOKE_ENDPOINTS !== "true") {
    return reject("disabled", 404);
  }

  const expectedToken = process.env.SMOKE_TEST_TOKEN;
  if (
    !expectedToken ||
    request.headers.get("authorization") !== `Bearer ${expectedToken}`
  ) {
    return reject("unauthorized", 401);
  }

  const email = process.env.SMOKE_AUTH_EMAIL;
  const password = process.env.SMOKE_AUTH_PASSWORD;
  if (!email || !password) {
    return reject("missing_configuration", 503);
  }

  const supabase = await createSupabaseServerClient();
  let signIn = await supabase.auth.signInWithPassword({ email, password });

  if (signIn.error) {
    const signUp = await supabase.auth.signUp({ email, password });
    if (signUp.error) {
      return reject("authentication_failed", 503);
    }
    signIn = await supabase.auth.signInWithPassword({ email, password });
  }

  if (signIn.error) {
    return reject("session_not_established", 503);
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return reject("session_not_verified", 503);
  }

  return NextResponse.json({
    status: "authenticated",
    boundary: "supabase_auth",
  });
}
