import { test, assert } from './harness.js';
import { STYLES, byId, generate } from '../src/registry.js';
import { sampleFor } from './samples.js';

test('board: every style says what it is made from', () => {
  // Which board a style is cut from is a fact about the style, not a default
  // belonging to the interface. It used to live in a DEFAULTS map in app.js
  // and covered seven of eleven, so choosing a shipping case after a carton
  // left the case in 350 micron card.
  for (const s of STYLES) {
    assert(s.board, `${s.id} declares no board`);
    assert(s.board.caliper > 0, `${s.id} has a nonsense caliper`);
    assert(['corrugated', 'carton'].includes(s.board.format),
      `${s.id} has format "${s.board.format}"`);
  }
});

test('board: the format and the caliper agree with each other', () => {
  // The rest of the codebase already draws this line: defaultGlueFlap() picks a
  // corrugated joint above 1mm and a folding-carton one below it. The declared
  // boards have to fall on the same side of it or two parts of the app
  // disagree about what a style is.
  for (const s of STYLES) {
    if (s.board.format === 'carton') {
      assert(s.board.caliper <= 1,
        `${s.id} is folding board at ${s.board.caliper}mm, which the rest of the app treats as corrugated`);
    } else {
      assert(s.board.caliper > 1, `${s.id} is corrugated at only ${s.board.caliper}mm`);
    }
  }
});

test('board: a style on its own board raises none of its own cautions', () => {
  // The strongest check available on this data, and the reason to state it as
  // data rather than as a default. Every style already carries domain rules in
  // warn(): a tuck carton complains above 1mm, a mailer complains when thick
  // board crowds a shallow box. If a style's declared board tripped its own
  // rules, the two pieces of knowledge would be contradicting each other.
  for (const s of STYLES) {
    const p = { ...sampleFor(s.id), t: s.board.caliper };
    const dl = generate(s.id, p);
    const own = (s.warn ? s.warn(p, dl) : []) || [];
    assert(own.length === 0,
      `${s.id} on its own ${s.board.caliper}mm board warns: "${own[0]}"`);
  }
});

test('board: a shipping case is never proposed in card', () => {
  // The specific absurdity this fixes: a 747mm blank on 0.35mm board.
  for (const id of ['rsc-0201', 'hsc', 'fol-0203', 'mailer-tucktop']) {
    assert(byId(id).board.format === 'corrugated', `${id} should be corrugated`);
    assert(byId(id).board.caliper >= 1.5, `${id} at ${byId(id).board.caliper}mm would be flimsy`);
  }
});

test('board: a retail carton is never proposed in corrugated', () => {
  for (const id of ['carton-ste', 'carton-rte', 'pillow', 'hexagon', 'sleeve']) {
    assert(byId(id).board.format === 'carton', `${id} should be folding board`);
  }
});
