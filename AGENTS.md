# ModsDevTool｜AI 開工入口

Codex 自動讀取；Claude Code 經 `CLAUDE.md` 匯入。本檔只放不可省略的規則與讀取順序，完整知識在下列文件。回應與文件使用繁體中文，程式識別字與命令保留原文。

## 不可省略的規則

1. **先確保版控**：開工先看 `git status` 與目前分支；不覆蓋他人或來源不明的未提交修改（`engineering-workflow.md` 第 0 節）。
2. **mod 一個資料夾**：每個 mod 放在 `mods/<name>/`，資料夾名稱等於 `.claude-plugin/plugin.json` 的 `name`；`.claude-plugin/marketplace.json` 由 `scripts/mods.mjs` 產生，不手動改。
3. **不碰使用者的全域環境**：`~/.claude/mods/`、`~/.claude/settings.json` 只由使用者執行 `node scripts/mods.mjs install`／`sync` 改動；agent 只用 `status` 或 `--dry-run`。
4. **不虛構驗證**：用 `VERIFIED`／`PARTIALLY VERIFIED`／`NOT VERIFIED`，失敗另列；mod 有沒有在 Claude Code 畫出來要實際看畫面。
5. **授權**：未經授權不 commit、push；stage 時明確列出路徑，禁止 `git add .`、`git add -A`。

## 必讀順序（非單純任務）

1. `AI_CONTEXT.md`：專案事實、指令、限制與 Context Routing。
2. `.agents/harness/engineering-workflow.md`：共用工程流程。
3. `.agents/harness/project-rules.md`：本專案規則。
4. `.ai/handoff.md`：上一位 agent 的交接。
5. `docs/current-status.md`：目前狀態。

涉及同步腳本的結構或 mod 安裝方式時，加讀 `docs/architecture.md` 與 `docs/decisions.md`。改特定 mod 時只讀 `mods/<name>/`。

## 收工要求

依 `project-rules.md` 的收工流程，並執行 `ai-handoff` skill（`.agents/skills/ai-handoff/SKILL.md`）：覆寫 `.ai/handoff.md`、新增 `docs/changelog-ai.md`、更新 `docs/current-status.md`，有設計決策時更新 `docs/decisions.md`；入口或 skill 有變更時執行 `scripts/ai/check-ai-structure.ps1`。

## Codex 專用

- 必要文件讀不到或亂碼時先停止回報，不憑印象工作。
- 文件為 UTF-8；Windows PowerShell 5.1 讀檔加 `-Encoding UTF8`。
- 本檔保持精簡；Codex 讀入的 AGENTS.md 合計上限 32 KiB。
- 共用 skill 來源在 `.agents/skills/`。Codex 不載入 `.claude/agents`、Claude hooks 或 `MODEL_ROUTING.md` 的自動建議；本專案尚未建立 Codex 自訂角色。
- mod 本身只在 Claude Code 執行；Codex 可以改 mod 原始碼與同步腳本，但無法實際載入 mod。
