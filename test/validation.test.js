import { test, assert } from './harness.js';
import { generate, STYLES, byId } from '../src/registry.js';
import { sweepFor } from './samples.js';

const bad = (fn) => { try { fn(); return null; } catch (e) { return e; } };

test('rejects an unknown style id', () => {
  const e = bad(() => generate('not-a-box', { L: 1, W: 1, H: 1 }));
  assert(e && /Unknown box style/.test(e.message), 'should reject unknown style');
});

test('rejects zero and negative dimensions with a readable message', () => {
  for (const p of [{ L: 0, W: 100, H: 50 }, { L: -5, W: 100, H: 50 }, { L: 100, W: 0, H: 50 }]) {
    const e = bad(() => generate('rsc-0201', p));
    assert(e && e.validation, `should have rejected ${JSON.stringify(p)}`);
    assert(/must be greater than zero/.test(e.message), `unhelpful message: ${e && e.message}`);
  }
});

test('rejects non-numeric input rather than emitting NaN geometry', () => {
  const e = bad(() => generate('rsc-0201', { L: 'wide', W: 100, H: 50 }));
  assert(e && e.validation, 'text input should be rejected');
});

test('rejects absurdly large dimensions', () => {
  const e = bad(() => generate('rsc-0201', { L: 99999, W: 100, H: 50 }));
  assert(e && /too large/.test(e.message), 'should cap runaway dimensions');
});

test('rejects negative board thickness', () => {
  assert(bad(() => generate('rsc-0201', { L: 100, W: 100, H: 50, t: -2 })), 'negative caliper allowed');
});

test('RSC rejects a slot wider than the panels can carry', () => {
  const e = bad(() => generate('rsc-0201', { L: 100, W: 40, H: 50, t: 3, slot: 40 }));
  assert(e && /Slot width/.test(e.message), 'oversized slot allowed');
});

test('tray warns when walls are too tall for the corner tabs', () => {
  const e = bad(() => generate('tray-4corner', { L: 100, W: 80, H: 60, t: 1 }));
  assert(e && /corner tabs/.test(e.message), 'impossible tray accepted');
});

test('mailer rejects a height that would foul the lid dust flaps', () => {
  const e = bad(() => generate('mailer-tucktop', { L: 200, W: 100, H: 80, t: 3 }));
  assert(e && /dust flaps/.test(e.message), 'impossible mailer accepted');
});

test('pillow rejects a curve deeper than half the height', () => {
  const e = bad(() => generate('pillow', { L: 90, W: 70, H: 120, t: 0.5 }));
  assert(e && /Curve depth/.test(e.message), 'impossible pillow accepted');
});

test('every style survives a realistic sweep of sizes', () => {
  for (const st of STYLES) {
    for (const [L, W, H] of sweepFor(st.id)) {
      const dl = generate(st.id, { L, W, H, t: 2 });
      assert(dl.bbox.w > 0 && dl.bbox.h > 0, `${st.id} produced an empty blank at ${L}x${W}x${H}`);
    }
  }
});

test('a value that is present but not a number is never silently defaulted', () => {
  for (const junk of ['wide', 'abc', {}, [1, 2], NaN]) {
    let threw = false;
    try { generate('rsc-0201', { L: junk, W: 100, H: 50 }); } catch { threw = true; }
    assert(threw, `input ${JSON.stringify(junk)} was silently accepted`);
  }
});

test('an omitted value still falls back to a sensible default', () => {
  const dl = generate('rsc-0201', { L: 200, W: 150, H: 100 });
  assert(dl.params.t === 3, 'default caliper should apply when omitted');
});

test('every style declares the metadata the catalogue page needs', () => {
  for (const st of STYLES) {
    for (const k of ['id', 'name', 'family', 'blurb']) assert(st[k], `${st.id} missing ${k}`);
    assert(typeof st.free === 'boolean', `${st.id} must declare free/paid`);
    assert(byId(st.id) === st, 'registry lookup broken');
  }
});

test('exactly two styles are free, and they are the two documented ones', () => {
  const free = STYLES.filter((s) => s.free).map((s) => s.id).sort();
  assert(JSON.stringify(free) === JSON.stringify(['rsc-0201', 'sleeve']),
    `free tier drifted: ${free.join(', ')}`);
});

test('one bad field produces one error, not a cascade of derived ones', () => {
  const e = bad(() => generate('rsc-0201', { L: 200, W: 150, H: 100, t: NaN }));
  assert(e && e.all.length === 1, `expected 1 error, got ${e && e.all.length}: ${e && e.all.join(' | ')}`);
  assert(/Board thickness/.test(e.message), `wrong field blamed: ${e && e.message}`);
});

/* ---- length parsing: people type fractions, especially in inches ---- */
import { parseLength } from '../src/geom.js';

test('plain decimals parse', () => {
  for (const [s, v] of [['12', 12], ['12.5', 12.5], ['0.35', 0.35], [' 7 ', 7]])
    assert(parseLength(s) === v, `${s} -> ${parseLength(s)}, expected ${v}`);
});

test('mixed and bare fractions parse the way a tradesperson writes them', () => {
  const cases = [['12 1/2', 12.5], ['12-1/2', 12.5], ['1/2', 0.5], ['3 3/8', 3.375], ['12 1/2"', 12.5]];
  for (const [s, v] of cases)
    assert(Math.abs(parseLength(s) - v) < 1e-9, `${s} -> ${parseLength(s)}, expected ${v}`);
});

test('nonsense is NaN, never a silent default', () => {
  for (const s of ['', '  ', 'abc', '12 1/', '1/0', '12//2', '--3', 'twelve', null, undefined])
    assert(Number.isNaN(parseLength(s)), `${JSON.stringify(s)} parsed to ${parseLength(s)}`);
});

test('a number passes straight through', () => {
  assert(parseLength(42) === 42);
  assert(Number.isNaN(parseLength(NaN)));
  assert(Number.isNaN(parseLength(Infinity)));
});
