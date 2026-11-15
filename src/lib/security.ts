/** HTTPS-only, no credentials, no dangerous schemes — for iframes & outbound links */
export function isSafeEmbedUrl(raw: string | null | undefined): boolean {
  if (!raw || typeof raw !== 'string') return false;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'https:') return false;
    if (url.username || url.password) return false;
    if (!url.hostname || url.hostname.includes('..')) return false;
    // Block localhost / private IP embeds in production pages
    if (isPrivateHostname(url.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

export function isSafeImageUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  if (raw.startsWith('/') && !raw.startsWith('//')) return true;
  return isSafeEmbedUrl(raw);
}

function isPrivateHostname(host: string): boolean {
  const h = host.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h === '0.0.0.0') return true;
  if (h === '::1' || h === '[::1]') return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;
  const parts = m.slice(1).map(Number);
  if (parts.some((n) => n > 255)) return true;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/** Escape for safe inclusion in HTML text / attributes when building strings */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Google AdSense + related consent / measurement hosts */
const ADSENSE_SCRIPT = [
  'https://pagead2.googlesyndication.com',
  'https://www.googletagservices.com',
  'https://www.googletagmanager.com',
  'https://www.google.com',
  'https://www.gstatic.com',
  'https://partner.googleadservices.com',
  'https://fundingchoicesmessages.google.com',
  'https://ep1.adtrafficquality.google',
  'https://ep2.adtrafficquality.google',
].join(' ');

const ADSENSE_CONNECT = [
  'https://pagead2.googlesyndication.com',
  'https://googleads.g.doubleclick.net',
  'https://www.google.com',
  'https://www.google-analytics.com',
  'https://analytics.google.com',
  'https://region1.google-analytics.com',
  'https://www.googletagmanager.com',
  'https://fundingchoicesmessages.google.com',
  'https://ep1.adtrafficquality.google',
  'https://ep2.adtrafficquality.google',
].join(' ');

/** Content-Security-Policy for Geroforge (static portal + HTTPS games + optional AdSense) */
export function buildContentSecurityPolicy(): string {
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    // 'unsafe-inline' kept for AdSense boot snippets + tiny UI helpers; scripts otherwise self/Google
    `script-src 'self' 'unsafe-inline' ${ADSENSE_SCRIPT}`,
    "style-src 'self' 'unsafe-inline' https://www.gstatic.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' https://fonts.gstatic.com https://www.gstatic.com",
    `connect-src 'self' ${ADSENSE_CONNECT}`,
    "media-src 'self' https: blob:",
    "worker-src 'self' blob:",
    "child-src 'self' https: blob:",
    "frame-src https:",
    "form-action 'self'",
    // frame-ancestors is ignored in <meta>; keep it only in HTTP headers (public/_headers)
    "upgrade-insecure-requests",
  ];
  return directives.join('; ');
}
