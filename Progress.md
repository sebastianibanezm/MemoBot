# MemoBot Development Progress

## Phase 1: Foundation + Auth — Completed

### Clerk setup
- [x] Installed `@clerk/nextjs`
- [x] Configured `ClerkProvider` with cyberpunk-style theme (dark bg `#0a0a0f`, accent `#00f5d4`)
- [x] Created sign-in page at `/sign-in` and sign-up page at `/sign-up`
- [x] Added `middleware.ts` for route protection (public: `/`, `/sign-in`, `/sign-up`, webhook routes)
- [x] Home page shows Sign in / Sign up when signed out, "Go to Dashboard" when signed in

### Supabase setup
- [x] Created `supabase/migrations/20250203000000_initial_schema.sql` with:
  - Extensions: `vector`, `uuid-ossp`
  - Tables: `users`, `platform_links`, `link_codes`, `categories`, `tags`, `memories`, `memory_tags`, `memory_relationships`, `conversation_sessions`, `user_settings`
  - RLS policies on all user-scoped tables
  - Helper `set_current_user_id(user_id)`
  - Functions: `match_memories`, `hybrid_search_memories`, `get_memory_network`
- [x] Added `supabase/README.md` with setup steps (create project, enable pgvector, run migration, env vars)
- [x] **Manual step:** Create a Supabase project, enable pgvector, run the migration (SQL Editor or `supabase db push`), then add env vars to `apps/web/.env.local`

### User sync (Clerk → Supabase)
- [x] Implemented `syncUserToSupabase()` in `src/lib/sync-user.ts` (upsert by Clerk user id)
- [x] Dashboard layout (`src/app/dashboard/layout.tsx`) calls sync on load using `currentUser()` and syncs id, email, name, avatar_url
- [x] Server Supabase client uses `SUPABASE_SERVICE_ROLE_KEY` for sync (bypasses RLS on `users`)

### App structure
- [x] Next.js app in `apps/web` (TypeScript, Tailwind, App Router, `src/`)
- [x] Supabase clients: `src/lib/supabase/server.ts` (service role), `src/lib/supabase/client.ts` (anon)
- [x] Dashboard page at `/dashboard` with placeholder and `UserButton`

### Phase 1 tests (PLAN.md)
- [x] **Build:** `npm run build` passes with env in `.env.local`.
- [x] **Health:** `GET /api/health` returns 200 and `{ status: "ok", phase: 1 }` (route is public).
- [x] **Auth flow:** Unauthenticated request to `/dashboard` is not publicly accessible (redirect to sign-in or `x-clerk-auth-status: signed-out`).
- [x] **Env:** Test script verifies required env vars present in `.env.local` (no placeholders).

Run from `apps/web`: **`npm run test`** — runs build, starts server, hits `/api/health` and `/dashboard`, then exits.

### How to run
1. Copy `apps/web/.env.example` to `apps/web/.env.local` and set Clerk + Supabase keys (required for both `npm run dev` and `npm run build`).
2. Run Supabase migration (see `supabase/README.md`).
3. From `apps/web`: `npm run dev` — then open `/`, sign up, and confirm redirect to dashboard and user sync.
4. Run Phase 1 tests: `npm run test`.

**Note:** Clerk secret key must start with `sk_test_` (not `ssk_test_`). If you see "Clerk Secret Key is invalid" in the browser, fix `CLERK_SECRET_KEY` in `.env.local`.

---

## Phase 2: Core Services + Agent Architecture — Completed

### Data services
- [x] **EmbeddingService** (`src/lib/services/embedding.ts`): OpenAI `text-embedding-3-small`, 512 dimensions; `generateEmbedding(text)`, `generateEmbeddings(texts)`
- [x] **MemoryService** (`src/lib/services/memory.ts`): user-scoped CRUD — create, getById, update, delete (soft), listRecentMemories
- [x] **CategoryService** (`src/lib/services/categorizer.ts`): `assignCategory(userId, contentOrName)`, `previewCategory(content, categories)`, `incrementCategoryMemoryCount`
- [x] **TagService** (`src/lib/services/tagger.ts`): `getOrCreateTags`, `extractTagNamesFromContent`, `extractAndAssignTags`, `previewTags`
- [x] **RelationshipService** (`src/lib/services/relationship.ts`): `findRelatedMemories(userId, excludeId, embedding)`, `createRelationships(memoryId, related)`
- [x] **RetrievalService** (`src/lib/services/retrieval.ts`): `searchMemoriesSemantic`, `searchMemoriesHybrid`, `getMemoryNetwork` (2-degree)
- [x] **Sync service** (`src/lib/services/sync.ts`): stub `syncMemoryToStorage` (Phase 7)
- [x] **Session service** (`src/lib/services/session.ts`): `getOrCreateSession(userId, platform, platformUserId)`

### Agent architecture
- [x] **System prompt** (`src/agent/system-prompt.ts`): `MEMOBOT_SYSTEM_PROMPT` (conversation + memory creation mode)
- [x] **Tool schemas** (`src/agent/tools.ts`): 14 tools in Claude tool-use format — search_memories, get_memory_by_id, list_recent_memories, list_categories, list_tags, start_memory_capture, add_to_memory_draft, generate_memory_draft, finalize_memory, cancel_memory_draft, update_memory, delete_memory, get_session_state, set_session_state
- [x] **Tool handlers** (`src/agent/tool-handlers.ts`): `handleToolCall(toolName, toolInput, context)` for all tools; title/summary via Claude in generate_memory_draft
- [x] **Orchestrator** (`src/agent/orchestrator.ts`): `processMessage(userMessage, context)` — agentic loop with Claude until no more tool_use

### Phase 2 tests (PLAN.md)
- [x] **Build:** `npm run build` passes.
- [x] **Health:** `GET /api/health` returns 200 and `{ status: "ok", phase: 2 }`.
- [x] **Env:** Test script verifies Phase 1 + Phase 2 env vars (including `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`).
- [x] **Auth flow:** Unauthenticated `/dashboard` still redirects to sign-in.

Run from `apps/web`: **`npm run test`** — runs build, starts server, checks health phase 2 and dashboard redirect.

**Phase 2 env:** Add to `.env.local`: `OPENAI_API_KEY=sk-...`, `ANTHROPIC_API_KEY=sk-ant-...` (see `.env.example`). All Phase 2 validation tests require these for `npm run test` to pass.

---

## Phase 3: Account Linking — Completed

### Link code generation API
- [x] **POST /api/link-code** (`src/app/api/link-code/route.ts`): authenticated; body `{ platform: "whatsapp" | "telegram" }`; generates 6-digit code (10 min TTL), stores in `link_codes`, returns `{ code }`
- [x] **GET /api/linked-accounts** (`src/app/api/linked-accounts/route.ts`): authenticated; returns `{ links: PlatformLink[] }` for current user

### Account linking service
- [x] **Account linking service** (`src/lib/services/account-linking.ts`): `generateLinkCode(userId, platform)`, `verifyAndLinkAccount(platform, platformUserId, code)`, `getLinkedAccounts(userId)`, `resolveUserFromPlatform(platform, platformUserId)`
- [x] **Session service** (`src/lib/services/session.ts`): added `updateSessionHistory(sessionId, newMessages)` for message router

### Message router (LINK command + unlinked welcome)
- [x] **Message router** (`src/lib/message-router.ts`): `processIncomingMessage(platform, platformUserId, text, replyFn)` — detects `LINK 123456`, verifies and links; else resolves user, shows unlinked welcome if needed; else get/create session, runs agent, updates history, replies (for Phase 4 Telegram/WhatsApp webhooks)

### Settings UI
- [x] **Dashboard Settings** (`src/app/dashboard/settings/page.tsx`): Link Messaging Accounts — generate code for WhatsApp/Telegram, display code + copy, list linked accounts; cyberpunk theme; link from dashboard header
- [x] Dashboard page has "Settings" link in header

### Phase 3 tests (PLAN.md)
- [x] **Build:** `npm run build` passes.
- [x] **Health:** `GET /api/health` returns 200 and `{ status: "ok", phase: 3 }`.
- [x] **Auth flow:** Unauthenticated `/dashboard` and `/dashboard/settings` redirect to sign-in.
- [x] **API protection:** POST `/api/link-code` and GET `/api/linked-accounts` return 401 or 404 when unauthenticated (Clerk may return 404).

Run from `apps/web`: **`npm run test`** — runs build, starts server, checks health phase 3, dashboard/settings redirect, and protected link-code/linked-accounts APIs.

---

## Phase 4: Telegram Integration — Completed

### Telegram webhook
- [x] **POST /api/webhook/telegram** (`src/app/api/webhook/telegram/route.ts`): verifies `X-Telegram-Bot-Api-Secret-Token` against `TELEGRAM_WEBHOOK_SECRET`; parses Telegram Update (message.chat.id, message.from.id, message.text); calls `processIncomingMessage("telegram", platformUserId, text, replyFn)`; replyFn sends reply via Telegram Bot API `sendMessage`
- [x] Webhook handler returns 401 when secret is missing or wrong; 200 when valid secret and update (with or without text)
- [x] **Manual step:** Create a bot via [BotFather](https://t.me/botfather), set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` in `.env.local`; set webhook: `curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" -d "url=<YOUR_APP_URL>/api/webhook/telegram" -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"`

### Integration
- [x] Webhook connected to message router → agent orchestrator (LINK command, unlinked welcome, session + agent flow)
- [x] Response formatting: agent replies sent to user via Telegram `sendMessage`

### Phase 4 tests (PLAN.md)
- [x] **Build:** `npm run build` passes.
- [x] **Health:** `GET /api/health` returns 200 and `{ status: "ok", phase: 4 }`.
- [x] **Env:** Test script verifies Phase 1 + Phase 2 + Phase 4 env vars (including `TELEGRAM_WEBHOOK_SECRET`).
- [x] **Webhook protection:** POST `/api/webhook/telegram` without `X-Telegram-Bot-Api-Secret-Token` returns 401; with wrong secret returns 401; with valid secret and valid update returns 200.

Run from `apps/web`: **`npm run test`** — runs build, starts server, checks health phase 4, dashboard/settings redirect, protected link-code/linked-accounts APIs, and Telegram webhook secret verification.

---

## Phase 5: WhatsApp Integration — Completed

### WhatsApp Cloud API webhook
- [x] **GET /api/webhook/whatsapp** (`src/app/api/webhook/whatsapp/route.ts`): webhook verification — validates `hub.mode=subscribe`, `hub.verify_token` against `WHATSAPP_VERIFY_TOKEN`, returns `hub.challenge` as plain text (200)
- [x] **POST /api/webhook/whatsapp**: verifies `X-Hub-Signature-256` (HMAC-SHA256 of body with `WHATSAPP_APP_SECRET`); parses WhatsApp Cloud API payload (`object`, `entry`, `changes`, `messages`); extracts first text message (`from` = wa_id, `text.body`); calls `processIncomingMessage("whatsapp", from, text, replyFn)`; replyFn sends via Cloud API `POST graph.facebook.com/v21.0/{phone_number_id}/messages`
- [x] Webhook handler returns 401 when signature is missing or invalid; 200 when valid secret and payload (with or without processable messages)
- [x] **Manual step:** Create Meta Developer app, add WhatsApp product, configure webhook URL and verify token; set `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` (and optionally `WHATSAPP_BUSINESS_ACCOUNT_ID`) in `apps/web/.env.local`

### Integration
- [x] WhatsApp webhook connected to message router → agent orchestrator (LINK command, unlinked welcome, session + agent flow)
- [x] Response formatting: agent replies sent via WhatsApp Cloud API send message

### Phase 5 tests (PLAN.md)
- [x] **Build:** `npm run build` passes.
- [x] **Health:** `GET /api/health` returns 200 and `{ status: "ok", phase: 5 }`.
- [x] **Env:** Test script verifies Phase 1 + Phase 2 + Phase 4 + Phase 5 env vars (including `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`).
- [x] **Webhook verification:** GET `/api/webhook/whatsapp` without valid `hub.verify_token` returns 403 or 503; with wrong token returns 403; with valid token and `hub.challenge` returns 200 and response body equals challenge.
- [x] **Webhook protection:** POST `/api/webhook/whatsapp` without `X-Hub-Signature-256` returns 401; with wrong signature returns 401; with valid signature and valid payload returns 200.

Run from `apps/web`: **`npm run test`** — runs build, server, health phase 5, dashboard/settings redirect, protected link-code/linked-accounts APIs, Telegram webhook secret verification, and WhatsApp webhook verification + signature verification.

---

## Phase 6: RAG + Querying — Completed

### RAG config (Phase 6)
- [x] **RAG config** (`src/lib/rag-config.ts`): tuned defaults — `RAG_HYBRID_DEFAULTS` (fullTextWeight 1.2, semanticWeight 1.5, rrfK 50), `RAG_NETWORK_DEFAULTS` (initialCount 6, relatedCount 3, similarityThreshold 0.48), `RAG_SEMANTIC_DEFAULTS` (matchThreshold 0.55), `RAG_CONTEXT_DEFAULTS` (contentPreviewLength 220, maxMessageHistoryForContext 8)
- [x] **RetrievalService** (`src/lib/services/retrieval.ts`): wired to RAG config for semantic, hybrid, and 2-degree network retrieval defaults
- [x] **Tool handlers** (`src/agent/tool-handlers.ts`): `search_memories` uses RAG_NETWORK_DEFAULTS and RAG_SEMANTIC_DEFAULTS; content preview length 220 for Claude context
- [x] **Orchestrator** (`src/agent/orchestrator.ts`): context building uses last 8 messages (RAG_CONTEXT_DEFAULTS.maxMessageHistoryForContext)
- [x] **System prompt** (`src/agent/system-prompt.ts`): added instruction to use search_memories results (content_preview, relevance/degree) and cite memory titles when answering

### Phase 6 tests (PLAN.md)
- [x] **Build:** `npm run build` passes.
- [x] **Health:** `GET /api/health` returns 200 and `{ status: "ok", phase: 6 }`.
- [x] **Env:** No additional env vars for Phase 6; Phase 1 + 2 + 4 + 5 env still required.
- [x] **Auth flow:** Unauthenticated `/dashboard` and `/dashboard/settings` still redirect; protected APIs and webhooks unchanged.

Run from `apps/web`: **`npm run test`** — runs build, server, health phase 6, dashboard/settings redirect, protected link-code/linked-accounts APIs, Telegram webhook secret verification, and WhatsApp webhook verification + signature verification.

---

## Phase 7: File Sync — Completed

### Markdown generator
- [x] **Markdown generator** (`src/lib/sync/markdown.ts`): `generateMemoryMarkdown(memory, categoryName, tagNames)` — YAML frontmatter (id, title, summary, category, tags, created_at, updated_at, occurred_at, source_platform) + content body

### Local backup
- [x] **Local filesystem writer** (`src/lib/sync/local-writer.ts`): `writeMemoryToLocal(basePath, categoryName, memoryId, title, markdownContent)` — writes to `basePath/CategoryName/slug.md`, sanitizes folder/file names, returns relative path
- [x] **Sync service** (`src/lib/services/sync.ts`): `getUserSyncSettings(userId)`, `syncMemoryToStorage(userId, memory, category, tags)` — reads `user_settings` (local_backup_enabled, local_backup_path); generates markdown; writes to local path when enabled; updates memory `sync_status` and `local_file_path` on success; placeholders for Google Drive and Dropbox upload

### Sync queue
- [x] **Sync queue** (`src/lib/services/sync-queue.ts`): `processSyncQueue(userId)` — fetches memories with `sync_status = 'pending'`, loads category and tags, calls `syncMemoryToStorage` for each; returns `{ processed, errors }`
- [x] **POST /api/sync/process** (`src/app/api/sync/process/route.ts`): authenticated; calls `processSyncQueue(userId)`; returns `{ processed, errors }`

### Google Drive OAuth
- [x] **GET /api/auth/google-drive**: authenticated; redirects to Google OAuth (scope `drive.file`); state = userId; env: `GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_APP_URL`
- [x] **GET /api/auth/google-drive/callback**: exchanges code for tokens; stores `google_refresh_token` in `user_settings`, sets `google_drive_enabled`; redirects to `/dashboard/settings?google_drive=linked`; env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- [x] Sync service placeholder for Google Drive upload (when `google_drive_enabled` and `google_refresh_token` present)

### Dropbox OAuth
- [x] **GET /api/auth/dropbox**: authenticated; redirects to Dropbox OAuth; state = userId; env: `DROPBOX_CLIENT_ID`, `NEXT_PUBLIC_APP_URL`
- [x] **GET /api/auth/dropbox/callback**: exchanges code for tokens; stores `dropbox_refresh_token` in `user_settings`, sets `dropbox_enabled`; redirects to `/dashboard/settings?dropbox=linked`; env: `DROPBOX_CLIENT_ID`, `DROPBOX_CLIENT_SECRET`
- [x] Sync service placeholder for Dropbox upload (when `dropbox_enabled` and `dropbox_refresh_token` present)

### Middleware
- [x] Auth callback routes `/api/auth/(.*)/callback` added to public routes so OAuth redirects work

### Phase 7 tests (PLAN.md)
- [x] **Build:** `npm run build` passes.
- [x] **Health:** `GET /api/health` returns 200 and `{ status: "ok", phase: 7 }`.
- [x] **Auth flow:** Unauthenticated `/dashboard` and `/dashboard/settings` redirect to sign-in; protected APIs unchanged.
- [x] **Sync API:** POST `/api/sync/process` returns 401 or 404 when unauthenticated.

Run from `apps/web`: **`npm run test`** — runs build, server, health phase 7, dashboard/settings redirect, protected link-code/linked-accounts APIs, Telegram webhook secret verification, WhatsApp webhook verification + signature verification, and POST /api/sync/process 401/404 when unauthenticated.

---

## Phase 8: Frontend Dashboard — Completed

### Cyberpunk theme (Tailwind config)
- [x] **globals.css** (`src/app/globals.css`): Extended `:root` with `--card`, `--card-border`, `--muted`, `--glow`; `@theme inline` exposes `--color-accent`, `--color-card`, `--color-muted` for Tailwind; body uses CSS variables

### Memory list/detail pages
- [x] **GET /api/memories** (`src/app/api/memories/route.ts`): Authenticated; query `categoryId`, `limit`, `offset`; returns `{ memories, total }` (paginated via Supabase range)
- [x] **GET /api/memories/[id]** (`src/app/api/memories/[id]/route.ts`): Authenticated; returns single memory with `category_name` and `tag_names`
- [x] **Memories list** (`src/app/dashboard/memories/page.tsx`): Client page — grid/list toggle, pagination, links to detail
- [x] **Memory detail** (`src/app/dashboard/memories/[id]/page.tsx`): Server page — title, content (pre-wrap), category, tags, dates, back link

### Category/tag browsers
- [x] **GET /api/categories** (`src/app/api/categories/route.ts`): Authenticated; returns `{ categories }` (id, name, memory_count)
- [x] **GET /api/tags** (`src/app/api/tags/route.ts`): Authenticated; returns `{ tags }` (id, name, usage_count)
- [x] **Categories page** (`src/app/dashboard/categories/page.tsx`): List categories with memory count; link to memories filtered by category
- [x] **Tags page** (`src/app/dashboard/tags/page.tsx`): Tag cloud with usage_count; font size scaled by usage

### Relationship graph visualization
- [x] **GET /api/graph** (`src/app/api/graph/route.ts`): Authenticated; returns `{ nodes, links }` for user’s memories and memory_relationships
- [x] **Graph page** (`src/app/dashboard/graph/page.tsx`): Force-directed graph (SVG); nodes are memories (link to detail), edges are relationships; simulation with repulsion/attraction and setInterval

### Settings (linking + sync config)
- [x] **Dashboard layout** (`src/app/dashboard/layout.tsx`): Shared header with nav (Home, Memories, Categories, Tags, Graph, Settings) and UserButton
- [x] **Settings page** (`src/app/dashboard/settings/page.tsx`): Link Messaging Accounts (unchanged); **Sync & Backup** section — local backup toggle, local backup path input, Save sync settings (GET/PATCH `/api/settings/sync`)
- [x] **GET /api/settings/sync** and **PATCH /api/settings/sync** (`src/app/api/settings/sync/route.ts`): Authenticated; read/update `local_backup_enabled`, `local_backup_path` in `user_settings`

### Phase 8 tests (PLAN.md)
- [x] **Build:** `npm run build` passes.
- [x] **Health:** `GET /api/health` returns 200 and `{ status: "ok", phase: 8 }`.
- [x] **Auth flow:** Unauthenticated `/dashboard`, `/dashboard/settings`, `/dashboard/memories` redirect to sign-in.
- [x] All prior Phase 1–7 checks (env, link-code, linked-accounts, Telegram webhook, WhatsApp webhook, sync/process) still pass.

Run from `apps/web`: **`npm run test`** — runs build, server, health phase 8, dashboard/settings/memories redirect, protected APIs, and webhooks.

---

## Phase 9: GitHub Setup + Deployment — Completed

### GitHub setup
- [x] **Root package.json** (`package.json`): monorepo with `workspaces: ["apps/web"]`; scripts `dev`, `build`, `lint`, `type-check`, `test` delegate to `web` workspace
- [x] **Type-check script** (`apps/web/package.json`): added `type-check`: `tsc --noEmit`
- [x] **Root .gitignore** (`.gitignore`): node_modules, .env*, .next, .vercel, .turbo, coverage, IDE/OS ignores
- [x] **PR checks workflow** (`.github/workflows/pr-checks.yml`): on pull_request to main/develop — checkout, Node 20, npm ci in apps/web, type-check, lint, create .env.local from secrets (with CI fallbacks), build, test
- [x] **Deploy-backend workflow** (`.github/workflows/deploy-backend.yml`): on push to main when `apps/api/**` or `packages/shared/**` change; Railway deploy (no-op until backend is split)

### Vercel configuration
- [x] **vercel.json** (`apps/web/vercel.json`): framework nextjs, region iad1, CORS headers for `/api/*`, rewrites for `/api/webhook/:path*`
- [ ] **Manual:** Connect GitHub repo to Vercel; set Root Directory to `apps/web`; add env vars (see PLAN.md); configure Clerk production domain; optional custom domain

### Branch protection (manual)
- [ ] **Manual:** In GitHub repo → Settings → Branches → Add rule for `main`: require PR reviews, require status checks (PR Checks) before merge

### Phase 9 tests (PLAN.md)
- [x] **Build:** `npm run build` passes (from apps/web).
- [x] **Health:** `GET /api/health` returns 200 and `{ status: "ok", phase: 9 }`.
- [x] **Auth flow:** Unauthenticated `/dashboard`, `/dashboard/settings`, `/dashboard/memories` redirect to sign-in.
- [x] **Phase 9 deliverable:** `.github/workflows/pr-checks.yml` present (validated by test script).
- [x] All prior Phase 1–8 checks (env, link-code, linked-accounts, Telegram webhook, WhatsApp webhook, sync/process) still pass.

Run from `apps/web`: **`npm run test`** — runs build, server, health phase 9, dashboard/settings/memories redirect, protected APIs, webhooks, and Phase 9 workflow presence.

### Next (Phase 10+)
- Manual: Create GitHub repo, push code, set branch protection, add repo secrets for CI
- Manual: Connect to Vercel, add env vars, deploy; configure Clerk production domain; optional custom domain
- Manual: Railway backend deployment when/if backend is split; update Telegram/WhatsApp webhooks to production URL

---

## Validation log

- **2025-02-03:** Ran `npm run test` from `apps/web` — all Phase 1–9 validation tests passed (build, health phase 9, auth redirects, protected APIs, Telegram/WhatsApp webhook checks, sync/process 401, pr-checks.yml present).
