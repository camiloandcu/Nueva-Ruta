import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { runtimeConfig } from "@/lib/config";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const config = runtimeConfig();

  return createServerClient(config.supabaseUrl, config.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components can read cookies but cannot write a refresh token.
          // Route handlers and Server Actions use this same client where writes are valid.
        }
      },
    },
  });
}
