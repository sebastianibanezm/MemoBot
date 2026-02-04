import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client (anon key). Use in client components.
 * RLS applies when using the anon key; set app.current_user_id via backend when needed.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createSupabaseClient(supabaseUrl, supabaseAnonKey);
}
