# AI_CONTEXT｜ModsDevTool 專案事實

只記錄可從檔案確認的事實。規則見 `.agents/harness/project-rules.md`，流程見 `.agents/harness/engineering-workflow.md`。

## 用途

收集 Caspar 自製的 Claude Code mod（以 function hooks 撰寫的 plugin），讓同一組 mod 能在多台機器上使用：

- 每個 mod 一個資料夾 `mods/<name>/`，可持續新增。
- `scripts/mods.mjs` 把本機有、repo 沒有的 mod 加進 repo（push），也把 repo 有、本機沒有的 mod 安裝到 `~/.claude/mods/` 並註冊載入（install）。
- 遠端：`https://github.com/chielinHsu/ModsDevTool.git`（分支 `main`）。

## 技術棧

- 同步腳本：Node.js（ES modules，只用內建模組，無 npm 相依）。本機確認 Node v24.21.0；腳本用到 `fs.rmSync`、`node:test`，`TODO(project)`：最低支援版本尚未在其他機器確認。
- 外部工具：`git`（必要）；`claude` CLI（可選，push 前執行 `claude plugin validate`）。
- mod：TypeScript／TSX hooks 模組，API 為 Claude Code function hooks（early access，型別由引擎寫入各 mod 的 `.claude-plugin/types/`，不進版控）。
- 協作腳本：PowerShell 5.1（`scripts/ai/*.ps1`）、Node（`scripts/ai/*.mjs`、`.claude/hooks/model_router.mjs`）。

## 重要目錄

| 路徑 | 內容 |
|---|---|
| `mods/<name>/` | 一個 mod：`.claude-plugin/plugin.json`、`hooks/hooks.json`、`hooks/*.ts(x)`、`types/index.d.ts`、測試 |
| `.claude-plugin/marketplace.json` | 由 `scripts/mods.mjs` 依 `mods/*` 產生的 marketplace 清單 |
| `scripts/mods.mjs` | 同步腳本指令列入口（git、`claude` CLI） |
| `scripts/mods/lib.mjs` | 同步核心：找 mod、比對內容、複製、註冊 `CLAUDE_CODE_PLUGIN_DIRS` |
| `tests/mods.test.mjs` | 同步核心的測試（暫存資料夾，不碰真實設定） |
| `~/.claude/mods/<name>/` | 本機安裝位置（不在 repo） |
| `~/.claude/dev-mods/<session>/<name>/` | Claude Code session 中開發的 mod 草稿（不在 repo） |

## 建置與測試

| 目的 | 指令 |
|---|---|
| 同步核心測試 | `node --test tests/mods.test.mjs` |
| 查看三處狀態（唯讀） | `node scripts/mods.mjs status` |
| 預覽 push／install | `node scripts/mods.mjs push --dry-run`、`node scripts/mods.mjs install --dry-run` |
| 驗證單一 mod | `claude plugin validate mods/<name>`、`claude plugin test mods/<name>` |
| AI 結構檢查 | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ai/check-ai-structure.ps1` |
| 技能鏡像檢查 | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ai/sync-skills.ps1 -Check` |
| 模型路由檢查 | `node scripts/ai/check-model-routing.mjs` |

沒有建置步驟；mod 由 Claude Code 直接載入原始碼。

## 限制與不變條件

- `mods/<name>/` 的資料夾名稱必須等於 `plugin.json` 的 `name`，否則腳本不會列入。
- 同步不包含引擎產生的 `.claude-plugin/types/`、含 `.claude-plugin/types` 的 `tsconfig.json`、`*.log`／`*.tmp`／`*.bak`、`node_modules/`。
- 內容比對以 LF 正規化後的雜湊為準；`.gitattributes` 讓 repo 內文字檔維持 LF。
- 腳本預設只新增缺少的 mod；內容不同時要 `--update` 才取代，install 取代前備份到 `~/.claude/mods-backup/`。
- push 前 `mods/` 與 `marketplace.json` 必須沒有未提交修改；stage 只列出 mod 資料夾與 marketplace 的明確路徑。
- 本機 mod 的載入方式：路徑列在 `~/.claude/settings.json` 的 `env.CLAUDE_CODE_PLUGIN_DIRS`（Windows 以 `;` 分隔，其他平台 `:`），需重開 Claude Code 才生效。
- Windows 上網路 git 指令預設加 `-c http.sslBackend=schannel`（本機 Git for Windows 的 OpenSSL 無法驗證 GitHub 憑證）；`MODS_GIT_SSL_BACKEND=default` 可關閉。

## 詞彙

- **mod**：Claude Code 的 function-hooks plugin，一個資料夾一個。
- **draft**：`~/.claude/dev-mods/` 裡 session 中開發、熱重載的 mod。
- **installed**：`~/.claude/mods/<name>/` 的 mod。
- **registered**：安裝位置已列在 `CLAUDE_CODE_PLUGIN_DIRS`。

## Context Routing

| 任務 | 應讀文件 |
|---|---|
| 新增或修改某個 mod | `mods/<name>/`、`plugin-authoring` skill（Claude Code） |
| 改同步腳本 | `scripts/mods/lib.mjs`、`scripts/mods.mjs`、`tests/mods.test.mjs`、`docs/architecture.md` |
| 改安裝或註冊方式 | `docs/architecture.md`、`docs/decisions.md` |
| 換機台或第一次使用 | `README.md` |
| AI 協作結構與路由 | `MODEL_ROUTING.md`、`.agents/harness/`、`scripts/ai/` |
