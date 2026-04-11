#!/usr/bin/env npx tsx
/**
 * Capture headless screenshots of the main feature pages (dashboard, settings, activity log).
 *
 * Prerequisites:
 *   1. A deployed instance seeded with dummy data (Setting table populated with
 *      WIZARD_COMPLETE=true, ADMIN_PASSWORD=ScreenshotDemo123, etc.)
 *   2. ActivityLog table seeded with plausible dummy rows
 *
 * Usage (against the ynab-screenshots Railway deployment):
 *   SCREENSHOT_BASE_URL=https://ynab-app-production-89d6.up.railway.app \
 *   npm run docs:feature-screenshots
 *
 * Usage (against a local dev server with a seeded DB):
 *   SCREENSHOT_BASE_URL=http://localhost:3000 \
 *   SCREENSHOT_PASSWORD=ScreenshotDemo123 \
 *   npm run docs:feature-screenshots
 *
 * Re-runnable: overwrites existing PNGs in docs/images/
 *
 * NOTE: This script targets the disposable ynab-screenshots Railway project.
 *       Do NOT run it against ynab-test-production.
 */

import { chromium } from 'playwright'
import path from 'path'
import fs from 'fs'

const BASE_URL = process.env.SCREENSHOT_BASE_URL
if (!BASE_URL) {
  console.error('Error: SCREENSHOT_BASE_URL env var is required.')
  console.error('Example: SCREENSHOT_BASE_URL=https://ynab-app-production-89d6.up.railway.app npm run docs:feature-screenshots')
  process.exit(1)
}

const PASSWORD = process.env.SCREENSHOT_PASSWORD ?? 'ScreenshotDemo123'
const OUT_DIR = path.join(process.cwd(), 'docs', 'images')

const FEATURE_PAGES: Array<{ slug: string; path: string; fullPage: boolean }> = [
  { slug: 'feature-dashboard',    path: '/dashboard', fullPage: false },
  { slug: 'feature-settings',     path: '/settings',  fullPage: true  },
  { slug: 'feature-activity-log', path: '/logs',      fullPage: false },
]

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  console.log(`Capturing feature screenshots from ${BASE_URL}`)
  console.log(`Output directory: ${OUT_DIR}`)
  console.log()

  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.setViewportSize({ width: 1280, height: 800 })

  // --- Log in ---
  console.log(`Logging in at ${BASE_URL}/login ...`)
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })

  // Fill password field and submit
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')

  // Wait for redirect to /dashboard after successful login
  await page.waitForURL('**/dashboard', { timeout: 30_000 })
  console.log('  -> logged in, on /dashboard')
  console.log()

  // --- Capture each feature page ---
  for (const { slug, path: pagePath, fullPage } of FEATURE_PAGES) {
    const url = `${BASE_URL}${pagePath}`
    console.log(`Capturing ${url} ${fullPage ? '(fullPage)' : '(viewport)'} ...`)

    await page.goto(url, { waitUntil: 'networkidle' })

    // For activity log, also wait for log entries or empty state to appear
    if (pagePath === '/logs') {
      try {
        // Log rows are divs, not table rows — wait for any activity entry or the empty state message
        await page.waitForSelector('[data-testid="log-row"], .log-entry, h1', { timeout: 10_000 })
      } catch {
        // Page content is already loaded via networkidle — this is just an extra guard
      }
    }

    const outPath = path.join(OUT_DIR, `${slug}.png`)
    await page.screenshot({ path: outPath, fullPage })

    const stats = fs.statSync(outPath)
    const sizeKB = Math.round(stats.size / 1024)
    console.log(`  -> saved ${outPath} (${sizeKB} KB)`)

    if (stats.size < 10_000) {
      console.warn(`  Warning: ${slug}.png is suspiciously small (${sizeKB} KB) — may be blank or error page`)
    }
  }

  await browser.close()
  console.log()
  console.log('Done. Feature screenshots saved to docs/images/')
  console.log()
  console.log('Files:')
  for (const { slug } of FEATURE_PAGES) {
    const outPath = path.join(OUT_DIR, `${slug}.png`)
    const stats = fs.statSync(outPath)
    console.log(`  ${outPath} (${Math.round(stats.size / 1024)} KB)`)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
