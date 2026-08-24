import { createCensor } from '../src/index.js';

/** Invented names only — never real lyrics or scraped titles. */
export const inventedBlocklist = {
  artists: [{ term: 'Zorblin Faye', verdict: 'review', reason: 'famous artist' }],
  works: [{ term: 'Neon Glass Harbor', verdict: 'block', reason: 'specific protected work' }],
  franchises: [{ term: 'Crystal Finch Saga', verdict: 'block', reason: 'protected franchise' }],
  trademarks: [{ term: 'Lumistitch', verdict: 'block', reason: 'protected trademark' }],
};

export function inventedCensor(overrides = {}) {
  return createCensor({
    blocklist: inventedBlocklist,
    replaceBlocklist: true,
    ...overrides,
  });
}
