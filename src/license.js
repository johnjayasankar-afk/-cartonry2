// ---------------------------------------------------------------------------
// Licence handling - provider agnostic.
//
// Entitlement is granted ONLY when the payment provider's own API confirms an
// active licence key. Reaching a success page grants nothing: the key is issued
// by the provider when an order completes, and every unlock is checked against
// their record. Activation binds the key to this browser, so the provider
// enforces the activation limit centrally.
//
// Two merchant-of-record providers are supported. Both expose an activate /
// validate / deactivate flow that is callable from a browser using the
// customer's own licence key as the credential, so no store secret is ever
// shipped to the client. Pick one in src/config.js.
//
// This is client-side software: a determined developer can patch any local
// check. That is true of all downloadable tools and is an accepted trade-off at
// this price point. It is documented rather than pretended away.
// ---------------------------------------------------------------------------
import { CONFIG } from './config.js';

const KEY = 'cartonry.licence.v1';
const DAY = 86400000;

/* --------------------------------------------------------------- adapters */
const ADAPTERS = {
  lemonsqueezy: {
    base: 'https://api.lemonsqueezy.com/v1/licenses',
    json: false,                       // form-encoded
    body: (op, s) => op === 'activate'
      ? { license_key: s.key, instance_name: s.name }
      : { license_key: s.key, instance_id: s.instanceId },
    readActivate: (d) => ({ ok: !!(d && d.activated && d.instance && d.instance.id),
                            instanceId: d && d.instance && d.instance.id, error: err(d) }),
    readValidate: (d) => ({ valid: !!(d && d.valid), error: err(d) }),
  },
  polar: {
    base: 'https://api.polar.sh/v1/customer-portal/license-keys',
    json: true,
    body: (op, s) => op === 'activate'
      ? { key: s.key, organization_id: CONFIG.organizationId, label: s.name }
      : { key: s.key, organization_id: CONFIG.organizationId, activation_id: s.instanceId },
    readActivate: (d) => ({ ok: !!(d && d.id), instanceId: d && d.id, error: err(d) }),
    // Polar returns the licence-key object; anything but "granted" is not valid.
    readValidate: (d) => ({ valid: !!(d && (d.status === 'granted' || d.valid === true)),
                            error: err(d) }),
  },
};
const err = (d) => (d && (d.error || d.detail || d.status)) || '';
const adapter = () => ADAPTERS[CONFIG.provider] || ADAPTERS.lemonsqueezy;

/* ----------------------------------------------------------------- storage */
export const readStore = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
};
const writeStore = (v) => {
  try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); }
  catch { /* private mode - the licence simply will not persist */ }
};

/* --------------------------------------------------------------- transport */
let transport = defaultTransport;
export const setTransport = (fn) => { transport = fn || defaultTransport; };

async function defaultTransport(op, body) {
  const a = adapter();
  const res = await fetch(`${a.base}/${op}`, {
    method: 'POST',
    headers: a.json
      ? { Accept: 'application/json', 'Content-Type': 'application/json' }
      : { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: a.json ? JSON.stringify(body) : new URLSearchParams(body).toString(),
  });
  return res.json();
}

const clean = (k) => String(k || '').trim();

/* ------------------------------------------------------------------- api */

/** Bind a licence key to this browser. Returns {ok, message}. */
export async function activate(licenceKey, instanceName = 'browser') {
  const key = clean(licenceKey);
  if (!key) return { ok: false, message: 'Enter your licence key.' };
  const a = adapter();
  let data;
  try {
    data = await transport('activate', a.body('activate', { key, name: instanceName }));
  } catch {
    return { ok: false, message: 'Could not reach the licence server. Check your connection and try again.' };
  }
  const r = a.readActivate(data);
  if (r.ok) {
    writeStore({ key, instanceId: r.instanceId, checkedAt: Date.now(), valid: true });
    return { ok: true, message: 'Licence activated. All box styles are unlocked.' };
  }
  return { ok: false, message: humanError(r.error) };
}

/** Re-check with the provider. Called on load, throttled by revalidateDays. */
export async function refresh({ force = false } = {}) {
  const s = readStore();
  if (!s) return { licensed: false };
  const age = Date.now() - (s.checkedAt || 0);
  if (!force && age < CONFIG.revalidateDays * DAY) return { licensed: !!s.valid, cached: true };

  const a = adapter();
  let data;
  try {
    data = await transport('validate', a.body('validate', { key: s.key, instanceId: s.instanceId }));
  } catch {
    // Offline: honour the last good check for the grace window, then stop.
    const ok = !!s.valid && age < CONFIG.offlineGraceDays * DAY;
    return { licensed: ok, offline: true,
      message: ok ? null : 'Licence needs re-checking, but the licence server is unreachable.' };
  }
  const r = a.readValidate(data);
  writeStore({ ...s, checkedAt: Date.now(), valid: r.valid });
  return { licensed: r.valid, message: r.valid ? null : humanError(r.error) };
}

/** Release this activation so the licence can be used on another machine. */
export async function deactivate() {
  const s = readStore();
  if (!s) return { ok: true };
  const a = adapter();
  try { await transport('deactivate', a.body('deactivate', { key: s.key, instanceId: s.instanceId })); }
  catch { /* clear locally regardless - the customer can re-activate */ }
  writeStore(null);
  return { ok: true, message: 'Licence released from this browser.' };
}

export const isLicensed = () => !!(readStore() || {}).valid;

function humanError(raw) {
  const t = String(raw || '').toLowerCase();
  if (t.includes('not found') || t.includes('404')) return 'That licence key was not recognised. Check for typos, or use the key from your receipt email.';
  if (t.includes('activation limit') || t.includes('limit')) return 'This licence has reached its activation limit. Release it from another browser first, or contact support.';
  if (t.includes('expired')) return 'This licence has expired.';
  if (t.includes('disabled') || t.includes('revoked')) return 'This licence has been disabled. Please contact support.';
  return raw ? `Licence check failed: ${raw}` : 'Licence check failed. Please contact support with your order number.';
}
