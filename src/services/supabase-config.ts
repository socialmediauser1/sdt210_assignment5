/**
 * Supabase connection configuration.
 *
 * Fallback placeholder values prevent createClient from throwing in
 * test / mock mode (when VITE_SUPABASE_URL is empty or absent).
 */
export const supabaseConfig = {
  url:     (import.meta.env.VITE_SUPABASE_URL     as string) || "https://placeholder.supabase.co",
  anonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "placeholder-anon-key",
};
