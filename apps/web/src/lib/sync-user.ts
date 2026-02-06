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
 * 
 * Handles the case where a user re-signs up with the same email but a new Clerk ID
 * by updating the existing row's ID to match the new Clerk ID.
 */
export async function syncUserToSupabase(payload: ClerkUserPayload): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    console.error("[syncUserToSupabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    return;
  }
  const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
  const email = payload.email_addresses?.[0]?.email_address ?? null;
  const name = [payload.first_name, payload.last_name].filter(Boolean).join(" ") || null;

  // First, check if user already exists by ID
  const { data: existingById } = await supabase
    .from("users")
    .select("id")
    .eq("id", payload.id)
    .maybeSingle();

  if (existingById) {
    // User exists with this ID, just update their info
    const { error } = await supabase
      .from("users")
      .update({
        email: email ?? undefined,
        name: name ?? undefined,
        avatar_url: payload.image_url ?? undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.id);

    if (error) {
      console.error("[syncUserToSupabase] Update error:", error);
    }
    return;
  }

  // User doesn't exist by ID - check if they exist by email (re-signup case)
  if (email) {
    const { data: existingByEmail } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingByEmail) {
      // User exists with this email but different ID (re-signup)
      // Update the existing row's ID to the new Clerk ID
      console.log(`[syncUserToSupabase] Updating user ID from ${existingByEmail.id} to ${payload.id} for email ${email}`);
      const { error } = await supabase
        .from("users")
        .update({
          id: payload.id,
          name: name ?? undefined,
          avatar_url: payload.image_url ?? undefined,
          updated_at: new Date().toISOString(),
        })
        .eq("email", email);

      if (error) {
        console.error("[syncUserToSupabase] ID update error:", error);
      }
      return;
    }
  }

  // User doesn't exist at all - insert new row
  const { error } = await supabase.from("users").insert({
    id: payload.id,
    email: email ?? undefined,
    name: name ?? undefined,
    avatar_url: payload.image_url ?? undefined,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[syncUserToSupabase] Insert error:", error);
    if (error.message?.toLowerCase().includes("invalid api key")) {
      console.error(
        "[syncUserToSupabase] Fix: In Supabase Dashboard → Project Settings → API, copy the 'service_role' key (secret) and set SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local, then restart the dev server."
      );
    }
  }
}
