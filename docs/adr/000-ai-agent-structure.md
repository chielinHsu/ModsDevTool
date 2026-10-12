# ADR-000 AI agent 共用結構（Codex 與 Claude Code）

- 日期：2026-10-12
- 決定者：使用者（要求依 AutomaticDetectionDev 的結構），Claude Code (Claude Opus 5.5) 執行
- 狀態：採用

## 背景

ModsDevTool 建立時，協作骨架是依全域規格 `~/.agents/harness/project-bootstrap-spec.md` 以 stock-aquarium 為參考做的。使用者隨後指出 commit 訊息不符合自己的慣例，並要求參考 `https://github.com/chielinHsu/AutomaticDetectionDev.git` 的結構，讓之後用 Claude Code 或 Codex 開發都照同一份規範。

AutomaticDetectionDev 的 `ai-project-template/`（版本 1.0.0）是跨專案的範本，附產生器 `New-AiProject.ps1`；它把檔案分成「範本管理」（`-Refresh` 會覆蓋）與「專案擁有」兩類，commit 訊息格式（`[作者]屬性: 說明`、`測試 :`、不帶 email 的 `Co-Authored-By`、`[Test]` 結尾）寫在範本的 `project-rules.md`。

## 決定

1. 以 `New-AiProject.ps1 -Path C:\CodexProject\ModsDevTool -Name ModsDevTool -Refresh` 套用範本：範本管理的檔案（`engineering-workflow.md`、`TEMPLATE_VERSION`、`ai-handoff` skill、`scripts/ai/check-ai-structure.ps1`、`scripts/ai/sync-skills.ps1`）與範本一致，不在本專案修改；`skill-sync.json` 改為範本格式。
2. 專案擁有的檔案依範本的形式重寫：`AGENTS.md`、`CLAUDE.md`、`AI_CONTEXT.md`、`project-rules.md`、`.ai/handoff.md`、`docs/*`、`.claude/settings.json`。
3. `project-rules.md` 的「Commit 訊息」逐字沿用範本，並加上本專案的分支流程與同步腳本產生 commit 的規則。
4. 決策改為一檔一決策（`docs/adr/`），`docs/decisions.md` 只當索引；原 `decisions.md` 的 ADR-001 內容搬到 `docs/adr/001-mods-sync-and-install.md`。
5. 保留依全域規格建立的模型路由（`MODEL_ROUTING.md`、`.claude/agents/` 五級角色、`.claude/hooks/model_router.mjs`、`scripts/ai/check-model-routing.mjs`、`bench-model-routing.mjs`），`CLAUDE.md` 匯入 `MODEL_ROUTING.md`。
6. `.gitattributes` 依參考 repo 讓 `*.ps1`、`*.cmd`、`*.bat` 在 checkout 時為 CRLF；`.claude/settings.json` 合併範本的 allow／ask／deny 與既有的 hook 和 ask 規則。

## 否決的替代方案

- 改用 AutomaticDetectionDev 自己的模型路由檔：內容綁它的 C++／Qt／HALCON 模組（分層、port、`.pro`），且它不在範本內；全域規格（2026-10-10）比它的 ADR-019／020（2026-10-08）新，目前這套已通過 `check-model-routing.mjs`。
- 搬入 Step Protocol、四種輸出（STE 英文、explainer.html、storyboard）、`docs/plan`、`docs/steps`、`perf/`：這些綁 AutomaticDetectionDev 的工具（`ste-lint`、`check-deps`、效能預算），範本本身也沒有收錄；本專案是小型工具，沒有分步驟計畫。
- 保留舊的 `check-ai-structure.ps1`（stock-aquarium 版）：與範本管理的版本衝突，`-Refresh` 也會覆蓋它。

## 後果

- 範本升級時，對本專案執行 `New-AiProject.ps1 -Path <本專案> -Refresh`；範本管理的檔案不在本專案修改。
- 結構檢查改為範本版：不檢查路由相關檔案，路由由 `check-model-routing.mjs` 負責。
- 2026-10-12 前的四個 commit（`e09a194`、`a411b1e`、`8b58746`、`0129d04`）是舊格式，是否改寫歷史由使用者決定（需要 force push）。
