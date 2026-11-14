// Functional verification of the real BASELINE user flow against a running server.
// Makes NO successful Gemini calls when the server has no key; with a key it makes exactly one analyze call.
// Usage: node verify.mjs [baseUrl]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2] || 'http://localhost:3100';
const OUT = path.resolve(import.meta.dirname, '../recordings/verify');
const SAMPLE = path.resolve(import.meta.dirname, '../../public/samples/move-in-sample.mp4');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

const health = await (await fetch(`${BASE}/api/health`)).json();
check('Health endpoint', health.ok === true, `hasGeminiKey=${health.hasGeminiKey} model=${health.primaryModel}`);

await page.goto(BASE, { waitUntil: 'networkidle' });
check('Homepage loads with hero', await page.getByText('Your apartment.').first().isVisible());

// 1. Create apartment
await page.getByRole('button', { name: 'Create Apartment Record' }).first().click();
await page.fill('#apt-unit-name', '100 Example St, Apt 1 (QA test)');
await page.fill('#apt-city-state', 'Berkeley, CA');
await page.fill('#apt-deposit', '1800');
await page.fill('#apt-landlord', 'Example Property Management');
await page.getByRole('button', { name: 'Create Record' }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/01-created.png` });
check('Apartment creation navigates to overview', await page.getByText('100 Example St').first().isVisible());

// 2. Upload move-in video
await page.getByRole('button', { name: 'Move-In', exact: true }).first().click();
await page.waitForTimeout(500);
const [chooser] = await Promise.all([
  page.waitForEvent('filechooser'),
  page.getByText(/Select Video File|Upload Video/).first().click(),
]);
const analyzeResp = page.waitForResponse((r) => r.url().includes('/api/analyze-video'), { timeout: 180000 }).catch(() => null);
await chooser.setFiles(SAMPLE);
await page.getByText('SHA-256').first().waitFor({ timeout: 30000 });
check('Video upload + SHA-256 fingerprint shown', true);
const t0 = Date.now();
const ar = await analyzeResp;
const analyzeMs = Date.now() - t0;
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/02-after-analyze.png`, fullPage: true });
if (!ar) {
  check('Analyze call issued', false, 'no /api/analyze-video request observed');
} else {
  const body = await ar.json().catch(() => ({}));
  if (ar.ok()) {
    check('Live Gemini analysis', true, `model=${body.model} observations=${body.observations?.length} in ${analyzeMs}ms`);
    fs.writeFileSync(`${OUT}/live-analysis.json`, JSON.stringify(body, null, 2));
  } else {
    check('Analysis failure handled gracefully (no live key)', ar.status() >= 400 && typeof body.error === 'string', `HTTP ${ar.status()} code=${body.code}: ${body.error}`);
    const retryVisible = await page.getByText('Retry Analysis').first().isVisible().catch(() => false);
    check('Retry affordance + preserved video after failure', retryVisible);
  }
}

// 3. Manual observation (human review path that works without Gemini)
await page.getByRole('button', { name: /Mark Observation at/ }).first().click();
await page.fill('input[placeholder="Room (e.g., Bedroom)"]', 'Living Room');
await page.fill('input[placeholder="Object / Surface"]', 'Oak floor near baseboard');
await page.fill('textarea[placeholder^="Describe the visible condition"]', 'Two short diagonal scuffs visible on floor planks (QA manual entry).');
await page.getByRole('button', { name: 'Save Observation' }).click();
await page.waitForTimeout(500);
check('Manual timestamped observation saved', await page.getByText('Oak floor near baseboard').first().isVisible());
await page.screenshot({ path: `${OUT}/03-manual-observation.png`, fullPage: true });

// 4. Persistence across reload (browser storage)
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);
check('Record persists across page reload (localStorage)', await page.getByText('100 Example St').first().isVisible());

// 5. Sample flow: comparison, claims, letter, PDF
await page.getByText('Explore Sample Apartment').first().click();
await page.getByRole('button', { name: 'Compare', exact: true }).first().click();
await page.waitForTimeout(600);
check('Comparison view renders classifications', await page.getByText('Potentially new').first().isVisible());
await page.getByRole('button', { name: 'Claims', exact: true }).first().click();
await page.waitForTimeout(600);
check('Claim matcher shows matched deduction', await page.getByText('Bedroom wall repair').first().isVisible());
await page.getByRole('button', { name: /Draft Reconsideration Request/ }).click();
await page.waitForTimeout(800);
const letter = await page.locator('textarea').first().inputValue();
check('Reconsideration letter is editable and populated', letter.length > 200, `${letter.length} chars`);
await page.locator('textarea').first().press('End');
await page.screenshot({ path: `${OUT}/04-letter.png`, fullPage: true });
await page.getByRole('button', { name: 'Export Report' }).first().click();
await page.waitForTimeout(800);
const [dl] = await Promise.all([
  page.waitForEvent('download', { timeout: 30000 }),
  page.getByRole('button', { name: /Download Evidence PDF/ }).click(),
]);
const pdfPath = `${OUT}/${dl.suggestedFilename()}`;
await dl.saveAs(pdfPath);
const pdfHead = fs.readFileSync(pdfPath).subarray(0, 5).toString();
check('Evidence PDF downloads', pdfHead === '%PDF-', `${path.basename(pdfPath)} ${fs.statSync(pdfPath).size} bytes`);
await page.screenshot({ path: `${OUT}/05-report.png`, fullPage: true });

// 6. Unknown API route
const r404 = await fetch(`${BASE}/api/does-not-exist`);
check('Unknown /api route returns JSON 404', r404.status === 404 && (await r404.json()).error !== undefined);

check('No uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '));
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify({ base: BASE, at: new Date().toISOString(), health, results }, null, 2));
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
