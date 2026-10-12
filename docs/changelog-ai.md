# AI changelog

新增置頂。只記已進入專案的結果。

## 2026-10-12｜建立 repo、同步腳本與共用協作骨架（ADR-001）

- **變更**：
  - 新增 `scripts/mods.mjs`、`scripts/mods/lib.mjs`、`tests/mods.test.mjs`：跨機台同步 mod（本機 `~/.claude/mods`、`~/.claude/dev-mods` ⇄ repo `mods/<name>`），預設只新增缺少的 mod。
  - 收錄 `mods/blast-radius`、`mods/replay-theater`（來源 `~/.claude/mods/`，內容與開發 session 的草稿相同），產生 `.claude-plugin/marketplace.json`。
  - 依 `project-bootstrap-spec.md` 建立協作骨架；通用檔沿用 stock-aquarium 參考實作，角色檔、路由 `PROFILE`、案例與環境變數前綴（`MODSDEV_ROUTER`）改為本專案內容。
  - 新增 `README.md`、`.gitignore`、`.gitattributes`、`package.json`。
- **驗證**：見 `.ai/handoff.md`。
