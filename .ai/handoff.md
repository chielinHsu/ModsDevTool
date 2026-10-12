# Agent Handoff

> 覆寫式交接單：每次收工整份重寫，不累積歷史（歷史在 `docs/changelog-ai.md`）。保持在 60 行內。
> 流程見 `ai-handoff` skill。

- 最後一位 agent：Claude Code (Claude Opus 5.5)
- 日期：2026-10-12

## 正在做

套用 AutomaticDetectionDev 的 `ai-project-template` 1.0.0 與 commit 規範（分支 `chore/adopt-ai-template`，完成後 `--no-ff` 合併回 `main`）。

## 已完成

- 範本管理的檔案以 `New-AiProject.ps1 -Refresh` 更新；入口、`AI_CONTEXT.md`、`project-rules.md`、docs 依範本重寫；ADR 改為 `docs/adr/` 一檔一決策。
- 同步腳本的 commit 訊息依規範骨架產生、寫成檔案後 `git commit -F`；`push`／`sync` 限定 `main`。

## 下一步

- 使用者決定：本分支合併後是否 push；是否 force push 改寫四個舊格式 commit。
- 其他機器 `git clone` → `node scripts/mods.mjs sync` → 重開 Claude Code，確認 mod 載入。

## 相關檔案

- `.agents/harness/project-rules.md`（Git、Commit 訊息）
- `scripts/mods.mjs`、`scripts/mods/lib.mjs`（`buildCommitMessage`、`authorTag`）、`tests/mods.test.mjs`
- `docs/adr/000-ai-agent-structure.md`、`docs/adr/001-mods-sync-and-install.md`

## 不要動

- 範本管理的檔案：`engineering-workflow.md`、`TEMPLATE_VERSION`、`.agents/skills/ai-handoff/`、`scripts/ai/check-ai-structure.ps1`、`scripts/ai/sync-skills.ps1`。
- `.claude-plugin/marketplace.json`（腳本產生）、`.claude/skills/`（鏡像）。

## 已知問題

- Windows 的 Git OpenSSL 無法驗證 GitHub 憑證；腳本自動用 schannel，本 repo 也有 repo 層級設定。
- install 會註冊所有「已安裝且在 repo 中」的 mod。

## 未提交的變更

- 收工時本分支的變更已分成三個 commit 並合併回 `main`；工作目錄乾淨。

## 假設與未驗證項目

- `claude -p` 實測 `CLAUDE.md` 匯入是否載入：未做（會消耗額度）。
- 其他機器實際載入、macOS／Linux：NOT VERIFIED。
- `bench-model-routing.mjs` 未執行（需授權）。
