import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  compileAutomaton,
  findCatalogSpans,
  parseAutomaton,
  serializeAutomaton,
} from '../src/automaton.js';
import { tokenize } from '../src/tokenize.js';

describe('token automaton', () => {
  const model = parseAutomaton(
    serializeAutomaton(
      compileAutomaton([
        { tokens: ['zorblin', 'faye'], kind: 'artist', verdict: 'review' },
        { tokens: ['neon', 'glass', 'harbor'], kind: 'work', verdict: 'block' },
      ]),
    ),
  );

  it('round-trips through the compact binary', () => {
    assert.equal(model.stats.patterns, 2);
    assert.ok(model.tokenToId.get('zorblin') >= 0);
  });

  it('returns character offsets for a catalog hit', () => {
    const text = 'please play Neon Glass Harbor now';
    const spans = findCatalogSpans(model, text, tokenize(text), new Set());
    assert.equal(spans[0].text, 'Neon Glass Harbor');
    assert.equal(spans[0].verdict, 'block');
    assert.equal(text.slice(spans[0].start, spans[0].end), 'Neon Glass Harbor');
  });

  it('does not match inside a longer token', () => {
    const text = 'queensland river folk';
    const tiny = parseAutomaton(
      serializeAutomaton(compileAutomaton([{ tokens: ['queen'], kind: 'artist', verdict: 'review', commonWord: true }])),
    );
    assert.deepEqual(findCatalogSpans(tiny, text, tokenize(text), new Set()), []);
  });
});
