// scripts/mods/lib.mjs 的測試：在暫存資料夾模擬 ~/.claude 與 repo，不碰真的設定。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';

import {
  buildMarketplace,
  contentHash,
  discoverLocal,
  discoverRepo,
  installMods,
  listModFiles,
  mergePluginDirs,
  registerPluginDirs,
  stageMods,
  status,
  writeMarketplace,
} from '../scripts/mods/lib.mjs';

let tmp;
let claude;
let repo;

function writeMod(dir, name, { version = '0.1.0', body = 'export const register = () => {}\n' } = {}) {
  const files = {
    '.claude-plugin/plugin.json': JSON.stringify({ name, version, description: `${name} mod` }),
    'hooks/hooks.json': '{ "modules": ["./register.ts"] }\n',
    'hooks/register.ts': body,
  };
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  return dir;
}

const touch = (dir, seconds) => {
  for (const rel of listModFiles(dir)) fs.utimesSync(path.join(dir, rel), seconds, seconds);
};

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mods test '));
  claude = path.join(tmp, 'claude home');
  repo = path.join(tmp, 'repo');
  fs.mkdirSync(repo, { recursive: true });
});

afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('listModFiles 與 contentHash', () => {
  test('排除引擎產生的檔案、log 與 node_modules', () => {
    const dir = writeMod(path.join(tmp, 'm'), 'm');
    fs.mkdirSync(path.join(dir, '.claude-plugin/types/claude-code'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.claude-plugin/types/claude-code/index.d.ts'), 'x');
    fs.writeFileSync(path.join(dir, 'tsconfig.json'), '{ "extends": "./.claude-plugin/types/tsconfig.json" }');
    fs.writeFileSync(path.join(dir, 'trace.log'), 'noise');
    fs.mkdirSync(path.join(dir, 'node_modules/x'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'node_modules/x/a.js'), 'x');
    assert.deepEqual(listModFiles(dir), ['.claude-plugin/plugin.json', 'hooks/hooks.json', 'hooks/register.ts']);
  });

  test('mod 自己寫的 tsconfig.json 會保留', () => {
    const dir = writeMod(path.join(tmp, 'm'), 'm');
    fs.writeFileSync(path.join(dir, 'tsconfig.json'), '{ "compilerOptions": { "strict": true } }');
    assert.ok(listModFiles(dir).includes('tsconfig.json'));
  });

  test('CRLF 與 LF 視為相同內容，實際修改則不同', () => {
    const a = writeMod(path.join(tmp, 'a'), 'm', { body: 'line1\nline2\n' });
    const b = writeMod(path.join(tmp, 'b'), 'm', { body: 'line1\r\nline2\r\n' });
    const c = writeMod(path.join(tmp, 'c'), 'm', { body: 'line1\nline3\n' });
    assert.equal(contentHash(a), contentHash(b));
    assert.notEqual(contentHash(a), contentHash(c));
  });
});

describe('discoverLocal', () => {
  test('找到已安裝、session 草稿與 --from，同名取最新', () => {
    touch(writeMod(path.join(claude, 'mods', 'alpha'), 'alpha', { body: 'old\n' }), 1_000);
    touch(writeMod(path.join(claude, 'dev-mods', 'session-1', 'alpha'), 'alpha', { body: 'new\n' }), 2_000);
    writeMod(path.join(claude, 'dev-mods', 'session-2', 'beta'), 'beta');
    writeMod(path.join(tmp, 'extra', 'gamma'), 'gamma');
    fs.mkdirSync(path.join(claude, 'mods', 'not-a-mod'), { recursive: true });

    const found = discoverLocal({ claude, extraDirs: [path.join(tmp, 'extra')] });
    assert.deepEqual([...found.keys()].sort(), ['alpha', 'beta', 'gamma']);
    assert.equal(found.get('alpha').length, 2);
    const plan = stageMods({ repoRoot: repo, claude, names: ['alpha'], dryRun: true });
    assert.equal(plan.added[0].from, path.join(claude, 'dev-mods', 'session-1', 'alpha'));
  });
});

describe('stageMods（push 的檔案部分）', () => {
  test('repo 沒有的 mod 加入 mods/<name>；相同的略過；不同的要 --update', () => {
    writeMod(path.join(claude, 'mods', 'alpha'), 'alpha');
    writeMod(path.join(claude, 'mods', 'beta'), 'beta', { body: 'local\n' });
    writeMod(path.join(repo, 'mods', 'beta'), 'beta', { body: 'repo\n' });

    const first = stageMods({ repoRoot: repo, claude });
    assert.deepEqual(first.added.map((a) => a.name), ['alpha']);
    assert.deepEqual(first.skipped.map((s) => s.name), ['beta']);
    assert.ok(fs.existsSync(path.join(repo, 'mods', 'alpha', 'hooks', 'register.ts')));
    assert.equal(fs.readFileSync(path.join(repo, 'mods', 'beta', 'hooks', 'register.ts'), 'utf8'), 'repo\n');

    const again = stageMods({ repoRoot: repo, claude });
    assert.equal(again.added.length, 0);

    const forced = stageMods({ repoRoot: repo, claude, update: true });
    assert.deepEqual(forced.updated.map((u) => u.name), ['beta']);
    assert.equal(fs.readFileSync(path.join(repo, 'mods', 'beta', 'hooks', 'register.ts'), 'utf8'), 'local\n');
  });

  test('只處理指定名稱，名稱不存在時回報', () => {
    writeMod(path.join(claude, 'mods', 'alpha'), 'alpha');
    writeMod(path.join(claude, 'mods', 'beta'), 'beta');
    const result = stageMods({ repoRoot: repo, claude, names: ['beta', 'ghost'] });
    assert.deepEqual(result.added.map((a) => a.name), ['beta']);
    assert.deepEqual(result.unknown.map((u) => u.name), ['ghost']);
    assert.ok(!fs.existsSync(path.join(repo, 'mods', 'alpha')));
  });

  test('dry-run 不寫檔', () => {
    writeMod(path.join(claude, 'mods', 'alpha'), 'alpha');
    stageMods({ repoRoot: repo, claude, dryRun: true });
    assert.ok(!fs.existsSync(path.join(repo, 'mods')));
  });
});

describe('marketplace.json', () => {
  test('依 mods/* 產生，保留既有 name 與 owner', () => {
    writeMod(path.join(repo, 'mods', 'zeta'), 'zeta');
    writeMod(path.join(repo, 'mods', 'alpha'), 'alpha', { version: '1.2.0' });
    const market = buildMarketplace(repo, { name: 'mine', owner: { name: 'Me' }, metadata: { x: 1 } });
    assert.equal(market.name, 'mine');
    assert.deepEqual(market.owner, { name: 'Me' });
    assert.deepEqual(market.metadata, { x: 1 });
    assert.deepEqual(market.plugins.map((p) => [p.name, p.source, p.version]), [
      ['alpha', './mods/alpha', '1.2.0'],
      ['zeta', './mods/zeta', '0.1.0'],
    ]);
  });

  test('資料夾名稱與 manifest name 不符的不列入', () => {
    writeMod(path.join(repo, 'mods', 'folder'), 'other-name');
    assert.equal(discoverRepo(repo).size, 0);
  });

  test('內容沒變就不重寫', () => {
    writeMod(path.join(repo, 'mods', 'alpha'), 'alpha');
    assert.equal(writeMarketplace(repo), true);
    assert.equal(writeMarketplace(repo), false);
  });
});

describe('CLAUDE_CODE_PLUGIN_DIRS', () => {
  test('Windows：分號分隔、正斜線、不分大小寫去重', () => {
    const merged = mergePluginDirs('C:/Users/me/.claude/mods/a;C:/Users/me/.claude/mods/b', [
      'C:\\Users\\ME\\.claude\\mods\\a',
      'C:\\Users\\me\\.claude\\mods\\c',
    ], 'win32');
    assert.equal(merged.value, 'C:/Users/me/.claude/mods/a;C:/Users/me/.claude/mods/b;C:/Users/me/.claude/mods/c');
    assert.deepEqual(merged.added, ['C:/Users/me/.claude/mods/c']);
  });

  test('macOS／Linux：冒號分隔', () => {
    const merged = mergePluginDirs('', ['/home/me/.claude/mods/a', '/home/me/.claude/mods/a'], 'linux');
    assert.equal(merged.value, '/home/me/.claude/mods/a');
  });

  test('註冊時保留 settings.json 其他設定並備份', () => {
    fs.mkdirSync(claude, { recursive: true });
    const file = path.join(claude, 'settings.json');
    fs.writeFileSync(file, JSON.stringify({ model: 'opus', env: { OTHER: '1' }, permissions: { deny: ['x'] } }, null, 2));
    const result = registerPluginDirs({ claude, dirs: [path.join(claude, 'mods', 'alpha')] });
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(result.changed, true);
    assert.equal(saved.model, 'opus');
    assert.equal(saved.env.OTHER, '1');
    assert.deepEqual(saved.permissions, { deny: ['x'] });
    assert.ok(saved.env.CLAUDE_CODE_PLUGIN_DIRS.includes('alpha'));
    assert.ok(fs.existsSync(`${file}.mods-backup`));
    assert.equal(registerPluginDirs({ claude, dirs: [path.join(claude, 'mods', 'alpha')] }).changed, false);
  });
});

describe('installMods（換機台）', () => {
  test('安裝本機沒有的 mod 並註冊；已一致的不動；不同的要 --update 且先備份', () => {
    writeMod(path.join(repo, 'mods', 'alpha'), 'alpha');
    writeMod(path.join(repo, 'mods', 'beta'), 'beta', { body: 'repo\n' });
    writeMod(path.join(claude, 'mods', 'beta'), 'beta', { body: 'mine\n' });

    const first = installMods({ repoRoot: repo, claude });
    assert.deepEqual(first.installed.map((i) => i.name), ['alpha']);
    assert.deepEqual(first.skipped.map((s) => s.name), ['beta']);
    assert.equal(fs.readFileSync(path.join(claude, 'mods', 'beta', 'hooks', 'register.ts'), 'utf8'), 'mine\n');
    assert.equal(first.registered.length, 2);

    const second = installMods({ repoRoot: repo, claude });
    assert.deepEqual(second.same.map((s) => s.name), ['alpha']);
    assert.equal(second.registered.length, 0);

    const forced = installMods({ repoRoot: repo, claude, update: true });
    assert.deepEqual(forced.updated.map((u) => u.name), ['beta']);
    assert.equal(fs.readFileSync(path.join(claude, 'mods', 'beta', 'hooks', 'register.ts'), 'utf8'), 'repo\n');
    assert.equal(fs.readFileSync(path.join(forced.updated[0].backup, 'hooks', 'register.ts'), 'utf8'), 'mine\n');
  });

  test('dry-run 不安裝也不改 settings.json', () => {
    writeMod(path.join(repo, 'mods', 'alpha'), 'alpha');
    const plan = installMods({ repoRoot: repo, claude, dryRun: true });
    assert.equal(plan.installed.length, 1);
    assert.ok(!fs.existsSync(path.join(claude, 'mods', 'alpha')));
    assert.ok(!fs.existsSync(path.join(claude, 'settings.json')));
  });
});

test('status 彙整三處狀態', () => {
  writeMod(path.join(claude, 'mods', 'alpha'), 'alpha');
  writeMod(path.join(claude, 'dev-mods', 's', 'draft-only'), 'draft-only');
  writeMod(path.join(repo, 'mods', 'alpha'), 'alpha');
  writeMod(path.join(repo, 'mods', 'remote-only'), 'remote-only');
  const rows = Object.fromEntries(status({ repoRoot: repo, claude }).map((r) => [r.name, r]));
  assert.equal(rows.alpha.repoState, 'same');
  assert.equal(rows.alpha.installState, 'same');
  assert.equal(rows.alpha.registered, false);
  assert.equal(rows['draft-only'].repoState, 'missing');
  assert.equal(rows['remote-only'].repoState, 'repo-only');
  assert.equal(rows['remote-only'].installState, 'missing');
});
