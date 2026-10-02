import { NextResponse } from "next/server";

import { fetchApiReadiness } from "@/lib/api-client/health";

export async function GET() {
  try {
    const api = await fetchApiReadiness();
    return NextResponse.json({
      service: "web",
      status: "ready",
      dependencies: { api },
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json(
      { service: "web", status: "not_ready", dependencies: { api: reason } },
      { status: 503 },
    );
  }
}
