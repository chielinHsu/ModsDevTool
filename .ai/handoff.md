# Agent Handoff

> 覆寫式交接單：每次收工整份重寫，不累積歷史（歷史在 `docs/changelog-ai.md`）。保持在 60 行內。
> 流程見 `ai-handoff` skill。

- 最後一位 agent：Claude Code (Claude Opus 5.5)
- 日期：2026-10-12

## 正在做

無。

## 已完成

- 套用 AutomaticDetectionDev 的 `ai-project-template` 1.0.0 與 commit 規範（ADR-000）。
- 改寫最早四個舊格式 commit（新格式、新信箱、`Co-Authored-By` 不帶 email 或網址），以 `--force-with-lease` 推上 `origin/main`；新舊 hash 對照在 ADR-000 的「後續」。

## 下一步

- 其他機器 `git clone` → `node scripts/mods.mjs sync` → 重開 Claude Code，確認 mod 載入。
- 本機要讓兩個 mod 在新 session 載入：使用者執行 `node scripts/mods.mjs install`。

## 相關檔案

- `.agents/harness/project-rules.md`（Git、Commit 訊息）
- `scripts/mods.mjs`、`scripts/mods/lib.mjs`、`tests/mods.test.mjs`
- `docs/adr/000-ai-agent-structure.md`、`docs/adr/001-mods-sync-and-install.md`

## 不要動

- 範本管理的檔案：`engineering-workflow.md`、`TEMPLATE_VERSION`、`.agents/skills/ai-handoff/`、`scripts/ai/check-ai-structure.ps1`、`scripts/ai/sync-skills.ps1`。
- `.claude-plugin/marketplace.json`（腳本產生）、`.claude/skills/`（鏡像）。
- 本機分支 `backup/pre-rewrite`（改寫前的歷史，不 push；使用者確認後再刪）。

## 已知問題

- Windows 的 Git OpenSSL 無法驗證 GitHub 憑證；腳本自動用 schannel，本 repo 也有 repo 層級設定。
- install 會註冊所有「已安裝且在 repo 中」的 mod。
- 舊紀錄（`docs/changelog-ai.md` 下方）裡的 commit hash 是改寫前的，對照 ADR-000。

## 未提交的變更

- 無；`main` 與 `origin/main` 同步。

## 假設與未驗證項目

- `claude -p` 實測 `CLAUDE.md` 匯入是否載入：未做（會消耗額度）。
- 其他機器實際載入、macOS／Linux：NOT VERIFIED。
