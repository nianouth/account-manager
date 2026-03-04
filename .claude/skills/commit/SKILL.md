---
name: commit
description: 当用户要求"提交"、"提交代码"、"commit"、"git commit"时触发。安全提交流程：先检查代码风险，再更新 CHANGELOG，最后确认提交。
---

当用户触发 `/commit` 时，按以下流程**严格顺序**执行：

## 第一步：收集变更

1. 运行 `git status`（不带 `-uall`）查看所有变更文件
2. 运行 `git diff --cached` 查看已暂存的变更；如果没有暂存内容，运行 `git diff` 查看未暂存变更
3. 运行 `git log --oneline -5` 查看最近提交风格

## 第二步：代码风险检查

对所有变更的代码（diff 内容）进行以下风险项扫描，生成风险报告：

### 安全风险（高优先级）
- 硬编码的密码、密钥、token（如 `password = "xxx"`, `apiKey`, `secret`, `token`）
- 敏感文件被提交（`.env`, `credentials`, `*.pem`, `*.key`, `config.json` 含密码）
- `eval()` 或 `new Function()` 的使用
- `innerHTML` 赋值用户输入（XSS 风险）
- HTTP 明文请求（应使用 HTTPS）
- SQL 拼接（SQL 注入风险）
- 禁用安全检查的代码（如 `--no-verify`, `disable-security`）

### 代码质量（中优先级）
- 遗留的 `console.log` / `console.debug` 调试语句（`console.error` 和 `console.warn` 可保留）
- 遗留的 `debugger` 语句
- 注释掉的大段代码（超过 5 行）
- `TODO` / `FIXME` / `HACK` 标记
- 未使用的 import 或变量

### 敏感操作（低优先级）
- `alert()` 调用（应使用 Toast）
- 直接操作 `localStorage`（本项目应使用 `chrome.storage`）
- `setTimeout` / `setInterval` 可能的性能问题

## 第三步：输出风险报告

以表格形式输出扫描结果：

```
## 代码风险扫描报告

| 级别 | 类型 | 文件 | 行号 | 说明 |
|------|------|------|------|------|
| 🔴 高 | 安全 | xxx.js | L42 | 硬编码密码 |
| 🟡 中 | 质量 | xxx.js | L15 | 遗留 console.log |
| 🟢 低 | 建议 | xxx.js | L88 | 使用了 alert() |
```

- 如果没有任何风险项，输出 "未发现风险项"
- 如果有 🔴 高优先级风险，**强烈建议**用户修复后再提交，并提供修复方案

## 第四步：使用 AskUserQuestion 询问用户

根据风险报告结果，使用 AskUserQuestion 工具询问用户下一步操作：

- 如果存在 🔴 高优先级风险：选项为 "修复风险后提交"（推荐）、"忽略风险并提交"、"取消提交"
- 如果只有 🟡/🟢 或无风险：选项为 "更新日志并提交"（推荐）、"直接提交（跳过日志）"、"取消提交"

**必须等待用户选择后再继续。** 如果用户选择取消，则终止流程。
如果用户选择修复，则协助修复后重新从第一步开始。

## 第五步：更新 CHANGELOG.md

（如果用户选择了包含更新日志的选项）

1. 读取当前 `CHANGELOG.md`
2. 读取 `manifest.json` 获取当前版本号
3. 根据变更内容，在 CHANGELOG 顶部（`---` 分隔线后）追加新条目或更新当天已有条目
4. 使用项目已有的 CHANGELOG 格式（Keep a Changelog 风格，带 emoji 分类）
5. 如果当天已有相同版本号的条目，在该条目中追加新的变更项，而不是创建重复条目
6. 将 CHANGELOG.md 的变更加入暂存区

## 第六步：执行提交

1. 将所有相关文件加入暂存区（`git add` 具体文件，不使用 `git add -A`）
2. 根据变更内容生成简洁的中文 commit message
3. commit message 格式：`<type>: <简短描述>`，type 使用英文（feat/fix/refactor/chore/docs/style/perf）
4. commit message 末尾添加 `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
5. 使用 HEREDOC 格式传递 commit message
6. 提交后运行 `git status` 验证成功
7. 显示提交结果摘要

## 重要规则

- **绝不**跳过风险检查步骤
- **绝不**在用户确认前执行提交
- **绝不**使用 `--no-verify` 跳过 hooks
- **绝不**使用 `git add -A` 或 `git add .`
- 如果 pre-commit hook 失败，修复问题后创建**新**提交，不要 amend
- 提交的文件中不应包含 `.env`、凭证文件等敏感文件
