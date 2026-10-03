import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/auth/server";
import { runtimeConfig } from "@/lib/config";

async function proxy(request: NextRequest, path: string[]) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    return NextResponse.json(
      { detail: "Authentication required" },
      { status: 401 },
    );
  }
  const upstream = await fetch(
    `${runtimeConfig().apiBaseUrl}/v1/${path.join("/")}${request.nextUrl.search}`,
    {
      method: request.method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type":
          request.headers.get("content-type") ?? "application/json",
      },
      body: request.method === "GET" ? undefined : await request.text(),
      cache: "no-store",
    },
  );
  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") ?? "application/json",
    },
  });
}

type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: Context) {
  return proxy(request, (await context.params).path);
}

export async function POST(request: NextRequest, context: Context) {
  return proxy(request, (await context.params).path);
}
