#!/usr/bin/env npx tsx
/**
 * Capture headless screenshots of the first-install wizard pages.
 *
 * Prerequisites:
 *   1. Ensure WIZARD_COMPLETE is empty or unset in the Setting table
 *      (so the wizard renders each step rather than redirecting to /login)
 *   2. Have a Next.js dev server running at BASE_URL, or set SCREENSHOT_BASE_URL
 *      to point at a live deployment with wizard state cleared.
 *
 * Usage (local dev server):
 *   npx tsx scripts/capture-wizard-screenshots.ts
 *
 * Usage (against live Railway deployment with wizard state cleared):
 *   SCREENSHOT_BASE_URL=https://ynab-test-production.up.railway.app \
 *   npx tsx scripts/capture-wizard-screenshots.ts
 *
 * Re-runnable: overwrites existing PNGs in docs/images/
 */

import { chromium } from 'playwright'
import path from 'path'
import fs from 'fs'

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:3000'
const OUT_DIR = path.join(process.cwd(), 'docs', 'images')

const PAGES = [
  { slug: 'wizard-step-1', path: '/setup/1' },
  { slug: 'wizard-step-2', path: '/setup/2' },
  { slug: 'wizard-step-3', path: '/setup/3' },
  { slug: 'wizard-step-4', path: '/setup/4' },
  { slug: 'wizard-step-5', path: '/setup/5' },
  { slug: 'wizard-step-6', path: '/setup/6' },
  { slug: 'wizard-done',   path: '/setup/done' },
]

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  console.log(`Capturing wizard screenshots from ${BASE_URL}`)
  console.log(`Output directory: ${OUT_DIR}`)
  console.log()

  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.setViewportSize({ width: 1280, height: 800 })

  for (const { slug, path: pagePath } of PAGES) {
    const url = `${BASE_URL}${pagePath}`
    console.log(`Capturing ${url} ...`)
    await page.goto(url, { waitUntil: 'networkidle' })
    const outPath = path.join(OUT_DIR, `${slug}.png`)
    await page.screenshot({ path: outPath, fullPage: false })
    console.log(`  -> saved ${outPath}`)
  }

  await browser.close()
  console.log()
  console.log('Done. All screenshots saved to docs/images/')
}

main().catch((err) => { console.error(err); process.exit(1) })
