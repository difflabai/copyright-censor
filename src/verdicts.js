/** @typedef {'allow' | 'review' | 'block'} Verdict */

export const VERDICTS = /** @type {const} */ ({
  ALLOW: 'allow',
  REVIEW: 'review',
  BLOCK: 'block',
});

export const VERDICT_RANK = {
  allow: 0,
  review: 1,
  block: 2,
};

/**
 * @param {...(Verdict | null | undefined)} verdicts
 * @returns {Verdict}
 */
export function worstVerdict(...verdicts) {
  let worst = VERDICTS.ALLOW;
  for (const verdict of verdicts) {
    if (verdict && VERDICT_RANK[verdict] > VERDICT_RANK[worst]) {
      worst = verdict;
    }
  }
  return worst;
}

/**
 * @param {unknown} value
 * @returns {value is Verdict}
 */
export function isVerdict(value) {
  return value === 'allow' || value === 'review' || value === 'block';
}
