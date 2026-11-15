/**
 * Operator identity — replace placeholders before production / AdSense application.
 * Legal pages and ads.txt read from these values.
 */
export const siteConfig = {
  name: 'Geroforge',
  legalName: 'Geroforge',
  tagline: 'The best free HTML5 games on the web',
  description:
    'Geroforge is a family-oriented, general-audience HTML5 game portal. Play free browser games with search, categories, and clear how-to guides—no downloads required. Not directed to children under 13.',
  url: process.env.SITE_URL || 'https://example.com',
  /** Governing law jurisdiction for Terms (update to your real location) */
  governingLaw: 'the laws of the jurisdiction in which the site operator resides',
  twitter: '@geroforge',
  /**
   * Google AdSense client ID, e.g. ca-pub-1234567890123456
   * Leave the placeholder until you have a real ID — ad code will not load.
   */
  adsenseClient: 'ca-pub-XXXXXXXXXXXXXXXX',
  /** Optional AdSense ad unit slot IDs from your AdSense → Ads → Ad units */
  adsenseSlots: {
    gameSidebar: '',
    homeInFeed: '',
  },
  /**
   * Google Analytics 4 Measurement ID, e.g. G-XXXXXXXXXX
   * Leave empty / placeholder until configured — GA will not load.
   */
  googleAnalyticsId: 'G-XXXXXXXXXX',
  /** Google Tag Manager container, loaded on every page */
  gtmId: 'GTM-PQLV9WP4',
  gamemonetizeId: 'YOUR_GAMEMONETIZE_PUBLISHER_ID',
  /** Audience positioning for policy & COPPA alignment */
  audience: 'general',
  minimumRecommendedAge: 13,
};
