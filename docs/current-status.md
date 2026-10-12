# 目前狀態

> 原地修改，反映「現在」。每次收工更新；歷史在 `changelog-ai.md`。保持在 80 行內。

- 更新日期：2026-10-12
- 階段：可使用（兩個 mod、同步腳本、AutomaticDetectionDev 範本 1.0.0 的協作規範）

## 進行中

- 無。全部 commit 已是新格式與新信箱，並推上 `origin/main`。

## 待辦（依優先順序）

1. 其他機器 `git clone` 後執行 `node scripts/mods.mjs sync`，重開 Claude Code 確認 mod 實際載入。
2. 本機要讓 blast-radius、replay-theater 在新 session 載入：使用者執行 `node scripts/mods.mjs install`（會改 `~/.claude/settings.json`）。
3. 本機另有 agents-panel、disk-status、taskboard-pane、usage-bar 未收錄；要收錄時 `node scripts/mods.mjs push <name>`。
4. macOS／Linux 實機驗證（`CLAUDE_CODE_PLUGIN_DIRS` 以 `:` 分隔，目前只有單元測試）。

## 已知問題

- 本機 Git for Windows 設定為 `http.sslBackend=openssl` 時無法驗證 GitHub 憑證；腳本在 Windows 自動改用 schannel，本 repo 也設定了 repo 層級的 schannel。
- install 會註冊所有「已安裝且在 repo 中」的 mod；若有刻意不載入的同名 mod，需在 `settings.json` 手動移除。
- 刪除 mod 的流程未定義（腳本不刪除任何一端）。
- 其他已 clone 舊歷史的地方要重新 clone，或 `git fetch` 後 `git reset --hard origin/main`（會丟掉該處未推送的修改）。

## 阻塞與待使用者決定

- 無。
