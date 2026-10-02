type RuntimeConfig = {
  apiBaseUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is missing`);
  }
  return value;
}

export function runtimeConfig(): RuntimeConfig {
  return {
    apiBaseUrl: required("API_BASE_URL").replace(/\/$/, ""),
    supabaseUrl: required("SUPABASE_URL").replace(/\/$/, ""),
    supabaseAnonKey: required("SUPABASE_ANON_KEY"),
  };
}
