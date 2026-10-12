# 交接單

更新：2026-10-12

## 正在做

無進行中的工作。ModsDevTool 已建立並推上 `chielinHsu/ModsDevTool`（`main`）。

## 已完成

- `scripts/mods.mjs`（status／push／install／sync）、`scripts/mods/lib.mjs`、`tests/mods.test.mjs`。
- `mods/blast-radius`、`mods/replay-theater` 由腳本本身 push 上去（commit「新增 mod：blast-radius、replay-theater」）。
- 協作骨架、README、ADR-001。

## 下一步

- 其他機器：`git clone` → `node scripts/mods.mjs sync` → 重開 Claude Code，確認 mod 實際載入。
- 本機：兩個 mod 在 `~/.claude/mods/` 但未註冊；要在新 session 載入時由使用者執行 `node scripts/mods.mjs install`。
- 本機另有 agents-panel、disk-status、taskboard-pane、usage-bar 未收錄；使用者決定後 `push <name>`。

## 相關檔案

`scripts/mods.mjs`、`scripts/mods/lib.mjs`、`tests/mods.test.mjs`、`mods/*`、`README.md`、`docs/architecture.md`、`docs/decisions.md`

## 不要動

- `.claude-plugin/marketplace.json` 由腳本產生。
- `.claude/skills/` 由 `scripts/ai/sync-skills.ps1` 產生。

## 已知問題

- Windows 的 Git OpenSSL 無法驗證 GitHub 憑證；腳本自動用 schannel，本 repo 也有 repo 層級設定。
- install 會註冊所有「已安裝且在 repo 中」的 mod，包含使用者原本刻意沒註冊的同名 mod。

## 未提交變更

無（交接時 `git status` 乾淨，與 origin/main 同步）。

## 假設與未驗證事項

- 假設其他機器的 Claude Code 也以 `CLAUDE_CODE_PLUGIN_DIRS` 載入 `~/.claude/mods/*`（本機觀察到的慣例）；實際載入 NOT VERIFIED。
- macOS／Linux 未實機驗證（只有單元測試涵蓋 `:` 分隔）。
- `bench-model-routing.mjs` 未執行（會消耗額度，未獲授權）。
