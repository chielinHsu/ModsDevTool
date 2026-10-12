<!-- 共用入口、事實與規則透過下列匯入，不在此複製。 -->
@AGENTS.md
@AI_CONTEXT.md
@.agents/harness/engineering-workflow.md
@.agents/harness/project-rules.md
@MODEL_ROUTING.md

## Claude Code 專用

- 寫新 mod 或改 mod 的 hooks 前先載入 `plugin-authoring` skill；API 以該 skill 寫出的型別檔（或 mod 載入後的 `.claude-plugin/types/claude-code/index.d.ts`）為準。
- 新 mod 先在 session 的 `~/.claude/dev-mods/<session>/<name>/` 開發並熱重載確認，再由使用者執行 `node scripts/mods.mjs push <name>` 放進 repo。
- 設計、決策、進度寫回共用文件，不只留在 Claude auto memory 或對話。
- 五級 subagent 在 `.claude/agents/`；分級規則見 `MODEL_ROUTING.md`。`UserPromptSubmit` hook 只提供建議，**不會切換本 session 的模型或 effort**。
- `.claude/skills/` 由 `scripts/ai/sync-skills.ps1` 從 `.agents/skills/` 產生，不手動編輯。個人設定放 `.claude/settings.local.json`（Git 忽略）。
