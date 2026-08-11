---
name: create-core-analyze-flow-doc
overview: 创建 /docs/core-analyze-flow.md 文档，包含简历分析功能的完整流程图、每个节点的核心说明、文件清单和关键函数一览。
todos:
  - id: create-doc
    content: 创建 /docs/core-analyze-flow.md 文档，包含 Mermaid 流程图、架构文件索引、逐节点核心说明、核心函数速查表
    status: completed
---

## 用户需求

创建 `/docs/core-analyze-flow.md` 文档，描述简历分析功能从用户点击按钮到结果持久化并渲染的完整端到端流程。

## 文档要求

- 包含 **Mermaid 流程图**（sequenceDiagram 风格，展示前端 → oRPC → Service → AI → Schema → DB → 前端渲染的完整链路）
- 每个流程节点包含 **核心说明**（该步骤做什么、调用哪个函数、在哪个文件）
- 包含 **架构文件索引** 表格（层次、文件路径、职责）
- 包含 **核心函数速查表**
- 参照 `docs/agent-chat.md` 的风格和结构

## 技术方案

### 文档结构设计

参照 `docs/agent-chat.md` 的成功模式，文档分为 4 个大节：

1. **概述**：一句话说明功能定位
2. **架构文件索引**：表格列出 12 个相关文件的层次、路径、职责
3. **完整流程图**：Mermaid sequenceDiagram，展示 10 个参与者（User / React / oRPC / Quota / Service / getModel / AI SDK / LLM / Schema / DB）的交互时序
4. **逐节点分析**：对流程图中的每个关键节点做深度说明（调用函数、关键逻辑、错误处理）

### 流程图设计

采用 sequenceDiagram 而非 flowchart，因为分析流程本质是线性的请求-响应链：

- 自动编号（`autonumber`）
- 涵盖配额检查、模型实例化、提示词构建、AI 调用、JSON 提取与校验、配额扣减、DB 持久化、前端渲染
- 用 `alt` 块展示错误分支（配额超限、AI 不可用、格式错误）

### 文档内容覆盖范围

基于已确认的代码，每个节点说明包括：

- **A. 确认 AI 状态**：`useQuery` 检查 providers 列表，无可用 provider 时渲染 `DisabledState`
- **B. 触发分析**：`useMutation` → `orpc.ai.analyzeResume`，传入 `{ resumeId, locale }`
- **C. oRPC 请求处理**：`protectedProcedure` 验证认证 → `aiRequestRateLimit` 中间件
- **D. 配额预检**：`checkResumeAnalysisQuota()` 读取 `userQuota` 表，比对 limit vs used
- **E. 并行获取上下文**：`Promise.all` 同时获取 AI provider (解密 API Key) 和 resume 数据
- **F. 模型实例化**：`getModel()` 用 `ts-pattern match` 支持 15+ 提供商
- **G. 提示词构建**：`buildAnalyzeResumeSystemPrompt()` 替换 `{{LANGUAGE}}` + 注入 resume JSON
- **H. AI 调用**：`generateText()` 非流式调用，user message 要求返回纯 JSON
- **I. JSON 提取**：正则匹配 markdown fence → fallback 到 `{...}` 边界匹配
- **J. Schema 校验**：`resumeAnalysisSchema.parse()` Zod 校验 4 个顶层字段 + 子约束
- **K. 配额扣减**：`consumeResumeAnalysisQuota()` 原子 `UPDATE ... WHERE used < limit`
- **L. 持久化**：`resumeService.analysis.upsert()` → `INSERT ON CONFLICT (resumeId) DO UPDATE`
- **M. 前端渲染**：综合评分圆环 + 10 格进度条 + `ScorecardRadar` SVG 雷达图 + 建议列表