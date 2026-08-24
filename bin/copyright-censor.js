#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { stdin } from 'node:process';
import { parseArgs } from 'node:util';
import { check, checkPair, createCensor } from '../src/index.js';

const EXIT = {
  allow: 0,
  review: 1,
  block: 2,
  usage: 64,
};

const HELP = `copyright-censor — conservative prompt filter (not legal advice)

Usage:
  copyright-censor [options] <text>
  copyright-censor --positive <text> --negative <text>
  echo "warm analog pads" | copyright-censor

Options:
  -p, --positive <text>     Positive slider prompt (use with --negative)
  -n, --negative <text>     Negative slider prompt
  -b, --blocklist <file>    Extra JSON blocklist to merge
      --replace-blocklist   Use only --blocklist (ignore the starter list)
      --media <kind>        music | image | video | all  (default: all)
      --json                Print machine-readable JSON
  -h, --help                Show this help

Exit codes: 0 allow, 1 review, 2 block, 64 usage
`;

function failUsage(message) {
  if (message) console.error(message);
  console.error(HELP);
  process.exit(EXIT.usage);
}

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stdin.setEncoding('utf8');
    stdin.on('data', (chunk) => chunks.push(chunk));
    stdin.on('end', () => resolve(chunks.join('')));
    stdin.on('error', reject);
  });
}

function loadBlocklist(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    failUsage(`Could not read blocklist ${path}: ${error.message}`);
  }
}

function formatHuman(result, label) {
  const prefix = label ? `${label} ` : '';
  const lines = [`${prefix}${result.verdict.toUpperCase()}`];
  for (const span of result.spans) {
    lines.push(`  [${span.start}:${span.end}] "${span.text}" ${span.verdict}: ${span.reason}`);
  }
  if (result.reasons.length && result.spans.length === 0) {
    for (const reason of result.reasons) lines.push(`  ${reason}`);
  }
  return lines.join('\n');
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    json: { type: 'boolean', default: false },
    positive: { type: 'string', short: 'p' },
    negative: { type: 'string', short: 'n' },
    blocklist: { type: 'string', short: 'b' },
    'replace-blocklist': { type: 'boolean', default: false },
    media: { type: 'string', default: 'all' },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (values.help) {
  console.log(HELP);
  process.exit(0);
}

const media = values.media;
if (!['music', 'image', 'video', 'all'].includes(media)) {
  failUsage(`Unknown --media ${media}`);
}

const options = {
  media,
  replaceBlocklist: values['replace-blocklist'],
};
if (values.blocklist) options.blocklist = loadBlocklist(values.blocklist);

const pairMode = values.positive !== undefined || values.negative !== undefined;
if (pairMode && (values.positive === undefined || values.negative === undefined)) {
  failUsage('Both --positive and --negative are required together.');
}

let text = positionals.join(' ').trim();
if (!pairMode && !text && !stdin.isTTY) {
  text = (await readStdin()).trim();
}

if (!pairMode && !text) failUsage('Pass prompt text, or use --positive/--negative.');

const censor = options.blocklist || options.replaceBlocklist || media !== 'all'
  ? createCensor(options)
  : null;

const result = pairMode
  ? (censor ?? { checkPair }).checkPair({
      positive: values.positive ?? '',
      negative: values.negative ?? '',
    })
  : (censor ?? { check }).check(text);

if (values.json) {
  console.log(JSON.stringify(result, null, 2));
} else if (pairMode) {
  console.log(formatHuman(result, 'pair'));
  console.log(formatHuman(result.positive, 'positive'));
  console.log(formatHuman(result.negative, 'negative'));
} else {
  console.log(formatHuman(result));
}

process.exit(EXIT[result.verdict] ?? 0);
