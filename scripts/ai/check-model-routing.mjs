#!/usr/bin/env node
// 靜態檢查模型路由：角色 frontmatter、工具邊界、hook 接線、文件／角色／hook 的 model 與 effort 一致性，
// 以及本專案案例（五級路由、升降級、最高級、通知過濾、壞輸入）。不呼叫任何模型 API。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROUTER = path.join(ROOT, '.claude', 'hooks', 'model_router.mjs');

// ---------------------------------------------------------------------------
// 本專案案例（ModsDevTool）。與 MODEL_ROUTING.md「本專案案例」一致。
// ---------------------------------------------------------------------------
const CASES = [
  { prompt: '列出 mods/ 底下有哪些 mod', agent: 'fast-worker' },
  { prompt: '找出 scripts/mods/lib.mjs 註冊 CLAUDE_CODE_PLUGIN_DIRS 的位置', agent: 'fast-worker' },
  { prompt: '修正 README.md 的錯字', agent: 'developer' },
  { prompt: '在 mods/replay-theater/hooks/diff.ts 調整 diff 的 context 行數', agent: 'developer' },
  { prompt: '新增一個 mod：在 pane 顯示目前的 git 分支', agent: 'developer-deep' },
  { prompt: '修改 mods/blast-radius/hooks/register.tsx 的 tool.call 攔截規則', agent: 'architect' },
  { prompt: '修改同步腳本的 install，讓它也處理 marketplace', agent: 'architect' },
  { prompt: '分析同步腳本 push 偶發覆寫遠端 mod 的根因', agent: 'architect-deep' },
];
const FAILURE_FLOW_PROMPT = '在 mods/replay-theater/hooks/diff.ts 調整 diff 的 context 行數';
const ENV_PREFIX_EXPECTED = 'MODSDEV_ROUTER';

// ---------------------------------------------------------------------------
const results = [];
function check(name, cond, detail = '') {
  results.push({ name, ok: Boolean(cond), detail });
}
function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function parseFrontmatter(text) {
  const m = text.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return fm;
}
const list = (v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

function parseRoutingTable(md) {
  const rows = {};
  for (const line of md.split(/\r?\n/)) {
    const m = line.match(/^\|\s*(fast-worker|developer|developer-deep|architect|architect-deep)\s*\|\s*(\w+)\s*\|\s*(\w+)\s*\|/);
    if (m && !rows[m[1]]) rows[m[1]] = { model: m[2], effort: m[3] };
  }
  return rows;
}

const router = await import(pathToFileURL(ROUTER).href);
const { TIERS, route, emptyState, handle, ENV_PREFIX } = router;

// 1. 角色 frontmatter 與工具邊界 ---------------------------------------------
const READ_ONLY = new Set(['fast-worker', 'architect', 'architect-deep']);
const WRITE_TOOLS = ['Edit', 'Write', 'NotebookEdit', 'Bash', 'PowerShell'];
const VALID_MODELS = new Set(['haiku', 'sonnet', 'opus', 'fable', 'inherit']);
const VALID_EFFORT = new Set(['low', 'medium', 'high', 'xhigh', 'max']);
const agentsFm = {};
for (const tier of TIERS) {
  const rel = `.claude/agents/${tier.agent}.md`;
  let text = '';
  try { text = read(rel); } catch { check(`${rel} 存在`, false); continue; }
  const fm = parseFrontmatter(text);
  check(`${rel} frontmatter 可解析`, fm);
  if (!fm) continue;
  agentsFm[tier.agent] = fm;
  check(`${rel} name 相符`, fm.name === tier.agent, fm.name);
  check(`${rel} 有 description`, (fm.description || '').length > 10);
  check(`${rel} model 為有效別名`, VALID_MODELS.has(fm.model), fm.model);
  check(`${rel} effort 為有效值`, VALID_EFFORT.has(fm.effort), fm.effort);
  const tools = list(fm.tools);
  const denied = list(fm.disallowedTools);
  check(`${rel} 明確列出 tools`, tools.length > 0);
  check(`${rel} 不可委派（tools 無 Agent/Task 且 disallowedTools 含 Agent）`, !tools.includes('Agent') && !tools.includes('Task') && denied.includes('Agent'));
  if (READ_ONLY.has(tier.agent)) {
    const leaked = tools.filter((t) => WRITE_TOOLS.includes(t));
    check(`${rel} 唯讀角色沒有寫入／shell 工具`, leaked.length === 0, leaked.join(','));
    check(`${rel} 唯讀角色 disallowedTools 排除寫入與 shell`, WRITE_TOOLS.every((t) => denied.includes(t)), denied.join(','));
    check(`${rel} 文字說明不修改專案`, /不(直接)?修改專案|無法修改檔案|不能修改專案/.test(text));
  } else {
    check(`${rel} 文字禁止 git add/commit/push`, /git add/.test(text) && /git commit/.test(text) && /git push/.test(text));
  }
  for (const phrase of ['繁體中文', '不 stage、commit、push', '不再委派', '不覆蓋來源不明的未提交修改']) {
    check(`${rel} 含共同界線「${phrase}」`, text.includes(phrase));
  }
  for (const section of ['## 適用情境', '## 必讀資料', '## 工作方式', '## 工具邊界', '## 升級條件', '## 回報格式']) {
    check(`${rel} 含段落 ${section}`, text.includes(section));
  }
}

// 1b. 其他 subagent（專案既有角色）的工具邊界 ------------------------------------
const GUARD = path.join(ROOT, '.claude', 'hooks', 'readonly_bash_guard.mjs');
const tierNames = new Set(TIERS.map((t) => t.agent));
for (const file of fs.readdirSync(path.join(ROOT, '.claude', 'agents')).filter((f) => f.endsWith('.md'))) {
  const name = file.replace(/\.md$/, '');
  if (tierNames.has(name)) continue;
  const rel = `.claude/agents/${file}`;
  const text = read(rel);
  const fm = parseFrontmatter(text);
  check(`${rel} frontmatter 可解析`, fm);
  if (!fm) continue;
  const tools = list(fm.tools);
  const denied = list(fm.disallowedTools);
  check(`${rel} 不可委派`, !tools.includes('Agent') && !tools.includes('Task') && denied.includes('Agent'));
  if (/唯讀|read-only/i.test(fm.description || '') || /\*\*唯讀\*\*/.test(text)) {
    const leaked = tools.filter((t) => ['Edit', 'Write', 'NotebookEdit', 'PowerShell'].includes(t));
    check(`${rel} 唯讀角色沒有寫入工具`, leaked.length === 0, leaked.join(','));
    if (tools.includes('Bash')) {
      check(`${rel} 唯讀角色的 Bash 受 readonly_bash_guard 限制`, /^hooks:[\s\S]*PreToolUse[\s\S]*matcher:\s*"Bash"[\s\S]*readonly_bash_guard\.mjs[\s\S]*?\n---/m.test(text) && fs.existsSync(GUARD));
    }
  }
}

// 2. 文件／角色／hook 一致性 ----------------------------------------------------
const table = parseRoutingTable(read('MODEL_ROUTING.md'));
for (const tier of TIERS) {
  const doc = table[tier.agent];
  const fm = agentsFm[tier.agent] || {};
  check(`${tier.agent} 文件表存在`, doc);
  if (!doc) continue;
  check(`${tier.agent} model 一致（文件 ${doc.model}／角色 ${fm.model}／hook ${tier.model}）`, doc.model === fm.model && fm.model === tier.model);
  check(`${tier.agent} effort 一致（文件 ${doc.effort}／角色 ${fm.effort}／hook ${tier.effort}）`, doc.effort === fm.effort && fm.effort === tier.effort);
}
check('hook 環境變數前綴為本專案前綴', ENV_PREFIX === ENV_PREFIX_EXPECTED, ENV_PREFIX);
const routingDoc = read('MODEL_ROUTING.md');
check('MODEL_ROUTING.md 說明不會切換主 session 模型', /不會(自動)?切換主 session 的模型/.test(routingDoc));
check('MODEL_ROUTING.md 記錄停用與狀態目錄環境變數', routingDoc.includes(`${ENV_PREFIX}_DISABLED`) && routingDoc.includes(`${ENV_PREFIX}_STATE_DIR`));

// 3. hook 接線 ------------------------------------------------------------------
let settings = null;
try { settings = JSON.parse(read('.claude/settings.json')); } catch (e) { check('.claude/settings.json 可解析', false, e.message); }
if (settings) {
  const groups = settings.hooks?.UserPromptSubmit || [];
  const cmds = groups.flatMap((g) => (g.hooks || []).map((h) => h.command || ''));
  const cmd = cmds.find((c) => c.includes('model_router.mjs')) || '';
  check('UserPromptSubmit 接上 model_router.mjs', cmd);
  // 本機以 PowerShell 執行 hook 時，沒有大括號的 $CLAUDE_PROJECT_DIR 會展開成空字串（QAdvancePinInspect 2026-10-19 以 --debug hooks 實測）
  check('hook 指令以 ${CLAUDE_PROJECT_DIR} 引用並加引號（支援空白路徑、PowerShell）', /"\$\{CLAUDE_PROJECT_DIR\}\/\.claude\/hooks\/model_router\.mjs"/.test(cmd), cmd);
  check('hook 指令不使用沒有大括號的 $CLAUDE_PROJECT_DIR', !/\$CLAUDE_PROJECT_DIR/.test(cmd), cmd);
  check('settings 未設定 bypassPermissions', settings.permissions?.defaultMode !== 'bypassPermissions');
}
const routerSource = fs.readFileSync(ROUTER, 'utf8');
check('hook 不使用網路或子程序（不呼叫外部模型或 API）', !/\bfetch\s*\(|node:https?|node:net|child_process|XMLHttpRequest|WebSocket/.test(routerSource));

// 4. 本專案路由案例 ---------------------------------------------------------------
for (const c of CASES) {
  const r = route(c.prompt, emptyState());
  check(`路由「${c.prompt}」→ ${c.agent}`, r.recommendation.agent === c.agent, `實得 ${r.recommendation.agent}，分數 ${JSON.stringify(r.scores)}，範圍 ${r.scope}，驗證 ${r.verificationCost}`);
}
// MODEL_ROUTING.md「本專案案例」表的分數、範圍、驗證與結果必須和 hook 實際計算一致。
const caseSection = routingDoc.split('## 本專案案例')[1]?.split('\n## ')[0] || '';
const docCases = caseSection.split(/\r?\n/)
  .map((line) => line.match(/^\|\s*([^|]+?)\s*\|\s*(\d)／(\d)／(\d)／(\d)\s*\|\s*([\w-]+)／(\w+)\s*\|\s*([\w-]+)\s*\|/))
  .filter(Boolean);
check('MODEL_ROUTING.md 案例表可解析且至少 5 列', docCases.length >= 5, String(docCases.length));
for (const m of docCases) {
  const prompt = m[1].replace(/`/g, '');
  const r = route(prompt, emptyState());
  const s = r.scores;
  const actual = `${s.complexity}／${s.risk}／${s.reasoning}／${s.uncertainty} ${r.scope}／${r.verificationCost} ${r.recommendation.agent}`;
  const expected = `${m[2]}／${m[3]}／${m[4]}／${m[5]} ${m[6]}／${m[7]} ${m[8]}`;
  check(`文件案例與 hook 一致：${prompt}`, actual === expected, `文件 ${expected}；hook ${actual}`);
}
const covered = new Set(CASES.map((c) => c.agent));
check('案例涵蓋五級', TIERS.every((t) => covered.has(t.agent)));

// 5. 升降級與最高級 ----------------------------------------------------------------
{
  let s = emptyState();
  let r = route(FAILURE_FLOW_PROMPT, s); s = r.state;
  const base = r.recommendation.agent;
  r = route('還是不行，錯誤訊息一樣', s); s = r.state;
  check('一次失敗不升級', r.escalation.floor === null, JSON.stringify(r.escalation));
  r = route('換了做法還是不行', s); s = r.state;
  const idx = TIERS.findIndex((t) => t.agent === base);
  check(`兩次失敗升一級（${base} → ${TIERS[idx + 1]?.agent}）`, r.escalation.floor === TIERS[idx + 1]?.agent, JSON.stringify(r.escalation));
  check('升級事件附說明', r.escalation.events.some((e) => e.startsWith('escalated: ') && e.includes(TIERS[idx + 1]?.agent)), JSON.stringify(r.escalation.events));
  r = route('修正 docs 的錯字', s); s = r.state;
  check('升級後保留下限', TIERS.findIndex((t) => t.agent === r.recommendation.agent) >= idx + 1, r.recommendation.agent);
  r = route('已解決，謝謝', s); s = r.state;
  check('成功後重置下限與失敗次數', r.escalation.floor === null && r.escalation.failures === 0, JSON.stringify(r.escalation));
  r = route('修正 README.md 的錯字', s);
  check('重置後重新分級', r.recommendation.agent === 'developer', r.recommendation.agent);

  let m = emptyState();
  m = route('分析同步腳本 push 偶發覆寫遠端 mod 的根因', m).state;
  m = route('[router:fail] 已換方法仍失敗', m).state;
  const top = route('[router:fail] 再換方法仍失敗', m);
  check('最高級再失敗時標示 maxed、交由使用者決定', top.escalation.maxed === true && top.recommendation.agent === 'architect-deep', JSON.stringify(top.escalation));
  const reset = route('[router:reset]', top.state);
  check('[router:reset] 清除狀態', reset.escalation.maxed === false && reset.escalation.floor === null);
}

// 6. 通知過濾與壞輸入（子程序端對端，使用暫存狀態目錄） ----------------------------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'router check '));
function runHook(stdin, extraEnv = {}) {
  const res = spawnSync(process.execPath, [ROUTER], {
    input: stdin,
    encoding: 'utf8',
    env: { ...process.env, [`${ENV_PREFIX}_STATE_DIR`]: path.join(tmp, 'state dir'), CLAUDE_PROJECT_DIR: path.join(tmp, 'project with space'), ...extraEnv },
    timeout: 10000,
  });
  return { code: res.status, out: res.stdout || '', err: res.stderr || '' };
}
const ctx = (out) => { try { return JSON.parse(out).hookSpecificOutput.additionalContext; } catch { return ''; } };
const ev = (prompt, extra = {}) => JSON.stringify({ hook_event_name: 'UserPromptSubmit', session_id: 's-check', cwd: tmp, prompt, ...extra });
{
  const normal = runHook(ev('在 mods/replay-theater/hooks/diff.ts 調整 diff 的 context 行數'));
  let parsed = null;
  try { parsed = JSON.parse(normal.out); } catch { /* 下方檢查 */ }
  check('正常需求輸出 hookSpecificOutput.additionalContext', normal.code === 0 && parsed?.hookSpecificOutput?.hookEventName === 'UserPromptSubmit' && ctx(normal.out).includes('"agent":"developer"'), normal.out.slice(0, 200));
  check('輸出明示不會切換主 session 模型', ctx(normal.out).includes('不會切換主 session 的模型'));
  for (const [label, prompt] of [
    ['slash 指令', '/compact'],
    ['shell 直通', '!git status'],
    ['task-notification', '<task-notification><task-id>x</task-id></task-notification>'],
    ['system-reminder', '<system-reminder>背景</system-reminder>'],
    ['ci-monitor-event', '<ci-monitor-event>pr</ci-monitor-event>'],
    ['空白需求', '   '],
  ]) {
    const r = runHook(ev(prompt));
    check(`忽略${label}`, r.code === 0 && r.out === '', r.out.slice(0, 80));
  }
  check('其他事件忽略', (() => { const r = runHook(JSON.stringify({ hook_event_name: 'Stop', prompt: '修正錯字' })); return r.code === 0 && r.out === ''; })());
  check('壞 JSON 不阻斷（exit 0、無輸出）', (() => { const r = runHook('{not json'); return r.code === 0 && r.out === ''; })());
  check('空輸入不阻斷', (() => { const r = runHook(''); return r.code === 0 && r.out === ''; })());
  check('非字串 prompt 不阻斷', (() => { const r = runHook(JSON.stringify({ hook_event_name: 'UserPromptSubmit', prompt: 42 })); return r.code === 0 && r.out === ''; })());
  check('停用環境變數生效', (() => { const r = runHook(ev('修正錯字'), { [`${ENV_PREFIX}_DISABLED`]: '1' }); return r.code === 0 && r.out === ''; })());

  // 狀態檔損壞
  process.env[`${ENV_PREFIX}_STATE_DIR`] = path.join(tmp, 'state dir');
  const stateFile = router.statePath(path.join(tmp, 'project with space'), 's-check');
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, '{corrupt');
  const corrupt = runHook(ev('修正 README.md 的錯字'));
  check('狀態檔損壞仍正常建議', corrupt.code === 0 && ctx(corrupt.out).includes('"agent":"developer"'));

  // 寫入失敗：狀態目錄指向一般檔案
  const blocker = path.join(tmp, 'blocker-file');
  fs.writeFileSync(blocker, 'x');
  const unwritable = runHook(ev('修正 README.md 的錯字'), { [`${ENV_PREFIX}_STATE_DIR`]: blocker });
  check('狀態寫入失敗仍正常建議（stateSaved=false）', unwritable.code === 0 && ctx(unwritable.out).includes('"stateSaved":false'), unwritable.out.slice(0, 120));

  // 專案與 session 隔離
  const a = router.statePath('C:/proj A', 's1');
  const b = router.statePath('C:/proj B', 's1');
  const c = router.statePath('C:/proj A', 's2');
  check('狀態依專案與 session 隔離', a !== b && a !== c && path.dirname(a) !== path.dirname(b) && path.dirname(a) === path.dirname(c));

  // 跨 session 不互相影響
  runHook(ev('還是不行', { session_id: 'iso-1' }));
  runHook(ev('還是不行', { session_id: 'iso-1' }));
  const other = runHook(ev('修正 README.md 的錯字', { session_id: 'iso-2' }));
  check('另一 session 不繼承升級下限', ctx(other.out).includes('"agent":"developer"'), other.out.slice(0, 160));

  // 直接呼叫 handle 的壞輸入
  check('handle 對 null 安全', handle('null') === null);
}
fs.rmSync(tmp, { recursive: true, force: true });

// ---------------------------------------------------------------------------
const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? '  [通過]' : '  [失敗]'} ${r.name}${!r.ok && r.detail ? ` — ${r.detail}` : ''}`);
}
console.log(`\n結果：${results.length - failed.length}/${results.length} 通過${failed.length ? `，${failed.length} 失敗` : ''}（靜態設定與本機 hook 行為；未驗證平台實際載入）`);
process.exitCode = failed.length ? 1 : 0;
