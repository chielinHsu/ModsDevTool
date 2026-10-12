# 交接單

更新：2026-10-12

## 正在做

建立 ModsDevTool repo：收錄 blast-radius、replay-theater，提供跨機台同步腳本，並補齊 Codex／Claude Code 共用協作骨架。

## 已完成

- `scripts/mods.mjs`（status／push／install／sync）與 `scripts/mods/lib.mjs`、`tests/mods.test.mjs`。
- 協作骨架、README、ADR-001。

## 下一步

- 其他機器 `git clone` 後執行 `node scripts/mods.mjs sync`，重開 Claude Code 確認 mod 載入。
- 本機要讓兩個 mod 在新 session 也載入：`node scripts/mods.mjs install`（會改 `~/.claude/settings.json`）。

## 相關檔案

`scripts/mods.mjs`、`scripts/mods/lib.mjs`、`tests/mods.test.mjs`、`mods/*`、`README.md`、`docs/architecture.md`、`docs/decisions.md`

## 不要動

- `.claude-plugin/marketplace.json` 由腳本產生，不手動改。
- `.claude/skills/` 由 `scripts/ai/sync-skills.ps1` 產生。

## 已知問題

- Windows 的 Git OpenSSL 無法驗證 GitHub 憑證；腳本自動用 schannel。
- macOS／Linux 未實機驗證。

## 未提交變更

（push 後更新）

## 假設與未驗證事項

- 假設其他機器的 Claude Code 也以 `CLAUDE_CODE_PLUGIN_DIRS` 載入 `~/.claude/mods/*`（本機觀察到的慣例）。
- `bench-model-routing.mjs` 未執行（會消耗額度，未獲授權）。
