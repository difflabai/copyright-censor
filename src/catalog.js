import { emptyAutomaton, parseAutomaton } from './automaton.js';

async function loadShippedBytes() {
  const url = new URL('../data/catalog.bin.gz', import.meta.url);
  if (typeof process !== 'undefined' && process.versions?.node) {
    const { readFileSync } = await import('node:fs');
    const { gunzipSync } = await import('node:zlib');
    return gunzipSync(readFileSync(url));
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load catalog.bin.gz (${response.status})`);
  }
  const buffer = await response.arrayBuffer();
  if (typeof DecompressionStream !== 'function') {
    throw new Error('Browser catalog load needs DecompressionStream (gzip)');
  }
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

let cached;
try {
  cached = parseAutomaton(await loadShippedBytes());
} catch (error) {
  if (typeof process !== 'undefined' && process.env.COPYRIGHT_CENSOR_ALLOW_EMPTY_CATALOG === '1') {
    cached = emptyAutomaton();
  } else {
    throw error;
  }
}

export const shippedCatalog = cached;
export const catalogMeta = shippedCatalog.stats;
