---
name: ai-handoff
description: 有意義的變更完成或工作中斷時，依實際 Git 狀態、diff 與驗證結果更新交接單、AI changelog、目前狀態與 ADR，並在入口或 skill 變更時執行結構檢查。用於收工、交接、切換 agent 或使用者要求「整理交接」時。
---

# ai-handoff：收工與交接

只寫實際發生且可確認的內容。不虛構驗證結果；沒做的寫 `NOT VERIFIED` 並說明原因。

## 1. 蒐集事實

依序執行並保留輸出摘要（Git 命令遇到 dubious ownership 時依 `AI_CONTEXT.md` 的說明加 `-c safe.directory=...`）：

```bash
git status --short --branch
git diff --stat
git diff --cached --stat
git log --oneline -5
```

- 區分：本次修改、本次之前就存在的未提交修改、未追蹤檔案。來源不明的修改不得覆蓋或歸為本次成果。
- 收集本次實際執行的驗證命令與結果（通過／失敗／略過數）；失敗另列。
- 無專案版控時，先依 `engineering-workflow.md` 第 0 節處理。

## 2. 覆寫 `.ai/handoff.md`（≤ 60 行）

使用以下段落，全部填寫；沒有內容寫「無」：

```markdown
# 交接單

更新：YYYY-MM-DD HH:mm（時區）｜分支：<branch>｜HEAD：<short sha>

## 正在做
## 已完成
## 下一步
## 相關檔案
## 不要動
## 已知問題
## 未提交變更
## 假設與未驗證事項
```

沒有進行中工作時，「正在做」寫「沒有進行中的交接」。

## 3. 新增 `docs/changelog-ai.md` 條目（置頂）

```markdown
## YYYY-MM-DD｜<標題>

### Added／Changed／Fixed／Documentation（只列有的）
- ...

### Validation
- <命令>：<結果>（VERIFIED／PARTIALLY VERIFIED／NOT VERIFIED）
```

純問答、沒有檔案變更時不新增條目。只記已進入專案的結果，不寫討論與重試細節。

## 4. 更新 `docs/current-status.md`

原地更新完成項目、待辦與已知問題；不要把歷史堆在這裡。

## 5. 有設計決策時新增 ADR

在 `docs/decisions.md` 的 ADR 區塊置頂新增：

```markdown
### ADR-NNN｜YYYY-MM-DD｜<標題>

- 狀態：Accepted（取代舊決策時寫 `Supersedes ADR-XXX`，並在舊條目註記 `Superseded by ADR-NNN`）
- 背景：
- 決定：
- 理由：
- 替代方案：
- 後果：
```

## 6. 結構檢查

入口文件（`AGENTS.md`、`CLAUDE.md`、`AI_CONTEXT.md`、`MODEL_ROUTING.md`）、harness 或 skill 有變更時執行：

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ai/sync-skills.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ai/check-ai-structure.ps1
node scripts/ai/check-model-routing.mjs
```

## 7. 回報

回報交接單重點、更新的檔案與檢查結果。未經授權不 stage、commit 或 push；需要提交時列出建議的明確路徑供使用者確認。
