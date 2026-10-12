# 目前狀態

更新：2026-10-12

## 已完成

- repo 結構：`mods/<name>/` 一個 mod 一個資料夾，`.claude-plugin/marketplace.json` 由腳本產生。
- 同步腳本 `scripts/mods.mjs`（`status`／`push`／`install`／`sync`，`--dry-run`／`--update`／`--no-push`／`--from`），核心 `scripts/mods/lib.mjs`，測試 `tests/mods.test.mjs`。
- 收錄的 mod：`blast-radius`、`replay-theater`。
- Codex／Claude Code 共用協作骨架（harness-1.0.0、routing-1）。

## 待辦

- 其他機器第一次執行 `sync` 的實測（macOS／Linux 的 `CLAUDE_CODE_PLUGIN_DIRS` 分隔與路徑尚未實機驗證）。
- 本機另有 `agents-panel`、`disk-status`、`taskboard-pane`、`usage-bar` 尚未放進 repo；要收錄時執行 `node scripts/mods.mjs push <name>`。
- `TODO(project)`：刪除 mod 的流程（目前腳本不刪除任何一端）。

## 已知問題

- 本機 Git for Windows 設定為 `http.sslBackend=openssl` 時無法驗證 GitHub 憑證；腳本在 Windows 自動改用 schannel，本 repo 也設定了 repo 層級的 schannel。
- 本機的 `blast-radius`、`replay-theater` 已在 `~/.claude/mods/`，但尚未列入 `CLAUDE_CODE_PLUGIN_DIRS`；目前只靠開發 session 的熱重載載入。執行 `node scripts/mods.mjs install` 後重開 Claude Code 才會在新 session 載入。
