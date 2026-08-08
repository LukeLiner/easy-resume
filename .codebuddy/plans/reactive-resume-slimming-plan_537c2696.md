---
name: reactive-resume-slimming-plan
overview: 对 Reactive Resume 项目进行功能瘦身，仅保留 4 个核心页面（简历列表、Agent 对话生成、简历编辑预览、偏好设置），移除冗余路由、功能模块、数据库表和依赖包，同时优化性能。
todos:
  - id: remove-home-page
    content: 删除首页营销页面：移除 apps/web/src/routes/_home/ 目录（18个文件）及根路由中的重定向逻辑
    status: completed
  - id: remove-applications
    content: 移除 Applications 功能：删除 dashboard/applications/ 路由、features/applications/ 模块、packages/api/src/features/applications/ API 模块、packages/db/src/schema/applications.ts 表定义
    status: completed
  - id: remove-settings-pages
    content: 精简 Settings 页面：仅保留 preferences.tsx，删除 profile、api-keys、authentication、integrations、danger-zone 路由及对应的 features/settings 中的非 preference 页面
    status: completed
  - id: remove-auth-pages
    content: 精简 Auth 页面：仅保留 login.tsx 和 register.tsx，删除 forgot-password、reset-password、resume-password、verify-2fa 等非核心认证页面
    status: completed
  - id: remove-public-resume-and-templates
    content: 移除公开简历分享页（$username/$slug.tsx）和模板预览路由（templates/）
    status: completed
  - id: remove-command-palette
    content: 移除 Command Palette 命令面板：删除 features/command-palette/ 目录（14个文件），从 __root.tsx 中移除挂载
    status: completed
  - id: remove-donation-toast
    content: 移除 DonationToast：从 __root.tsx 中移除 DonationToast 组件挂载及相关导入
    status: completed
  - id: simplify-sidebar
    content: 精简 Dashboard 侧边栏：移除 Applications 菜单项，Settings 分组仅保留 Preferences
    status: completed
    dependencies:
      - remove-applications
      - remove-settings-pages
  - id: remove-statistics-api
    content: 移除 statistics API 模块：删除 packages/api/src/features/statistics/ 和 email 包
    status: completed
  - id: optimize-builder-lazy-loading
    content: 优化 Builder 性能：对左侧 16 个 section 组件和右侧 12 个 section 组件实施 React.lazy 懒加载，仅渲染当前视口可见的 section
    status: completed
  - id: db-migration
    content: 生成数据库迁移：删除 applications 表定义后运行 pnpm db:generate 生成迁移文件
    status: completed
    dependencies:
      - remove-applications
  - id: verify-build
    content: 验证构建与类型检查：运行 pnpm typecheck 和 pnpm build 确保无编译错误，验证四个保留页面功能正常
    status: completed
    dependencies:
      - remove-home-page
      - remove-applications
      - remove-settings-pages
      - remove-auth-pages
      - remove-public-resume-and-templates
      - remove-command-palette
      - remove-donation-toast
      - simplify-sidebar
      - remove-statistics-api
      - optimize-builder-lazy-loading
---

## 用户需求
项目功能过于臃肿，页面频繁卡顿。进行系统性瘦身，仅保留四个核心功能：
- Resumes 列表页面（List/Grid 视图）
- Agent 对话生成简历页面
- 简历 Preview 编辑页面（Builder）
- Preference 偏好设置页面

## 产品概述
Reactive Resume 是一个 AI 驱动的简历构建器。瘦身后的版本聚焦核心工作流：从简历列表进入 Builder 编辑器填写内容，或通过 Agent 对话自然语言生成简历，两个入口均可实时预览 PDF 效果，并在偏好设置中切换主题和语言。

## 核心功能
- **简历管理**：列表视图与网格视图查看所有简历，支持创建、导入、搜索、排序、标签筛选
- **Agent 对话生成**：多轮对话式 AI 助手，通过 JSON Patch 增量修改简历，支持附件上传，实时预览变更
- **Builder 编辑**：三栏布局编辑器（左侧内容编辑区 + 中间 PDF 实时预览 + 右侧样式/导出设置），支持模板切换、排版调整、PDF/DOCX 导出
- **偏好设置**：主题切换（亮色/暗色）、语言切换

## 技术栈
- 前端：React 19 + TypeScript + TanStack Router + Tailwind CSS
- AI 框架：Vercel AI SDK v4 (@ai-sdk/react useChat + ToolLoopAgent)
- 通信：oRPC SSE 流式传输
- 数据库：PostgreSQL + Drizzle ORM
- 包管理：pnpm monorepo (Turborepo)

## 实施策略

### 分阶段瘦身
瘦身分 **4 个阶段**，每个阶段可独立验证，降低风险：

**阶段一：移除无关路由与页面（文件级删除）**
直接删除不再需要的路由目录，这是最安全、影响面最小的操作。

**阶段二：清理废弃 API 与数据库表**
移除不再被前端调用的 API feature 模块、数据库表定义、以及配套的 package。

**阶段三：简化侧边栏与导航**
精简侧边栏菜单项，移除 Applications、多余 Settings 入口，优化 dashboard layout。

**阶段四：Builder 性能优化**
这是解决卡顿的关键步骤。对 Builder 左侧 16 个 section 和右侧 12 个 section 实施懒加载（React.lazy + Suspense），仅渲染当前可见的 section，大幅减少初始渲染开销。

### 关键性能优化点
1. **Builder Section 懒加载**：左侧 16 个 + 右侧 12 个 section 组件全部改为 `lazyRouteComponent` 或 `React.lazy` 动态导入，滚动到对应位置时才挂载，预计减少 60% 以上的初始 JS 执行时间
2. **PDF 预览节流**：ResumePreview 组件内部已有一定优化，可进一步对数据变更做 debounce（300ms），避免每次按键都触发 PDF 重新渲染
3. **路由级 Code Splitting**：保留的路由页面本身已经通过 TanStack Router 的文件路由实现了 code splitting

## 实施注意事项
- 删除 `packages/db/src/schema/applications.ts` 后需重新生成迁移（`pnpm db:generate`）
- 删除 settings 子路由后需保留 `/dashboard/settings/preferences` 路由文件
- 删除 auth 子路由后需保留 `/auth/login` 和 `/auth/register`
- 侧边栏需移除 `BriefcaseIcon` 导入及 Applications 菜单项
- `__root.tsx` 中的 `CommandPalette` 和 `DonationToast` 需移除
- 删除 `packages/email` 后需检查 `apps/server` 中的引用并移除
- 保留 `packages/import`（resumes 列表页的导入按钮依赖）
