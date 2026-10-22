# AI 工作紀錄

> 只新增，新紀錄放最上方。每個 agent session 一筆，讓下一位 agent 知道上一位做過什麼、為什麼。
> agent 欄位寫實際的工具與模型；不要從舊紀錄抄。

## 格式

```markdown
## YYYY-MM-DD — Claude Code (模型) ／ Codex (模型)

### 完成
- 做了什麼（一行一件）

### 修改的檔案
- path/to/file

### 驗證
- 實際執行的指令與結果；沒執行就寫「未驗證」與原因

### 未完成
- 還沒做完的事

### 注意事項
- 下一位 agent 需要知道的限制、否決的做法、不要還原的修改
```

## 2026-10-22 — Claude Code (Sonnet 5.5)（導入 AI 結構 2.0.0，ADR-002）

### 完成
- 在 origin 最新版（26f356c）上重新套用 AI 結構 2.0.0（先前在舊歷史上做過一次，origin 改寫歷史後重做），保留 origin 的 commit 規範、同步腳本 commit 訊息規則與 ADR-001。
- 以 `New-AiProject.ps1 -Refresh` 換上範本管理檔：`engineering-workflow.md`（新增「需求展開與進度表」）、`TEMPLATE_VERSION`（2.0.0）、`ai-handoff` skill 與鏡像、`check-ai-structure.ps1`、`sync-skills.ps1`；新增 `tools/ste-lint.mjs`、`docs/plan/_template.md`、`docs/adr/_template.md`、`docs/steps/_template/`；`.gitignore` 補 `perf/results/`。
- 專案擁有檔合併：`AGENTS.md` 改為四條規則；`CLAUDE.md`、`project-rules.md`（SOLID、四種輸出、Step Protocol、與上層規則的關係、Git 授權維持不含 push）、`AI_CONTEXT.md`、`MODEL_ROUTING.md`、`.claude/agents/*` 補上 2.0.0 段落。
- 新增 `docs/00-master-plan.md`、`docs/adr/002-ai-structure-2-0-0.md`；`docs/decisions.md` 加索引；`docs/current-status.md` 開頭加需求進度表（回填 R01–R06，列出 R07–R11）。
- 使用者同意後，`.claude/settings.json` 的 hook 指令改成 `${CLAUDE_PROJECT_DIR}`（只改這一個字串），`check-model-routing.mjs` 同步改檢查新寫法並拒絕沒有大括號的寫法。

### 修改的檔案
- 修改：`AGENTS.md`、`CLAUDE.md`、`AI_CONTEXT.md`、`MODEL_ROUTING.md`、`.agents/harness/engineering-workflow.md`、`.agents/harness/project-rules.md`、`.agents/harness/TEMPLATE_VERSION`、`.agents/skills/ai-handoff/SKILL.md`、`.claude/skills/ai-handoff/SKILL.md`（鏡像）、`.claude/agents/{architect,architect-deep,developer,developer-deep}.md`、`.claude/settings.json`、`.gitignore`、`scripts/ai/check-ai-structure.ps1`、`scripts/ai/sync-skills.ps1`、`scripts/ai/check-model-routing.mjs`、`.ai/handoff.md`、`docs/{architecture,changelog-ai,current-status,decisions}.md`、`docs/adr/000-ai-agent-structure.md`
- 新增：`docs/00-master-plan.md`、`docs/adr/002-ai-structure-2-0-0.md`、`docs/adr/_template.md`、`docs/plan/_template.md`、`docs/steps/_template/*`、`tools/ste-lint.mjs`
- 未動：`mods/`、`tests/`、`scripts/mods*`、`README.md`、`package.json`

### 驗證
- `sync-skills.ps1 -Check`、`check-ai-structure.ps1 -Strict`、`check-model-routing.mjs`（163/163）、`node --test tests/mods.test.mjs`（21/21）、`node tools/ste-lint.mjs`（0 錯誤）的結果見 `.ai/handoff.md`。
- 靜態檢查通過不等於 Claude Code 實際載入：hook、agents、skill 在本專案 session 的載入未驗證。

### 未完成
- 在本專案的 Claude Code session 實際確認 hook 會輸出路由建議。
- `docs/current-status.md`「待使用者決定」六項（含 settings.json 的 `git add`／`git commit` ask 規則；Git 授權維持不含 push）。

### 注意事項
- 範本管理的檔案不要在本專案修改；`skill-sync.json` 與 2.0.0 格式相同，未更動。
- 本專案有 remote 且沒有 CI：PR 開出後不合併，等使用者決定。
- 提交身分、訊息格式與完成後流程以上層 `D:\ClaudeWork\CLAUDE.md` 為準。

## 2026-10-12 — Claude Code (Claude Opus 5.5)（改寫舊 commit 並強制推送）

### 完成
- 使用者同意後，以 `git commit-tree` 重建 `main`：四個舊格式 commit 改成「Commit 訊息」的骨架、作者改為 `chielin0025@hotmail.com`；`Co-Authored-By` 只寫模型名稱，不帶 email 或網址。tree、時間與結構不變，對照表在 ADR-000 的「後續」。
- 合併 commit 訊息裡的 hash 換成新的；舊歷史留在本機分支 `backup/pre-rewrite`。
- 以 `--force-with-lease` 推送 `main`。

### 修改的檔案
- `docs/adr/000-ai-agent-structure.md`、`docs/changelog-ai.md`、`docs/current-status.md`、`.ai/handoff.md`

### 驗證
- 改寫後最後的 tree 與改寫前相同（`4a1d937`）；8 個 commit 的作者與提交者都是新信箱；8 個 `Co-Authored-By` 都是 `Claude Opus 5.5`，沒有 email 或網址；8 個都有 `[Test]` 結尾；合併訊息引用的 3 個 hash 都在新的 `main` 上。

### 未完成
- 無。

### 注意事項
- 本紀錄以下的舊紀錄裡出現的 commit hash 是改寫前的，對照 ADR-000 的表。
- `backup/pre-rewrite` 確認不需要後可以刪除（`git branch -D backup/pre-rewrite`）。

## 2026-10-12 — Claude Code (Claude Opus 5.5)（套用 AutomaticDetectionDev 範本與 commit 規範）

### 完成
- 以 AutomaticDetectionDev 的 `ai-project-template/New-AiProject.ps1 -Refresh` 套用範本 1.0.0；範本管理的檔案與範本一致，`skill-sync.json` 改為範本格式（ADR-000）。
- 依範本重寫入口與專案文件；`project-rules.md` 的「Commit 訊息」逐字沿用範本，加上分支流程與同步腳本 commit 的規則。
- 決策改為 `docs/adr/` 一檔一決策，`docs/decisions.md` 改為索引。
- 同步腳本：commit 訊息改用 `buildCommitMessage`（範本骨架）並寫成檔案後 `git commit -F`；`push`／`sync` 限定 `main`（`--dry-run` 不限）。
- repo 的 `user.email` 改為 `chielin0025@hotmail.com`。

### 修改的檔案
- `AGENTS.md`、`CLAUDE.md`、`AI_CONTEXT.md`、`.agents/harness/*`、`.agents/skills/ai-handoff/SKILL.md`、`.claude/skills/ai-handoff/SKILL.md`、`.claude/settings.json`、`.ai/handoff.md`
- `docs/architecture.md`、`docs/decisions.md`、`docs/adr/000-ai-agent-structure.md`、`docs/adr/001-mods-sync-and-install.md`、`docs/current-status.md`、`docs/changelog-ai.md`
- `scripts/ai/check-ai-structure.ps1`、`scripts/ai/sync-skills.ps1`、`scripts/mods.mjs`、`scripts/mods/lib.mjs`、`tests/mods.test.mjs`、`.gitattributes`、`README.md`

### 驗證
- `node --test tests/mods.test.mjs`：21／21 通過（新增 5 個 commit 訊息測試）。
- 暫存副本（`main`、假的設定目錄）實際執行 `push demo-local --no-push`：產生的 commit 訊息符合骨架，只 commit `mods/demo-local` 與 `marketplace.json`，訊息檔用完即刪。
- 工作分支上 `push` 被擋、`push --dry-run` 可以執行。
- 結構、技能鏡像與路由檢查的結果見下一位交接單（`.ai/handoff.md`）。

### 未完成
- 2026-10-12 前的四個 commit 仍是舊格式與舊信箱；改寫需要 force push，待使用者決定。

### 注意事項
- 範本管理的檔案（`engineering-workflow.md`、`TEMPLATE_VERSION`、`ai-handoff` skill、`scripts/ai/check-ai-structure.ps1`、`scripts/ai/sync-skills.ps1`）不要在本專案修改。
- 模型路由沿用依全域規格建立的版本，沒有改用 AutomaticDetectionDev 的路由（理由見 ADR-000）。

## 2026-10-12 — Claude Code (Claude Opus 5.5)（建立 repo 與同步腳本）

### 完成
- 新增 `scripts/mods.mjs`、`scripts/mods/lib.mjs`、`tests/mods.test.mjs`：跨機台同步 mod（本機 `~/.claude/mods`、`~/.claude/dev-mods` ⇄ repo `mods/<name>`），預設只新增缺少的 mod。
- 以腳本 push 收錄 `mods/blast-radius`、`mods/replay-theater`，產生 `.claude-plugin/marketplace.json`。
- 依全域規格建立協作骨架與五級模型路由（環境變數前綴 `MODSDEV_ROUTER`）。

### 修改的檔案
- 整個 repo 初次建立（commit `e09a194`、`a411b1e`、`8b58746`、`0129d04`）。

### 驗證
- `node --test tests/mods.test.mjs` 16／16；`check-model-routing.mjs` 162／162；兩個 mod 與 marketplace 的 `claude plugin validate` 通過。
- 暫存 clone + 假設定目錄執行 `sync --no-push`：安裝、註冊、保留原設定與備份、加入本機獨有的 mod，第二次執行沒有重複動作。

### 未完成
- 其他機器實際載入、macOS／Linux 未驗證。

### 注意事項
- 本機 Git for Windows 的 OpenSSL 無法驗證 GitHub 憑證；腳本在 Windows 對網路 git 指令加 schannel。
