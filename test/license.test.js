import { test, assert } from './harness.js';

// --- minimal localStorage shim so the browser module runs under Node ---
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};

const L = await import('../src/license.js');

/* ---- fake Lemon Squeezy licence API ---------------------------------- */
const KEYS = {
  'GOOD-KEY': { activations: 0, limit: 2, status: 'active' },
  'LIMIT-KEY': { activations: 5, limit: 5, status: 'active' },
  'EXPIRED-KEY': { activations: 0, limit: 2, status: 'expired' },
  'DISABLED-KEY': { activations: 0, limit: 2, status: 'disabled' },
};
let instances = {}, seq = 0, offline = false, calls = [];
function fakeApi(endpoint, body) {
  calls.push([endpoint, body]);
  if (offline) return Promise.reject(new Error('network down'));
  const rec = KEYS[body.license_key];
  if (!rec) return Promise.resolve({ activated: false, valid: false, error: 'license_key not found' });
  if (rec.status === 'expired') return Promise.resolve({ activated: false, valid: false, error: 'license_key is expired' });
  if (rec.status === 'disabled') return Promise.resolve({ activated: false, valid: false, error: 'license_key is disabled' });

  if (endpoint === 'activate') {
    if (rec.activations >= rec.limit)
      return Promise.resolve({ activated: false, error: 'activation limit reached for this license_key' });
    rec.activations++;
    const id = `inst_${++seq}`;
    instances[id] = body.license_key;
    return Promise.resolve({ activated: true, instance: { id, name: body.instance_name } });
  }
  if (endpoint === 'validate')
    return Promise.resolve({ valid: instances[body.instance_id] === body.license_key });
  if (endpoint === 'deactivate') {
    if (instances[body.instance_id]) { delete instances[body.instance_id]; rec.activations--; }
    return Promise.resolve({ deactivated: true });
  }
  return Promise.resolve({});
}
const reset = () => {
  mem.clear(); instances = {}; seq = 0; offline = false; calls = [];
  for (const k of Object.values(KEYS)) k.activations = 0;
  KEYS['LIMIT-KEY'].activations = 5;
  L.setTransport(fakeApi);
};

/* ---------------------------------------------------------------- tests */
test('unlicensed by default - nothing is unlocked without a purchase', () => {
  reset(); assert(!L.isLicensed(), 'should start unlicensed');
});

test('a browser that never bought anything cannot self-grant a licence', () => {
  reset();
  localStorage.setItem('cartonry.licence.v1', JSON.stringify({ key: 'MADE-UP', valid: true, checkedAt: 0 }));
  // Forged local state must not survive a provider check.
  return L.refresh({ force: true }).then((r) => {
    assert(!r.licensed, 'forged local licence state was accepted');
    assert(!L.isLicensed(), 'forged licence still reported as valid');
  });
});

test('valid key activates and unlocks', async () => {
  reset();
  const r = await L.activate('GOOD-KEY');
  assert(r.ok, `activation failed: ${r.message}`);
  assert(L.isLicensed(), 'not licensed after successful activation');
});

test('unknown key is rejected with a message a customer can act on', async () => {
  reset();
  const r = await L.activate('NOPE');
  assert(!r.ok && !L.isLicensed(), 'unknown key granted access');
  assert(/not recognised/i.test(r.message), `unhelpful message: ${r.message}`);
});

test('empty key is rejected without calling the provider', async () => {
  reset();
  const r = await L.activate('   ');
  assert(!r.ok, 'blank key accepted');
  assert(calls.length === 0, 'blank key should not hit the network');
});

test('activation limit produces a recovery instruction, not a dead end', async () => {
  reset();
  const r = await L.activate('LIMIT-KEY');
  assert(!r.ok && /activation limit/i.test(r.message), `got: ${r.message}`);
  assert(/release it/i.test(r.message), 'should tell the customer how to recover');
});

test('expired and disabled licences are refused distinctly', async () => {
  reset();
  assert(/expired/i.test((await L.activate('EXPIRED-KEY')).message), 'expired not reported');
  reset();
  assert(/disabled/i.test((await L.activate('DISABLED-KEY')).message), 'disabled not reported');
});

test('re-activating the same key twice does not consume two seats needlessly', async () => {
  reset();
  await L.activate('GOOD-KEY');
  const used = KEYS['GOOD-KEY'].activations;
  await L.refresh({ force: true });                 // revalidation must not re-activate
  assert(KEYS['GOOD-KEY'].activations === used, 'refresh consumed another activation');
});

test('revalidation is throttled - a fresh check is not repeated on every load', async () => {
  reset();
  await L.activate('GOOD-KEY');
  const before = calls.length;
  const r = await L.refresh();
  assert(r.cached, 'expected the cached result');
  assert(calls.length === before, 'throttled refresh still hit the network');
});

test('licence revoked at the provider is revoked in the app on next check', async () => {
  reset();
  await L.activate('GOOD-KEY');
  instances = {};                                    // provider-side revocation
  const r = await L.refresh({ force: true });
  assert(!r.licensed && !L.isLicensed(), 'revoked licence still unlocked');
});

test('offline keeps a previously valid licence working within the grace window', async () => {
  reset();
  await L.activate('GOOD-KEY');
  offline = true;
  const r = await L.refresh({ force: true });
  assert(r.licensed && r.offline, 'valid licence should survive a brief outage');
});

test('offline beyond the grace window stops unlocking and says why', async () => {
  reset();
  await L.activate('GOOD-KEY');
  const s = JSON.parse(localStorage.getItem('cartonry.licence.v1'));
  s.checkedAt = Date.now() - 400 * 86400000;         // long past grace
  localStorage.setItem('cartonry.licence.v1', JSON.stringify(s));
  offline = true;
  const r = await L.refresh({ force: true });
  assert(!r.licensed, 'stale offline licence still unlocked');
  assert(/unreachable/i.test(r.message), `unclear message: ${r.message}`);
});

test('network failure during activation does not half-activate', async () => {
  reset(); offline = true;
  const r = await L.activate('GOOD-KEY');
  assert(!r.ok && !L.isLicensed(), 'failed activation left the app unlocked');
  assert(/connection/i.test(r.message), `unclear message: ${r.message}`);
});

test('customer can release a seat and re-activate elsewhere', async () => {
  reset();
  await L.activate('GOOD-KEY');
  await L.deactivate();
  assert(!L.isLicensed(), 'still licensed after release');
  const again = await L.activate('GOOD-KEY');
  assert(again.ok, 'could not re-activate after releasing the seat');
});

test('licence survives a page reload (persisted, then re-checked)', async () => {
  reset();
  await L.activate('GOOD-KEY');
  const saved = localStorage.getItem('cartonry.licence.v1');
  assert(saved && JSON.parse(saved).instanceId, 'nothing persisted for the next visit');
  const r = await L.refresh({ force: true });
  assert(r.licensed, 'licence did not survive a reload');
});

test('storage failures (private browsing) never throw', () => {
  reset();
  const real = globalThis.localStorage;
  globalThis.localStorage = { getItem() { throw new Error('denied'); },
    setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
  try { assert(L.readStore() === null, 'readStore should degrade to null'); assert(!L.isLicensed()); }
  finally { globalThis.localStorage = real; }
});

/* ---- provider adapters -------------------------------------------------
 * The two supported merchants of record answer with different shapes. These
 * tests pin the mapping so switching provider cannot silently unlock (or
 * silently lock out) every customer.
 * --------------------------------------------------------------------- */
const { CONFIG } = await import('../src/config.js');

test('Lemon Squeezy response shape maps correctly', async () => {
  reset(); CONFIG.provider = 'lemonsqueezy';
  let seen;
  L.setTransport((op, body) => { seen = { op, body };
    return Promise.resolve(op === 'activate'
      ? { activated: true, instance: { id: 'ls_1' } } : { valid: true }); });
  const r = await L.activate('GOOD-KEY');
  assert(r.ok, 'LS activate not recognised');
  assert(seen.body.license_key === 'GOOD-KEY', 'LS uses snake_case license_key');
  assert(L.readStore().instanceId === 'ls_1', 'LS instance id not stored');
  assert((await L.refresh({ force: true })).licensed, 'LS validate not recognised');
});

test('Polar response shape maps correctly', async () => {
  reset(); CONFIG.provider = 'polar'; CONFIG.organizationId = 'org_x';
  let seen;
  L.setTransport((op, body) => { seen = { op, body };
    return Promise.resolve(op === 'activate' ? { id: 'act_9' } : { status: 'granted' }); });
  const r = await L.activate('GOOD-KEY');
  assert(r.ok, 'Polar activate not recognised');
  assert(seen.body.key === 'GOOD-KEY' && seen.body.organization_id === 'org_x',
    'Polar body must send key + organization_id');
  assert(L.readStore().instanceId === 'act_9', 'Polar activation id not stored');
  assert((await L.refresh({ force: true })).licensed, 'Polar validate not recognised');
});

test('Polar: a revoked key (status != granted) does not unlock', async () => {
  reset(); CONFIG.provider = 'polar';
  L.setTransport((op) => Promise.resolve(op === 'activate' ? { id: 'act_9' } : { status: 'revoked' }));
  await L.activate('GOOD-KEY');
  const r = await L.refresh({ force: true });
  assert(!r.licensed, 'revoked Polar licence still unlocked');
  CONFIG.provider = 'lemonsqueezy';
  L.setTransport(fakeApi);
});
