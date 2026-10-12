// 跨機台同步 Claude Code mod 的核心邏輯：找出本機與 repo 的 mod、比對內容、複製與註冊。
// 不呼叫 git 或網路；git 操作在 scripts/mods.mjs。所有路徑相關函式都可傳入目錄，方便測試。
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const MODS_DIR = 'mods';
export const MARKETPLACE_FILE = path.join('.claude-plugin', 'marketplace.json');
export const DEFAULT_MARKETPLACE = {
  name: 'mods-dev-tool',
  owner: { name: 'Caspar Hsu' },
  description: "Caspar's Claude Code mods, one folder each under mods/",
};
export const PLUGIN_DIRS_ENV = 'CLAUDE_CODE_PLUGIN_DIRS';

const NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
const IGNORED_NAMES = new Set(['node_modules', '.git', '.DS_Store', 'Thumbs.db']);
const IGNORED_FILES = /\.(log|tmp|bak)$/i;

/** Claude Code 設定目錄：`MODS_CLAUDE_DIR` > `CLAUDE_CONFIG_DIR` > `~/.claude`。 */
export function claudeDir(env = process.env) {
  return path.resolve(env.MODS_CLAUDE_DIR || env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'));
}

const toPosix = (rel) => rel.split(path.sep).join('/');

/** 引擎每次載入 mod 都會重寫的檔案，不屬於 mod 本身，不同步。 */
export function isGenerated(rel, absolute) {
  const r = toPosix(rel);
  if (r === '.claude-plugin/types' || r.startsWith('.claude-plugin/types/')) return true;
  if (r === 'tsconfig.json') {
    try {
      return fs.readFileSync(absolute, 'utf8').includes('.claude-plugin/types');
    } catch {
      return false;
    }
  }
  return false;
}

/** mod 資料夾裡要同步的檔案，posix 相對路徑，已排序。 */
export function listModFiles(dir) {
  const out = [];
  const walk = (sub) => {
    for (const entry of fs.readdirSync(path.join(dir, sub), { withFileTypes: true })) {
      const rel = sub ? path.join(sub, entry.name) : entry.name;
      const abs = path.join(dir, rel);
      if (IGNORED_NAMES.has(entry.name) || entry.isSymbolicLink() || isGenerated(rel, abs)) continue;
      if (entry.isDirectory()) walk(rel);
      else if (entry.isFile() && !IGNORED_FILES.test(entry.name)) out.push(toPosix(rel));
    }
  };
  walk('');
  return out.sort();
}

/** `.claude-plugin/plugin.json` 的 name／version／description；不是 mod 時回傳 null。 */
export function readManifest(dir) {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, '.claude-plugin', 'plugin.json'), 'utf8'));
    if (!manifest || typeof manifest.name !== 'string' || !NAME.test(manifest.name)) return null;
    return { name: manifest.name, version: manifest.version ?? null, description: manifest.description ?? '' };
  } catch {
    return null;
  }
}

/** 內容雜湊：文字檔換行一律視為 LF，Git 在 Windows 轉成 CRLF 也算相同。 */
export function contentHash(dir) {
  const hash = crypto.createHash('sha256');
  for (const rel of listModFiles(dir)) {
    const bytes = fs.readFileSync(path.join(dir, rel));
    const isText = !bytes.includes(0);
    hash.update(rel).update('\0').update(isText ? bytes.toString('utf8').replace(/\r\n/g, '\n') : bytes).update('\0');
  }
  return hash.digest('hex');
}

/** mod 內最新檔案的修改時間（毫秒）。 */
export function newestMtime(dir) {
  return listModFiles(dir).reduce((max, rel) => Math.max(max, fs.statSync(path.join(dir, rel)).mtimeMs), 0);
}

function describe(dir, kind) {
  const manifest = readManifest(dir);
  if (!manifest) return null;
  return { name: manifest.name, manifest, dir, kind, mtime: newestMtime(dir), hash: contentHash(dir) };
}

const childDirs = (dir) => {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => path.join(dir, e.name));
  } catch {
    return [];
  }
};

/**
 * 本機所有 mod：已安裝（`<claude>/mods/*`）、各 session 草稿（`<claude>/dev-mods/*\/*`）與額外資料夾。
 * 回傳 Map<name, candidate[]>，candidate 為 { name, manifest, dir, kind, mtime, hash }。
 */
export function discoverLocal({ claude = claudeDir(), extraDirs = [] } = {}) {
  const found = new Map();
  const add = (candidate) => {
    if (!candidate) return;
    if (!found.has(candidate.name)) found.set(candidate.name, []);
    found.get(candidate.name).push(candidate);
  };
  for (const dir of childDirs(path.join(claude, 'mods'))) add(describe(dir, 'installed'));
  for (const session of childDirs(path.join(claude, 'dev-mods'))) {
    for (const dir of childDirs(session)) add(describe(dir, 'draft'));
  }
  for (const extra of extraDirs) {
    const self = describe(path.resolve(extra), 'extra');
    if (self) add(self);
    else for (const dir of childDirs(path.resolve(extra))) add(describe(dir, 'extra'));
  }
  return found;
}

/** 同名 mod 有多份時取內容最新的一份。 */
export function pickNewest(candidates) {
  return [...candidates].sort((a, b) => b.mtime - a.mtime)[0];
}

/** repo 的 `mods/*`，Map<name, { name, manifest, dir, hash }>。資料夾名稱必須等於 manifest 的 name。 */
export function discoverRepo(repoRoot) {
  const found = new Map();
  for (const dir of childDirs(path.join(repoRoot, MODS_DIR))) {
    const mod = describe(dir, 'repo');
    if (mod && path.basename(dir) === mod.name) found.set(mod.name, mod);
  }
  return found;
}

/** 以 src 取代 dest：先刪除 dest，再複製 src 中要同步的檔案。 */
export function copyMod(src, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  for (const rel of listModFiles(src)) {
    const target = path.join(dest, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(src, rel), target);
  }
}

/** 由 `mods/*` 產生 marketplace.json，保留既有的 name、owner 與其他欄位。 */
export function buildMarketplace(repoRoot, existing = null) {
  const base = existing && typeof existing === 'object' ? existing : DEFAULT_MARKETPLACE;
  const plugins = [...discoverRepo(repoRoot).values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((mod) => ({
      name: mod.name,
      source: `./${MODS_DIR}/${mod.name}`,
      description: mod.manifest.description,
      ...(mod.manifest.version ? { version: mod.manifest.version } : {}),
    }));
  return {
    ...base,
    name: base.name || DEFAULT_MARKETPLACE.name,
    owner: base.owner || DEFAULT_MARKETPLACE.owner,
    description: base.description || DEFAULT_MARKETPLACE.description,
    plugins,
  };
}

export function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
  } catch {
    return fallback;
  }
}

/** 寫 JSON，沿用原檔縮排（預設 2），結尾換行。 */
export function writeJson(file, value) {
  let indent = 2;
  try {
    const m = fs.readFileSync(file, 'utf8').match(/\n([ \t]+)"/);
    if (m) indent = m[1];
  } catch {
    // 新檔案
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, indent)}\n`);
}

/** 重新產生 marketplace.json；內容沒變就不寫，回傳是否改變。 */
export function writeMarketplace(repoRoot) {
  const file = path.join(repoRoot, MARKETPLACE_FILE);
  const existing = readJson(file, null);
  const next = buildMarketplace(repoRoot, existing);
  if (existing && JSON.stringify(existing) === JSON.stringify(next)) return false;
  writeJson(file, next);
  return true;
}

const samePath = (a, b, platform) => {
  const norm = (p) => path.resolve(p).replace(/[\\/]+$/, '');
  return platform === 'win32' ? norm(a).toLowerCase() === norm(b).toLowerCase() : norm(a) === norm(b);
};

/** 把 dirs 加進 `CLAUDE_CODE_PLUGIN_DIRS` 的值，保留原有項目與順序；回傳 { value, added }。 */
export function mergePluginDirs(current, dirs, platform = process.platform) {
  const sep = platform === 'win32' ? ';' : ':';
  const entries = String(current || '').split(sep).map((s) => s.trim()).filter(Boolean);
  const added = [];
  for (const dir of dirs) {
    const spelled = platform === 'win32' ? dir.replace(/\\/g, '/') : dir;
    if (![...entries, ...added].some((e) => samePath(e, spelled, platform))) added.push(spelled);
  }
  return { value: [...entries, ...added].join(sep), added };
}

/** 在 `<claude>/settings.json` 的 env 註冊 mod 資料夾。改動前備份原檔一次。 */
export function registerPluginDirs({ claude = claudeDir(), dirs, platform = process.platform, dryRun = false }) {
  const file = path.join(claude, 'settings.json');
  const settings = readJson(file, {});
  const env = settings.env && typeof settings.env === 'object' ? settings.env : {};
  const { value, added } = mergePluginDirs(env[PLUGIN_DIRS_ENV], dirs, platform);
  if (added.length === 0 || dryRun) return { file, added, changed: false };
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.mods-backup`);
  writeJson(file, { ...settings, env: { ...env, [PLUGIN_DIRS_ENV]: value } });
  return { file, added, changed: true };
}

export function registeredDirs(claude = claudeDir(), platform = process.platform) {
  const env = readJson(path.join(claude, 'settings.json'), {}).env || {};
  return String(env[PLUGIN_DIRS_ENV] || '').split(platform === 'win32' ? ';' : ':').map((s) => s.trim()).filter(Boolean);
}

export function isRegistered(dir, claude = claudeDir(), platform = process.platform) {
  return registeredDirs(claude, platform).some((e) => samePath(e, dir, platform));
}

/** 每個 mod 在本機、repo、安裝位置三處的狀態。 */
export function status({ repoRoot, claude = claudeDir(), extraDirs = [], platform = process.platform }) {
  const local = discoverLocal({ claude, extraDirs });
  const repo = discoverRepo(repoRoot);
  const names = [...new Set([...local.keys(), ...repo.keys()])].sort();
  return names.map((name) => {
    const newest = local.has(name) ? pickNewest(local.get(name)) : null;
    const inRepo = repo.get(name) || null;
    const installedDir = path.join(claude, 'mods', name);
    const installed = readManifest(installedDir) ? contentHash(installedDir) : null;
    return {
      name,
      local: newest,
      repo: inRepo,
      repoState: !inRepo ? 'missing' : !newest ? 'repo-only' : newest.hash === inRepo.hash ? 'same' : 'differs',
      installState: !inRepo ? 'n/a' : installed === null ? 'missing' : installed === inRepo.hash ? 'same' : 'differs',
      registered: isRegistered(installedDir, claude, platform),
    };
  });
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

/**
 * 把本機 mod 放進 repo 的 `mods/<name>`：repo 沒有的一律加入；內容不同的只在 update 時取代。
 * 回傳 { added, updated, skipped }，各為 { name, from } 清單；dryRun 時不寫檔。
 */
export function stageMods({ repoRoot, claude = claudeDir(), extraDirs = [], names = [], update = false, dryRun = false }) {
  const local = discoverLocal({ claude, extraDirs });
  const repo = discoverRepo(repoRoot);
  const wanted = names.length > 0 ? names : [...local.keys()].sort();
  const result = { added: [], updated: [], skipped: [], unknown: [] };
  for (const name of wanted) {
    if (!local.has(name)) {
      result.unknown.push({ name });
      continue;
    }
    const newest = pickNewest(local.get(name));
    const inRepo = repo.get(name);
    const entry = { name, from: newest.dir };
    if (!inRepo) result.added.push(entry);
    else if (inRepo.hash === newest.hash) continue;
    else if (update) result.updated.push(entry);
    else {
      result.skipped.push({ ...entry, reason: 'repo 版本不同；加 --update 以本機最新版取代' });
      continue;
    }
    if (!dryRun) copyMod(newest.dir, path.join(repoRoot, MODS_DIR, name));
  }
  return result;
}

/**
 * 把 repo 的 mod 安裝到 `<claude>/mods/<name>` 並註冊到 CLAUDE_CODE_PLUGIN_DIRS。
 * 本機沒有的一律安裝；內容不同的只在 update 時取代，舊版先備份到 `<claude>/mods-backup/`。
 */
export function installMods({ repoRoot, claude = claudeDir(), names = [], update = false, dryRun = false, platform = process.platform }) {
  const repo = discoverRepo(repoRoot);
  const wanted = names.length > 0 ? names : [...repo.keys()].sort();
  const result = { installed: [], updated: [], skipped: [], unknown: [], same: [], registered: [], settingsFile: null };
  const keep = [];
  for (const name of wanted) {
    const mod = repo.get(name);
    if (!mod) {
      result.unknown.push({ name });
      continue;
    }
    const dest = path.join(claude, 'mods', name);
    const current = readManifest(dest) ? contentHash(dest) : null;
    if (current === null) {
      result.installed.push({ name, to: dest });
      if (!dryRun) copyMod(mod.dir, dest);
    } else if (current === mod.hash) {
      result.same.push({ name, to: dest });
    } else if (update) {
      const backup = path.join(claude, 'mods-backup', `${name}-${stamp()}`);
      result.updated.push({ name, to: dest, backup });
      if (!dryRun) {
        copyMod(dest, backup);
        copyMod(mod.dir, dest);
      }
    } else {
      result.skipped.push({ name, to: dest, reason: '本機已安裝的版本不同；加 --update 以 repo 版本取代（舊版會備份）' });
    }
    keep.push(dest);
  }
  const reg = registerPluginDirs({ claude, dirs: keep, platform, dryRun });
  result.registered = reg.added;
  result.settingsFile = reg.file;
  return result;
}
