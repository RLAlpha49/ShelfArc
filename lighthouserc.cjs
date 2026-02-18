/** @type {import('@lhci/cli').UserConfig} */
module.exports = {
  ci: {
    collect: {
      startServerCommand: "bun run start",
      startServerReadyPattern: "Ready",
      startServerReadyTimeout: 60000,
      // Logs in once before collection; requires LHCI_TEST_EMAIL + LHCI_TEST_PASSWORD.
      puppeteerScript: "./lighthousePuppeteerScript.cjs",
      url: [
        // Public pages
        "http://localhost:3000/",
        "http://localhost:3000/login",
        "http://localhost:3000/signup",
        // Authenticated pages — puppeteer script handles login first
        "http://localhost:3000/dashboard",
        "http://localhost:3000/library",
        "http://localhost:3000/activity",
        "http://localhost:3000/settings"
      ],
      numberOfRuns: 2,
      settings: {
        preset: "desktop"
      }
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.8 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["warn", { minScore: 0.9 }],
        "categories:seo": ["warn", { minScore: 0.9 }]
      }
    },
    upload: {
      target: "temporary-public-storage"
    }
  }
}
