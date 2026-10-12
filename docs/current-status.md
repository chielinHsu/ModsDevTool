# 目前狀態

> 原地修改，反映「現在」。每次收工更新；歷史在 `changelog-ai.md`。保持在 80 行內。

- 更新日期：2026-10-12
- 階段：可使用（兩個 mod、同步腳本、AutomaticDetectionDev 範本 1.0.0 的協作規範）

## 進行中

- 分支 `chore/adopt-ai-template`：套用範本與 commit 規範，合併回 `main` 後待使用者決定是否 push。

## 待辦（依優先順序）

1. 決定是否改寫 2026-10-12 前四個舊格式 commit（需要 force push）。
2. 其他機器 `git clone` 後執行 `node scripts/mods.mjs sync`，重開 Claude Code 確認 mod 實際載入。
3. 本機要讓 blast-radius、replay-theater 在新 session 載入：使用者執行 `node scripts/mods.mjs install`（會改 `~/.claude/settings.json`）。
4. 本機另有 agents-panel、disk-status、taskboard-pane、usage-bar 未收錄；要收錄時 `node scripts/mods.mjs push <name>`。
5. macOS／Linux 實機驗證（`CLAUDE_CODE_PLUGIN_DIRS` 以 `:` 分隔，目前只有單元測試）。

## 已知問題

- 本機 Git for Windows 設定為 `http.sslBackend=openssl` 時無法驗證 GitHub 憑證；腳本在 Windows 自動改用 schannel，本 repo 也設定了 repo 層級的 schannel。
- install 會註冊所有「已安裝且在 repo 中」的 mod；若有刻意不載入的同名 mod，需在 `settings.json` 手動移除。
- 刪除 mod 的流程未定義（腳本不刪除任何一端）。

## 阻塞與待使用者決定

- 是否 force push 改寫舊 commit（訊息格式與作者信箱）。
- 本次分支合併後是否 push 到 GitHub。
