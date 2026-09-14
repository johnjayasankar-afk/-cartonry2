// ---------------------------------------------------------------------------
// Deployment configuration. Everything the owner must fill in lives HERE and
// nowhere else. No secrets belong in this file - the Lemon Squeezy licence API
// is authenticated by the customer's own licence key, not by a store API key,
// so nothing sensitive is ever shipped to the browser.
// ---------------------------------------------------------------------------
export const CONFIG = {
  productName: 'Cartonry',
  tagline: 'Production-ready dielines for standard box styles.',

  // Flip to true only after the store is live and a real test purchase has
  // been made. While false the UI says payments are not open yet and never
  // sends anyone to a checkout that does not exist.
  paymentsLive: false,

  // Lemon Squeezy hosted checkout URL for the licence. Owner pastes this in.
  checkoutUrl: '',

  // Shown on the page and in the licence panel.
  price: { amount: 39, currency: 'USD', label: '$39 one-time' },

  supportEmail: '',            // owner fills in - see docs/owner-checklist.md

  // Merchant of record: 'lemonsqueezy' or 'polar'. Both are MoR (they handle
  // VAT/sales tax) and both expose a browser-callable licence activate/validate
  // flow keyed on the customer's own licence key, so no store secret is shipped.
  provider: 'lemonsqueezy',
  organizationId: '',          // Polar only - ignored for Lemon Squeezy

  // Re-check an activated licence with the provider this often. Between checks
  // the app works offline; past the grace window it asks to reconnect.
  revalidateDays: 7,
  offlineGraceDays: 30,

  // Optional, cookieless, $0 analytics. Left OFF deliberately: with no token
  // the site makes no third-party requests at all. Set provider:'cloudflare'
  // and paste the token to switch it on - see docs/owner-checklist.md.
  // Cloudflare Web Analytics sets no cookies and stores no personal data,
  // which is what privacy.html already describes.
  analytics: { provider: null, token: '' },
};
