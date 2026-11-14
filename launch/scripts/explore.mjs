// Exploration pass: screenshot every BASELINE screen (desktop + mobile) against a running server.
// Usage: node explore.mjs [baseUrl]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2] || 'http://localhost:3100';
const OUT = path.resolve(import.meta.dirname, '../recordings/explore');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const errors = [];

async function run(label, viewport, isMobile = false) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: isMobile ? 3 : 1, isMobile, hasTouch: isMobile });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${label}] console: ${m.text()}`); });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${label}-01-landing.png`, fullPage: true });
  await page.getByText('Explore Sample Apartment').first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${label}-02-overview.png`, fullPage: true });
  const tabs = ['Move-In', 'Move-Out', 'Compare', 'Claims'];
  let i = 3;
  for (const t of tabs) {
    await page.getByRole('button', { name: t, exact: true }).first().click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/${label}-0${i++}-${t.toLowerCase()}.png`, fullPage: true });
  }
  await ctx.close();
}

await run('desktop', { width: 1920, height: 1080 });
await run('mobile', { width: 390, height: 844 }, true);
await browser.close();
console.log(errors.length ? errors.join('\n') : 'no page errors');
