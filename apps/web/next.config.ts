import type { NextConfig } from "next";
import path from "node:path";
import { readFileSync } from "node:fs";

// Load .env.local from this app directory so env is correct when run from monorepo root
const appDir = __dirname;
try {
  const envPath = path.join(appDir, ".env.local");
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eq = trimmed.indexOf("=");
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
          value = value.slice(1, -1);
        // Always apply so apps/web/.env.local wins over cwd or other env
        process.env[key] = value;
      }
    }
  }
} catch {
  // .env.local optional
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
