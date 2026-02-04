import { createClient } from "@supabase/supabase-js";

export type ClerkUserPayload = {
  id: string;
  email_addresses?: { email_address: string }[];
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
};

/**
 * Sync Clerk user to Supabase users table.
 * Uses anon key because `users` has no RLS—avoids service_role key issues.
 * Other server operations still use createServerSupabase() (service_role).
 */
export async function syncUserToSupabase(payload: ClerkUserPayload): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    console.error("[syncUserToSupabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    return;
  }
  const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
  const email =
    payload.email_addresses?.[0]?.email_address ?? null;
  const name = [payload.first_name, payload.last_name].filter(Boolean).join(" ") || null;

  const { error } = await supabase.from("users").upsert(
    {
      id: payload.id,
      email: email ?? undefined,
      name: name ?? undefined,
      avatar_url: payload.image_url ?? undefined,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    console.error("[syncUserToSupabase]", error);
    if (error.message?.toLowerCase().includes("invalid api key")) {
      console.error(
        "[syncUserToSupabase] Fix: In Supabase Dashboard → Project Settings → API, copy the 'service_role' key (secret) and set SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local, then restart the dev server."
      );
    }
    // Don't throw so the dashboard still loads; sync is best-effort
    return;
  }
}
