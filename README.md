# copyright-censor

Preemptive copyright/trademark string check for music (and image/video) slider prompts.

The library is a **conservative filter**: high recall, false positives are acceptable, false negatives are not. It is **not legal advice**, not a takedown engine, and not a pirate tool. It never ships copyrighted lyrics and never scrapes lyric sites.

A concept-slider UI can call `check()` on every keystroke and highlight the exact words that look risky.

## Policy

| Prompt | Verdict |
| --- | --- |
| Generic mood / era / production language (`dreamy 80s synthwave`) | `allow` |
| Famous artist, no specific work (`in the style of …`) | `review` |
| Specific work, franchise, trademark, or “reproduce this” phrasing | `block` |

Overall verdict is the worst span: `block` > `review` > `allow`.

## Install

```bash
npm install copyright-censor
```

ESM only, browser + Node 20.10+, no runtime dependencies. The default path is **synchronous and local** — no network.

## API

```js
import { check, checkPair, createCensor } from 'copyright-censor';

check('dreamy 80s synthwave');
// { verdict: 'allow', spans: [], reasons: [] }

check('in the style of Zorblin Faye', {
  extraTerms: [{ term: 'Zorblin Faye', kind: 'artist', verdict: 'review' }],
});
// {
//   verdict: 'review',
//   spans: [{ start, end, text, verdict, reason, kind }],
//   reasons: ['artist-style request', 'famous artist']
// }

checkPair({
  positive: 'warm analog pads',
  negative: 'no Neon Glass Harbor',
});
```

`spans` are **character offsets into the original string**, so a textarea or contenteditable can mark words live.

### `check(text, options?)`

Returns `{ verdict, spans, reasons }`.

### `checkPair({ positive, negative }, options?)`

Checks both slider fields. Worst verdict wins. Each span also has `field: 'positive' | 'negative'`.

### `createCensor(options?)`

Compile the matcher once, then call `censor.check()` / `censor.checkPair()` on every keystroke.

```js
const censor = createCensor({
  blocklist: myJson,          // merged onto the starter list
  extraTerms: [{ term: 'My Label Artist', kind: 'artist' }],
  media: 'music',             // or 'image' | 'video' | 'all'
  allowlist: ['harbor'],      // never flag these phrases
});
```

Set `replaceBlocklist: true` to ignore the shipped starter list.

### Options

| Option | Meaning |
| --- | --- |
| `blocklist` | User JSON (grouped object or flat array). Merged with the starter list. |
| `replaceBlocklist` | Use only the provided list. |
| `extraTerms` | Extra `{ term, kind, verdict? }` rows. |
| `media` | Drop entries that do not apply (`music` / `image` / `video` / `all`). |
| `allowlist` | Extra mood/era phrases that must never flag. |

## Blocklist JSON

Edit `data/blocklist.json` or pass your own:

```json
{
  "artists": ["Zorblin Faye", { "term": "Queen", "commonWord": true }],
  "works": ["Neon Glass Harbor"],
  "franchises": ["Crystal Finch Saga"],
  "trademarks": [{ "term": "Lumistitch", "media": ["image", "video"] }]
}
```

- **artists** default to `review`
- **works / franchises / trademarks** default to `block`
- `commonWord: true` only flags a capitalized token or a nearby rights cue (`style`, `cover`, `lyrics`, `sounds`, …) so `drama queen` stays clean
- `aliases` and leading `The` / `A` / `An` are also matched
- Matching is word-boundary, case-insensitive, accent-folded (`Beyoncé` = `beyonce`)

Import the shipped file as `copyright-censor/blocklist.json`.

**Do not add copyrighted lyrics.** Titles, names, and franchise labels only.

## Heuristics (no stored lyrics)

These fire without a list hit:

- Reproduction: `cover of`, `lyrics from`, `word for word`, `recreate the song`, `chorus:`, `screenshot from`, …
- Likeness: `in the style of`, `inspired by`, `voice of`, `official logo`
- A long quoted passage (8+ words) is treated as a pasted lyric-like excerpt — tests use invented or public-domain strings only

Generic “sounds like rain on tin” is allowed. “sounds like Queen” is review because of the artist term.

## CLI

```bash
npx copyright-censor "dreamy 80s synthwave"
npx copyright-censor --json "cover of Neon Glass Harbor"
npx copyright-censor --positive "warm pads" --negative "no crowd noise"
npx copyright-censor --blocklist ./my-list.json --media music "…"
```

Exit codes: `0` allow, `1` review, `2` block, `64` usage.

## Browser demo

From the repo root (ESM + JSON imports need a static server):

```bash
npm run demo
```

Open [http://localhost:4173/demo/](http://localhost:4173/demo/). Type in the positive/negative fields; flagged words highlight as you type.

## What this is not

- Not legal advice and not a guarantee you are clear to ship a generation
- Not a lyrics database, fingerprint, or Content ID replacement
- Not a tool for finding, storing, or reproducing copyrighted works

If a lawsuit would wreck the product, treat `review` as “do not send to the model until a human looks at it,” and `block` as “do not send.”

## License

MIT
