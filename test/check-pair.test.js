import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkPair } from '../src/index.js';
import { inventedBlocklist, inventedCensor } from './helpers.js';

describe('checkPair()', () => {
  it('allows a clean positive/negative slider pair', () => {
    const result = inventedCensor().checkPair({
      positive: 'dreamy 80s synthwave',
      negative: 'harsh clipping, crowd noise',
    });
    assert.equal(result.verdict, 'allow');
    assert.equal(result.positive.verdict, 'allow');
    assert.equal(result.negative.verdict, 'allow');
  });

  it('takes the worse of the two fields', () => {
    const result = inventedCensor().checkPair({
      positive: 'warm analog pads',
      negative: 'no Neon Glass Harbor',
    });
    assert.equal(result.verdict, 'block');
    assert.equal(result.positive.verdict, 'allow');
    assert.equal(result.negative.verdict, 'block');
    assert.equal(result.spans[0].field, 'negative');
  });

  it('reviews when only the positive side names an artist', () => {
    const result = checkPair(
      { positive: 'Zorblin Faye vocals', negative: 'muddy mix' },
      { blocklist: inventedBlocklist, replaceBlocklist: true },
    );
    assert.equal(result.verdict, 'review');
    assert.equal(result.positive.spans[0].text, 'Zorblin Faye');
  });

  it('does not treat negation as a free pass', () => {
    const result = inventedCensor().checkPair({
      positive: 'soft choir',
      negative: 'no Crystal Finch Saga',
    });
    assert.equal(result.verdict, 'block');
  });
});
