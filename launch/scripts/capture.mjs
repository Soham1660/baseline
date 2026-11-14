// Authentic BASELINE footage capture with Playwright.
// Records real browser sessions of the running app (no mocked UI). A small cursor dot is overlaid
// because headless Chromium does not render the OS pointer.
// Usage: node capture.mjs [baseUrl]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2] || 'http://localhost:3100';
const OUT = path.resolve(import.meta.dirname, '../recordings/clips');
const STILLS = path.resolve(import.meta.dirname, '../recordings/stills');
const SAMPLE_VIDEO = path.resolve(import.meta.dirname, '../../public/samples/move-in-sample.mp4');
const ZOOM = 1.3;
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(STILLS, { recursive: true });

const browser = await chromium.launch();
const marks = {};

const CURSOR_JS = (zoom) => `
(() => {
  if (window.__cursor) return;
  const c = document.createElement('div');
  c.style.cssText = 'position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(32,33,31,.85);border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.25);z-index:2147483647;pointer-events:none;transition:transform .12s ease;zoom:${1 / zoom};';
  document.documentElement.appendChild(c);
  window.__cursor = c;
  addEventListener('mousemove', e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
  addEventListener('mousedown', () => { c.style.transform = 'scale(.7)'; }, true);
  addEventListener('mouseup', () => { c.style.transform = 'scale(1)'; }, true);
})();`;

const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (n) => !ONLY || ONLY.includes(n);
async function newClip(name, { viewport = { width: 1920, height: 1080 }, zoom = ZOOM } = {}) {
  const ctx = await browser.newContext({
    viewport,
    recordVideo: { dir: OUT, size: viewport },
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  const t0 = Date.now();
  marks[name] = [];
  const mark = (label) => marks[name].push({ label, t: +((Date.now() - t0) / 1000).toFixed(2) });
  await page.addInitScript(`document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='html{zoom:${zoom}} ::-webkit-scrollbar{display:none}';document.head.appendChild(s);});`);
  page.on('load', () => page.evaluate(CURSOR_JS(zoom)).catch(() => {}));
  const helpers = {
    mark,
    async move(locator, { steps = 28, dx = 0, dy = 0 } = {}) {
      const box = await locator.boundingBox();
      if (!box) throw new Error('no box for locator');
      await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps });
    },
    async click(locator, opts) {
      await helpers.move(locator, opts);
      await page.waitForTimeout(250);
      await page.mouse.down();
      await page.waitForTimeout(90);
      await page.mouse.up();
    },
    async scrollBy(dy, ms = 1400) {
      await page.evaluate(([dy, ms]) => new Promise((res) => {
        const start = scrollY; const t0 = performance.now();
        const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
        const step = (now) => {
          const p = Math.min(1, (now - t0) / ms);
          scrollTo(0, start + dy * ease(p));
          p < 1 ? requestAnimationFrame(step) : res();
        };
        requestAnimationFrame(step);
      }), [dy, ms]);
    },
    async scrollToText(text, offset = 160, ms = 1400) {
      const y = await page.getByText(text).first().evaluate((el, off) => el.getBoundingClientRect().top - off, offset);
      await helpers.scrollBy(y, ms);
    },
  };
  return { ctx, page, ...helpers };
}

async function finish(name, ctx, page) {
  const video = page.video();
  await ctx.close();
  const src = await video.path();
  fs.renameSync(src, path.join(OUT, `${name}.webm`));
  console.log('recorded', name);
}

// c01 — Landing → open sample
if (want('c01-landing')) {
  const name = 'c01-landing';
  const { ctx, page, mark, click, move } = await newClip(name);
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.mouse.move(1400, 700);
  mark('landing-ready');
  await page.waitForTimeout(1800);
  await move(page.getByText('Explore Sample Apartment').first());
  await page.waitForTimeout(400);
  mark('click-explore');
  await click(page.getByText('Explore Sample Apartment').first(), { steps: 2 });
  await page.waitForTimeout(2200);
  mark('overview');
  await finish(name, ctx, page);
}

// c02 — Move-in timeline: play footage, jump to timestamped findings
if (want('c02-movein')) {
  const name = 'c02-movein';
  const { ctx, page, mark, click, scrollBy } = await newClip(name);
  await page.goto(`${BASE}/?autostart=1`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Move-In', exact: true }).first().click();
  await page.waitForTimeout(800);
  await scrollBy(250, 10);
  await page.mouse.move(900, 600);
  mark('movein-ready');
  await page.waitForTimeout(800);
  await click(page.getByRole('button', { name: 'Play video' }));
  mark('play');
  await page.waitForTimeout(3200);
  await click(page.getByText('00:04.8').first());
  mark('jump-04.8');
  await page.waitForTimeout(2200);
  await click(page.getByText('00:10.2').first());
  mark('jump-10.2');
  await page.waitForTimeout(2200);
  await finish(name, ctx, page);
}

// c03 — Human review: confirm a needs-review finding, open edit
if (want('c03-review')) {
  const name = 'c03-review';
  const { ctx, page, mark, click, scrollBy, move } = await newClip(name);
  await page.goto(`${BASE}/?autostart=1`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Move-In', exact: true }).first().click();
  await page.waitForTimeout(800);
  await scrollBy(250, 10);
  await page.mouse.move(1500, 500);
  mark('review-ready');
  await page.waitForTimeout(900);
  const confirmBtn = page.getByRole('button', { name: 'Confirm', exact: true }).first();
  await move(confirmBtn);
  await page.waitForTimeout(500);
  mark('click-confirm');
  await click(confirmBtn, { steps: 2 });
  await page.waitForTimeout(1600);
  const editBtn = page.getByRole('button', { name: 'Edit', exact: true }).nth(1);
  await click(editBtn);
  mark('edit-open');
  await page.waitForTimeout(2200);
  await finish(name, ctx, page);
}

// c04 — Move-in vs move-out comparison
if (want('c04-compare')) {
  const name = 'c04-compare';
  const { ctx, page, mark, scrollToText, scrollBy } = await newClip(name);
  await page.goto(`${BASE}/?autostart=1`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Compare', exact: true }).first().click();
  await page.waitForTimeout(800);
  await page.mouse.move(1700, 300);
  mark('compare-ready');
  await page.waitForTimeout(1600);
  await scrollToText('Lower west wall baseboard', 150, 2200);
  mark('potentially-new');
  await page.waitForTimeout(3500);
  await scrollBy(320, 1500);
  mark('caveat');
  await page.waitForTimeout(2000);
  await finish(name, ctx, page);
}

// c05 — Claim-to-evidence match
if (want('c05-claims')) {
  const name = 'c05-claims';
  const { ctx, page, mark, scrollToText, move } = await newClip(name);
  await page.goto(`${BASE}/?autostart=1`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Claims', exact: true }).first().click();
  await page.waitForTimeout(800);
  await page.mouse.move(1500, 400);
  mark('claims-ready');
  await page.waitForTimeout(1200);
  await scrollToText('Precomputed sample match', 120, 1800);
  mark('claim-card');
  await page.waitForTimeout(1500);
  await move(page.getByText('Evidence suggests pre-existing condition').first());
  await page.waitForTimeout(1500);
  await scrollToText('Evidence Assessment', 140, 1600);
  mark('assessment');
  await page.waitForTimeout(2600);
  await finish(name, ctx, page);
}

// c06 — Reconsideration letter: edit by hand
if (want('c06-letter')) {
  const name = 'c06-letter';
  const { ctx, page, mark, click, scrollBy } = await newClip(name);
  await page.goto(`${BASE}/?autostart=1`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Claims', exact: true }).first().click();
  await page.waitForTimeout(600);
  await page.mouse.move(1500, 300);
  mark('claims-top');
  await page.waitForTimeout(700);
  await click(page.getByRole('button', { name: /Draft Reconsideration Request/ }));
  await page.waitForTimeout(1200);
  mark('letter');
  const ta = page.locator('textarea').first();
  await ta.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(1500);
  await ta.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await click(ta, { dy: 60 });
  await page.keyboard.press('Meta+ArrowDown');
  await page.keyboard.press('Control+End');
  mark('typing');
  await page.keyboard.type('\n\nI am happy to walk through the timestamped footage together.', { delay: 38 });
  await page.waitForTimeout(1800);
  await finish(name, ctx, page);
}

// c07 — Report + PDF export
if (want('c07-report')) {
  const name = 'c07-report';
  const { ctx, page, mark, click, scrollBy } = await newClip(name);
  await page.goto(`${BASE}/?autostart=1`, { waitUntil: 'networkidle' });
  await page.mouse.move(1300, 500);
  await page.waitForTimeout(500);
  await click(page.getByRole('button', { name: 'Export Report' }).first());
  await page.waitForTimeout(1000);
  mark('report');
  await scrollBy(700, 2400);
  await page.waitForTimeout(600);
  await scrollBy(-700, 1200);
  await page.waitForTimeout(400);
  const dlBtn = page.getByRole('button', { name: /Download Evidence PDF/ });
  const dlP = page.waitForEvent('download');
  await click(dlBtn);
  mark('download-click');
  const dl = await dlP;
  await dl.saveAs(path.join(STILLS, 'sample-report.pdf'));
  await page.waitForTimeout(2200);
  mark('downloaded');
  await finish(name, ctx, page);
}

// c08 — New apartment + real upload with SHA-256 fingerprint (stops before analysis result)
if (want('c08-upload')) {
  const name = 'c08-upload';
  const { ctx, page, mark, click } = await newClip(name);
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.mouse.move(1300, 500);
  await page.waitForTimeout(600);
  await click(page.getByRole('button', { name: 'Create Apartment Record' }).first());
  await page.waitForTimeout(600);
  mark('modal');
  await page.locator('#apt-unit-name').click();
  await page.keyboard.type('418 Telegraph Ave, Apt 3A', { delay: 30 });
  await page.locator('#apt-city-state').click();
  await page.keyboard.type('Berkeley, CA', { delay: 30 });
  await page.locator('#apt-deposit').click({ clickCount: 3 });
  await page.keyboard.type('2400', { delay: 40 });
  await click(page.getByRole('button', { name: 'Create Record' }));
  await page.waitForTimeout(1200);
  mark('created');
  await click(page.getByRole('button', { name: 'Move-In', exact: true }).first());
  await page.waitForTimeout(900);
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    click(page.getByText(/Select Video File/).first()),
  ]);
  await chooser.setFiles(SAMPLE_VIDEO);
  mark('file-selected');
  await page.getByText('SHA-256').first().waitFor({ timeout: 30000 });
  mark('fingerprint');
  await page.waitForTimeout(2500);
  await finish(name, ctx, page);
}

// Crisp 2x stills for zoom-ins (desktop) and native vertical (mobile)
if (want('stills')) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${STILLS}/d-landing.png` });
  await page.goto(`${BASE}/?autostart=1`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${STILLS}/d-overview.png`, fullPage: true });
  for (const [tab, file] of [['Move-In', 'd-movein'], ['Move-Out', 'd-moveout'], ['Compare', 'd-compare'], ['Claims', 'd-claims']]) {
    await page.getByRole('button', { name: tab, exact: true }).first().click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${STILLS}/${file}.png`, fullPage: true });
  }
  await page.getByRole('button', { name: /Draft Reconsideration Request/ }).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${STILLS}/d-letter.png`, fullPage: true });
  await page.getByRole('button', { name: 'Export Report' }).first().click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${STILLS}/d-report.png`, fullPage: true });
  await ctx.close();
}
if (want('stills')) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${STILLS}/m-landing.png`, fullPage: true });
  await page.goto(`${BASE}/?autostart=1`, { waitUntil: 'networkidle' });
  for (const [tab, file] of [['Move-In', 'm-movein'], ['Compare', 'm-compare'], ['Claims', 'm-claims']]) {
    await page.getByRole('button', { name: tab, exact: true }).first().click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${STILLS}/${file}.png`, fullPage: true });
  }
  await page.getByRole('button', { name: /Draft Reconsideration Request/ }).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${STILLS}/m-letter.png`, fullPage: true });
  await page.getByRole('button', { name: 'Export Report' }).first().click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${STILLS}/m-report.png`, fullPage: true });
  await ctx.close();
}

const mp = path.join(OUT, 'marks.json');
const prev = fs.existsSync(mp) ? JSON.parse(fs.readFileSync(mp, 'utf8')) : {};
fs.writeFileSync(mp, JSON.stringify({ ...prev, ...marks }, null, 2));
await browser.close();
console.log(JSON.stringify(marks));
