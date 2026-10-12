# Claude Code 專案入口

@AGENTS.md
@AI_CONTEXT.md
@.agents/harness/engineering-workflow.md
@.agents/harness/project-rules.md
@MODEL_ROUTING.md

上面五份每個 session 都會載入（`MODEL_ROUTING.md` 是 Claude 專用的模型路由規則，見 `docs/adr/000-ai-agent-structure.md`）。`.ai/handoff.md` 與 `docs/current-status.md` 會頻繁變動，不自動匯入；非單純任務開始前，依 `AGENTS.md` 的清單讀取。

本檔只放 Claude 專屬規則，共通內容在上面的文件，不要在此複製。

## Claude 專屬規則

- **Skill**：`.claude/skills/` 是 `.agents/skills/` 的鏡像，改 skill 時改 `.agents/skills/` 的來源，再執行 `scripts/ai/sync-skills.ps1`。只給 Claude 用的 skill 要登記在 `.agents/harness/skill-sync.json` 的 `claudeOnly`。
- **權限與 hook**：`.claude/settings.json` 控制工具權限。設定允許某個指令，不代表已授權 commit、push、刪除或對外發布。
- **流程圖**：`engineering-workflow.md` 要求的修改前後流程圖，在對話中優先用可用的視覺化工具渲染成圖；工具不可用時退回 Mermaid，並說明原因。寫進文件的流程圖一律保留 Mermaid 原始碼。
- **寫 mod**：新增或修改 mod 的 hooks 前先載入 `plugin-authoring` skill；API 以該 skill 寫出的型別檔（或 mod 載入後的 `.claude-plugin/types/claude-code/index.d.ts`）為準。新 mod 先在 session 的 `~/.claude/dev-mods/<session>/<name>/` 開發並熱重載確認，再由使用者執行 `node scripts/mods.mjs push <name>`。
- **模型與推理強度路由**：依 `MODEL_ROUTING.md` 評分並決定是否委派 subagent（`.claude/agents/`）。`UserPromptSubmit` hook（`.claude/hooks/model_router.mjs`）只提供建議，**不會切換本 session 的模型或 effort**；改過路由相關檔案後跑 `node scripts/ai/check-model-routing.mjs`。
- **個人偏好**放 `CLAUDE.local.md`（已在 `.gitignore`），不要寫進本檔。
