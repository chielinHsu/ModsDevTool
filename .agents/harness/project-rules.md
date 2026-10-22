# 專案規則（ModsDevTool）

本檔放「這個專案的慣例」：命名、格式、依賴、SOLID、四種輸出、Step Protocol、Git、Commit 訊息、文件與驗證。流程在 `engineering-workflow.md`，專案事實在 `AI_CONTEXT.md`。
結構沿用 `ai-project-template`（版本見 `.agents/harness/TEMPLATE_VERSION`），決策見 `docs/adr/000-ai-agent-structure.md`、`docs/adr/002-ai-structure-2-0-0.md`。

**與上層規則的關係**：本專案位於 `D:\ClaudeWork\ModsDevTool`，上層 `D:\ClaudeWork\CLAUDE.md` 的提交身分、commit 指令寫法、訊息格式與「完成後的自動流程」由 Claude Code 自動往上讀取。本檔與上層衝突時，**提交身分與訊息格式以上層為準**；上層的「完成後的自動流程」（推送分支、開 PR）不適用本專案：本檔對 commit 與 push 的授權較具體，上層也寫明專案規定更具體時以專案為準。本檔只補本專案才有的規定（mod 與同步腳本）。Codex 讀不到上層檔，所以下面「Git」與「Commit 訊息」把必要部分寫在本檔，內容與上層一致。

## 程式碼風格

- 沿用周邊程式碼的命名、縮排、註解密度與慣用寫法；不做無關的重構或格式化。
- 新增依賴前，先確認既有依賴解決不了。`scripts/` 只用 Node 內建模組；要加 npm 相依先記 ADR。
- 編碼與換行：UTF-8（無 BOM）、LF；`*.bat`、`*.cmd`、`*.ps1` 在 checkout 時為 CRLF（見 `.gitattributes`）。含中文的 `.ps1`（`scripts/ai/*.ps1`）依範本維持原狀，Windows PowerShell 5.1 讀檔加 `-Encoding UTF8`。縮排 2 個空白。
- `scripts/`、`tests/`：ES modules、單引號、行尾分號。`mods/`：沿用 Claude Code mod 範例的風格（單引號、行尾不加分號）。
- 註解用繁體中文；mod 內沿用撰寫時的英文註解，不為了語言一致而改寫。
- mod 名稱：小寫英數與 `-`（`^[a-z0-9][a-z0-9-]{0,63}$`），資料夾 `mods/<name>/` 與 `plugin.json` 的 `name` 一致；`$.state` 的鍵在 mod 的 `types/index.d.ts` 宣告。
- mod 只能 import 自己資料夾內的檔案與 `claude-code`／`claude-code/testing`，不得使用 `import()`。
- 同步腳本的子指令維持 `status`、`push`、`install`、`sync`；新增子指令時同步更新 `HELP`、`README.md` 與 `AI_CONTEXT.md`。

### SOLID 檢查清單（每次 commit 前自問）

本專案沒有類別階層，「類別」讀作「模組或函式」、「use case」讀作「同步指令或 mod hook」。

- **S** 這個模組只有一個變更理由嗎？`scripts/mods/lib.mjs` 或單一 mod 檔超過 300 行要在 commit 說明。
- **O** 新增功能是「新增模組 + 註冊」（例如新 mod、新子指令的獨立函式），還是「修改既有流程」？後者要有理由。
- **L** 新的實作能通過同一組介面的契約（`lib.mjs` 的函式簽章、mod 的 hook 契約）與既有測試嗎？
- **I** 函式與 mod 對外只露出需要的最小介面；`lib.mjs` 維持純檔案邏輯，git 與 `claude` CLI 只在 `mods.mjs` 呼叫。
- **D** 邏輯依賴參數（路徑、設定目錄用參數或環境變數傳入），不在函式內寫死 `~/.claude`；測試用暫存資料夾驗證，不碰真實設定。

## 每一步都必須交付四種輸出（Karpathy 的 4 種輸出形式）

目的：讓讀者清楚知道這個設計的**目的（Purpose）、原因（Reason）、效果（Effect）**。放在 `docs/steps/<ID>-<slug>/`，範本在 `docs/steps/_template/`。

**適用範圍**：Step Protocol 的步驟，以及 `docs/current-status.md` 需求進度表中類型標為「功能」的需求（例如新增 mod、新增同步腳本子指令）。**小修正（fix、docs、chore、refactor 等）免四種輸出**，只要依 `ai-handoff` skill 更新進度表、交接單與 changelog。

| # | 輸出 | 檔案 | 要求 |
|---|---|---|---|
| 1 | 寫作 Writing | `spec.md` | 用 ASD-STE100 風格英文寫 Purpose / Reason / Effect（放在 `<!--STE-->` … `<!--/STE-->` 之間），每段後附繁中摘要。短句（描述句 ≤ 25 字、程序句 ≤ 20 字）、主動語態、一詞一義。執行 `node tools/ste-lint.mjs` 必須無 error。這是長度／被動語態的檢查，**不是**完整 STE 驗證。 |
| 2 | 圖解 Diagrams | `diagram.md` | Mermaid 圖（結構圖、流程圖、序列圖、狀態圖擇需要者）。能用圖就不要用長文。 |
| 3 | 互動網頁 Web page | `explainer.html` | 單一檔案、離線可開、深色／淺色皆可讀、手機寬度可用；要有可操作的元件（slider、按鈕、步進）。需要的文字放在 `<script type="application/json" id="ste-data">`，其中 `ste` 欄位會被 lint 檢查。 |
| 4 | 解說影片 Explainer video | `storyboard.md` | 分鏡表（時間、畫面、旁白 STE 英文、繁中字幕）。實際影片／語音合成是選配，需使用者同意再做。 |

另外每一步要有 `perf.md`：本步驟量測了哪些指標、預算、實測值、機器指紋。本步驟沒有效能指標時，寫「本步驟無效能指標」並說明原因，不要留白。

## Step Protocol（每完成一個步驟必做；不要在同一個 session 連做下一步）

步驟 ID `<ID>` 用總體計畫（`docs/00-master-plan.md`）的編號，例如 `S01`；需求進度表的 `Rnn` 若自成一步也可以當 ID。

1. 開工：讀 `docs/current-status.md`（需求進度表）與 `docs/plan/<ID>-*.md`。從預設分支建立分支（`feat/…`、`fix/…`、`docs/…`、`chore/…`）；把本步驟在進度表裡的列標為 ⏳。
2. 實作，並同時產出四種輸出與 `perf.md`。
3. 驗證：`node --test tests/mods.test.mjs` 通過、`node tools/ste-lint.mjs` 無 error，以及 `AI_CONTEXT.md` 與該步驟 plan 檔「完成定義」列出的其他檢查（新 mod 加 `claude plugin validate`、`claude plugin test` 與實際在 Claude Code 看畫面）；本步驟的效能指標已量測並與預算（若專案有定義）比對。**失敗就如實回報，不要宣稱完成。**
4. 更新 `docs/current-status.md`（需求進度表該列改 ✅，補分支／commit 與驗證），並依 `ai-handoff` skill 更新 `.ai/handoff.md` 與 `docs/changelog-ai.md`。
5. Commit（格式見下方「Commit 訊息」；該步驟 plan 檔的「Commit 範本」只當內容參考），在工作分支 commit 後以 `git merge --no-ff` 合併回 `main`，打 tag `step-NN-done`。**不包含 push**；推送與開 PR 要使用者另外同意（見「Git」）。
6. 對使用者**提示 commit 內容**：commit hash、訊息、PR 連結、變更檔案摘要、效能結果、未解決事項。
7. 為下一步建立新 session（prompt 取自**下一步** plan 檔底部的「Start prompt」，並提醒新 session 回覆使用繁體中文）：Claude Code 用 `start_session` 或 `spawn_task`（工具可用時）；Codex 或工具不可用時，把 prompt 印出來讓使用者貼上。**到此為止，不要接著做下一步。**

## Git

- 調查、review、狀態詢問不授權 commit 或 push；要做就先取得使用者同意。本專案明確授權的流程只有下列兩項，且授權範圍不得擴大：
  1. **使用者自己執行** `node scripts/mods.mjs push`／`sync`：腳本在 `main` 上 commit mod 與 `marketplace.json` 並 push。agent 不代為執行這兩個指令，除非使用者在當次對話明確要求。
  2. 使用者同意 agent commit 之後：在工作分支（`feat/<slug>`、`fix/<slug>`、`docs/<slug>`、`chore/<slug>`）上 commit，完成後以 `git merge --no-ff` 合併回 `main`，合併 commit 標題用 `[作者]chore: 合併 <分支>，<一句話說明>`。**不包含 push**，push 要使用者另外同意。
- Stage 時明確列出路徑，禁止 `git add .` 與 `git add -A`（`.claude/settings.json` 也設了 deny）。
- Commit 前看 `git status` 與 `git diff --staged`；有 submodule 時逐一檢查，因為它們是獨立的 repository。
- 工作目錄可能有他人或其他 session 的未提交修改。同一個檔案混有他人修改時，先確認自己的精確 diff，不整檔 stage，也不回復他人的內容。
- Commit 訊息一律寫成檔案（UTF-8）再用 `git commit -F <檔案>`；不用 `-F -`（stdin）、heredoc 或拼接多個 `-m`。原因：Bash heredoc 會壓縮連續反斜線（UNC 路徑會壞），多行訊息經 shell 也可能被改寫，檔案不受影響。commit 指令固定以 `git -c user.name="Caspar Hsu" -c user.email="chielin0025@hotmail.com" commit -F <檔案>` 開頭（上層規則）。
- 不使用 `--no-verify`；force push、`reset --hard`、`clean` 需要使用者明確同意。
- 作者：`Caspar Hsu <chielin0025@hotmail.com>`（本 repo 也有同樣的 repo 層級設定），不用機器全域 gitconfig 的公司帳號。
- 不要提交：`mods/*/.claude-plugin/types/`、mod 根目錄由引擎產生的 `tsconfig.json`、`*.log`、`.ai/bench/`、`perf/results/`；`.gitignore` 已涵蓋。
- 訊息格式見下方「Commit 訊息」。

### Commit 訊息

本節說明格式；**格式的權威是上層 `D:\ClaudeWork\CLAUDE.md`**（作者身分、指令寫法、骨架）。任何 AI 在 commit、或只是產生一段訊息給人貼上時，都照這個格式產出（出處：使用者的固定慣例，AlgoParamFineTune 的 `.clauderules`）。專案若有別的規定，直接改本節並與上層對齊，不要另外在別處再寫一份。

訊息骨架（每個空行都是格式的一部分，不可增減）：

```
[Caspar]type: 繁體中文標題

先寫使用者的回報或要求，再寫原因／現象，再寫改了什麼
（檔案、函式、行為）的散文段落。

測試 :
散文列出實際跑過的檢查與結果；沒跑或失敗的明講。

Co-Authored-By: Claude <當下模型名稱>

[Test]
Build OK, Test OK
```

- **標題**：`[Caspar]type: 修改說明`。`]` 之後不留空格，冒號後一個半形空格。作者名字取 git user 的名字（例如 `HQ\Caspar.Hsu` 寫 `Caspar`）。type 用小寫英文，**只寫一個，不加括號**：`feat`、`fix`、`docs`、`refactor`、`test`、`chore`、`perf`、`build`。說明用繁體中文，一句話交代「到底改了什麼」，禁止「修正問題」「調整程式碼」這類沒有資訊量的句子。有 ADR 時在句尾附 `（ADR-00N）`。
- **正文**：與標題空一行，用散文（不用條列），每行約 30 個全形字折行（不超過 76 字元寬）。寫為什麼改與怎麼改的，不重述 diff；踩到的坑、否決的做法、實測的數字都寫進來。
- **`測試 :`**：`測試` 與冒號之間一個半形空格，自成一行；內容從下一行開始，用繁體中文（指令、函式名保留原文）。沒跑就照實寫沒跑，或寫實際做了什麼驗證；不可以為了填滿格式而編造結果。
- **`Co-Authored-By: Claude <模型名稱>`**：前後各空一行。模型名稱填產生這次 commit 的模型當下實際的名字，不要從文件或舊 commit 抄。**後面不接 email 與角括號**，這是刻意的選擇，不要順手加回去。
- **結尾固定兩行**：`[Test]` 與下一行的測試結果（例如 `Build OK, Test OK`；實際失敗就照實寫，如 `Build OK, Test FAIL`）。純文件、沒有建置的修改也照寫，不省略、不改字；實際驗證了什麼只看 `測試 :` 區塊。本專案沒有建置步驟，「Build OK」指檢查腳本可執行、無語法錯誤。
- 一個 commit 一個意圖；格式化、重新命名不要混進功能 commit。

#### 同步腳本產生的 commit

`scripts/mods.mjs` 的 `push`／`sync` 依上面的骨架自動產生訊息（`buildCommitMessage`，`tests/mods.test.mjs` 驗證格式）：

- 標題：新增時 `[作者]feat: 新增 mod：a、b`；只有更新時 `[作者]chore: 以本機版本更新 mod：a`。作者名字由 `git config user.name` 推得。
- 正文列出每個 mod 的版本與來源（家目錄寫成 `~`，不寫出完整路徑）；`測試 :` 寫 `claude plugin validate` 的實際結果，沒執行就寫沒執行。
- `Co-Authored-By` 段落：由 Claude 代為執行時，設定環境變數 `MODS_CO_AUTHOR_MODEL`（例如 `Opus 5.5`）才會加上；使用者自己執行時沒有 AI 參與，省略該段落（連同它前後的空行），其餘骨架不變。這是已知的格式例外；agent 手動提交一律依上層格式。

## 新增或更新 mod 的流程

1. 在 Claude Code session 內用 `plugin-authoring` skill 開發（草稿在 `~/.claude/dev-mods/<session>/<name>/`），熱重載後實際確認畫面或行為。
2. `claude plugin validate`、`claude plugin test` 通過。
3. 使用者執行 `node scripts/mods.mjs push <name>`（更新既有 mod 加 `--update`）。
4. 其他機台執行 `node scripts/mods.mjs sync`，重開 Claude Code 生效。

## 文件

- `AGENTS.md` ≤ 80 行、`CLAUDE.md` ≤ 80 行、`.ai/handoff.md` ≤ 60 行、`docs/current-status.md` ≤ 150 行（`check-ai-structure.ps1` 檢查，部分為警告）。
- 修改任何 Markdown 後，最終回應要列出「本次修改差異」。
- `docs/` 內的功能或設計文件，最前方保留修改紀錄表，新紀錄放在最上方。
- `docs/changelog-ai.md` 新增置頂；`docs/current-status.md` 原地更新，需求進度表的列不刪除。
- 流程圖寫進文件時保留 Mermaid 原始碼。
- 文件裡的路徑、指令與檔名必須是真的存在的；不確定就不寫。
- 設計決策寫成 `docs/adr/NNN-slug.md`（範本 `docs/adr/_template.md`），並在 `docs/decisions.md` 的索引加一行；`decisions.md` 不放 ADR 內文。
- 需求進度表（`docs/current-status.md`）與計畫檔（`docs/plan/`）的規則見 `engineering-workflow.md`「需求展開與進度表」。
- 每個 mod 的用法寫在 `README.md` 的 mod 清單；新增或移除 mod 時同步更新；mod 內部細節以程式註解為主，不另寫長文件。

## 驗證

- 驗證指令與 `VERIFIED` 的定義在 `AI_CONTEXT.md` 的「建置與測試」；步驟層級的驗證項目在 Step Protocol 第 3 步。
- 改過入口檔、skill、`.claude/` 或 `scripts/ai/` 之後，執行 `scripts/ai/sync-skills.ps1`（改 skill 時）、`scripts/ai/check-ai-structure.ps1 -Strict`；改過模型路由相關檔案，再跑 `node scripts/ai/check-model-routing.mjs`。
- 改同步腳本後跑 `node --test tests/mods.test.mjs`，並用 `node scripts/mods.mjs status`、`push --dry-run`、`install --dry-run` 預覽（唯讀）。`push` 前腳本會執行 `claude plugin validate`，失敗就不 commit。
- 額外的 gate：commit 前 `mods/` 與 `marketplace.json` 不可有來源不明的修改；mod 有沒有在 Claude Code 畫出來要實際看畫面，沒看就標 `NOT VERIFIED`。

## 收工流程

1. 依實際變更執行相關驗證（`AI_CONTEXT.md`「建置與測試」），以 `VERIFIED`／`PARTIALLY VERIFIED`／`NOT VERIFIED` 回報，失敗另列。
2. 執行 `ai-handoff` skill：更新需求進度表、覆寫 `.ai/handoff.md`、新增 `docs/changelog-ai.md`；有設計決策時新增 ADR。
3. 入口、harness 或 skill 有變更時執行 `scripts/ai/check-ai-structure.ps1`；改 skill 時先執行 `scripts/ai/sync-skills.ps1`。
4. 回報修改檔案、驗證結果、尚未驗證的平台行為（例如 mod 在桌面版或終端機的實際繪製），並總結修改內容（`AGENTS.md` 第 1 條）。
