# MODEL_ROUTING｜Claude Code 模型分級（ModsDevTool）

Claude Code 專屬。Codex 不載入 `.claude/agents` 或 Claude hooks，不適用本檔的自動建議；Codex 依 `AGENTS.md` 與共用流程工作。

路由擴充版本：`routing-1`（2026-10-12）。骨架版本見 `.agents/harness/TEMPLATE_VERSION`。

## 角色

| Agent | model | effort | 職責與界線 |
|---|---|---|---|
| fast-worker | haiku | low | 明確的唯讀查詢、搜尋、摘要；不修改專案、不執行命令 |
| developer | sonnet | medium | 既有架構內的一般實作、文件與除錯 |
| developer-deep | sonnet | high | 風險不高但複雜、需要深度推理或驗證成本高的實作 |
| architect | opus | high | 高風險分析、架構與設計計畫；不直接修改專案 |
| architect-deep | opus | xhigh | 高風險且高度不確定、推理特別深的分析；不直接修改專案 |

角色檔在 `.claude/agents/`。唯讀角色（fast-worker、architect、architect-deep）的工具只有 Read／Grep／Glob（架構角色另有 WebFetch／WebSearch），並以 `disallowedTools` 排除 Edit、Write、Bash、PowerShell、Agent。developer 系列可改檔與執行測試，但排除 Agent，且不得 stage／commit／push，也不執行會改寫 `~/.claude/` 的 `scripts/mods.mjs push`／`install`／`sync`。

平台支援（2026-10-12 依本機 Claude Code CLI 2.1.283 `--help` 確認有 `--agent`、`--model`、`--effort`；subagent frontmatter 欄位沿用參考實作 2026-10-09 依官方文件的確認）：`model`（`haiku`／`sonnet`／`opus` 別名）、`effort`（`low`／`medium`／`high`／`xhigh`／`max`）、`tools`、`disallowedTools`。這是**靜態設定確認**；實際載入結果需以 `scripts/ai/bench-model-routing.mjs` 在授權下驗證。

## 評分

每項 1–5 分，取命中條件的最高值，不累加。

| 分數 | 複雜度 | 風險 | 推理深度 | 不確定性 |
|---|---|---|---|---|
| 1 | 錯字、措辭 | 純文字微調 | 直接查找 | 完全已知 |
| 2 | 單檔小修改 | 不影響攔截、同步與全域設定 | 簡單因果 | 現況清楚 |
| 3 | 新增一般功能、新 mod、指令、測試 | `ui.render`、pane、band、`$.state`、計時器、replay／diff 顯示、熱重載 | 一般除錯、mod 沒有畫出 | 需要比較少數選項 |
| 4 | 跨模組、批次、並行、雙向同步衝突處理 | `tool.call`／`tool.check` 攔截、權限、guard、安全、憑證／SSL、sync／install、跨機台、marketplace、`~/.claude/mods`、dev-mods | 根因分析、設計權衡、效能瓶頸 | 桌面版／終端機差異、跨平台（macOS／Linux）、其他機台、平台限制 |
| 5 | 大範圍重構、所有 mod 一起改 | `git push`、強制推送、發布、覆寫、刪除 mod 或 repo、`rm -rf`、`settings.json`／`CLAUDE_CODE_PLUGIN_DIRS` 全域設定 | 最壞情況、安全模型 | 原因不明、偶發、無法重現 |

- **範圍**：`single-file`、`module`、`cross-module`、`unknown`。
- **驗證成本**：`low`（文件）、`medium`（`node --test`、`claude plugin test`）、`high`（在 Claude Code 實際看畫面、熱重載、跨機台安裝、push 到遠端）。

## 判斷順序

1. 純查詢、唯讀、範圍明確且不涉及分析或設計 → fast-worker（唯讀查詢不改變系統，主題敏感不提高動作風險）。
2. 風險 ≥ 4，且推理 ≥ 5 或不確定性 ≥ 4 → architect-deep。
3. 其餘風險 ≥ 4 → architect。
4. 複雜度、推理或不確定性任一 ≥ 4，或驗證成本 high → developer-deep。
5. 其餘 → developer。

## 本專案案例

| 需求 | 分數（複雜／風險／推理／不確定） | 範圍／驗證 | 結果 |
|---|---|---|---|
| 列出 `mods/` 底下有哪些 mod | 2／2／2／2 | module／medium | fast-worker |
| 找出 `scripts/mods/lib.mjs` 註冊 `CLAUDE_CODE_PLUGIN_DIRS` 的位置 | 2／5／2／2 | single-file／medium | fast-worker |
| 修正 `README.md` 的錯字 | 1／2／2／2 | single-file／low | developer |
| 在 `mods/replay-theater/hooks/diff.ts` 調整 diff 的 context 行數 | 2／3／2／2 | single-file／medium | developer |
| 新增一個 mod：在 pane 顯示目前的 git 分支 | 3／3／2／2 | unknown／high | developer-deep |
| 修改 `mods/blast-radius/hooks/register.tsx` 的 tool.call 攔截規則 | 2／4／2／2 | single-file／medium | architect |
| 修改同步腳本的 install，讓它也處理 marketplace | 2／4／2／2 | unknown／medium | architect |
| 分析同步腳本 push 偶發覆寫遠端 mod 的根因 | 2／5／4／5 | unknown／high | architect-deep |

這些案例由 `scripts/ai/check-model-routing.mjs` 驗證；修改規則時同步更新三處：本檔、`.claude/hooks/model_router.mjs` 的 `PROFILE`、檢查腳本的案例。

## 升降級

- 同一問題兩次有證據、有調整做法的有效嘗試仍失敗，升一級；重複相同做法不算有效嘗試。
- 升級後保留等級下限直到問題解決；最高級（architect-deep）仍無進展時，整理證據、已排除假設及缺少資訊交由使用者決定。
- 問題解決後重新分級。
- hook 以使用者訊息中的失敗／成功語句計數（如「還是不行」「已解決」），也可用明確標記 `[router:fail]`、`[router:resolved]`、`[router:reset]`。計數只是輔助，主 agent 依實際證據判斷是否為有效嘗試。

## 委派

- 只在獨立子任務、可平行處理、大量資料整理或需要不同推理能力時委派；主 agent 足以完成的小任務直接處理，不為分級而開 agent。
- 委派時提供：目標、範圍、相關檔案、驗收條件、已知證據、失敗紀錄。唯讀角色需要命令輸出時，由主 agent 先執行並附上。
- 架構角色把計畫交回主 agent，由主 agent 或 developer 系列執行已授權的實作。
- 主 agent 必須核對 subagent 的重要結論與驗證證據，再回報使用者。

## 驗證

- `node scripts/ai/check-model-routing.mjs`：frontmatter、工具邊界、hook 接線、文件／角色／hook 的 model 與 effort 一致性、本專案案例、升降級、最高級、通知過濾與壞輸入。不呼叫模型 API。
- `node scripts/ai/bench-model-routing.mjs`：預設只顯示計畫；`--run` 且設定 `MODSDEV_ROUTER_BENCH_AUTHORIZED=1` 才實際呼叫 `claude -p --agent`，會消耗額度，需使用者授權。結果寫入 Git 忽略的 `.ai/bench/`。

## Hook：`.claude/hooks/model_router.mjs`

- 事件：`UserPromptSubmit`；輸出 `hookSpecificOutput.additionalContext`，內容為建議 agent、model、effort、各項分數、範圍、驗證成本、理由與升級狀態。
- **只提供建議，不會自動切換主 session 的模型或 effort**；主 agent 讀取實際內容後重新判斷。
- 忽略：`/` 開頭指令、`!` shell、`<task-notification>`、`<system-reminder>`、`<ci-monitor-event>`、Artifact 留言等背景事件。
- 狀態依專案路徑與 session 雜湊隔離，記錄失敗次數、升級下限；成功後重置。
- 壞輸入、狀態檔損壞或寫入失敗都靜默略過（exit 0），不阻斷需求；不呼叫外部模型或 API。

| 環境變數 | 作用 |
|---|---|
| `MODSDEV_ROUTER_DISABLED=1` | 停用 hook |
| `MODSDEV_ROUTER_STATE_DIR=<路徑>` | 自訂狀態目錄（預設系統暫存 `claude-model-router/`） |
| `MODSDEV_ROUTER_BENCH_AUTHORIZED=1` | 允許 bench 實際執行（仍需 `--run`） |
