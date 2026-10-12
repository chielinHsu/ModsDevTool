# AI changelog

新增置頂。只記已進入專案的結果。

## 2026-10-12｜建立 repo、同步腳本與共用協作骨架（ADR-001）

- **變更**：
  - 新增 `scripts/mods.mjs`、`scripts/mods/lib.mjs`、`tests/mods.test.mjs`：跨機台同步 mod（本機 `~/.claude/mods`、`~/.claude/dev-mods` ⇄ repo `mods/<name>`），預設只新增缺少的 mod；Windows 經 `cmd.exe` 呼叫 `claude plugin validate`，網路 git 指令用 schannel。
  - 以腳本 push 收錄 `mods/blast-radius`、`mods/replay-theater`（來源 `~/.claude/mods/`，與開發 session 的草稿內容相同），產生 `.claude-plugin/marketplace.json`。
  - 依 `project-bootstrap-spec.md` 建立協作骨架；通用檔沿用 stock-aquarium 參考實作，角色檔、路由 `PROFILE`、案例與環境變數前綴（`MODSDEV_ROUTER`）改為本專案內容。
  - 新增 `README.md`、`.gitignore`、`.gitattributes`、`package.json`。
- **驗證**：
  - `node --test tests/mods.test.mjs`：16/16 通過（VERIFIED）。
  - `node scripts/ai/check-model-routing.mjs`：162/162 通過（靜態設定與本機 hook 行為）。
  - `check-ai-structure.ps1`：0 失敗、3 警告（刻意標記的 `TODO(project)`）；`sync-skills.ps1 -Check` 一致。暫存副本刪除角色檔、改錯 model、手改技能鏡像，兩支檢查器皆 exit 1。
  - `claude plugin validate`：兩個 mod 與 marketplace 通過（只剩未填 author 的警告）。
  - 端對端：實際 `push blast-radius replay-theater` 推上 GitHub；暫存 clone + 假設定目錄執行 `sync --no-push`，安裝 2 個 mod、註冊並保留原設定與備份、把本機獨有的 mod commit 進暫存 clone，第二次執行無重複動作。
  - 未驗證：其他機器實際載入、macOS／Linux、bench（需授權）。
