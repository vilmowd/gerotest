import { siteConfig } from '../data/site';

/** True when a real publisher ID is configured (not a placeholder). */
export function isAdSenseConfigured(): boolean {
  const id = (siteConfig.adsenseClient || '').trim();
  if (!id) return false;
  if (/X{4,}|YOUR_|REPLACE|0000000000/i.test(id)) return false;
  return /^ca-pub-\d{10,20}$/i.test(id);
}

export function getAdSenseClient(): string {
  return isAdSenseConfigured() ? siteConfig.adsenseClient.trim() : '';
}

/** ads.txt line Google expects when you are a DIRECT seller */
export function getAdsTxtLine(): string {
  const client = getAdSenseClient();
  if (!client) return '';
  const pub = client.replace(/^ca-/i, '');
  return `google.com, ${pub}, DIRECT, f08c47fec0942fa0`;
}
