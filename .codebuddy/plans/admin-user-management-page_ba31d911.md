---
name: admin-user-management-page
overview: 创建管理员用户管理前端页面（/dashboard/admin/users），包含用户列表、封禁/删除/密码重置操作、查看用户简历、以及配额管理功能。后端 API 已就绪，仅需前端实现。
todos:
  - id: create-admin-users-page
    content: 创建 `apps/web/src/routes/dashboard/admin/users.tsx` 管理员用户管理页面，包含：beforeLoad admin 守卫、用户列表表格（姓名/邮箱/用户名/角色/封禁状态/简历数/创建时间）、搜索框、分页控件、每行 DropdownMenu 操作菜单、封禁/解封 toggle、删除用户（useConfirm 二次确认）、重置密码 Dialog、配额编辑 Dialog（threadMessages/resumeAnalyses/resumeDownloads 三个字段）
    status: completed
---

## 用户需求

### 1. 管理员用户管理页面

管理员可通过 `/dashboard/admin/users` 页面查看所有注册用户的完整列表，支持分页浏览和关键词搜索。对每个用户，管理员可以执行以下操作：

- **封禁/解封用户**：切换用户的 `banned` 状态，可选填写封禁原因和过期时间
- **删除用户**：永久删除用户及其所有关联数据，操作前需二次确认
- **修改用户密码**：为使用凭证登录的用户重置密码（至少 8 个字符）

### 2. Integrations 菜单权限（已实现）

Integrations 菜单仅对管理员可见，非管理员用户无法看到该菜单项。管理员可以编辑 AI Provider 配置和查看 App Key。此功能已通过侧边栏过滤 + `beforeLoad` 守卫 + 后端 `adminProcedure` 完整实现。

### 3. 用户配额管理

管理员可为每个用户独立配置三种使用配额：

- **Thread 对话次数**：限制 agent 对话中发送的消息数量
- **简历分析次数**：限制 AI 简历分析的调用次数
- **简历下载次数**：限制简历 PDF/DOCX 下载次数

配额值设为 `-1` 表示无限制。管理员还可以一键重置用户的使用计数（将已用量归零）。

## 技术方案

### 技术栈

- **前端框架**：React 19 + TypeScript + TanStack Router（文件路由）
- **数据获取**：oRPC + TanStack Query（`useQuery` / `useMutation`）
- **UI 组件**：`@reactive-resume/ui`（Base UI / shadcn-style 组件集）
- **图标**：`@phosphor-icons/react`
- **国际化**：`@lingui`（`t` macro / `<Trans>` / `msg`）
- **样式**：Tailwind CSS + `cn()` from `@reactive-resume/utils/style`
- **确认对话框**：自定义 `useConfirm()` hook（基于 AlertDialog）
- **Toast**：sonner

### 实现方案

**核心策略**：仅创建一个前端路由文件 `apps/web/src/routes/dashboard/admin/users.tsx`，直接消费已完整实现的后端 Admin API。无需修改任何后端代码。

**工作原理**：页面加载时通过 `orpc.admin.users.list` 查询分页用户列表，展示为原生 HTML 表格。每个用户行通过 DropdownMenu 暴露操作入口（封禁/解封、重置密码、编辑配额、删除）。配额编辑和密码重置通过 Dialog 模态框实现，修改通过 `orpc.admin.quotas.update` 和 `orpc.admin.users.resetPassword` 提交。删除操作使用 `useConfirm()` 进行二次确认。

**关键设计决策**：

1. **单文件架构**：鉴于需求明确且后端 API 已完整，将所有 UI 逻辑置于一个文件中，避免过度拆分。若后续扩展（如简历详情页），可再抽取组件。
2. **原生表格**：项目无内置 Table 组件，沿用 `list-view.tsx` 中的原生 `<table>` + Tailwind 模式，确保风格一致。
3. **本地分页状态**：使用 `useState` 管理 page/limit/search，避免 URL search params 污染浏览器历史。这是管理后台页面，不需要可分享的 URL 状态。
4. **乐观更新**：封禁/解封切换使用 `useMutation` + `onSuccess` 自动刷新列表，配额和密码修改通过 Dialog 关闭后刷新。

### 实现细节

**性能考虑**：

- 分页查询由后端 SQL `LIMIT/OFFSET` 实现，前端仅渲染当前页数据
- 用户列表使用 `queryKey` 包含 `{ page, limit, search }` 实现自动缓存失效
- 配额批量查询在后端通过 `IN` 子句一次性获取，避免 N+1

**错误处理**：

- 所有 mutation 通过 `onError` 回调使用 `toast.error` 展示错误
- 删除管理员用户时后端会返回 `CONFLICT` 错误，前端捕获并提示
- 无 credential 账户重置密码时后端返回 `CONFLICT`，前端提示用户无法重置

**日志与监控**：

- 复用 oRPC 客户端内置的 `onError` 拦截器，自动打印到 console

**兼容性**：

- 不修改任何现有 API 签名或数据库 schema
- 侧边栏已有的 `adminSidebarItems` 无需改动
- 与现有 `beforeLoad` admin 守卫模式保持一致

### 架构设计

```mermaid
graph TD
    A[Admin User] -->|访问| B[/dashboard/admin/users]
    B -->|beforeLoad 检查| C{session.user.role === 'admin'?}
    C -->|否| D[重定向到 /dashboard]
    C -->|是| E[UserManagementPage]
    E -->|useQuery| F[orpc.admin.users.list]
    F -->|oRPC| G[Admin Router]
    G -->|Drizzle| H[(PostgreSQL)]
    
    E -->|操作| I[DropdownMenu]
    I -->|封禁/解封| J[orpc.admin.users.updateStatus]
    I -->|删除| K[useConfirm → orpc.admin.users.delete]
    I -->|重置密码| L[PasswordDialog → orpc.admin.users.resetPassword]
    I -->|编辑配额| M[QuotaDialog → orpc.admin.quotas.update]
    
    J --> G
    K --> G
    L --> G
    M --> G
```

### 目录结构

```
apps/web/src/routes/dashboard/admin/
└── users.tsx  # [NEW] 管理员用户管理页面
                # 功能：用户列表（表格+分页+搜索）、封禁/解封操作、
                # 删除用户（含二次确认）、重置密码 Dialog、
                # 配额编辑 Dialog（threadMessages/resumeAnalyses/resumeDownloads）
                # 实现要求：
                # - beforeLoad 守卫检查 admin 角色
                # - 使用 DashboardHeader + Separator 页面布局
                # - 原生 <table> 展示用户数据（名称、邮箱、用户名、角色、封禁状态、简历数、创建时间）
                # - InputGroup 搜索框，支持按名称/邮箱/用户名搜索
                # - 底部分页控件（上一页/下一页 + 页码显示）
                # - 每行 DropdownMenu 操作入口
                # - Badge 显示 banned 状态（红色=已封禁，绿色=正常）
                # - 所有文案使用 t`...` / <Trans> 国际化
                # - 使用 RouterOutput["admin"]["users"]["list"] 获取类型
                # - 使用 useConfirm() 进行删除确认
                # - toast.success/error 反馈操作结果
```

### 关键代码结构

**页面组件内部类型定义**：

```typescript
// 用户列表项类型（从 API 输出推断）
type UserItem = RouterOutput["admin"]["users"]["list"]["users"][number];

// 分页响应类型
type UsersListOutput = RouterOutput["admin"]["users"]["list"];

// 配额类型
type UserQuota = NonNullable<UserItem["quota"]>;

// 配额表单输入
type QuotaFormState = {
  threadMessagesLimit: number;
  resumeAnalysesLimit: number;
  resumeDownloadsLimit: number;
};
```

**组件 Props 类型**：

```typescript
type PasswordDialogProps = {
  open: boolean;
  userId: string;
  userName: string;
  onClose: () => void;
};

type QuotaDialogProps = {
  open: boolean;
  userId: string;
  userName: string;
  currentQuota: UserQuota | null;
  onClose: () => void;
};

type PaginationProps = {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
};
```