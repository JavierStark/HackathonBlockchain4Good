import { defineConfig, devices } from "@playwright/test";

// E2E smoke suite. Deliberately small and deterministic (see e2e/README.md).
//
// Deploy → build → serve is a HARD ordering requirement here: deployedContracts.ts
// is baked into the Next.js bundle at *build* time (it's a static import, not
// fetched at runtime), so the frontend build must not start until the fresh
// local deployment has finished writing that file. Playwright's built-in
// `webServer` option starts BEFORE `globalSetup` (confirmed against Playwright's
// own docs/issue tracker while building this) — using it here raced the build
// against the deploy and served a stale contract address. So there is no
// `webServer` block: global-setup.ts owns the whole sequence itself (anvil ->
// deploy -> build -> serve) and only resolves once the app is actually up.
const PORT = 3000;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // all specs share one deployed local chain — keep it simple and ordered
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  // A cold build (lint + Turbopack compile + typecheck) measured ~3m35s during
  // setup — give global-setup real headroom instead of flaking in CI.
  globalTimeout: 0,
  timeout: 60_000,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
