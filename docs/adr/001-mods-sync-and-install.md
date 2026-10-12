# ADR-001 mod 的存放與跨機台同步

- 日期：2026-10-12
- 決定者：使用者（需求：每個 mod 一個資料夾、可持續擴充、一支腳本在不同機台補上沒有的 mod），Claude Code (Claude Opus 5.5) 提案並實作
- 狀態：採用

## 背景

使用者要把自製 mod 放上 `chielinHsu/ModsDevTool`，之後持續新增，並用一支腳本在不同機器上補上缺少的 mod。本機已有慣例：mod 放在 `~/.claude/mods/<name>/`，路徑列在 `~/.claude/settings.json` 的 `env.CLAUDE_CODE_PLUGIN_DIRS`（觀察到 agents-panel、disk-status、taskboard-pane、usage-bar 以此方式載入）。開發中的 mod 在 `~/.claude/dev-mods/<session>/<name>/`。

## 決定

1. repo 以 `mods/<name>/` 存放每個 mod；`.claude-plugin/marketplace.json` 由腳本依 `mods/*` 產生。
2. `scripts/mods.mjs` 提供 `status`／`push`／`install`／`sync`；安裝目的地沿用 `~/.claude/mods/<name>/` 並註冊到 `CLAUDE_CODE_PLUGIN_DIRS`。
3. 兩個方向預設只新增缺少的 mod；內容不同要 `--update`，安裝端先備份。
4. 內容比對用 LF 正規化後的 SHA-256，排除引擎產生的檔案。
5. 腳本只用 Node 內建模組。

## 否決的替代方案

- 只用 marketplace（`claude plugin install <mod>@mods-dev-tool`）：Claude Code 會另存一份安裝副本，更新要走 `plugin update`；本機現有 mod 也不是這樣載入。保留 `marketplace.json` 作為之後的選項。
- PowerShell 腳本：macOS／Linux 需要另外安裝 pwsh。
- 自動以較新的一方覆蓋：無法可靠判斷哪一台的修改才是要的。

## 後果

- 新機器第一次要 `git clone` 後執行 `node scripts/mods.mjs sync`，並重開 Claude Code。
- 刪除 mod 仍需手動處理；同一個 mod 兩台都改過時，要人工決定再用 `--update`。
- install 會註冊所有「已安裝且在 repo 中」的 mod，包含使用者原本刻意沒註冊的同名 mod。

## 後續（2026-10-12）

- 依 ADR-000 的 commit 規則，腳本的 commit 訊息改為 `[作者]feat: …` 骨架、寫成檔案再 `git commit -F`；`push`／`sync` 限定在 `main` 分支執行。
