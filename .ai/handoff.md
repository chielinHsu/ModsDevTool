# Agent Handoff

> 覆寫式交接單：每次收工整份重寫，不累積歷史（歷史在 `docs/changelog-ai.md`）。保持在 60 行內。
> 流程見 `ai-handoff` skill。進度的單一事實來源是 `docs/current-status.md` 的需求進度表，這裡只寫「下一位第一件要知道的事」。

- 最後一位 agent：Claude Code (Sonnet 5.5)
- 日期：2026-10-22

## 正在做

導入 AI 結構 2.0.0（進度表 R07、[ADR-002](../docs/adr/002-ai-structure-2-0-0.md)）：分支 `docs/ai-structure-2.0.0`，基於 origin/main 26f356c。變更完成後由主 session 在本機提交、推送該分支並開 PR；本專案沒有 CI，PR 開出後不合併，等使用者決定。

## 已完成

- 範本管理檔換成 2.0.0（`-Refresh`）；專案擁有檔（入口、`project-rules.md`、`AI_CONTEXT.md`、`MODEL_ROUTING.md`、agents）合併，保留 origin 的 commit 規範、同步腳本 commit 規則與 `MODSDEV_ROUTER_*` 路由。
- 新增 ADR-002、`docs/00-master-plan.md`、需求進度表（回填 R01–R06，列出 R07–R11）、`docs/plan`／`docs/steps`／`docs/adr` 範本、`tools/ste-lint.mjs`。
- hook 指令改成 `${CLAUDE_PROJECT_DIR}`（使用者同意，R07.4），`check-model-routing.mjs` 同步改檢查。
- 驗證：`sync-skills.ps1 -Check` 一致；`check-ai-structure.ps1 -Strict` 0 失敗 0 警告；`check-model-routing.mjs` 163/163；`node --test tests/mods.test.mjs` 21/21；`node tools/ste-lint.mjs` 0 錯誤。

## 下一步

- 本次修改由主 session 提交，依使用者當次要求推送分支 `docs/ai-structure-2.0.0` 並開 PR（沒有 CI，不合併，等使用者決定）。
- 回答 `docs/current-status.md`「待使用者決定」六項，特別是 settings.json 的 `git add`／`git commit` ask 規則。
- 在本專案開新 session，確認 hook 實際輸出路由建議。

## 相關檔案

`AGENTS.md`、`CLAUDE.md`、`AI_CONTEXT.md`、`MODEL_ROUTING.md`、`.agents/harness/`、`docs/adr/002-ai-structure-2-0-0.md`、`docs/00-master-plan.md`、`docs/current-status.md`

## 不要動

- 範本管理的檔案：`engineering-workflow.md`、`TEMPLATE_VERSION`、`.agents/skills/ai-handoff/`、`scripts/ai/check-ai-structure.ps1`、`scripts/ai/sync-skills.ps1`、`tools/ste-lint.mjs`、各 `_template`。
- `.claude-plugin/marketplace.json`（腳本產生）、`.claude/skills/`（鏡像）。
- `mods/`、`tests/`、`scripts/mods*`（本次沒有改）。
- 本機分支 `backup/pre-rewrite`（若仍在：改寫前的歷史，不 push；使用者確認後再刪）。

## 已知問題

- Windows 的 Git OpenSSL 無法驗證 GitHub 憑證；腳本自動用 schannel，本 repo 也有 repo 層級設定。
- install 會註冊所有「已安裝且在 repo 中」的 mod（R11）。
- 舊紀錄（`docs/changelog-ai.md` 下方）裡的 commit hash 是改寫前的，對照 ADR-000。

## 未提交的變更

- 無來源不明的修改。本次修改由主 session 在本機提交、推送到 origin 的 `docs/ai-structure-2.0.0` 並開 PR；`.claude/settings.json` 只改 hook 指令一行。

## 假設與未驗證項目

- 靜態檢查通過不等於平台實際載入：agents、hook、skills 在 Claude Code 的實際載入 NOT VERIFIED；Codex 端未實測。
- `bench-model-routing.mjs` 未執行（會消耗額度，未獲授權）。
- hook 改成 `${CLAUDE_PROJECT_DIR}` 後，在本專案 session 的實際載入未驗證（QAdvancePinInspect 以同樣寫法實測過）。
