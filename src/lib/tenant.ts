/**
 * Tenant resolution from the browser URL.
 *
 * Strategy: leftmost subdomain of `window.location.hostname` is the tenant code.
 * - `localhost`, `127.0.0.1`, `::1`, `app.example.com` → no tenant (Host scope)
 * - `acme.localhost`, `acme.app.example.com`           → tenant code = "acme"
 *
 * The resolved value is sent on every request as the `__tenant` header so
 * ABP's default `HeaderTenantResolveContributor` can resolve it server-side.
 */

const RESERVED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
]);

const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api']);

/**
 * Returns the tenant code (e.g. "acme") derived from the current URL,
 * or `null` if the request is targeting the host scope.
 */
export function getCurrentTenantCode(): string | null {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname.toLowerCase();
  if (RESERVED_HOSTS.has(host)) return null;

  const parts = host.split('.');
  // Plain hostnames without a dot (e.g. "localhost") cannot carry a tenant
  if (parts.length < 2) return null;

  const sub = parts[0];
  if (!sub || RESERVED_SUBDOMAINS.has(sub)) return null;

  // For "acme.localhost" the parts are ["acme", "localhost"] — sub is "acme".
  // For "app.example.com" the parts are ["app", "example", "com"] — reserved → null.
  return sub;
}

/**
 * Returns true when the current browser URL targets the host (platform) scope.
 */
export function isHostUrl(): boolean {
  return getCurrentTenantCode() === null;
}
