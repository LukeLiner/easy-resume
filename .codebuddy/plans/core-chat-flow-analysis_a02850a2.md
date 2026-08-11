---
name: core-chat-flow-analysis
overview: 分析 agent chat 对话生成/更新简历的完整流程，梳理涉及的核心文件和函数，输出 /docs/core-chat-flow.md 文档。
todos:
  - id: write-doc
    content: 编写 docs/core-chat-flow.md，包含架构概览、Thread 生命周期、消息发送流程、5 个 Agent 工具详解、JSON Patch 机制、SSE 流式传输、前端订阅、回滚机制、错误处理与安全等完整分析
    status: completed
---

## 需求概述

分析 Reactive Resume 项目中 Agent Chat 对话生成简历和更新简历的完整流程，梳理涉及的所有代码文件和核心函数，并输出一份详细的技术文档 `core-chat-flow.md` 到 `/docs` 目录。

## 核心内容要求

- **架构概览**：前后端分层架构、数据流向的宏观描述
- **Thread 生命周期**：创建、归档、删除的完整流程
- **消息发送与 AI 响应**：从用户输入到 AI 流式输出的完整链路
- **5 个 Agent 工具详解**：`read_resume`、`apply_resume_patch`、`ask_user_question`、`read_attachment`、`web_search` 的定义与执行
- **JSON Patch 应用机制**：`packages/resume/src/patch.ts` 的 RFC 6902 实现，包括路径规范化、事务保护、快照回滚
- **SSE 流式传输**：`parseAgentSseStream` 客户端解析、`agentStreamLifecycle` 服务端可恢复流（Redis）
- **前端实时订阅**：`useAgentResumeUpdateSubscription` 与简历变更通知机制
- **回滚机制**：从 action 快照恢复简历数据的完整流程
- **错误处理与安全**：环境校验、配额控制、并发防护（CAS）、版本冲突处理

## 涉及的关键文件清单

- `apps/web/src/routes/agent/-components/agent-chat.tsx` — 前端聊天核心组件
- `apps/web/src/routes/agent/-hooks/use-agent-resume-updates.ts` — 简历更新订阅 Hook
- `apps/web/src/routes/agent/$threadId.tsx` — Thread 页面编排
- `packages/api/src/features/agent/service.ts` — 后端核心业务逻辑（~1388 行）
- `packages/api/src/features/agent/tools.ts` — Agent 工具集构建
- `packages/api/src/features/agent/messages.ts` — 消息发送/停止/恢复 ORPC 端点
- `packages/api/src/features/agent/threads.ts` — Thread CRUD ORPC 端点
- `packages/api/src/features/agent/streams.ts` — 可恢复 SSE 流（基于 Redis）
- `packages/api/src/features/agent/runs.ts` — 活动运行状态 CAS 管理
- `packages/api/src/features/agent/resume.ts` — 简历操作辅助函数
- `packages/api/src/features/agent/actions.ts` — Action 回滚端点
- `packages/api/src/features/agent/attachments.ts` — 附件上传/删除端点
- `packages/ai/src/prompts/chat-system.md` — AI 系统指令
- `packages/ai/src/tools/patch-proposal.ts` — Patch Proposal 类型定义
- `packages/resume/src/patch.ts` — JSON Patch RFC 6902 实现