import { runtimeConfig } from "@/lib/config";

export type ApiReadiness = {
  service: string;
  status: "ready" | "not_ready";
  dependencies: Record<string, string>;
};

export async function fetchApiReadiness(): Promise<ApiReadiness> {
  const response = await fetch(`${runtimeConfig().apiBaseUrl}/health/ready`, {
    cache: "no-store",
    signal: AbortSignal.timeout(4_000),
  });
  const payload = (await response.json()) as ApiReadiness;
  if (!response.ok) {
    throw new Error(`FastAPI readiness failed with status ${response.status}`);
  }
  return payload;
}
