// Tiny zero-dependency test harness.
let pass = 0, fail = 0; const failures = [];
export function test(name, fn) {
  try { fn(); pass++; process.stdout.write('.'); }
  catch (e) { fail++; failures.push([name, e.message]); process.stdout.write('X'); }
}
export function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
export function near(a, b, tol, msg) {
  if (Math.abs(a - b) > (tol ?? 1e-6))
    throw new Error(`${msg || 'values differ'}: got ${a}, expected ${b} (tol ${tol ?? 1e-6})`);
}
export function report() {
  console.log(`\n\n${pass} passed, ${fail} failed`);
  for (const [n, m] of failures) console.log(`  FAIL  ${n}\n        ${m}`);
  return fail === 0;
}

/* ---- geometry helpers used by the property tests ---- */

/** Do closed-polygon segments (excluding neighbours) cross each other? */
export function selfIntersects(pts) {
  const n = pts.length;
  const seg = (i) => [pts[i], pts[(i + 1) % n]];
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;            // adjacent through the wrap
      const [a, b] = seg(i), [c, d] = seg(j);
      if (properCross(a, b, c, d)) return [i, j];
    }
  }
  return null;
}
const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
function properCross(a, b, c, d) {
  const EPS = 1e-9;
  const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
  // Strict crossing only: touching endpoints (common in dieline outlines) is legal.
  return ((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) &&
         ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS));
}
