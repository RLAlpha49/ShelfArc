/**
 * LHCI puppeteer authentication script.
 * Logs into ShelfArc using test credentials before Lighthouse audits begin,
 * so authenticated pages (/dashboard, /library, /activity, /settings) are
 * reachable. No data is mutated — this is a read-only session setup.
 *
 * Required environment variables:
 *   LHCI_TEST_EMAIL    – email address of the read-only test account
 *   LHCI_TEST_PASSWORD – password of the read-only test account
 *
 * @param {import('puppeteer-core').Browser} browser
 */
module.exports = async function lhciAuth(browser) {
  // Attempt to load a local `.env` file into process.env so LHCI picks up
  // LHCI_TEST_EMAIL / LHCI_TEST_PASSWORD when you run `bunx lhci autorun`.
  // This is only a convenience for local runs; CI should use GitHub secrets.
  try {
    const { existsSync, readFileSync } = await import("node:fs")
    const { resolve } = await import("node:path")
    const envPath = resolve(process.cwd(), ".env")
    if (existsSync(envPath)) {
      const raw = readFileSync(envPath, "utf8")
      raw.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("="))
          return
        const idx = trimmed.indexOf("=")
        const key = trimmed.slice(0, idx).trim()
        let val = trimmed.slice(idx + 1)
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1)
        }
        if (!process.env[key]) process.env[key] = val
      })
    }
  } catch {
    // ignore — optional convenience only
  }

  const email = process.env.LHCI_TEST_EMAIL
  const password = process.env.LHCI_TEST_PASSWORD

  if (!email || !password) {
    console.log(
      "[LHCI Auth] LHCI_TEST_EMAIL / LHCI_TEST_PASSWORD not set — " +
        "authenticated pages will redirect to /login and may score lower."
    )
    return
  }

  const page = await browser.newPage()
  try {
    const resp = await page.goto("http://localhost:3000/login", {
      waitUntil: "networkidle2",
      timeout: 30_000
    })

    // Log response status to help debug server-side failures.
    try {
      console.log(
        "[LHCI Auth] /login response status:",
        resp?.status?.() ?? "no-response"
      )
    } catch {
      /* ignore */
    }

    // If navigating to /login immediately redirected us elsewhere, assume the
    // browser is already authenticated and skip attempting to fill the login form.
    const landedUrl = page.url()
    if (!landedUrl.includes("/login")) {
      console.log(
        `[LHCI Auth] Navigation to /login landed at ${landedUrl} — assuming already authenticated; skipping login.`
      )
      return
    }

    // Wait for client-side hydration to render the inputs (prevents "No element found").
    try {
      await page.waitForSelector("#email", { visible: true, timeout: 30_000 })
      await page.waitForSelector("#password", {
        visible: true,
        timeout: 30_000
      })
    } catch (err) {
      console.error(
        "[LHCI Auth] Login inputs not found after navigation; capturing debug output."
      )
      try {
        console.error("[LHCI Auth] Page URL:", page.url())
        const html = await page.content()
        console.error("[LHCI Auth] Page HTML snippet:", html.slice(0, 2000))
      } catch {
        // ignore
      }
      try {
        await page.screenshot({
          path: "lhci-login-no-inputs.png",
          fullPage: true
        })
        console.error(
          "[LHCI Auth] Saved screenshot to lhci-login-no-inputs.png for debugging."
        )
      } catch {
        // ignore
      }
      throw err
    }

    // Fill credentials into the ShelfArc login form.
    try {
      await page.type("#email", email, { delay: 25 })
      await page.type("#password", password, { delay: 25 })
    } catch (err) {
      console.error("[LHCI Auth] Failed to type into login inputs:", err)
      // Capture a short HTML snapshot for debugging (no secrets).
      try {
        const html = await page.content()
        console.error("[LHCI Auth] Page HTML snippet:", html.slice(0, 2000))
      } catch {
        // ignore snapshot failure
      }
      throw err
    }

    // Submit and wait for the post-login redirect.
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30_000 }),
      page.click('[type="submit"]')
    ])

    // Verify login by waiting for the unauthenticated "Sign In" link to disappear.
    try {
      await page.waitForSelector('a[href="/login"]', {
        hidden: true,
        timeout: 8_000
      })
      console.log(`[LHCI Auth] Login succeeded; landed on ${page.url()}`)
    } catch (err) {
      console.error(
        "[LHCI Auth] Still appears unauthenticated after submit; login may have failed.",
        err
      )
      try {
        await page.screenshot({
          path: "lhci-login-failure.png",
          fullPage: true
        })
        console.error(
          "[LHCI Auth] Saved screenshot to lhci-login-failure.png for debugging."
        )
      } catch {
        // ignore screenshot failure
      }
    }
  } catch (err) {
    console.error("[LHCI Auth] Login script error:", err)
  } finally {
    await page.close()
  }
}
