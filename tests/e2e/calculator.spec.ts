import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('calculator — golden path', () => {
  test('reverse: target → minimum charge with breakdown', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Amount you want to receive').fill('1000');

    const main = page.locator('#result-main');
    await expect(main).toHaveText('$1,030.17');

    const breakdown = page.locator('#breakdown');
    await expect(breakdown).toContainText('You want to receive');
    await expect(breakdown).toContainText('$1,000.00');
    await expect(breakdown).toContainText('Total processing fee');
    await expect(breakdown).toContainText('$30.17');
    await expect(breakdown).toContainText('Effective fee rate');
    await expect(breakdown).toContainText('2.93%');
  });

  test('forward mode: charge → net received', async ({ page }) => {
    await page.goto('/');
    // The radio is covered by its wrapping label — click it as a user does.
    await page.locator('label', { hasText: 'I plan to charge' }).click();
    await page.getByLabel('Amount you plan to charge').fill('1030.17');

    await expect(page.locator('#result-main')).toHaveText('$1,000.00');
    await expect(page.locator('#result-label')).toHaveText('You receive');
  });

  test('preset change updates fee fields and result', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Amount you want to receive').fill('1000');

    await page.locator('#preset').selectOption('paypal-us-checkout');
    await expect(page.locator('#pct')).toHaveValue('3.49');
    await expect(page.locator('#fixed')).toHaveValue('0.49');
    await expect(page.locator('#result-main')).toHaveText('$1,036.67');

    // preset meta shows the source + verified date
    await expect(page.locator('#preset-meta')).toContainText('verified 2026-09-25');
    await expect(page.locator('#preset-meta a')).toHaveAttribute('href', /paypal\.com/);
  });

  test('editing a preset number converts to custom', async ({ page }) => {
    await page.goto('/');
    await page.locator('#pct').fill('5');
    await expect(page.locator('#preset')).toHaveValue('custom');
  });

  test('custom fee: no preset needed', async ({ page }) => {
    await page.goto('/');
    await page.locator('#preset').selectOption('custom');
    await page.locator('#pct').fill('5');
    await page.locator('#fixed').fill('1');
    await page.getByLabel('Amount you want to receive').fill('100');
    await expect(page.locator('#result-main')).toHaveText('$106.32');
  });

  test('invalid inputs show errors, never a wrong result', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Amount you want to receive').fill('-50');
    await expect(page.locator('#amount-error')).toBeVisible();
    await expect(page.locator('#result')).toBeHidden();

    await page.getByLabel('Amount you want to receive').fill('10.999');
    await expect(page.locator('#amount-error')).toContainText('decimals');

    await page.locator('#pct').fill('150');
    await page.getByLabel('Amount you want to receive').fill('100');
    await expect(page.locator('#pct-error')).toBeVisible();
  });

  test('copy amount writes the charge to the clipboard', async ({
    page,
    context,
    browserName,
  }) => {
    // Clipboard permissions are a Chromium concept; FF/WebKit reject the grant.
    if (browserName === 'chromium') {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    }
    await page.goto('/');
    await page.getByLabel('Amount you want to receive').fill('1000');
    await page.locator('#copy').click();
    await expect(page.locator('#copy')).toHaveText('Copied');
    // Reading the clipboard back is only permitted by Chromium.
    if (browserName === 'chromium') {
      const clip = await page.evaluate(() => navigator.clipboard.readText());
      expect(clip).toBe('1030.17');
    }
  });

  test('URL state round-trips a configured calculation', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Amount you want to receive').fill('250');
    await page.waitForFunction(() => window.location.search.includes('amt=250'));
    await page.reload();
    await expect(page.getByLabel('Amount you want to receive')).toHaveValue('250');
    await expect(page.locator('#result-main')).toHaveText('$257.78');
  });

  test('garbage URL params fall back to defaults', async ({ page }) => {
    await page.goto('/?mode=bogus&cur=XX&pre=zzz&amt=abc');
    await expect(page.getByLabel('Amount you want to receive')).toHaveValue('abc');
    await expect(page.locator('#amount-error')).toBeVisible();
    // invalid preset ignored → default stripe preset
    await expect(page.locator('#preset')).toHaveValue('stripe-us-domestic');
  });
});

test.describe('SEO + accessibility', () => {
  test('has meta, canonical, robots and JSON-LD', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Payment Fee .*Calculator/i);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/$/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.+/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /.+/);
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(ld.join('')).toContain('WebApplication');
  });

  test('robots.txt serves sitemap reference', async ({ page }) => {
    const res = await page.goto('/robots.txt');
    expect(await res?.text()).toContain('Sitemap:');
  });

  test('passes axe on desktop + mobile', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Amount you want to receive').fill('1000');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
