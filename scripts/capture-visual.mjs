import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const baseUrl = process.env.ALEPH_CAPTURE_URL ?? 'http://127.0.0.1:4173/';
const revision = process.env.GITHUB_HEAD_SHA || process.env.GITHUB_SHA || 'local';
const outDir = process.env.ALEPH_CAPTURE_DIR ?? 'artifacts/visual';

const cases = [
  { name: 'desktop-normal', viewport: { width: 1280, height: 900 }, reducedMotion: 'no-preference' },
  { name: 'mobile-normal', viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' },
  { name: 'desktop-reduced-motion', viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' },
  { name: 'mobile-reduced-motion', viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' },
];

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const manifest = { revision, route: '/', generated_at: new Date().toISOString(), cases: [] };

try {
  for (const captureCase of cases) {
    const context = await browser.newContext({
      viewport: captureCase.viewport,
      reducedMotion: captureCase.reducedMotion,
    });

    await context.route('**/*', async route => {
      const url = route.request().url();
      if (/generativelanguage|googleapis|googleusercontent/.test(url)) {
        await route.abort();
        return;
      }
      await route.continue();
    });

    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    // The initial story state is repository-owned and deterministic. Clicking its
    // visible text finishes progressive disclosure without invoking a player action.
    const story = page.locator('main').first();
    if (await story.count()) {
      await story.click({ position: { x: 20, y: 120 } }).catch(() => {});
    }
    await page.waitForTimeout(captureCase.reducedMotion === 'reduce' ? 250 : 1800);

    const bodyText = await page.locator('body').innerText();
    if (!bodyText.includes('To forget is to kill her again.')) {
      throw new Error(`Expected initial choice in rendered body for ${captureCase.name}`);
    }
    if ((await page.title()) !== 'The Aleph: Infinite Borges') {
      throw new Error(`Expected Aleph document title for ${captureCase.name}`);
    }

    const currentDate = page.getByText('February 15, 1929', { exact: true }).first();
    if (!(await currentDate.isVisible())) {
      throw new Error(`Expected full narrative date to remain visible for ${captureCase.name}`);
    }

    const layout = await page.evaluate(() => ({
      document_width: document.documentElement.scrollWidth,
      viewport_width: document.documentElement.clientWidth,
    }));
    if (layout.document_width > layout.viewport_width) {
      throw new Error(
        `Unexpected document overflow for ${captureCase.name}: ${layout.document_width}px > ${layout.viewport_width}px`,
      );
    }

    const file = `${outDir}/${captureCase.name}.png`;
    await page.screenshot({ path: file, fullPage: true });
    manifest.cases.push({
      name: captureCase.name,
      viewport: captureCase.viewport,
      reduced_motion: captureCase.reducedMotion,
      file,
      narrative_date: 'February 15, 1929',
      document_width: layout.document_width,
      viewport_width: layout.viewport_width,
    });
    await context.close();
  }
} finally {
  await browser.close();
}

await writeFile(`${outDir}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Captured ${manifest.cases.length} browser states for ${revision}`);
