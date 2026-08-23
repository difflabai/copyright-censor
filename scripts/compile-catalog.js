#!/usr/bin/env node
import { createReadStream } from 'node:fs';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { gzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileAutomaton, serializeAutomaton } from '../src/automaton.js';
import { tokenize } from '../src/tokenize.js';
import { COMMON_WORDS, SKIP_EXACT, SPECIAL_PURPOSE } from './common-words.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ARTICLES = new Set(['the', 'a', 'an']);

function normalizePhrase(tokens) {
  return tokens.join(' ');
}

function isSpecialPurpose(term) {
  const trimmed = String(term).trim();
  return SPECIAL_PURPOSE.some((re) => re.test(trimmed));
}

function shouldKeep(kind, tokens, commonWord) {
  if (!tokens.length) return false;
  const phrase = normalizePhrase(tokens);
  if (SKIP_EXACT.has(phrase)) return false;
  if (tokens.length === 1 && COMMON_WORDS.has(tokens[0]) && (kind === 'work' || kind === 'album')) {
    return false;
  }
  if (tokens.length === 1 && tokens[0].length < 3 && !commonWord) return false;
  if (phrase.length < 2) return false;
  return true;
}

function expandTerms(term, kind) {
  const tokens = tokenize(String(term)).map((token) => token.norm).filter(Boolean);
  if (!tokens.length) return [];
  const out = [tokens];
  if (tokens.length > 1 && ARTICLES.has(tokens[0])) {
    const rest = tokens.slice(1);
    if (rest.length >= 2 || (kind === 'artist' && rest.length === 1 && !COMMON_WORDS.has(rest[0]))) {
      out.push(rest);
    }
  }
  return out;
}

function addEntry(bucket, term, kind, extra = {}) {
  if (!term || isSpecialPurpose(term)) return;
  const commonWord = Boolean(extra.commonWord) || (tokenize(term).length === 1 && COMMON_WORDS.has(tokenize(term)[0]?.norm));
  for (const tokens of expandTerms(term, kind)) {
    if (!shouldKeep(kind, tokens, commonWord)) continue;
    const key = `${kind}|${tokens.join(' ')}`;
    const prev = bucket.get(key);
    const verdict = extra.verdict ?? (kind === 'artist' ? 'review' : 'block');
    if (!prev || (prev.verdict !== 'block' && verdict === 'block')) {
      bucket.set(key, {
        tokens,
        kind,
        verdict,
        commonWord: commonWord || prev?.commonWord || false,
        term: String(term),
        source: extra.source ?? 'unknown',
      });
    }
  }
}

async function readJsonl(path, onRow) {
  const stream = createReadStream(path, { encoding: 'utf8' });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    onRow(JSON.parse(line));
  }
}

function loadOldStarter() {
  try {
    return JSON.parse(readFileSync(join(root, 'test/fixtures/old-starter.json'), 'utf8'));
  } catch {
    return { artists: [], works: [], franchises: [], trademarks: [] };
  }
}

function flattenStarter(list) {
  return (list || []).map((item) => (typeof item === 'string' ? item : item.term)).filter(Boolean);
}

const bucket = new Map();
const jsonlPath = process.argv[2] || join(root, 'build/identifiers.jsonl');
const outBin = join(root, 'data/catalog.bin.gz');
const outMeta = join(root, 'data/catalog.meta.json');

mkdirSync(join(root, 'data'), { recursive: true });

if (jsonlPath) {
  try {
    await readJsonl(jsonlPath, (row) => {
      if (row && row.term && row.kind) addEntry(bucket, row.term, row.kind, row);
    });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    console.warn(`No identifier dump at ${jsonlPath}; compiling extras only.`);
  }
}

const extras = JSON.parse(readFileSync(join(root, 'data/blocklist.json'), 'utf8'));
for (const [group, kind] of [
  ['artists', 'artist'],
  ['works', 'work'],
  ['franchises', 'franchise'],
  ['trademarks', 'trademark'],
]) {
  for (const item of extras[group] || []) {
    if (typeof item === 'string') addEntry(bucket, item, kind, { source: 'extras' });
    else addEntry(bucket, item.term, item.kind || kind, { ...item, source: 'extras' });
  }
}

const entries = [...bucket.values()];
console.log(`compiling ${entries.length} unique patterns…`);
const model = compileAutomaton(entries);
const raw = serializeAutomaton(model);
const gz = gzipSync(raw, { level: 9 });
writeFileSync(outBin, gz);

const old = loadOldStarter();
const oldNorm = new Set(
  [...flattenStarter(old.artists), ...flattenStarter(old.works), ...flattenStarter(old.franchises)]
    .map((term) => tokenize(term).map((token) => token.norm).join(' ')),
);
const heldOut = [];
for (const entry of entries) {
  if (heldOut.length >= 40) break;
  if (entry.kind !== 'work' && entry.kind !== 'album' && entry.kind !== 'franchise') continue;
  if (entry.tokens.length < 2) continue;
  const phrase = entry.tokens.join(' ');
  if (oldNorm.has(phrase)) continue;
  if (COMMON_WORDS.has(phrase)) continue;
  if (/\b(remix|remaster|live|feat|featuring|karaoke|version)\b/i.test(entry.term)) continue;
  if (/[()]/.test(entry.term)) continue;
  heldOut.push(entry.term);
}

const counts = { artist: 0, work: 0, album: 0, franchise: 0, trademark: 0 };
for (const entry of entries) counts[entry.kind] = (counts[entry.kind] || 0) + 1;

const meta = {
  version: 1,
  builtAt: new Date().toISOString(),
  containsLyrics: false,
  identifierFieldsOnly: ['term', 'kind', 'source'],
  sources: [
    'MusicBrainz artist names (LeData/media-metadata-musicbrainz-artists, CC0)',
    'MusicBrainz recording titles (imseldrith/musicbrainz-all-songs, identifiers only)',
    'TVMaze show names (LeData/media-metadata-tvmaze-shows, CC0, names only)',
    'Steam game names (LeData/media-metadata-steam-games, CC0, names only)',
    'AniList / MAL titles (LeData, CC0, titles only)',
    'Wikidata media-franchise / film-series / video-game-series labels',
    'Local extras.json identifier overlay',
  ],
  counts,
  patterns: entries.length,
  tokens: model.tokenList.length,
  nodes: model.nodes.length,
  rawBytes: raw.byteLength,
  gzipBytes: gz.byteLength,
  heldOutExamples: heldOut,
  note: 'High-recall catalog of public identifiers. Not a legal oracle and not every copyrighted sentence.',
};

writeFileSync(outMeta, `${JSON.stringify(meta, null, 2)}\n`);
console.log(
  `wrote ${outBin} (${gz.byteLength} gzip / ${raw.byteLength} raw) patterns=${entries.length} nodes=${model.nodes.length}`,
);
