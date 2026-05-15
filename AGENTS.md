# EDMS Frontend — Agent Instructions

React 19 + TypeScript + Vite SPA for the GedProject EDMS backend. Tailwind v4 UI based on Metronic primitives. The backend lives in a separate workspace (`../../Desktop/GED-project`).

See [README.md](README.md) for tech-stack rationale and [INTEGRATION_PHASE1.md](INTEGRATION_PHASE1.md) / [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md) for integration & QA notes.

## Commands

```powershell
npm install
npm run dev       # Vite dev server on http://localhost:5173 (proxies /api, /connect, /signalr-hubs to https://localhost:44324)
npm run build     # tsc + vite build
npm run lint      # eslint src --fix
npm run preview
```

The dev server requires the backend at `https://localhost:44324` (see [vite.config.ts](vite.config.ts) proxy). `allowedHosts: true` so any `*.localhost:5173` subdomain works for tenant routing.

## Architecture

```
src/
  auth/                 # Login, register, forgot/reset password — lazy-loaded module
  components/
    auth/RoleGuard.tsx  # <RoleGuard> + <PermissionGuard>
    layout/             # AppLayout, Sidebar, Topbar (tenant scope)
    ui/                 # Metronic primitives (button, input, sonner, ...)
  features/             # One folder per feature: page.tsx, *.service.ts, hooks, sub-components
    documents/  admin/  dashboard/  libraries/  settings/  activity/  host/
  lib/
    api.client.ts       # Axios instance + 401 refresh-token interceptor (read this before adding API calls)
    auth-rbac/roles.ts  # Role / Permission enums (must mirror backend permission keys)
    tenant.ts           # Subdomain → tenant code resolver
    metadata-store.ts, use-debounce.ts, useAvatar.ts, activity-logger.ts, utils.ts
  providers/
    auth-provider.tsx   # AuthContext, useAuth(), session restore via refresh_token
    app-router.tsx      # Route table (host vs tenant routes)
    signalr-provider.tsx# Connects to /signalr-hubs/edms; auto-pauses after 3 negotiate-500s
  styles/globals.css    # Tailwind tokens
```

Path alias `@/` → `src/` (configured in [vite.config.ts](vite.config.ts) and [tsconfig.json](tsconfig.json)). Always use `@/...` imports.

## Conventions

- **API calls**: import `apiClient` from [src/lib/api.client.ts](src/lib/api.client.ts). It already injects `Authorization: Bearer`, `__tenant`, `X-XSRF-TOKEN`, and handles 401 → refresh transparently. Don't create new axios instances.
- **Feature services**: each feature owns a `*.service.ts` with typed DTOs and pure async functions; hooks (`useDocuments`, `useDashboard`, ...) wrap them with state + toasts.
- **Forms**: `react-hook-form` + `zod` + `@hookform/resolvers`. Zod schemas live in `src/<module>/lib/*.schema.ts`.
- **Toasts**: `sonner` via `import { toast } from 'sonner'`. Error pattern: `err?.response?.data?.error?.message ?? fallback`.
- **RBAC**: gate UI with `<RoleGuard allowedRoles={[Role.ADMIN]}>` or `<PermissionGuard requiredPermission={Permission.X}>`. `Role.ADMIN` implicitly has every permission (see [src/providers/auth-provider.tsx](src/providers/auth-provider.tsx)).
- **Host vs tenant**: `user.isHost === true` ↔ `tenantId === null`. Host-only routes are nested under `<HostLayout>`; tenant routes under `<TenantRouteGuard><AppLayout>`. Don't render tenant features on the host.
- **Tokens**: access token in **memory only** (`setAccessToken`), refresh token in `sessionStorage` as `edms_refresh_token`, user profile in `localStorage` as `edms_user`. Never persist the access token.
- **SignalR**: subscribe via `useSignalR()`. The provider attaches `__tenant` as a query param (WS upgrades cannot send custom headers) — preserve that when modifying the URL.
- **i18n**: user-visible strings are French. Match the existing tone when adding text.

## Env vars (Vite)

All must be prefixed `VITE_` (declared usages in [src/lib/api.client.ts](src/lib/api.client.ts) and [src/providers/auth-provider.tsx](src/providers/auth-provider.tsx)):

| Var | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `/api` | Axios baseURL |
| `VITE_AUTH_URL` | `''` | Token endpoint host (uses Vite proxy by default) |
| `VITE_OIDC_CLIENT_ID` | `GedProject_Vue` | OpenIddict client |
| `VITE_OIDC_SCOPE` | `openid profile email GedProject` | Requested scopes |

## Pitfalls

- **CORS / proxy**: hitting the backend directly from the browser bypasses the Vite proxy and breaks cookies + tenant subdomains. Always go through `/api`, `/connect`, `/signalr-hubs`.
- **Refresh-token loop**: the response interceptor explicitly skips `/auth/login`, `/auth/refresh`, `/connect/token`. Don't rename those checks if you add new auth endpoints — extend the skip list.
- **Tenant header on `/connect/token`**: required when refreshing inside a tenant subdomain, otherwise OpenIddict resolves to host and returns 500.
- **bcrypt / password hashing is server-side only.** Never hash on the client.
- **No test runner is wired** in `package.json` — `npm run lint` is the only static check. If you add tests, set up Vitest first.
- **React 19 + Tailwind v4** — avoid `tailwindcss/forms` style v3 plugins; use the v4 `@tailwindcss/vite` pipeline already configured.
