# Project Analysis — TelcoVantage ERP System

> Last updated: 2026-08-04

## Stack

- **Framework**: Next.js 16.2 (App Router)
- **Language**: TypeScript 5 (strict)
- **UI**: React 19, Tailwind CSS 4, Lucide icons
- **Database**: Supabase (PostgreSQL) — raw SQL migrations, no ORM
- **Auth**: Supabase Auth (email/password + Microsoft SSO)
- **AI**: Gemini 2.5 Flash via Vercel AI SDK
- **Email**: Resend + React Email
- **Testing**: Jest 30 + Testing Library
- **Package Manager**: npm

## Architecture

- **Server-first**: React Server Components for reads, `"use server"` actions for mutations, Route Handlers for external integrations
- **3 Supabase clients**: browser (`client.ts`), server/cookie-aware (`server.ts`), service-role (`service.ts`) — never interchangeable
- **RBAC enforced server-side** via `requireCapability()` in `lib/auth/permissions.ts`; UI hides nav items cosmetically only
- **Auth guard**: `proxy.ts` (Next.js 16 convention, replaces `middleware.ts`)
- **No component library** — hand-rolled primitives in `components/ui/`
- **3 themes** (light, dark, midnight) via `next-themes` + custom `AccentProvider`

## Directory Structure

```
app/
├── actions/           # Shared server actions (AI import, chat, OCR)
├── api/               # Route handlers (12+ subdirectories)
├── auth/              # Callback + password reset
├── dashboard/         # Main ERP modules (21 subdirectories)
├── login/             # Login page + actions
├── portal/            # External vendor upload portal
├── layout.tsx         # Root layout
├── page.tsx           # Root redirect → /login
├── proxy.ts           # Auth guard

components/
├── dashboard/         # Feature UI (28 entries)
├── docx/              # Browser-based DOCX editor
├── portal/            # Upload portal components
├── ui/                # Shared primitives (pagination, search, tooltip, etc.)

lib/
├── auth/              # RBAC: roles.ts (client-safe) + permissions.ts (server-only)
├── chat/              # Gemini assistant tools (~911 lines)
├── dashboard/         # Shared dashboard queries
├── docx/              # DOCX generation helpers
├── email/             # Resend sender + React Email templates
├── invoices/          # Invoice status logic
├── pdf/               # PO + report PDF rendering
├── portal/            # Magic-link URL helpers
├── reports/           # Shared report calculations
├── telegram/          # Telegram bot client + role-assign service
├── vendors/           # 14-point accreditation document types
├── env.ts             # Environment variable validation
├── payment-terms.ts   # Payment term definitions

utils/
├── supabase/          # 3 client factories
├── audit.ts           # Audit log helper
├── notifications.ts   # In-app notification helper
├── ai-import-processor.ts
├── import-export.ts
├── completeness.ts
├── client-import-parser.ts
├── pdf-stamper.ts
├── storage.ts
├── string-similarity.ts

supabase/
└── migrations/        # 39 SQL migrations (schema source of truth)

scripts/               # Operational scripts (purge-db, seed docs, Telegram webhook)
__tests__/             # Jest tests (business logic focus)
```

## Modules

| Module | Route | Key Features |
|--------|-------|-------------|
| Command Center | `/dashboard` | KPIs, cash-flow charts, compliance health |
| Vendors | `/dashboard/vendors` | 14-point accreditation, magic-link upload portals |
| Purchase Orders | `/dashboard/purchase-orders` | Draft→issue workflow, compliance gates, DOCX/PDF gen |
| Invoices (AP) | `/dashboard/invoices` | OCR via Gemini, overbilling guards, payment vouchers |
| CRM | `/dashboard/crm` | Accounts, contacts, opportunities |
| Client Invoices | `/dashboard/client-invoices` | AR billing |
| Client POs | `/dashboard/client-pos` | Client purchase orders |
| Projects | `/dashboard/projects` | Vendor/customer linking, completion tracking |
| Documents | `/dashboard/documents` | 3-tier vault (Company/Vendor/Customer), versioning |
| HR | `/dashboard/hr` | Employee directory, 201 File Vault |
| Assets | `/dashboard/assets` | Asset registry, maintenance logs |
| Compliance | `/dashboard/compliance` | Vendor document compliance |
| Accounting | `/dashboard/accounting` | Financial summaries |
| Reports | `/dashboard/reports` | PDF reports (AP aging, compliance, operations) |
| Audit Logs | `/dashboard/audit-logs` | Change tracking |
| Notifications | `/dashboard/notifications` | Realtime bell |
| Settings | `/dashboard/settings` | App configuration |
| AI Assistant | (sidebar) | Gemini chat with ERP tools |
| Portal | `/portal/upload/[token]/` | Vendor self-service uploads |

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@supabase/ssr`, `@supabase/supabase-js` | Auth, DB, storage, realtime |
| `ai`, `@ai-sdk/google`, `@ai-sdk/react` | AI assistant |
| `resend`, `@react-email/*` | Email |
| `pdf-lib`, `pdfkit`, `pizzip` | PDF/DOCX generation |
| `@eigenpal/docx-editor-react` | Browser DOCX editor |
| `recharts` | Charts |
| `sonner` | Toasts |
| `next-themes` | Theme switching |
| `xlsx` | Excel import/export |
| `zod` | Validation |

## Database

- **38 migrations** in `supabase/migrations/` — additive only, no down-migrations
- **Key tables**: `profiles`, `vendors`, `vendor_documents`, `tvph_documents`, `projects`, `project_vendors`, `vendor_contracts`, `purchase_orders`, `service_invoices`, `payments`, `audit_logs`, `notifications`, `crm_accounts`, `crm_contacts`, `erp_documents`, `customer_documents`, `employee_documents`, `assets`, `email_logs`, `chat_messages`, `payment_requests`, `payment_reservations`, `completion_certificates`, `internal_entities`, `purchase_requests` (+ `pr_line_items`, `pr_site_details`; header carries `vendor_id` — optional nominated vendor prefilled onto the PO at conversion — plus `dp_amount`/`dp_percent` where `dp_amount = amount × dp_percent/100`, inherited by the PO, which also stores `dp_percent`)
- **RLS** enabled on all tables
- **Storage buckets**: `avatars`, `vendor-documents`, `tvph-documents`, `erp-documents`, `customer-documents`, `employee-documents`, + payment/PO buckets
- **Cron**: `pg_cron` + `pg_net` for document expiry + invoice due reminders

## RBAC

- **5 roles**: `superadmin`, `admin`, `finance`, `operations`, `viewer`
- **32 capabilities** mapped via `CAPABILITY_ROLES` in `lib/auth/roles.ts`
- `requireCapability(capability)` gates every Server Action and Route Handler
- New Microsoft SSO users default to `viewer`; Telegram notifies admins for role assignment

## Notable Patterns

- Module pattern: `page.tsx` (list) + `[id]/page.tsx` (detail) + `new/page.tsx` (create) + `actions.ts` (server actions)
- Suspense boundaries with skeleton fallbacks for lazy-loading
- `unstable_instant = { prefetch: "static" }` for instant navigation
- Report calculations shared between UI and PDF routes via `lib/reports/`
- AI tools (`lib/chat/tools.ts`) import server actions directly
- 14-point vendor accreditation defined in `lib/vendors/document-types.ts`
- Tests target business logic (PO guards, invoice guards), not UI snapshots
