import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * Server-side Supabase client with service role key (JWT only).
 * Use SUPABASE_SERVICE_ROLE_KEY from Dashboard → Project Settings → API → service_role (secret).
 * In dev, if env is missing/wrong, falls back to reading apps/web/.env.local so the key is never stale.
 */
function getEnvFromFile(): { url?: string; serviceRoleKey?: string } {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, ".env.local"),
    path.join(cwd, "apps", "web", ".env.local"),
  ];
  for (const envPath of candidates) {
    if (!existsSync(envPath)) continue;
    try {
      const content = readFileSync(envPath, "utf8");
      const out: Record<string, string> = {};
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
          value = value.slice(1, -1);
        out[key] = value;
      }
      return {
        url: out.NEXT_PUBLIC_SUPABASE_URL,
        serviceRoleKey: out.SUPABASE_SERVICE_ROLE_KEY,
      };
    } catch {
      continue;
    }
  }
  return {};
}

export function createServerSupabase() {
  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  // Fallback: read .env.local at runtime when key is missing or not a JWT (avoids worker/env issues)
  if (!serviceRoleKey || !serviceRoleKey.startsWith("eyJ")) {
    const fromFile = getEnvFromFile();
    if (fromFile.serviceRoleKey?.startsWith("eyJ")) {
      serviceRoleKey = fromFile.serviceRoleKey;
      if (!supabaseUrl && fromFile.url) supabaseUrl = fromFile.url;
    }
  }

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add them to apps/web/.env.local and restart the dev server."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
