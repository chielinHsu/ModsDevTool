# 專案規則（ModsDevTool）

本專案的命名、格式、依賴、Git、文件與工作方式。專案事實見 `AI_CONTEXT.md`；跨專案流程見 `engineering-workflow.md`。

## 命名

- mod 名稱：小寫英數與 `-`（`^[a-z0-9][a-z0-9-]{0,63}$`），資料夾 `mods/<name>/` 與 `plugin.json` 的 `name` 一致。
- mod 的 `$.state` 鍵在 `types/index.d.ts` 的 `PluginState['<name>']` 宣告（`claude plugin validate` 會核對）。
- 同步腳本的子指令維持 `status`、`push`、`install`、`sync`；新增子指令時同步更新 `HELP`、`README.md` 與 `AI_CONTEXT.md`。

## 格式

- 全部文字檔 UTF-8、LF（`.gitattributes` 強制）；縮排 2 個空白。
- JavaScript／TypeScript：ES modules、單引號、尾端不加分號（mod 沿用 Claude Code 範例風格；`scripts/` 沿用參考骨架的分號風格）。`TODO(project)`：尚未導入格式化工具。
- 文件與使用者訊息用繁體中文；程式識別字、命令與 mod 的介面字串保留原文。

## 依賴

- `scripts/` 只用 Node 內建模組，不新增 npm 相依；需要時先記 ADR。
- mod 只能 import 自己資料夾內的檔案與 `claude-code`／`claude-code/testing`，不得使用 `import()`。

## Git

- 分支：`main`。沒有額外分支策略前，直接在 `main` 工作；`TODO(project)`：多人或多機同時改同一個 mod 時的流程。
- stage 只列明確路徑；禁止 `git add .`、`git add -A`、`git add --all`。
- 未經授權不 commit、push；`scripts/mods.mjs push`／`sync` 的 commit 與 push 屬於使用者執行腳本時的授權。
- commit 訊息：繁體中文一句話說明結果；腳本產生的格式為「新增 mod：a、b」或「更新 mod：a」。有 ADR 時在句尾附 `（ADR-00N）`。
- 不提交引擎產生的 `.claude-plugin/types/`、mod 根目錄的引擎 `tsconfig.json`、`*.log`。

## 新增或更新 mod 的流程

1. 在 Claude Code session 內用 `plugin-authoring` skill 開發（草稿在 `~/.claude/dev-mods/<session>/<name>/`），熱重載後實際確認畫面或行為。
2. `claude plugin validate`、`claude plugin test` 通過。
3. 使用者執行 `node scripts/mods.mjs push <name>`（更新既有 mod 加 `--update`）。
4. 其他機台執行 `node scripts/mods.mjs sync`，重開 Claude Code 生效。

## 文件

- `AGENTS.md` ≤ 80 行、`CLAUDE.md` ≤ 40 行、`.ai/handoff.md` ≤ 60 行（`check-ai-structure.ps1` 檢查）。
- `docs/changelog-ai.md`、`docs/decisions.md` 新增置頂；`docs/current-status.md` 原地更新。
- 每個 mod 的用法寫在 `README.md` 的 mod 清單；mod 內部細節以程式註解為主，不另寫長文件。

## 收工流程

1. 依實際變更執行相關驗證（`AI_CONTEXT.md`「建置與測試」），以 `VERIFIED`／`PARTIALLY VERIFIED`／`NOT VERIFIED` 回報，失敗另列。
2. 執行 `ai-handoff` skill：覆寫 `.ai/handoff.md`、新增 `docs/changelog-ai.md`、更新 `docs/current-status.md`；有設計決策時新增 ADR。
3. 入口、harness 或 skill 有變更時執行 `scripts/ai/check-ai-structure.ps1`；改 skill 時先執行 `scripts/ai/sync-skills.ps1`。
4. 回報修改檔案、驗證結果、尚未驗證的平台行為（例如 mod 在桌面版或終端機的實際繪製）。
