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

async function blockGeneration(context) {
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (/generativelanguage|googleapis|googleusercontent/.test(url)) {
      await route.abort();
      return;
    }
    await route.continue();
  });
}

try {
  for (const captureCase of cases) {
    const context = await browser.newContext({
      viewport: captureCase.viewport,
      reducedMotion: captureCase.reducedMotion,
    });

    await blockGeneration(context);

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

    const layout = await page.evaluate(() => {
      const viewportWidth = document.documentElement.clientWidth;
      const offenders = [...document.querySelectorAll('*')]
        .map(element => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName.toLowerCase(),
            class_name: typeof element.className === 'string' ? element.className : '',
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          };
        })
        .filter(item => item.right > viewportWidth + 1 || item.left < -1)
        .sort((a, b) => b.right - a.right)
        .slice(0, 8);

      return {
        document_width: document.documentElement.scrollWidth,
        viewport_width: viewportWidth,
        offenders,
      };
    });
    if (layout.document_width > layout.viewport_width) {
      throw new Error(
        `Unexpected document overflow for ${captureCase.name}: ${layout.document_width}px > ${layout.viewport_width}px; offenders=${JSON.stringify(layout.offenders)}`,
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

  // Force the live generation boundary to fail and record what the player actually sees.
  // This case is intentionally behavioral: it protects the recovery state, not Gemini.
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  await blockGeneration(context);
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const input = page.getByLabel('Free-form action');
  await input.fill('Inspect the cellar door');
  await page.getByLabel('Submit free-form action').click();
  const retry = page.getByText('Try to regain composure...', { exact: true });
  await retry.waitFor({ state: 'visible', timeout: 15000 });
  const errorBody = await page.locator('body').innerText();
  const playerActionOccurrences = errorBody.split('I decided to: Inspect the cellar door').length - 1;
  const file = `${outDir}/mobile-generation-error.png`;
  await page.screenshot({ path: file, fullPage: true });
  manifest.cases.push({
    name: 'mobile-generation-error',
    viewport: { width: 390, height: 844 },
    reduced_motion: 'reduce',
    file,
    retry_label: 'Try to regain composure...',
    explicit_error_message: false,
    player_action_occurrences: playerActionOccurrences,
  });
  await context.close();
} finally {
  await browser.close();
}

await writeFile(`${outDir}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Captured ${manifest.cases.length} browser states for ${revision}`);
