import { defineConfig } from "@playwright/test";

try { process.loadEnvFile(".env.local"); } catch { /* CI provides env */ }

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  use: { baseURL: "http://localhost:3100" },
  webServer: { command: "npm run dev -- -p 3100", url: "http://localhost:3100/age-gate", reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
