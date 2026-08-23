import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { check, createCensor, tokenize } from '../src/index.js';
import { inventedBlocklist, inventedCensor } from './helpers.js';

describe('check()', () => {
  it('returns the documented shape on the default path', () => {
    const result = check('warm analog pads and dusty tape');
    assert.equal(result.verdict, 'allow');
    assert.ok(Array.isArray(result.spans));
    assert.ok(Array.isArray(result.reasons));
  });

  it('allows generic mood and era language', () => {
    const result = inventedCensor().check('dreamy 80s synthwave, warm analog pads, melancholic jazz');
    assert.equal(result.verdict, 'allow');
    assert.deepEqual(result.spans, []);
    assert.deepEqual(result.reasons, []);
  });

  it('reviews a famous artist with no specific work', () => {
    const result = inventedCensor().check('late night city pop with Zorblin Faye');
    assert.equal(result.verdict, 'review');
    assert.equal(result.spans.length, 1);
    assert.equal(result.spans[0].text, 'Zorblin Faye');
    assert.equal(result.spans[0].verdict, 'review');
    assert.equal(result.reasons.includes('famous artist'), true);
  });

  it('blocks a specific work title', () => {
    const result = inventedCensor().check('make Neon Glass Harbor with extra reverb');
    assert.equal(result.verdict, 'block');
    assert.equal(result.spans[0].text, 'Neon Glass Harbor');
    assert.equal(result.spans[0].verdict, 'block');
  });

  it('returns character offsets into the original string', () => {
    const text = '  please paint Crystal Finch Saga tonight';
    const result = inventedCensor().check(text);
    const span = result.spans[0];
    assert.equal(text.slice(span.start, span.end), 'Crystal Finch Saga');
    assert.equal(span.start, text.indexOf('Crystal'));
    assert.equal(span.end, text.indexOf('Saga') + 'Saga'.length);
  });

  it('keeps offsets stable when punctuation surrounds a hit', () => {
    const text = 'Need (Neon Glass Harbor)!';
    const result = inventedCensor().check(text);
    const span = result.spans.find((item) => item.kind === 'work');
    assert.ok(span);
    assert.equal(text.slice(span.start, span.end), 'Neon Glass Harbor');
  });

  it('uses word boundaries so prefixes do not match', () => {
    const censor = createCensor({
      replaceBlocklist: true,
      blocklist: { artists: [{ term: 'Queen', commonWord: true }] },
    });
    assert.equal(censor.check('queensland river folk').verdict, 'allow');
    assert.equal(censor.check('drama queen ballad').verdict, 'allow');
    assert.equal(censor.check('the band Queen on analog tape').verdict, 'review');
    const cued = censor.check('sounds like queen on cheap speakers');
    assert.equal(cued.verdict, 'review');
    assert.equal(cued.spans.some((span) => span.text.toLowerCase() === 'queen'), true);
  });

  it('treats empty or blank input as allow', () => {
    assert.equal(check('').verdict, 'allow');
    assert.equal(check('   \n').verdict, 'allow');
    assert.equal(check(null).verdict, 'allow');
  });

  it('merges a custom blocklist onto the default list', () => {
    const result = check('a gentle hymn about Zorblin Faye', { blocklist: inventedBlocklist });
    assert.equal(result.verdict, 'review');
  });

  it('can replace the default list entirely', () => {
    const result = check('Taylor Swift Neon Glass Harbor', {
      blocklist: inventedBlocklist,
      replaceBlocklist: true,
    });
    assert.equal(result.spans.some((span) => span.text.includes('Taylor')), false);
    assert.equal(result.spans.some((span) => span.text === 'Neon Glass Harbor'), true);
    assert.equal(result.verdict, 'block');
  });

  it('supports extraTerms without replacing the starter list', () => {
    const result = check('Zorblin Faye over warm pads', {
      extraTerms: [{ term: 'Zorblin Faye', kind: 'artist', verdict: 'review' }],
    });
    assert.equal(result.verdict, 'review');
  });

  it('prefers the more severe overlapping span', () => {
    const censor = createCensor({
      replaceBlocklist: true,
      blocklist: {
        artists: ['Glass Harbor'],
        works: ['Neon Glass Harbor'],
      },
    });
    const result = censor.check('please recreate Neon Glass Harbor');
    assert.equal(result.verdict, 'block');
    assert.equal(result.spans.some((span) => span.text === 'Neon Glass Harbor'), true);
  });

  it('filters entries by media', () => {
    const list = {
      trademarks: [{ term: 'Lumistitch', media: ['image'] }],
    };
    const image = createCensor({ blocklist: list, replaceBlocklist: true, media: 'image' });
    const music = createCensor({ blocklist: list, replaceBlocklist: true, media: 'music' });
    assert.equal(image.check('Lumistitch poster').verdict, 'block');
    assert.equal(music.check('Lumistitch poster').verdict, 'allow');
  });

  it('does not flag a public-domain nursery line without reproduction cues', () => {
    const result = inventedCensor().check('Mary had a little lamb, little lamb, little lamb');
    assert.equal(result.verdict, 'allow');
  });

  it('tokenizes with original offsets', () => {
    const tokens = tokenize('Hi, Zorblin!');
    assert.equal(tokens[0].text, 'Hi');
    assert.equal(tokens[1].text, 'Zorblin');
    assert.equal(tokens[1].start, 4);
  });
});
