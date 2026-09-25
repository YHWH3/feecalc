/** SEO/structured-data helpers — server-side only, imported by pages/layouts. */

export const SITE_NAME = 'FeeCalc';

export function canonicalUrl(site: URL | undefined, path: string): string {
  const base = site ?? new URL('https://feecalc.com');
  return new URL(path, base).toString();
}

export function websiteJsonLd(site: URL | undefined): Record<string, unknown> {
  const base = (site ?? new URL('https://feecalc.com')).toString().replace(/\/$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: base,
  };
}

export function webApplicationJsonLd(
  site: URL | undefined,
  description: string,
): Record<string, unknown> {
  const base = (site ?? new URL('https://feecalc.com')).toString().replace(/\/$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: `${SITE_NAME} — Payment Fee & Gross-Up Calculator`,
    url: base,
    description,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
}
