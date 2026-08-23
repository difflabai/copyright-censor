import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createCensor } from '../src/index.js';

describe('performance', () => {
  it('stays comfortable on a keystroke budget', () => {
    const censor = createCensor();
    const text =
      'dreamy 80s synthwave, warm analog pads, soft tape hiss, in the style of a late night host, no crowd noise';
    const start = performance.now();
    for (let i = 0; i < 500; i += 1) {
      censor.check(text);
    }
    const elapsed = performance.now() - start;
    assert.ok(elapsed < 250, `500 checks took ${elapsed}ms`);
  });
});
