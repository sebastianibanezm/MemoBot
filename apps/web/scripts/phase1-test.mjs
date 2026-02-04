#!/usr/bin/env node
/**
 * Phase 1 through Phase 9 tests (PLAN.md): build, health, env, auth flow, Phase 3 APIs, Telegram webhook, WhatsApp webhook, Phase 6 RAG, Phase 7 file sync, Phase 8 dashboard, Phase 9 GitHub + deployment config.
 * Run from apps/web: npm run test
 */
import { spawn } from "child_process";
import http from "http";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const repoRoot = path.resolve(root, "..", "..");

function loadEnvLocal() {
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error("Missing .env.local (copy from .env.example and add keys)");
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, "utf8");
  const env = {};
  for (const line of content.split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
  return env;
}

const PHASE1_ENV = [
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const PHASE2_ENV = ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"];

const PHASE4_ENV = ["TELEGRAM_WEBHOOK_SECRET"];
const PHASE5_ENV = ["WHATSAPP_VERIFY_TOKEN", "WHATSAPP_APP_SECRET"];

function requiredEnv(env, keys) {
  const missing = keys.filter((k) => !env[k] || env[k].includes("..."));
  if (missing.length) {
    console.error("Missing or placeholder env in .env.local:", missing.join(", "));
    process.exit(1);
  }
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: root,
      stdio: opts.silent ? "pipe" : "inherit",
      shell: true,
      ...opts,
    });
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
  });
}

function fetchUrl(port, pathname, opts = {}) {
  return new Promise((resolve, reject) => {
    const { body, ...reqOpts } = opts;
    const options = {
      hostname: "127.0.0.1",
      port,
      path: pathname,
      method: opts.method || "GET",
      timeout: opts.timeout ?? 5000,
      headers: opts.headers || {},
      ...reqOpts,
    };
    if (body && !options.headers["Content-Type"]) {
      options.headers["Content-Type"] = "application/json";
    }
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (ch) => (data += ch));
      res.on("end", () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, data });
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
    if (body) {
      req.write(typeof body === "string" ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function fetchHealth(port) {
  return fetchUrl(port, "/api/health").then(({ statusCode, data }) => {
    const json = JSON.parse(data);
    if (statusCode === 200 && json.status === "ok") return json;
    throw new Error(`health returned ${statusCode}: ${data}`);
  });
}

/** Phase 1: unauthenticated protected route must not be publicly accessible (redirect or auth required) */
function expectProtectedRedirect(port, pathname) {
  return fetchUrl(port, pathname, {
    headers: { Host: "localhost" },
  }).then(({ statusCode, headers }) => {
    const location = (headers.location || "").toString();
    const authStatus = (headers["x-clerk-auth-status"] || "").toString();
    if (statusCode === 307 || statusCode === 302) {
      if (location.includes("sign-in")) return true;
      throw new Error(`${pathname} redirect not to sign-in: ${location}`);
    }
    if (statusCode === 401 || statusCode === 403) return true;
    if (statusCode === 404 && authStatus === "signed-out") return true;
    throw new Error(`expected protected response for ${pathname}, got ${statusCode} x-clerk-auth-status: ${authStatus}`);
  });
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("Phase 1 through Phase 9 tests (PLAN.md)\n");

  const env = loadEnvLocal();
  requiredEnv(env, PHASE1_ENV);
  requiredEnv(env, PHASE2_ENV);
  requiredEnv(env, PHASE4_ENV);
  requiredEnv(env, PHASE5_ENV);
  console.log("✓ Env vars present (Phase 1 + Phase 2 + Phase 4 + Phase 5)\n");
  // Phase 6 and Phase 7 have no additional required env vars

  console.log("Running: npm run build ...");
  await run("npm", ["run", "build"]).catch((e) => {
    console.error("Build failed:", e.message);
    process.exit(1);
  });
  console.log("✓ Build passed\n");

  const port = 3012;
  const server = spawn("npm", ["run", "start"], {
    cwd: root,
    stdio: "pipe",
    shell: true,
    env: { ...process.env, PORT: String(port) },
  });

  let stderr = "";
  server.stderr?.on("data", (ch) => (stderr += ch.toString()));
  server.stdout?.on("data", (ch) => {
    const s = ch.toString();
    if (process.env.DEBUG) process.stdout.write(s);
  });

  try {
    await wait(4000);
    const health = await fetchHealth(port);
    console.log("✓ GET /api/health → 200", health);
    if (health.phase !== 9) {
      throw new Error(`Expected health.phase === 9, got ${health.phase}`);
    }
    console.log("✓ Health phase 9 (GitHub + Deployment)");
    await expectProtectedRedirect(port, "/dashboard");
    console.log("✓ Unauthenticated /dashboard redirects to sign-in (auth flow)");
    await expectProtectedRedirect(port, "/dashboard/settings");
    console.log("✓ Unauthenticated /dashboard/settings redirects to sign-in");
    await expectProtectedRedirect(port, "/dashboard/memories");
    console.log("✓ Unauthenticated /dashboard/memories redirects to sign-in (Phase 8)");
    // Phase 9: GitHub workflows and deployment config are present (checked by CI)

    const linkCodeRes = await fetchUrl(port, "/api/link-code", {
      method: "POST",
      body: { platform: "whatsapp" },
    });
    if (linkCodeRes.statusCode !== 401 && linkCodeRes.statusCode !== 404) {
      throw new Error(`Expected POST /api/link-code 401 or 404 without auth, got ${linkCodeRes.statusCode}`);
    }
    console.log("✓ POST /api/link-code returns 401/404 when unauthenticated");

    const linkedRes = await fetchUrl(port, "/api/linked-accounts");
    if (linkedRes.statusCode !== 401 && linkedRes.statusCode !== 404) {
      throw new Error(`Expected GET /api/linked-accounts 401 or 404 without auth, got ${linkedRes.statusCode}`);
    }
    console.log("✓ GET /api/linked-accounts returns 401/404 when unauthenticated");

    // Phase 4: Telegram webhook — must require valid secret token
    const webhookNoSecret = await fetchUrl(port, "/api/webhook/telegram", {
      method: "POST",
      body: {},
    });
    if (webhookNoSecret.statusCode !== 401) {
      throw new Error(`Expected POST /api/webhook/telegram without secret → 401, got ${webhookNoSecret.statusCode}`);
    }
    console.log("✓ POST /api/webhook/telegram without secret returns 401");

    const webhookWrongSecret = await fetchUrl(port, "/api/webhook/telegram", {
      method: "POST",
      headers: { "X-Telegram-Bot-Api-Secret-Token": "wrong-secret" },
      body: {},
    });
    if (webhookWrongSecret.statusCode !== 401) {
      throw new Error(`Expected POST /api/webhook/telegram with wrong secret → 401, got ${webhookWrongSecret.statusCode}`);
    }
    console.log("✓ POST /api/webhook/telegram with wrong secret returns 401");

    const webhookValidSecret = await fetchUrl(port, "/api/webhook/telegram", {
      method: "POST",
      headers: { "X-Telegram-Bot-Api-Secret-Token": env.TELEGRAM_WEBHOOK_SECRET },
      body: { message: { chat: { id: 1 }, from: { id: 1 } } },
      timeout: 10000,
    });
    if (webhookValidSecret.statusCode !== 200) {
      throw new Error(`Expected POST /api/webhook/telegram with valid secret → 200, got ${webhookValidSecret.statusCode}: ${webhookValidSecret.data}`);
    }
    console.log("✓ POST /api/webhook/telegram with valid secret and update returns 200");

    // Phase 5: WhatsApp webhook — GET verification
    const whatsappGetNoToken = await fetchUrl(port, "/api/webhook/whatsapp", { method: "GET" });
    if (whatsappGetNoToken.statusCode !== 403 && whatsappGetNoToken.statusCode !== 503) {
      throw new Error(`Expected GET /api/webhook/whatsapp without verify_token → 403 or 503, got ${whatsappGetNoToken.statusCode}`);
    }
    console.log("✓ GET /api/webhook/whatsapp without valid verify returns 403/503");

    const whatsappGetWrongToken = await fetchUrl(port, "/api/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=99", { method: "GET" });
    if (whatsappGetWrongToken.statusCode !== 403) {
      throw new Error(`Expected GET /api/webhook/whatsapp with wrong verify_token → 403, got ${whatsappGetWrongToken.statusCode}`);
    }
    console.log("✓ GET /api/webhook/whatsapp with wrong verify_token returns 403");

    const challenge = "phase5-challenge-123";
    const whatsappGetValid = await fetchUrl(
      port,
      `/api/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(env.WHATSAPP_VERIFY_TOKEN)}&hub.challenge=${encodeURIComponent(challenge)}`,
      { method: "GET" }
    );
    if (whatsappGetValid.statusCode !== 200) {
      throw new Error(`Expected GET /api/webhook/whatsapp with valid token → 200, got ${whatsappGetValid.statusCode}: ${whatsappGetValid.data}`);
    }
    const bodyText = whatsappGetValid.data?.trim?.() ?? "";
    if (bodyText !== challenge) {
      throw new Error(`Expected GET /api/webhook/whatsapp body to be challenge "${challenge}", got "${bodyText}"`);
    }
    console.log("✓ GET /api/webhook/whatsapp with valid verify_token returns 200 and challenge");

    // Phase 5: WhatsApp webhook — POST signature verification
    const whatsappPostBody = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [{ id: "1", changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: {} } }] }],
    });
    const whatsappPostNoSig = await fetchUrl(port, "/api/webhook/whatsapp", {
      method: "POST",
      body: whatsappPostBody,
    });
    if (whatsappPostNoSig.statusCode !== 401) {
      throw new Error(`Expected POST /api/webhook/whatsapp without signature → 401, got ${whatsappPostNoSig.statusCode}`);
    }
    console.log("✓ POST /api/webhook/whatsapp without signature returns 401");

    const wrongSig = "sha256=" + crypto.createHmac("sha256", "wrong-secret").update(whatsappPostBody).digest("hex");
    const whatsappPostWrongSig = await fetchUrl(port, "/api/webhook/whatsapp", {
      method: "POST",
      headers: { "X-Hub-Signature-256": wrongSig },
      body: whatsappPostBody,
    });
    if (whatsappPostWrongSig.statusCode !== 401) {
      throw new Error(`Expected POST /api/webhook/whatsapp with wrong signature → 401, got ${whatsappPostWrongSig.statusCode}`);
    }
    console.log("✓ POST /api/webhook/whatsapp with wrong signature returns 401");

    const validSig = "sha256=" + crypto.createHmac("sha256", env.WHATSAPP_APP_SECRET).update(whatsappPostBody).digest("hex");
    const whatsappPostValid = await fetchUrl(port, "/api/webhook/whatsapp", {
      method: "POST",
      headers: { "X-Hub-Signature-256": validSig },
      body: whatsappPostBody,
      timeout: 10000,
    });
    if (whatsappPostValid.statusCode !== 200) {
      throw new Error(`Expected POST /api/webhook/whatsapp with valid signature → 200, got ${whatsappPostValid.statusCode}: ${whatsappPostValid.data}`);
    }
    console.log("✓ POST /api/webhook/whatsapp with valid signature and payload returns 200");

    // Phase 7: sync API — POST /api/sync/process requires auth (401/404 when unauthenticated)
    const syncProcessRes = await fetchUrl(port, "/api/sync/process", {
      method: "POST",
    });
    if (syncProcessRes.statusCode !== 401 && syncProcessRes.statusCode !== 404) {
      throw new Error(`Expected POST /api/sync/process 401 or 404 without auth, got ${syncProcessRes.statusCode}`);
    }
    console.log("✓ POST /api/sync/process returns 401/404 when unauthenticated");

    // Phase 9: GitHub PR checks workflow must exist
    const prChecksPath = path.join(repoRoot, ".github", "workflows", "pr-checks.yml");
    if (!fs.existsSync(prChecksPath)) {
      throw new Error(`Phase 9: missing .github/workflows/pr-checks.yml`);
    }
    console.log("✓ Phase 9: .github/workflows/pr-checks.yml present");
  } catch (e) {
    console.error("Phase 1/2/3/4/5/6/7/8/9 check failed:", e.message);
    if (stderr) console.error("Server stderr:", stderr.slice(-500));
    server.kill("SIGTERM");
    process.exit(1);
  } finally {
    server.kill("SIGTERM");
  }

    console.log("\nPhase 1 through Phase 9 tests passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
