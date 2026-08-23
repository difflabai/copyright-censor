import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { inventedCensor } from './helpers.js';

describe('heuristics', () => {
  it('blocks cover / lyric / verbatim reproduction phrasing', () => {
    const censor = inventedCensor();
    assert.equal(censor.check('cover of an old sailing hymn').verdict, 'block');
    assert.equal(censor.check('lyrics from a made-up river chant').verdict, 'block');
    assert.equal(censor.check('play this word for word').verdict, 'block');
    assert.equal(censor.check('recreate the song with the same arrangement').verdict, 'block');
    assert.equal(censor.check('sing the lyrics softly').verdict, 'block');
    assert.equal(censor.check('chorus: invented lantern hills').verdict, 'block');
  });

  it('reviews artist-style phrasing even without a named artist', () => {
    const result = inventedCensor().check('in the style of a late-night radio host');
    assert.equal(result.verdict, 'review');
    assert.equal(result.spans.some((span) => span.reason === 'artist-style request'), true);
  });

  it('blocks a long quoted invented passage as lyric-like', () => {
    const inventedVerse =
      '"the moon is a lantern over invented hills and silver ponds remember nothing"';
    const result = inventedCensor().check(`hum this ${inventedVerse}`);
    assert.equal(result.verdict, 'block');
    assert.equal(result.spans.some((span) => span.reason === 'quoted lyric-like passage'), true);
  });

  it('does not treat a short quoted mood phrase as lyrics', () => {
    const result = inventedCensor().check('make it sound "warm and foggy" tonight');
    assert.equal(result.verdict, 'allow');
  });

  it('blocks visual reproduction phrasing for image/video prompts', () => {
    const result = inventedCensor().check('a screenshot from the opening credits, wide shot');
    assert.equal(result.verdict, 'block');
  });

  it('reviews logo / trademark wording', () => {
    const result = inventedCensor().check('clean official logo on a plain backdrop');
    assert.equal(result.verdict, 'review');
  });

  it('still blocks when style language is combined with a specific work', () => {
    const result = inventedCensor().check('in the style of Neon Glass Harbor');
    assert.equal(result.verdict, 'block');
  });
});
