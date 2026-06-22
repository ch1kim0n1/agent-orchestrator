import { describe, it, expect } from "vitest";

// next.config.js is ESM and exports default config object.
// Import dynamically to avoid Next.js runtime requirements in the test env.
async function loadNextConfig() {
  // Use a relative path from the test file to the config at packages/web/.
  // vitest resolves this against the test file location.
  const mod = await import("../../next.config.js");
  return mod.default;
}

describe("Security headers (issue #93)", () => {
  it("next.config.js exports an async headers() function", async () => {
    const config = await loadNextConfig();
    expect(typeof config.headers).toBe("function");
  });

  it("applies security headers to all routes via source '/(.*)'", async () => {
    const config = await loadNextConfig();
    const headers = await config.headers();
    const catchAll = headers.find((h) => h.source === "/(.*)");
    expect(catchAll).toBeDefined();
    const keys = catchAll!.headers.map((h) => h.key);

    // Core security headers from the issue checklist.
    expect(keys).toContain("X-Frame-Options");
    expect(keys).toContain("X-Content-Type-Options");
    expect(keys).toContain("Referrer-Policy");
    expect(keys).toContain("Permissions-Policy");
    expect(keys).toContain("Content-Security-Policy");
    expect(keys).toContain("Strict-Transport-Security");
  });

  it("X-Frame-Options is DENY (no clickjacking)", async () => {
    const config = await loadNextConfig();
    const headers = await config.headers();
    const catchAll = headers.find((h) => h.source === "/(.*)")!;
    const xfo = catchAll.headers.find((h) => h.key === "X-Frame-Options");
    expect(xfo?.value).toBe("DENY");
  });

  it("X-Content-Type-Options is nosniff (no MIME sniffing)", async () => {
    const config = await loadNextConfig();
    const headers = await config.headers();
    const catchAll = headers.find((h) => h.source === "/(.*)")!;
    const xcto = catchAll.headers.find((h) => h.key === "X-Content-Type-Options");
    expect(xcto?.value).toBe("nosniff");
  });

  it("CSP blocks frame-ancestors, object-src, base-uri, form-action", async () => {
    const config = await loadNextConfig();
    const headers = await config.headers();
    const catchAll = headers.find((h) => h.source === "/(.*)")!;
    const csp = catchAll.headers.find((h) => h.key === "Content-Security-Policy")!.value;

    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it("CSP allows ws/wss connect-src for terminal WebSocket", async () => {
    const config = await loadNextConfig();
    const headers = await config.headers();
    const catchAll = headers.find((h) => h.source === "/(.*)")!;
    const csp = catchAll.headers.find((h) => h.key === "Content-Security-Policy")!.value;

    // Terminal uses WebSocket — must be allowed or the dashboard breaks.
    expect(csp).toContain("connect-src 'self' ws: wss:");
  });

  it("CSP default-src is 'self' (no wildcards)", async () => {
    const config = await loadNextConfig();
    const headers = await config.headers();
    const catchAll = headers.find((h) => h.source === "/(.*)")!;
    const csp = catchAll.headers.find((h) => h.key === "Content-Security-Policy")!.value;

    expect(csp).toContain("default-src 'self'");
    // No wildcard hosts allowed.
    expect(csp).not.toContain("*");
  });

  it("HSTS has max-age >= 1 year and includeSubDomains", async () => {
    const config = await loadNextConfig();
    const headers = await config.headers();
    const catchAll = headers.find((h) => h.source === "/(.*)")!;
    const hsts = catchAll.headers.find((h) => h.key === "Strict-Transport-Security")!.value;

    // max-age=31536000 = 1 year.
    expect(hsts).toMatch(/max-age=31536000/);
    expect(hsts).toContain("includeSubDomains");
  });

  it("preserves the existing /sw.js Cache-Control headers", async () => {
    const config = await loadNextConfig();
    const headers = await config.headers();
    const sw = headers.find((h) => h.source === "/sw.js");
    expect(sw).toBeDefined();
    const cc = sw!.headers.find((h) => h.key === "Cache-Control");
    expect(cc?.value).toBe("no-cache, no-store, must-revalidate");
  });
});
