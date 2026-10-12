# ModsDevTool

Caspar 自製的 Claude Code mod 合集，以及一支在不同機器之間同步 mod 的腳本。

- 每個 mod 一個資料夾：`mods/<name>/`。
- `scripts/mods.mjs`：把本機有、repo 沒有的 mod 加上來；把 repo 有、本機沒有的 mod 裝到這台機器。
- 只需要 Git 與 Node.js（只用內建模組，不用 `npm install`）。

## 在新的機器上使用

```bash
git clone https://github.com/chielinHsu/ModsDevTool.git
cd ModsDevTool
node scripts/mods.mjs sync
```

`sync` 會依序：

1. `git pull` 取得最新的 mod。
2. 把這台機器沒有的 mod 複製到 `~/.claude/mods/<name>/`，並把路徑加進 `~/.claude/settings.json` 的 `env.CLAUDE_CODE_PLUGIN_DIRS`（原本的設定保留，改之前備份成 `settings.json.mods-backup`）。
3. 把這台機器有、repo 沒有的 mod 加進 `mods/<name>/`，commit 並 push。

完成後**重新啟動 Claude Code**，新的 mod 才會載入。

> Windows 若 clone 時出現 `SSL certificate ... unable to get local issuer certificate`，改用：
> `git -c http.sslBackend=schannel clone -c http.sslBackend=schannel https://github.com/chielinHsu/ModsDevTool.git`
> 腳本本身在 Windows 上會自動對網路 git 指令加上這個設定。

## 指令

```bash
node scripts/mods.mjs status              # 每個 mod 在本機、repo、安裝位置的狀態
node scripts/mods.mjs push [mod...]       # 本機有、repo 沒有的 mod → mods/<name>，commit 並 push
node scripts/mods.mjs install [mod...]    # repo 有、本機沒有的 mod → ~/.claude/mods/<name>，並註冊載入
node scripts/mods.mjs sync                # pull → install → push
```

| 選項 | 作用 |
|---|---|
| `--dry-run` | 只顯示會做什麼，不寫檔、不 commit、不 push |
| `--update` | 內容不同的 mod 也取代：push 以本機最新版取代 repo；install 以 repo 版取代本機，舊版先備份到 `~/.claude/mods-backup/` |
| `--no-push` | push／sync 只 commit，不 push |
| `--from <資料夾>` | 額外的 mod 來源資料夾（可重複） |

預設**只新增缺少的 mod，不覆蓋、不刪除**。兩邊內容不同時會列出來並略過，確認要用哪一份後再加 `--update`。

腳本找本機 mod 的位置：

- `~/.claude/mods/*`：已安裝的 mod
- `~/.claude/dev-mods/*/*`：在 Claude Code session 裡開發中的 mod（同名時取最新修改的那份）
- `--from` 指定的資料夾

設定目錄不是 `~/.claude` 時，設 `MODS_CLAUDE_DIR`（或 Claude Code 的 `CLAUDE_CONFIG_DIR`）。

## 新增一個 mod

1. 在 Claude Code 裡請 Claude 做一個 mod（會用 `plugin-authoring` skill，草稿在 `~/.claude/dev-mods/`），熱重載確認可以用。
2. 在這個 repo 執行 `node scripts/mods.mjs push <name>`（腳本會先跑 `claude plugin validate`）。
3. 其他機器執行 `node scripts/mods.mjs sync`，重開 Claude Code。

更新既有 mod：`node scripts/mods.mjs push <name> --update`，其他機器 `node scripts/mods.mjs sync --update`。

## 目前的 mod

| mod | 功能 | 用法 |
|---|---|---|
| [blast-radius](mods/blast-radius) | Claude 要執行 `rm -rf`、`Remove-Item -Recurse`、`rmdir /s` 前先攔下，列出會刪掉的檔案數、總大小與清單 | 自動生效；在對話框選 Proceed 或 Cancel |
| [replay-theater](mods/replay-theater) | 記錄 Claude 每次用 Edit／Write 改檔的 diff 與說明，一步一步重播 | 每輪回覆下方的 **Replay** 按鈕，或 `/replay`（`all`／`last`／`<步數>`／`clear`）；面板內 `f`／`p`／`k`／`n`／`l` |

## 也可以當 marketplace 用

`.claude-plugin/marketplace.json` 由腳本依 `mods/*` 自動產生，所以也能用 Claude Code 內建的方式安裝單一 mod：

```text
/plugin install blast-radius --marketplace chielinHsu/ModsDevTool
```

這種方式由 Claude Code 另存一份副本，更新要走 `/plugin update`；跨機台同步建議用上面的 `sync`。

## 專案結構

```text
mods/<name>/                 每個 mod 一個資料夾
.claude-plugin/marketplace.json
scripts/mods.mjs             同步腳本（指令列）
scripts/mods/lib.mjs         同步核心
tests/mods.test.mjs          node --test tests/mods.test.mjs
```

AI 協作相關的檔案（`AGENTS.md`、`CLAUDE.md`、`.agents/`、`.claude/`、`docs/`、`scripts/ai/`）是給 Codex 與 Claude Code 在這個 repo 工作時讀的。
