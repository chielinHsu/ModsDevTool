#!/usr/bin/env node
// 跨機台同步 Claude Code mod：repo（mods/<name>）⇄ 本機（~/.claude/mods/<name>）。
// 用法見 README.md 或 `node scripts/mods.mjs help`。只用 Node 內建模組，Windows／macOS／Linux 皆可。
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MARKETPLACE_FILE,
  MODS_DIR,
  claudeDir,
  installMods,
  stageMods,
  status,
  writeMarketplace,
} from './mods/lib.mjs';

const HELP = `用法：node scripts/mods.mjs <指令> [mod 名稱...] [選項]

指令
  status            列出每個 mod 在本機、repo、安裝位置的狀態
  push [mod...]     把 repo 沒有的本機 mod 加進 mods/<name>，commit 並 push
  install [mod...]  把本機沒有的 repo mod 安裝到 ~/.claude/mods 並註冊載入
  sync              git pull → install → push（換機台時執行這個）
  help              顯示本說明

選項
  --update          內容不同的 mod 也以較新的一方取代（install 會先備份舊版）
  --dry-run         只顯示會做什麼，不寫檔、不 commit、不 push
  --no-push         push／sync：只 commit，不 git push
  --from <資料夾>    額外的 mod 來源資料夾（可重複）
  --repo <資料夾>    repo 根目錄（預設為本腳本所在的 repo）

環境變數
  MODS_CLAUDE_DIR        Claude 設定目錄（預設 CLAUDE_CONFIG_DIR 或 ~/.claude）
  MODS_GIT_SSL_BACKEND   Windows 網路 git 指令的 http.sslBackend（預設 schannel；設為 default 不指定）
`;

function parseArgs(argv) {
  const args = { command: argv[0] || 'help', names: [], update: false, dryRun: false, push: true, from: [], repo: null };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--update') args.update = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--no-push') args.push = false;
    else if (a === '--from') args.from.push(argv[++i]);
    else if (a === '--repo') args.repo = argv[++i];
    else if (a.startsWith('--')) throw new Error(`不認得的選項：${a}`);
    else args.names.push(a);
  }
  return args;
}

const log = (line = '') => console.log(line);

/** 依顯示寬度補空白：中日韓全形字算兩格。 */
const WIDE_RANGES = [[0x1100, 0x115f], [0x2e80, 0xa4cf], [0xac00, 0xd7a3], [0xf900, 0xfaff], [0xfe30, 0xfe4f], [0xff00, 0xff60], [0xffe0, 0xffe6]];
const isWide = (ch) => WIDE_RANGES.some(([from, to]) => ch.codePointAt(0) >= from && ch.codePointAt(0) <= to);
const pad = (text, width) => {
  const shown = [...String(text)].reduce((n, ch) => n + (isWide(ch) ? 2 : 1), 0);
  return `${text}${' '.repeat(Math.max(1, width - shown))}`;
};

// ---------------------------------------------------------------------------
// git
// ---------------------------------------------------------------------------
function sslArgs() {
  if (process.platform !== 'win32') return [];
  const backend = process.env.MODS_GIT_SSL_BACKEND ?? 'schannel';
  return backend && backend !== 'default' ? ['-c', `http.sslBackend=${backend}`] : [];
}

function git(repo, args, { network = false, allowFail = false } = {}) {
  const res = spawnSync('git', [...(network ? sslArgs() : []), ...args], { cwd: repo, encoding: 'utf8' });
  if (res.error) throw new Error(`無法執行 git：${res.error.message}`);
  if (res.status !== 0 && !allowFail) {
    throw new Error(`git ${args.join(' ')} 失敗（exit ${res.status}）\n${(res.stderr || res.stdout).trim()}`);
  }
  return { ok: res.status === 0, out: (res.stdout || '').trim(), err: (res.stderr || '').trim() };
}

const branchOf = (repo) => git(repo, ['rev-parse', '--abbrev-ref', 'HEAD'], { allowFail: true }).out || 'main';

function remoteHasBranch(repo, branch) {
  const res = git(repo, ['ls-remote', '--heads', 'origin', branch], { network: true, allowFail: true });
  if (!res.ok) throw new Error(`無法連到 origin：${res.err}`);
  return res.out !== '';
}

function pull(repo, dryRun) {
  const branch = branchOf(repo);
  if (!remoteHasBranch(repo, branch)) {
    log(`· origin 還沒有 ${branch} 分支，略過 pull`);
    return;
  }
  if (dryRun) {
    log(`· （dry-run）會執行 git pull --ff-only origin ${branch}`);
    return;
  }
  git(repo, ['pull', '--ff-only', 'origin', branch], { network: true });
  log(`· 已 pull origin/${branch}`);
}

/** mods/ 與 marketplace.json 有未提交修改時中止，避免蓋掉別人的變更。 */
function assertClean(repo) {
  const dirty = git(repo, ['status', '--porcelain', '--', MODS_DIR, MARKETPLACE_FILE.split(path.sep).join('/')]).out;
  if (dirty) throw new Error(`repo 的 mods/ 或 marketplace.json 有未提交的修改，先處理再執行：\n${dirty}`);
}

// ---------------------------------------------------------------------------
// claude CLI（可選）：push 前驗證 mod
// ---------------------------------------------------------------------------
function validate(repo, name) {
  const res = spawnSync('claude', ['plugin', 'validate', `${MODS_DIR}/${name}`], {
    cwd: repo,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (res.error || res.status === null) return { ran: false };
  return { ran: true, ok: res.status === 0, out: `${res.stdout || ''}${res.stderr || ''}`.trim() };
}

// ---------------------------------------------------------------------------
// 指令
// ---------------------------------------------------------------------------
function printStatus(ctx) {
  const rows = status(ctx);
  if (rows.length === 0) {
    log('找不到任何 mod。');
    return;
  }
  const label = {
    repoState: { missing: '未上傳', same: '一致', differs: '不同', 'repo-only': '僅 repo' },
    installState: { missing: '未安裝', same: '一致', differs: '不同', 'n/a': '—' },
  };
  log(`${pad('mod', 22)}${pad('本機來源', 12)}${pad('repo', 10)}${pad('安裝', 10)}已註冊`);
  for (const r of rows) {
    const from = r.local ? r.local.kind : '—';
    log(
      `${pad(r.name, 22)}${pad(from, 12)}${pad(label.repoState[r.repoState], 10)}` +
        `${pad(label.installState[r.installState], 10)}${r.registered ? '是' : '否'}`,
    );
  }
  log('\n本機來源：installed＝~/.claude/mods，draft＝~/.claude/dev-mods 的 session 草稿，extra＝--from');
}

function push(ctx, args) {
  const { repoRoot } = ctx;
  assertClean(repoRoot);
  const staged = stageMods({ ...ctx, names: args.names, update: args.update, dryRun: args.dryRun });
  for (const u of staged.unknown) log(`! 本機找不到 mod「${u.name}」`);
  for (const s of staged.skipped) log(`- ${s.name}：${s.reason}`);
  const changed = [...staged.added, ...staged.updated];
  if (changed.length === 0) {
    log('repo 不需要新增或更新任何 mod。');
    return;
  }
  for (const a of staged.added) log(`+ 新增 ${a.name}（來自 ${a.from}）`);
  for (const u of staged.updated) log(`~ 更新 ${u.name}（來自 ${u.from}）`);
  if (args.dryRun) {
    log('（dry-run）未寫檔、未 commit。');
    return;
  }

  writeMarketplace(repoRoot);
  let invalid = false;
  for (const { name } of changed) {
    const v = validate(repoRoot, name);
    if (!v.ran) log(`· 找不到 claude CLI，略過 ${name} 的 plugin validate`);
    else if (v.ok) log(`· ${name}：claude plugin validate 通過`);
    else {
      invalid = true;
      log(`! ${name}：claude plugin validate 失敗\n${v.out}`);
    }
  }
  if (invalid) throw new Error('有 mod 驗證失敗，已複製進 repo 但未 commit；修正後再執行 push。');

  const paths = [...changed.map(({ name }) => `${MODS_DIR}/${name}`), MARKETPLACE_FILE.split(path.sep).join('/')];
  git(repoRoot, ['add', '--', ...paths]);
  const verb = staged.updated.length > 0 && staged.added.length === 0 ? '更新' : '新增';
  const message = `${verb} mod：${changed.map((c) => c.name).join('、')}`;
  git(repoRoot, ['commit', '-m', message, '--', ...paths]);
  log(`· 已 commit：${message}`);
  if (!args.push) {
    log('· --no-push：未 push。');
    return;
  }
  git(repoRoot, ['push', '-u', 'origin', 'HEAD'], { network: true });
  log(`· 已 push 到 origin/${branchOf(repoRoot)}`);
}

function install(ctx, args) {
  const result = installMods({ ...ctx, names: args.names, update: args.update, dryRun: args.dryRun });
  const tag = args.dryRun ? '（dry-run）' : '';
  const touched = result.installed.length + result.updated.length + result.skipped.length + result.same.length;
  if (touched === 0 && result.unknown.length === 0) log('repo 的 mods/ 還沒有任何 mod。');
  for (const u of result.unknown) log(`! repo 沒有 mod「${u.name}」`);
  for (const i of result.installed) log(`+ ${tag}安裝 ${i.name} → ${i.to}`);
  for (const u of result.updated) log(`~ ${tag}更新 ${u.name} → ${u.to}（舊版備份到 ${u.backup}）`);
  for (const s of result.skipped) log(`- ${s.name}：${s.reason}`);
  for (const s of result.same) log(`= ${s.name} 已是最新`);
  if (result.registered.length > 0) {
    log(`+ ${tag}在 ${result.settingsFile} 的 env.CLAUDE_CODE_PLUGIN_DIRS 註冊：`);
    for (const d of result.registered) log(`    ${d}`);
  }
  if (!args.dryRun && (result.installed.length || result.updated.length || result.registered.length)) {
    log('重新啟動 Claude Code（或開新 session）後載入新的 mod。');
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (['help', '--help', '-h'].includes(args.command)) {
    log(HELP);
    return;
  }
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(args.repo || path.join(here, '..'));
  const ctx = { repoRoot, claude: claudeDir(), extraDirs: args.from };
  if (!fs.existsSync(path.join(repoRoot, '.git')) && args.command !== 'status') {
    throw new Error(`${repoRoot} 不是 git repo；先 git clone https://github.com/chielinHsu/ModsDevTool.git`);
  }
  log(`repo：${repoRoot}\nClaude 設定目錄：${ctx.claude}\n`);
  switch (args.command) {
    case 'status':
      printStatus(ctx);
      break;
    case 'push':
      push(ctx, args);
      break;
    case 'install':
      install(ctx, args);
      break;
    case 'sync':
      pull(repoRoot, args.dryRun);
      install(ctx, { ...args, names: [] });
      push(ctx, { ...args, names: [] });
      break;
    default:
      throw new Error(`不認得的指令：${args.command}\n\n${HELP}`);
  }
}

try {
  main();
} catch (error) {
  console.error(`錯誤：${error.message}`);
  process.exitCode = 1;
}
