import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/auth/server";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    return NextResponse.json(
      { detail: "Authentication required" },
      { status: 401 },
    );
  }
  const webhook = process.env.N8N_PARTNER_IMPORT_WEBHOOK_URL;
  if (!webhook) {
    return NextResponse.json(
      { detail: "El procesamiento de importaciones no está configurado" },
      { status: 503 },
    );
  }
  const { id } = await context.params;
  try {
    const upstream = await fetch(webhook, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ import_job_id: id }),
      cache: "no-store",
    });
    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") ?? "application/json",
      },
    });
  } catch {
    return NextResponse.json(
      { detail: "El procesamiento de importaciones no está disponible" },
      { status: 503 },
    );
  }
}
