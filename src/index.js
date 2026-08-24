export {
  check,
  checkPair,
  createCensor,
  defaultBlocklist,
  emptyBlocklist,
  mergeBlocklists,
} from './censor.js';
export { flattenBlocklist } from './blocklist.js';
export { tokenize, normalizeToken } from './tokenize.js';
export { VERDICTS, VERDICT_RANK, worstVerdict } from './verdicts.js';
export { DEFAULT_ALLOWLIST } from './allowlist.js';
export { shippedCatalog, catalogMeta } from './catalog.js';
export { compileAutomaton, parseAutomaton, serializeAutomaton, findCatalogSpans } from './automaton.js';

import {
  check,
  checkPair,
  createCensor,
  defaultBlocklist,
  emptyBlocklist,
  mergeBlocklists,
} from './censor.js';
import { catalogMeta } from './catalog.js';
import { VERDICTS, worstVerdict } from './verdicts.js';

export default {
  check,
  checkPair,
  createCensor,
  defaultBlocklist,
  emptyBlocklist,
  mergeBlocklists,
  catalogMeta,
  VERDICTS,
  worstVerdict,
};
