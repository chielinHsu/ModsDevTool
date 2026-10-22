# 目前狀態

> 原地修改，反映「現在」。每次收工更新；歷史在 `changelog-ai.md`。需求進度表的規則見 `.agents/harness/engineering-workflow.md`「需求展開與進度表」。保持在 150 行內。

- 更新日期：2026-10-22
- 階段：可使用（兩個 mod、同步腳本、AI 結構 2.0.0 的協作規範）

## 需求進度表

| 編號 | 類型 | 需求／細項 | 狀態 | 計畫 | 分支／commit | 驗證 |
|---|---|---|---|---|---|---|
| R01 | 雜項 | 建立跨機台 mod 同步腳本與共用協作骨架 | ✅ | [ADR-001](adr/001-mods-sync-and-install.md) | `main` 915d246 | VERIFIED（`node --test` 16/16；`check-model-routing.mjs` 162/162；暫存 clone 端對端 `sync --no-push`） |
| R01.1 | | 同步核心 `scripts/mods/lib.mjs`：找 mod、LF 正規化雜湊、複製、產生 marketplace、註冊 `CLAUDE_CODE_PLUGIN_DIRS` | ✅ | | | 單元測試 |
| R01.2 | | 指令列 `scripts/mods.mjs`：`status`／`push`／`install`／`sync`，`--dry-run`／`--update`／`--no-push`／`--from` | ✅ | | | 暫存 clone 端對端 |
| R01.3 | | 協作骨架與五級模型路由（`.claude/agents`、hook、`check-model-routing.mjs`） | ✅ | | | 檢查腳本 162/162 |
| R02 | 功能 | 收錄 mod：`blast-radius`、`replay-theater`（0.1.0） | ✅ | | `main` 33ebfeb | PARTIALLY VERIFIED（`claude plugin validate` 通過；其他機器載入未驗證） |
| R02.1 | | 以 `push` 把 `~/.claude/mods/` 的兩個 mod 放進 `mods/<name>/` | ✅ | | | 腳本 |
| R02.2 | | 產生 `.claude-plugin/marketplace.json` | ✅ | | | `claude plugin validate` |
| R03 | 修正 | 同步腳本：Windows 經 `cmd.exe` 呼叫 `claude` CLI、找不到 CLI 時略過驗證並補上 marketplace 說明 | ✅ | | `main` 4f48936 | VERIFIED（`node --test`） |
| R03.1 | | `claude plugin validate` 在 Windows 的呼叫方式 | ✅ | | | 暫存資料夾測試 |
| R03.2 | | marketplace 補上說明欄位 | ✅ | | | |
| R04 | 文件 | 記錄 repo 建立後的驗證結果、交接與目前狀態 | ✅ | | `main` 9edb53c | VERIFIED（文件） |
| R05 | 雜項 | 套用 AutomaticDetectionDev 的 `ai-project-template` 1.0.0 與 commit 規範；同步腳本改用規範骨架提交、`push`／`sync` 限定 `main` | ✅ | [ADR-000](adr/000-ai-agent-structure.md) | `chore/adopt-ai-template` f01ef2d、70a0899、b1cbf7a，合併 d5efbc9 | VERIFIED（`node --test` 21/21；暫存副本實跑 `push demo-local --no-push`） |
| R05.1 | | 範本 1.0.0 套用：入口、harness、`docs/adr/` 一檔一決策、`decisions.md` 改索引 | ✅ | | f01ef2d | 結構檢查 |
| R05.2 | | `buildCommitMessage` 產生規範骨架、寫成檔案後 `git commit -F`、`push`／`sync` 限定 `main` | ✅ | | 70a0899 | 單元測試（新增 5 個）＋暫存副本實跑 |
| R05.3 | | 交接、目前狀態與 AI 工作紀錄 | ✅ | | b1cbf7a | 文件 |
| R06 | 雜項 | 改寫最早四個舊格式 commit（新格式、新信箱、`Co-Authored-By` 不帶 email 或網址）並以 `--force-with-lease` 推上 `origin/main` | ✅ | [ADR-000](adr/000-ai-agent-structure.md)「後續」 | `docs/history-rewrite` 2346b83，合併 26f356c | VERIFIED（改寫前後 tree 相同 `4a1d937`；8 個 commit 作者與格式逐一核對） |
| R07 | 雜項 | 導入 AI 結構 2.0.0（整套照搬 AutoCadCreated，在 origin 26f356c 上重做） | ✅ | [ADR-002](adr/002-ai-structure-2-0-0.md) | `docs/ai-structure-2.0.0`（本機提交後推送、開 PR；不合併，等使用者決定） | PARTIALLY VERIFIED（結構、鏡像、路由檢查與單元測試通過，見 `.ai/handoff.md`；hook 在本專案 session 的實際載入未驗證） |
| R07.1 | | 範本管理檔換成 2.0.0（`engineering-workflow.md`、`ai-handoff`、`check-ai-structure.ps1`、`sync-skills.ps1`、`tools/ste-lint.mjs`、各 `_template`） | ✅ | | | `-Refresh`＋結構檢查 |
| R07.2 | | 專案擁有檔合併（入口、`project-rules.md`、`AI_CONTEXT.md`、`MODEL_ROUTING.md`、agents），保留 origin 的 commit 規範、同步腳本規則與模型路由 | ✅ | | | 結構檢查 |
| R07.3 | | ADR-002、`00-master-plan.md`、`decisions.md` 索引、需求進度表回填 | ✅ | | | 結構檢查 `-Strict` |
| R07.4 | | hook 指令改成 `${CLAUDE_PROJECT_DIR}`（PowerShell 下沒有大括號的寫法會變空字串），`check-model-routing.mjs` 改檢查新寫法並拒絕舊寫法（使用者同意） | ✅ | | | `check-model-routing.mjs` 163/163；實際 session 載入未驗證 |
| R08 | 功能 | 收錄本機其餘 mod：`agents-panel`、`disk-status`、`taskboard-pane`、`usage-bar` | ⬜ | | | |
| R09 | 雜項 | 其他機台第一次 `sync` 的實測；macOS／Linux 實機驗證（`CLAUDE_CODE_PLUGIN_DIRS` 以 `:` 分隔，目前只有單元測試） | ⬜ | | | |
| R10 | 功能 | 刪除 mod 的流程（目前腳本不刪除任何一端） | ⬜ | | | |
| R11 | 修正 | `install` 會註冊所有「已安裝且在 repo 中」的 mod，包含刻意不載入的同名 mod | ⚠️ | | | 已知問題 |

圖例：✅ 完成　⏳ 進行中　⬜ 尚未開始　⚠️ 有未解決問題　⛔ 取消

### 待使用者決定

1. `.claude/settings.json` 的 `ask` 規則：origin 已有範本要求的 PowerShell 版 `deny` 與 `ask`（`git push`、`reset --hard`、`clean`），沒有缺項，本次沒有動；另外 origin 對 `git add *`、`git commit *`（Bash 與 PowerShell）也設了 `ask`，範本 2.0.0 沒有這兩類。要保留、改成只在非標準寫法時詢問，或與範本一致，請使用者決定。
2. Git 授權範圍維持 ADR-000 的規定（使用者同意後在工作分支 commit、`merge --no-ff` 回 `main`、不含 push），只有提交身分與格式依上層；這次的推送與 PR 是使用者當次要求。若要改成上層「完成後的自動流程」，需使用者明確決定。
3. 在本專案的 Claude Code session 實際確認 hook（`${CLAUDE_PROJECT_DIR}` 寫法）有輸出路由建議；目前只做過靜態檢查與直接執行 `model_router.mjs`。
4. Node 最低支援版本：`package.json` 的 `engines` 寫 `>=18`，本機只確認 v24.21.0，其他機器未驗證。
5. 是否導入格式化工具（目前沿用周邊程式碼風格）。
6. 多人或多機同時改同一個 mod 時的流程。

## 目前進度

### 進行中

- 導入 AI 結構 2.0.0（R07）：變更由主 session 在本機提交、推送到 origin 的 `docs/ai-structure-2.0.0` 並開 PR；本專案沒有 CI，開 PR 後不合併，等使用者決定。

### 已完成

- repo 結構：`mods/<name>/` 一個 mod 一個資料夾，`.claude-plugin/marketplace.json` 由腳本產生；已推上 `chielinHsu/ModsDevTool` 的 `main`。
- 同步腳本 `scripts/mods.mjs`（`status`／`push`／`install`／`sync`，`--dry-run`／`--update`／`--no-push`／`--from`），核心 `scripts/mods/lib.mjs`，測試 `tests/mods.test.mjs`（21/21）。
- 收錄的 mod：`blast-radius`（0.1.0）、`replay-theater`（0.1.0）。
- Codex／Claude Code 共用協作結構 2.0.0（routing-1 模型路由；見 ADR-002）。

### 待辦（依優先順序）

1. 其他機器 `git clone` 後執行 `node scripts/mods.mjs sync`，重開 Claude Code 確認 mod 實際載入（R09）。
2. 本機要讓 blast-radius、replay-theater 在新 session 載入：使用者執行 `node scripts/mods.mjs install`（會改 `~/.claude/settings.json`）。
3. 本機另有 agents-panel、disk-status、taskboard-pane、usage-bar 未收錄；要收錄時 `node scripts/mods.mjs push <name>`（R08）。
4. macOS／Linux 實機驗證（R09）。
5. 刪除 mod 的流程尚未設計（R10）。

### 已知問題

- 本機 Git for Windows 設定為 `http.sslBackend=openssl` 時無法驗證 GitHub 憑證；腳本在 Windows 自動改用 schannel，本 repo 也設定了 repo 層級的 schannel。
- install 會註冊所有「已安裝且在 repo 中」的 mod；若有刻意不載入的同名 mod，需在 `settings.json` 手動移除（R11）。
- 刪除 mod 的流程未定義（腳本不刪除任何一端）。
- 其他已 clone 舊歷史的地方要重新 clone，或 `git fetch` 後 `git reset --hard origin/main`（會丟掉該處未推送的修改）。
- `docs/steps/`、`docs/plan/` 目前只有範本，未替過去的需求補計畫檔與四種輸出。
