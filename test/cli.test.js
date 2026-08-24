import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const bin = fileURLToPath(new URL('../bin/copyright-censor.js', import.meta.url));
const fixture = fileURLToPath(new URL('./fixtures/invented.json', import.meta.url));

function run(args, input) {
  return spawnSync(process.execPath, [bin, ...args], {
    encoding: 'utf8',
    input,
  });
}

describe('CLI', () => {
  it('allows a generic mood prompt and exits 0', () => {
    const result = run(['dreamy 80s synthwave']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /ALLOW/);
  });

  it('prints JSON and uses the invented blocklist', () => {
    const result = run(['--json', '--replace-blocklist', '-b', fixture, 'please sing Neon Glass Harbor']);
    assert.equal(result.status, 2);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.verdict, 'block');
    assert.equal(parsed.spans[0].text, 'Neon Glass Harbor');
  });

  it('checks a positive/negative pair', () => {
    const result = run([
      '--replace-blocklist',
      '-b',
      fixture,
      '-p',
      'Zorblin Faye vocals',
      '-n',
      'muddy mix',
    ]);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /REVIEW/);
    assert.match(result.stdout, /positive/);
  });

  it('reads stdin when no text argument is given', () => {
    const result = run(['--json'], 'warm analog pads\n');
    assert.equal(result.status, 0);
    assert.equal(JSON.parse(result.stdout).verdict, 'allow');
  });

  it('prints help', () => {
    const result = run(['--help']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage/);
  });
});
