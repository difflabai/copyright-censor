import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { check, catalogMeta, createCensor } from '../src/index.js';

const meta = JSON.parse(readFileSync(new URL('../data/catalog.meta.json', import.meta.url), 'utf8'));
const oldStarter = JSON.parse(readFileSync(new URL('./fixtures/old-starter.json', import.meta.url), 'utf8'));

function flatten(list) {
  return (list || []).map((item) => (typeof item === 'string' ? item : item.term)).filter(Boolean);
}

describe('compiled catalog', () => {
  it('ships a catalog-scale identifier automaton, not a 200-row list', () => {
    assert.ok(catalogMeta.patterns > 10_000, `patterns=${catalogMeta.patterns}`);
    assert.ok(meta.patterns > 10_000);
    assert.equal(meta.containsLyrics, false);
    assert.deepEqual(meta.identifierFieldsOnly, ['term', 'kind', 'source']);
    assert.equal(meta.identifierFieldsOnly.includes('lyrics'), false);
    assert.equal(meta.identifierFieldsOnly.includes('synopsis'), false);
  });

  it('hits many cataloged titles the old starter list would miss', () => {
    const old = new Set(
      [...flatten(oldStarter.artists), ...flatten(oldStarter.works), ...flatten(oldStarter.franchises)].map((term) =>
        term.toLowerCase(),
      ),
    );
    const examples = meta.heldOutExamples || [];
    assert.ok(examples.length >= 20, 'compiler should record held-out identifier examples');
    let hits = 0;
    for (const term of examples) {
      assert.equal(old.has(term.toLowerCase()), false, `held-out example leaked into old starter: ${term}`);
      const result = check(term);
      if (result.verdict !== 'allow' && result.spans.some((span) => span.kind !== 'heuristic')) hits += 1;
    }
    assert.ok(hits >= 15, `only ${hits}/${examples.length} held-out identifiers matched`);
  });

  it('stays on a keystroke budget for a long mixed prompt', () => {
    const censor = createCensor();
    const text = [
      'dreamy 80s synthwave, warm analog pads, soft tape hiss,',
      'late night city pop, dusty cassette, no crowd noise,',
      'melancholic jazz piano, intimate vocal air, analog chorus',
    ].join(' ');
    const start = performance.now();
    for (let i = 0; i < 300; i += 1) censor.check(text);
    const elapsed = performance.now() - start;
    assert.ok(elapsed < 400, `300 long-prompt checks took ${elapsed}ms`);
  });

  it('still allows generic mood language on the default catalog path', () => {
    assert.equal(check('dreamy 80s synthwave, warm analog pads').verdict, 'allow');
  });
});
