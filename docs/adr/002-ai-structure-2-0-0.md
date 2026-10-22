# ADR-002 導入 AI 結構 2.0.0

- 日期：2026-10-22
- 決定者：使用者（要求所有專案整套照搬 AutoCadCreated 的 AI 結構），Claude Code (Sonnet 5.5) 執行
- 狀態：採用（延伸 [ADR-000](000-ai-agent-structure.md)：結構版本由 1.0.0 升為 2.0.0）

## 背景

本專案在 2026-10-12 套用 `ai-project-template` 1.0.0（ADR-000）：入口只有三條規則、沒有需求進度表、總體計畫、計畫檔與四種輸出的規定，`project-rules.md` 也沒有 SOLID 與 Step Protocol。使用者隨後要求所有專案整套套用 AutoCadCreated 的 AI 結構（範本 2.0.0，位於 `AutoCadCreated/ai-project-template`），並要求所有文件與回覆一律使用繁體中文，包含 session、子 session 與委派的 subagent。

這項工作先在舊歷史（本機 `main` 0129d04）上做過一次；origin 之後改寫了歷史並套用 1.0.0 與新的 commit 規範，所以在 origin 最新版（26f356c）上重做，沿用 origin 既有的內容。

## 決定

- 入口 `AGENTS.md` 改為 2.0.0 的 bootloader：「不可省略的四條」（繁中回覆與完成總結、不虛構驗證、不擅自 commit／push、非單純需求先展開需求進度表）；原有的 mod 資料夾與 Codex 專屬規則保留，加上「不碰全域環境」一條。`CLAUDE.md` 補上 architect 計畫由主 agent 寫進進度表、Step Protocol 第 7 步與委派時交代繁中回覆。
- 範本管理的檔案以 `New-AiProject.ps1 -Refresh` 換成 2.0.0：`engineering-workflow.md`（新增「需求展開與進度表」）、`TEMPLATE_VERSION`、`ai-handoff` skill 與其 `.claude/skills` 鏡像、`scripts/ai/check-ai-structure.ps1`、`scripts/ai/sync-skills.ps1`、`tools/ste-lint.mjs`、`docs/plan/_template.md`、`docs/adr/_template.md`、`docs/steps/_template/`；`.gitignore` 補 `perf/results/`。`skill-sync.json` 的格式與 2.0.0 相同，不需更動。
- 專案擁有的檔案採「合併」：`project-rules.md` 保留 origin 的程式碼風格、mod 規則、同步腳本 commit 規則與驗證，補上 SOLID、四種輸出（含適用範圍）、Step Protocol、與上層規則的關係；`AI_CONTEXT.md` 的 Context Routing、目錄與指令補上進度表、計畫檔與 ste-lint；`MODEL_ROUTING.md` 與 `.claude/agents/*` 補上「architect 計畫由主 agent 寫進進度表」。
- 保留專案自己的模型路由：`MODEL_ROUTING.md` 的案例與評分、`check-model-routing.mjs`、`bench-model-routing.mjs`、`model_router.mjs` 的 `MODSDEV_ROUTER_*` 環境變數。
- 2.0.0 的結構檢查指出 `.claude/settings.json` 的 hook 指令用沒有大括號的 `$CLAUDE_PROJECT_DIR`：本機以 PowerShell 執行 hook 時會展開成空字串（QAdvancePinInspect 於 2026-10-19 以 `--debug hooks` 實測）。經使用者同意，只把這個字串改成 `node "${CLAUDE_PROJECT_DIR}/.claude/hooks/model_router.mjs"`，其他權限規則不動；`check-model-routing.mjs` 同步改為檢查新寫法並拒絕舊寫法。
- 決策仍是 `docs/adr/` 一檔一決策，`docs/decisions.md` 為索引；新增 `docs/00-master-plan.md`；`docs/current-status.md` 開頭加需求進度表，依 `docs/changelog-ai.md` 與 `git log` 回填 R01–R05。
- 提交身分與訊息格式以上層 `D:\ClaudeWork\CLAUDE.md` 為準。Git 授權維持 ADR-000 時期的規定：使用者同意後在工作分支 commit、`git merge --no-ff` 回 `main`，**不包含 push**；上層的「完成後的自動流程」不適用本專案。本次導入依使用者當次要求推送分支並開 PR（沒有 CI，不合併）；使用者自己執行 `scripts/mods.mjs push`／`sync` 的授權不變。

## 否決的替代方案

- 整份換成範本的 `MODEL_ROUTING.md`、agents、hook 與 `check-model-routing.mjs`：範本版本是通用的，會遺失已調好的本專案案例與 `MODSDEV_ROUTER` 環境變數前綴。
- 改成上層「完成後的自動流程」（推送分支、開 PR）：會放寬本專案「不包含 push」的授權；上層寫明專案規定更具體時以專案為準，所以不採用。這次推送與開 PR 是使用者當次明確要求的。
- 為過去的需求補計畫檔與四種輸出：`docs/plan/`、`docs/steps/` 只放範本，之後新的「功能」類需求才使用。
- 在 `.claude/settings.json` 一併調整其他權限規則：使用者只同意改 hook 字串。origin 已有範本要求的 PowerShell 版 deny 與 ask 規則，沒有缺項。

## 後果

- 之後升級範本時對本專案執行 `New-AiProject.ps1 -Path <本專案> -Refresh`；範本管理的檔案不在專案內修改。
- 四種輸出只適用「功能」類需求與 Step Protocol 的步驟；小修正免。
- 結構檢查改為 2.0.0 版：除了必要檔案，也檢查入口四條規則、需求進度表與 hook 寫法。
- 靜態檢查通過不等於 Claude Code 實際載入：hook 改寫後在本專案 session 的實際載入、agents 與 skill 的載入都未驗證。
