import { siteConfig } from '../data/site';

/** True when a real GA4 Measurement ID is configured */
export function isGoogleAnalyticsConfigured(): boolean {
  const id = (siteConfig.googleAnalyticsId || '').trim();
  if (!id) return false;
  if (/X{4,}|YOUR_|REPLACE|000000/i.test(id)) return false;
  return /^G-[A-Z0-9]+$/i.test(id);
}

export function getGoogleAnalyticsId(): string {
  return isGoogleAnalyticsConfigured() ? siteConfig.googleAnalyticsId.trim() : '';
}
