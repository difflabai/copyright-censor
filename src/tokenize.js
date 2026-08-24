const WORD_RE = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

/**
 * @typedef {object} Token
 * @property {number} start
 * @property {number} end
 * @property {string} text
 * @property {string} norm
 */

/**
 * Fold accents and case so "Beyoncé" matches "beyonce".
 * @param {string} value
 * @returns {string}
 */
export function normalizeToken(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '');
}

/**
 * Word tokens with offsets into the original string.
 * Hyphens and slashes split ("Queen-style", "AC/DC") for high recall.
 * @param {string} text
 * @returns {Token[]}
 */
export function tokenize(text) {
  const tokens = [];
  WORD_RE.lastIndex = 0;
  let match;
  while ((match = WORD_RE.exec(text))) {
    tokens.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
      norm: normalizeToken(match[0]),
    });
  }
  return tokens;
}

/**
 * @param {Token[]} tokens
 * @param {number} from
 * @param {number} count
 * @returns {string}
 */
export function joinNorm(tokens, from, count) {
  return tokens
    .slice(from, from + count)
    .map((token) => token.norm)
    .join(' ');
}
