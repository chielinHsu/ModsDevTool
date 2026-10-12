# 設計決策（ADR）

新增置頂。取代舊決策時在舊條目標註「已被 ADR-00N 取代」。

## ADR-001：mod 以 `~/.claude/mods` + `CLAUDE_CODE_PLUGIN_DIRS` 安裝，repo 一個 mod 一個資料夾

- **日期**：2026-10-12
- **狀態**：已接受
- **背景**：使用者要把自製 mod 放上 `chielinHsu/ModsDevTool`，每個 mod 各自一個資料夾、之後持續擴充，並用一支腳本在不同機器上補上缺少的 mod。本機已經有慣例：mod 放在 `~/.claude/mods/<name>/`，路徑列在 `~/.claude/settings.json` 的 `env.CLAUDE_CODE_PLUGIN_DIRS`（觀察到 agents-panel、disk-status、taskboard-pane、usage-bar 以此方式載入）。
- **決定**：
  1. repo 以 `mods/<name>/` 存放每個 mod，`.claude-plugin/marketplace.json` 由腳本產生。
  2. `scripts/mods.mjs` 提供 `status`／`push`／`install`／`sync`；安裝目的地沿用 `~/.claude/mods/<name>/` 並註冊到 `CLAUDE_CODE_PLUGIN_DIRS`。
  3. 兩個方向預設只新增缺少的 mod；內容不同需 `--update`，且安裝端先備份。
  4. 腳本只用 Node 內建模組。
- **理由**：沿用本機既有載入方式，換機台後的行為與現在一致；只新增不覆蓋，避免兩台機器各自修改時互相蓋掉；Node 在 Windows／macOS／Linux 都能跑，且 Claude Code 使用者本來就有 Node。
- **替代方案**：
  - 只用 marketplace（`claude plugin install <mod>@mods-dev-tool`）：Claude Code 會另存一份安裝副本，更新要走 `plugin update`；且本機現有 mod 不是這樣載入。保留 marketplace.json 作為之後的選項，但不作為主要安裝方式。
  - PowerShell 腳本：macOS／Linux 需要另外安裝 pwsh。
  - 自動覆寫較舊的一方：無法可靠判斷哪一台的修改才是要的，風險高。
- **後果**：新機器第一次需要 `git clone` 後執行 `node scripts/mods.mjs sync`，並重開 Claude Code；刪除 mod 仍需手動處理；同一 mod 兩台都改過時，需要人工決定再用 `--update`。
