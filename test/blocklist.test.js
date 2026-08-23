import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createCensor,
  defaultBlocklist,
  flattenBlocklist,
  mergeBlocklists,
} from '../src/index.js';

describe('blocklist', () => {
  it('ships a grouped starter list without lyric fields', () => {
    assert.equal(typeof defaultBlocklist.version, 'number');
    assert.ok(defaultBlocklist.artists.length > 10);
    assert.ok(defaultBlocklist.works.length > 10);
    const blob = JSON.stringify(defaultBlocklist).toLowerCase();
    assert.equal(blob.includes('verse 1'), false);
    assert.equal(blob.includes('chorus:'), false);
  });

  it('merges grouped lists and extra entries', () => {
    const merged = mergeBlocklists(
      { artists: ['Ada'] },
      { works: ['River Glass'], entries: [{ term: 'Nox', kind: 'trademark' }] },
    );
    assert.deepEqual(merged.artists, ['Ada']);
    assert.deepEqual(merged.works, ['River Glass']);
    assert.equal(merged.entries.length, 1);
  });

  it('drops leading articles so The Beatles-style terms hit the short form', () => {
    const entries = flattenBlocklist({ artists: ['The Silver Finch'] });
    assert.ok(entries.some((entry) => entry.tokens.join(' ') === 'silver finch'));
  });

  it('matches aliases and accent-folded spellings', () => {
    const censor = createCensor({
      replaceBlocklist: true,
      blocklist: {
        artists: [{ term: 'Beyoncé', aliases: ['Beyonce'] }],
        franchises: [{ term: 'Pokemon', aliases: ['Pokémon'] }],
      },
    });
    assert.equal(censor.check('beyonce-like vocals').verdict, 'review');
    assert.equal(censor.check('a Pokémon overworld theme').verdict, 'block');
  });

  it('lets an allowlist override a colliding custom term', () => {
    const censor = createCensor({
      replaceBlocklist: true,
      blocklist: { artists: ['dreamy'] },
      allowlist: ['dreamy'],
    });
    assert.equal(censor.check('dreamy pads').verdict, 'allow');
  });
});
