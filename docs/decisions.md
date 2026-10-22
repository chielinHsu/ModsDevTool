# 設計決策索引（ADR）

> 本專案一檔一決策：每個決策是 `docs/adr/NNN-slug.md`，本檔只是索引，新的放最上方。內容只寫在 ADR 檔，不要在這裡複製。
> 已記錄的決定，沒有新證據不推翻；要推翻就新增一筆，並在新舊兩筆都標明取代關係。

| 編號 | 標題 | 狀態 | 日期 |
|---|---|---|---|
| [ADR-002](adr/002-ai-structure-2-0-0.md) | 導入 AI 結構 2.0.0：四條入口規則、需求進度表、總體計畫、SOLID／四種輸出／Step Protocol；保留專案模型路由；hook 指令改 `${CLAUDE_PROJECT_DIR}`；Git 授權不變（不含 push） | 採用（要求由使用者提出；hook 字串改動經使用者同意；這次的推送與 PR 是使用者當次要求） | 2026-10-22 |
| [ADR-001](adr/001-mods-sync-and-install.md) | mod 的存放與跨機台同步：repo 一個 mod 一個資料夾 `mods/<name>/`；`scripts/mods.mjs` 的 `status`／`push`／`install`／`sync`；安裝到 `~/.claude/mods/<name>/` 並註冊 `CLAUDE_CODE_PLUGIN_DIRS`；兩個方向預設只新增缺少的、不覆蓋不刪除；只用 Node 內建模組 | 採用（需求由使用者提出；安裝方式沿用本機既有慣例，做法是 Claude Code 的提案） | 2026-10-12 |
| [ADR-000](adr/000-ai-agent-structure.md) | AI agent 共用結構：套用 AutomaticDetectionDev 的 `ai-project-template` 1.0.0（薄入口、`AI_CONTEXT.md`、harness、交接、一檔一決策、commit 訊息格式）；保留依全域建置規格建立的五級模型路由 | 採用（要求套用由使用者提出） | 2026-10-12 |
