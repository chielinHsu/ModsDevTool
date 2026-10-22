# ModsDevTool — AI Context

> 只寫「這個專案的事實」。工作流程在 `.agents/harness/engineering-workflow.md`，規則在 `.agents/harness/project-rules.md`，不要在此複製。
> 建立日期：2026-10-12

## 專案用途

收集 Caspar 自製的 Claude Code mod（以 function hooks 撰寫的 plugin），每個 mod 一個資料夾 `mods/<name>/`，可持續新增；並提供 `scripts/mods.mjs`，讓同一組 mod 在不同機器之間互相補齊：本機有、repo 沒有的加進 repo（push），repo 有、本機沒有的裝到本機（install）。遠端：`https://github.com/chielinHsu/ModsDevTool.git`。

## 技術棧

| 層 | 技術 | 版本／備註 |
|---|---|---|
| 語言 | JavaScript（ES modules）、TypeScript／TSX（mod） | 同步腳本只用 Node 內建模組，無 npm 相依 |
| 執行環境 | Node.js | 本機 v24.21.0；`package.json` 宣告 `>=18`，其他版本未實測 |
| mod API | Claude Code function hooks（early access） | 型別由引擎寫入各 mod 的 `.claude-plugin/types/`，不進版控；本機 CLI 2.1.283 |
| 外部工具 | `git`（必要）、`claude` CLI（可選，push 前執行 `claude plugin validate`） | |
| AI 協作腳本 | Windows PowerShell 5.1（`scripts/ai/*.ps1`）、Node（`scripts/ai/*.mjs`、`.claude/hooks/`） | |

## 重要目錄

| 路徑 | 內容 |
|---|---|
| `mods/<name>/` | 一個 mod：`.claude-plugin/plugin.json`、`hooks/hooks.json`、`hooks/*.ts(x)`、`types/index.d.ts`、測試 |
| `.claude-plugin/marketplace.json` | 由 `scripts/mods.mjs` 依 `mods/*` 產生的 marketplace 清單，不手改 |
| `scripts/mods.mjs` | 同步腳本的指令列：git、`claude` CLI、commit 訊息 |
| `scripts/mods/lib.mjs` | 同步核心：找 mod、比對內容、複製、註冊 `CLAUDE_CODE_PLUGIN_DIRS`、產生 commit 訊息 |
| `tests/mods.test.mjs` | 同步核心的測試（暫存資料夾，不碰真實設定） |
| `docs/` | 總體計畫（`00-master-plan.md`）、架構、決策（`decisions.md` 索引 + `adr/`）、需求進度表（`current-status.md` 開頭）、計畫檔（`plan/`）、步驟輸出（`steps/`）、AI 工作紀錄（`changelog-ai.md`） |
| `.agents/`、`.claude/`、`.ai/`、`scripts/ai/`、`tools/`、`MODEL_ROUTING.md` | AI agent 的規範、skill、角色、路由 hook、交接單與檢查腳本，各檔職責見 `.agents/harness/engineering-workflow.md` 第 0 節 |
| `~/.claude/mods/<name>/` | 本機安裝位置（不在 repo） |
| `~/.claude/dev-mods/<session>/<name>/` | Claude Code session 中開發的 mod 草稿（不在 repo） |

## 建置與測試

驗證指令是 agent 判斷「做完了沒有」的唯一依據。沒有寫在這裡的指令，agent 不會自己猜。沒有建置步驟：mod 由 Claude Code 直接載入原始碼。

| 目的 | 指令 | 備註 |
|---|---|---|
| 同步核心測試 | `node --test tests/mods.test.mjs` | |
| 三處狀態（唯讀） | `node scripts/mods.mjs status` | 讀本機 `~/.claude`，不寫入 |
| 預覽 push／install | `node scripts/mods.mjs push --dry-run`、`node scripts/mods.mjs install --dry-run` | 不寫檔、不 commit |
| 驗證單一 mod | `claude plugin validate mods/<name>`、`claude plugin test mods/<name>` | 需要 `claude` CLI |
| 驗證 marketplace | `claude plugin validate .` | |
| AI 結構檢查 | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ai/check-ai-structure.ps1` | `-Strict` 時 `TODO(project)` 也算失敗 |
| 技能鏡像 | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ai/sync-skills.ps1` | 加 `-Check` 只檢查不寫入 |
| STE lint（四種輸出的 spec.md／explainer.html） | `node tools/ste-lint.mjs` | 只檢查句長與被動語態 |
| 模型路由檢查 | `node scripts/ai/check-model-routing.mjs` | 不呼叫模型 API |

`VERIFIED` 的定義：
- 改同步腳本：`node --test tests/mods.test.mjs` 全部通過，且相關指令以 `--dry-run` 或暫存設定目錄（`MODS_CLAUDE_DIR`）實際跑過。
- 改 mod：`claude plugin validate` 與 `claude plugin test` 通過，**且**在 Claude Code 裡熱重載後實際看到畫面或行為；只有前兩項時寫 `PARTIALLY VERIFIED`。
- 改 AI 協作檔：`check-ai-structure.ps1 -Strict` 無 FAIL、`sync-skills.ps1 -Check` 一致；動到路由時另加 `check-model-routing.mjs` 全數通過；有 `docs/steps/` 的 spec／explainer 時加 `node tools/ste-lint.mjs` 無 error。

## 限制與不變條件

- `mods/<name>/` 的資料夾名稱必須等於 `plugin.json` 的 `name`（`^[a-z0-9][a-z0-9-]{0,63}$`），否則腳本不列入。
- 同步不包含引擎產生的 `.claude-plugin/types/`、含 `.claude-plugin/types` 的 `tsconfig.json`、`*.log`／`*.tmp`／`*.bak`、`node_modules/`、符號連結。
- 內容比對以 LF 正規化後的 SHA-256 為準；`.gitattributes` 讓 repo 內文字檔維持 LF（`*.ps1` 等 Windows 腳本例外，checkout 為 CRLF）。
- 腳本兩個方向預設都只新增缺少的 mod，不覆蓋、不刪除；內容不同要 `--update`，install 取代前備份到 `~/.claude/mods-backup/`，改 `settings.json` 前寫 `settings.json.mods-backup`。
- `push`／`sync` 只在 `main` 分支執行；push 前 `mods/` 與 `marketplace.json` 必須沒有未提交修改，stage 只列出明確路徑。
- 本機 mod 的載入方式：路徑列在 `~/.claude/settings.json` 的 `env.CLAUDE_CODE_PLUGIN_DIRS`（Windows 以 `;`、其他平台以 `:` 分隔），重開 Claude Code 才生效。
- Windows 上網路 git 指令預設加 `-c http.sslBackend=schannel`（本機 Git for Windows 的 OpenSSL 無法驗證 GitHub 憑證）；`MODS_GIT_SSL_BACKEND=default` 可關閉。

## Context Routing（任務 → 先讀什麼）

只載入與任務相關的文件，不要一次讀完。

| 任務 | 必讀文件／skill | 注意 |
|---|---|---|
| 接續上一位 agent 的工作 | `.ai/handoff.md`、`docs/current-status.md`（需求進度表）、`docs/changelog-ai.md` | 先看 `git status`，別覆蓋未完成的修改 |
| 展開需求、追蹤進度 | `docs/current-status.md`、`docs/plan/_template.md`、`engineering-workflow.md`「需求展開與進度表」 | 非單純需求實作前先展開成細項 |
| 做一個步驟（Step Protocol） | `docs/00-master-plan.md`、`docs/plan/<ID>-*.md`、`project-rules.md`、`docs/steps/_template/` | 四種輸出只適用「功能」類需求與步驟 |
| 新增或修改某個 mod | `mods/<name>/`、`plugin-authoring` skill（Claude Code） | 不直接改 `~/.claude/` 底下的檔案 |
| 改同步腳本 | `scripts/mods/lib.mjs`、`scripts/mods.mjs`、`tests/mods.test.mjs`、`docs/architecture.md` | 改行為要補測試 |
| 改安裝或註冊方式 | `docs/architecture.md`、`docs/adr/001-mods-sync-and-install.md` | 已記錄的決定沒有新證據不推翻 |
| 換機台或第一次使用 | `README.md` | |
| AI 協作結構與路由 | `docs/adr/000-ai-agent-structure.md`、`docs/adr/002-ai-structure-2-0-0.md`、`MODEL_ROUTING.md`、`scripts/ai/` | 範本管理的檔案不在專案裡改 |
| 收工、換 agent | `ai-handoff` skill | commit 訊息照 `project-rules.md`「Commit 訊息」 |

## 詞彙表

| 詞 | 意義 |
|---|---|
| mod | Claude Code 的 function-hooks plugin，一個資料夾一個 |
| draft | `~/.claude/dev-mods/` 裡 session 中開發、熱重載的 mod |
| installed | `~/.claude/mods/<name>/` 的 mod |
| registered | 安裝位置已列在 `CLAUDE_CODE_PLUGIN_DIRS` |
| 範本管理 | 由 `ai-project-template`（2.0.0 在 AutoCadCreated 維護）維護、`-Refresh` 會覆蓋的檔案 |
| 需求進度表 | `docs/current-status.md` 開頭的表格；需求編號 `Rnn`、細項 `Rnn.m` |

## 範圍外

- 刪除任何一端的 mod（目前腳本不做；要做先記 ADR）。
- 把 mod 發布到官方或其他 marketplace。
- 修改使用者 `~/.claude/` 底下 mod 以外的設定（只動 `env.CLAUDE_CODE_PLUGIN_DIRS`）。
