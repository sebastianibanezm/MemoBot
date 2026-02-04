#!/usr/bin/env node
/**
 * Run Supabase migration: link (if needed) + db push.
 * Requires: NEXT_PUBLIC_SUPABASE_URL in apps/web/.env.local
 * For non-interactive link: set SUPABASE_DB_PASSWORD (env or in .env.local)
 *   Get DB password from: Supabase Dashboard → Project Settings → Database
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { spawnSync } from "child_process";

const rootDir = resolve(import.meta.dirname, "..");
const envPath = resolve(rootDir, "apps/web/.env.local");

function loadEnv(path) {
  try {
    const text = readFileSync(path, "utf8");
    const env = {};
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (value.startsWith('"') && value.endsWith('"')) env[key] = value.slice(1, -1);
      else if (value.startsWith("'") && value.endsWith("'")) env[key] = value.slice(1, -1);
      else env[key] = value;
    }
    return env;
  } catch (e) {
    return {};
  }
}

function getProjectRef(url) {
  if (!url || typeof url !== "string") return null;
  const m = url.match(/https?:\/\/([^.]+)\.supabase\.co/);
  return m ? m[1] : null;
}

const envLocal = loadEnv(envPath);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || envLocal.NEXT_PUBLIC_SUPABASE_URL;
const dbPassword = process.env.SUPABASE_DB_PASSWORD || envLocal.SUPABASE_DB_PASSWORD;
const projectRef = getProjectRef(supabaseUrl);

if (!projectRef) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL (e.g. https://YOUR_REF.supabase.co) in apps/web/.env.local");
  process.exit(1);
}

// Apply Supabase-related vars from .env.local so CLI gets them (trim to avoid invalid format)
for (const [k, v] of Object.entries(envLocal)) {
  if (k.startsWith("SUPABASE_") && v != null) process.env[k] = String(v).trim();
}
if (!process.env.SUPABASE_ACCESS_TOKEN) {
  const found = Object.keys(envLocal).filter((k) => k.startsWith("SUPABASE_"));
  console.error("SUPABASE_ACCESS_TOKEN not found in apps/web/.env.local.");
  if (found.length) console.error("Found SUPABASE_* keys:", found.join(", "));
  console.error("Add: SUPABASE_ACCESS_TOKEN=sbp_... (create at https://supabase.com/dashboard/account/tokens)");
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  const env = { ...process.env };
  if (dbPassword) env.SUPABASE_DB_PASSWORD = dbPassword;
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: rootDir, env, ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log("Linking Supabase project:", projectRef);
run("npx", ["supabase", "link", "--project-ref", projectRef]);

console.log("Pushing migration...");
run("npx", ["supabase", "db", "push"]);

console.log("Migration complete.");
