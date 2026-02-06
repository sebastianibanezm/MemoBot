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
 *
 * Handles the case where a user re-signs up with the same email but a new Clerk ID
 * by clearing the email from the old user row, then inserting the new user.
 * (We can't update the old row's PK because child tables reference it via FK.)
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

  // Check if user already exists by ID
  const { data: existingById } = await supabase
    .from("users")
    .select("id")
    .eq("id", payload.id)
    .maybeSingle();

  if (existingById) {
    // User exists with this ID — just update their info
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

  // User doesn't exist by ID — if there's an email conflict, clear it first
  if (email) {
    const { data: existingByEmail } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingByEmail) {
      // Old user row owns this email — clear it so the new row can use it
      console.log(
        `[syncUserToSupabase] Email ${email} belongs to old user ${existingByEmail.id}. Clearing email to allow new user ${payload.id}.`
      );
      await supabase
        .from("users")
        .update({ email: null, updated_at: new Date().toISOString() })
        .eq("id", existingByEmail.id);
    }
  }

  // Insert new user row
  const { error } = await supabase.from("users").insert({
    id: payload.id,
    email: email ?? undefined,
    name: name ?? undefined,
    avatar_url: payload.image_url ?? undefined,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[syncUserToSupabase] Insert error:", error);
  }
}
