import { test, assert, near } from './harness.js';
import { deliveredCost, costPerBox } from '../src/estimate.js';

test('cost: delivered is board plus freight’s share of the load', () => {
  const r = deliveredCost({ boardPerBox: 0.384, freightPerLoad: 180, boxesPerLoad: 364 });
  near(r.board, 0.384, 1e-9);
  near(r.freight, 180 / 364, 1e-9);
  near(r.total, 0.384 + 180 / 364, 1e-9);
});

test('cost: a fuller pallet carries less freight per box', () => {
  // The whole reason this number exists: freight per box falls as the load
  // fills, so a style using more board can still be cheaper delivered.
  let prev = Infinity;
  for (const boxes of [100, 200, 364, 800]) {
    const r = deliveredCost({ boardPerBox: 0.4, freightPerLoad: 180, boxesPerLoad: boxes });
    assert(r.freight < prev, `${boxes} boxes did not reduce the freight share`);
    prev = r.freight;
  }
});

test('cost: a bulkier box can beat a cheaper one once freight is counted', () => {
  // Style A: less board, but fewer per load. Style B: more board, more per load.
  const a = deliveredCost({ boardPerBox: 0.30, freightPerLoad: 200, boxesPerLoad: 200 });
  const b = deliveredCost({ boardPerBox: 0.38, freightPerLoad: 200, boxesPerLoad: 500 });
  assert(a.board < b.board, 'A should be the cheaper board');
  assert(b.total < a.total, 'B should win on delivered cost - that is the point of the figure');
});

test('cost: half an answer is reported as half an answer, never as a total', () => {
  // Board with no freight, or freight with no board, must not silently become
  // a "delivered" figure that is missing one of its two halves.
  const noFreight = deliveredCost({ boardPerBox: 0.4 });
  assert(noFreight.board === 0.4 && noFreight.freight === null && noFreight.total === null);
  const noBoard = deliveredCost({ freightPerLoad: 180, boxesPerLoad: 300 });
  assert(noBoard.board === null && noBoard.total === null && noBoard.freight > 0);
  assert(deliveredCost({}) === null, 'nothing in, nothing out');
  assert(deliveredCost() === null, 'no argument at all');
});

test('cost: nonsense never becomes a confident number', () => {
  for (const bad of [
    { boardPerBox: NaN, freightPerLoad: 100, boxesPerLoad: 10 },
    { boardPerBox: 1, freightPerLoad: NaN, boxesPerLoad: 10 },
    { boardPerBox: 1, freightPerLoad: 100, boxesPerLoad: 0 },
    { boardPerBox: 1, freightPerLoad: 100, boxesPerLoad: -5 },
    { boardPerBox: -1, freightPerLoad: 100, boxesPerLoad: 10 },
  ]) {
    const r = deliveredCost(bad);
    assert(r === null || r.total === null,
      `${JSON.stringify(bad)} produced a total of ${r && r.total}`);
  }
});

test('cost: free freight is a real answer, not a missing one', () => {
  // Collection in your own van is zero freight, not "unknown".
  const r = deliveredCost({ boardPerBox: 0.4, freightPerLoad: 0, boxesPerLoad: 300 });
  near(r.freight, 0, 1e-12);
  near(r.total, 0.4, 1e-12);
});

test('cost: board cost still charges the whole sheet, waste included', () => {
  // Unchanged behaviour, asserted here because delivered cost builds on it.
  const withSheet = costPerBox(0.189, 2, 3, { sheetM2: 0.96 });
  near(withSheet, (0.96 * 2) / 3, 1e-9);
  assert(costPerBox(0.189, 0, 3, { sheetM2: 0.96 }) === null, 'no price, no cost');
});
