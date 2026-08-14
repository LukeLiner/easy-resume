# 微信支付充值功能设计方案

> 本文档描述「充值功能」的完整设计方案，引用现有代码均以 `文件:行号` 标注。

## 一、需求概述

在现有「余额 + 使用明细」体系之上，新增微信支付充值能力：

1. **入口**：用户中心余额卡片下方，明显展示「立即充值」按钮。
2. **主路径**：点击立即充值 → 填写金额 → 后端调微信 Native 下单 → 弹框展示付款二维码 → 用户扫码支付 → 微信回调 → 验签/解密 → 入账更新余额。
3. **异常兜底**：支付异常必须记录支付异常记录，并详细记录异常日志信息。
4. **管理侧**：User Management 中可查询用户支付记录与异常记录。

## 二、现状分析

### 2.1 余额字段（单位：分，整数）

`packages/db/src/schema/auth.ts:35` 已有 `balance` 字段：`pg.integer("balance").notNull().default(0)`。

### 2.2 余额变动流水表

`packages/db/src/schema/user-transaction.ts` 已有 `user_transaction` 表，含 `userId/type/amount/balance/remark/createdAt`。充值入账复用此表，新增 `type: "recharge"` 正向流水。

### 2.3 现有扣费逻辑

`packages/api/src/features/billing/service.ts` 已实现 `deductBalance`（`PRICE_PER_USE_CENTS = 50`），其注释明确「待充值功能上线后接入强校验」。充值功能补齐后即可对扣费做强校验（余额不足拒绝）。

### 2.4 用户中心余额展示位置

`apps/web/src/routes/dashboard/account.tsx:102-107` 展示余额卡片。充值按钮插在卡片下方（第 108 行附近）。

### 2.5 Admin User Management

`apps/web/src/routes/dashboard/admin/users.tsx` 用 `orpc.admin.users.list` 渲染用户表格并带「Actions」下拉菜单，支付记录查询复用该结构。

### 2.6 存储与 HTTP 层

- `packages/api/src/features/storage/service.ts` 的 `uploadFile` 可用于支付凭证上传。
- 服务端 Hono 应用挂载于 `apps/server/src/http/app.ts`，微信回调需在此新增原生 HTTP 路由。

## 三、方案选型：微信支付 Native 扫码支付

PC Web 应用，选择 **Native 支付**（商户后台生成二维码，用户微信扫码）。

标准流程：后端调 `POST /v3/pay/transactions/native` 下单返回 `code_url` → 前端渲染二维码 → 用户扫码 → 微信异步回调 `notify_url` → 商户验签/解密/校验 → 事务入账。

## 四、数据库设计

新增 `packages/db/src/schema/payment.ts`，并从 `schema/index.ts` 导出。

### 4.1 `payment_order`（充值订单表）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | text PK | `generateId()` |
| `userId` | text FK → user.id | 归属用户 |
| `orderNo` | text unique | 商户订单号，对外唯一 |
| `amount` | integer | 充值金额（分） |
| `status` | text | `pending`/`paid`/`failed`/`expired`/`manual_review` |
| `codeUrl` | text | 微信返回 `code_url` |
| `transactionId` | text nullable | 微信支付单号 |
| `paidAt` | timestamp nullable | 支付成功时间 |
| `expiresAt` | timestamp | 超时时间（默认 15 分钟） |
| `createdAt`/`updatedAt` | timestamp | 时间戳 |

### 4.2 `payment_exception_log`（支付异常日志表）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | text PK | `generateId()` |
| `orderNo` | text nullable | 关联订单号 |
| `userId` | text nullable | 关联用户 |
| `stage` | text | `create_order`/`verify_sign`/`decrypt`/`validate`/`credit`/`callback` |
| `errorType` | text | `SIGN_INVALID`/`DECRYPT_FAILED`/`AMOUNT_MISMATCH`/`ORDER_NOT_FOUND`/`DUPLICATE_NOTIFY`/`DB_ERROR`/`TIMEOUT`/`CREATE_FAILED` |
| `message` | text | 脱敏后的异常信息 |
| `rawPayload` | text nullable | 原始报文脱敏摘要 |
| `stack` | text nullable | 错误堆栈 |
| `createdAt` | timestamp | 发生时间 |

索引：`(orderNo)`、`(userId, createdAt)`、`(errorType)`。

## 五、环境变量

新增微信支付环境变量，**必须同步加入 `turbo.json` 的 `globalEnv`**（否则运行时为 `undefined`）：

| 变量 | 说明 |
|------|------|
| `WECHAT_PAY_MCH_ID` | 商户号 |
| `WECHAT_PAY_APP_ID` | 应用 AppID |
| `WECHAT_PAY_API_V3_KEY` | API v3 密钥（回调解密） |
| `WECHAT_PAY_PRIVATE_KEY` | 商户 API 私钥（请求签名） |
| `WECHAT_PAY_CERT_SERIAL_NO` | 商户证书序列号 |
| `WECHAT_PAY_NOTIFY_URL` | 回调地址 |
| `WECHAT_PAY_ENABLED` | 功能开关，默认 `false`，未配置时关闭充值入口 |

定义位置：`packages/env/src/server.ts` 的 `createEnv`。

## 六、后端设计

### 6.1 代码放置（遵循决策树）

| 模块 | 位置 |
|------|------|
| oRPC 过程 + DTO + service | `packages/api/src/features/payment/` |
| 微信 SDK（签名/验签/解密/下单） | `packages/api/src/features/payment/wechat-pay.ts` |
| 回调 HTTP 端点 | `apps/server/src/http/wechat-pay.ts`，在 `app.ts` 注册 |

### 6.2 微信客户端（基于 `node:crypto`，无额外依赖）

1. 请求签名：`SHA256withRSA`（商户私钥），写 `Authorization: WECHATPAY2-SHA256-RSA2048 ...`。
2. Native 下单：`POST /v3/pay/transactions/native`，返回 `code_url`。
3. 回调验签：平台证书公钥验签 `Wechatpay-Signature`。
4. 回调解密：`AES-256-GCM`（key=API v3 密钥）解密 `resource.ciphertext`。

### 6.3 oRPC 过程

全部 `protectedProcedure`（Admin 用 `adminProcedure`），DTO 用 Zod 定义：

| 过程 | 说明 |
|------|------|
| `payment.createRechargeOrder` | 入参 `{ amount }`（分，`int().min(100)`），返回 `{ orderNo, codeUrl, expiresAt }` |
| `payment.getOrderStatus` | 前端轮询订单状态 |
| `payment.listMyOrders` | 当前用户充值记录（分页） |
| `payment.submitManualProof` | 凭证兜底：上传凭证 + 实付金额 + 邮箱，转 `manual_review` |
| `admin.payments.list` | 管理员查询所有支付记录 |
| `admin.payments.exceptions` | 管理员查询异常记录 |

### 6.4 回调处理（幂等 + 事务入账）

1. 验签，失败 → 写异常日志（`SIGN_INVALID`）→ 返回失败应答。
2. 解密，失败 → 写异常日志（`DECRYPT_FAILED`）。
3. 校验 `trade_state === "SUCCESS"`，否则仅记录不入账。
4. 查订单，校验存在、`status === "pending"`、金额一致；不符 → 写异常日志。
5. 事务内：订单转 `paid` 写 `transactionId`/`paidAt`；`balance += amount`；插 `user_transaction`（`type: "recharge"`）。
6. 返回 `{ code: "SUCCESS" }`，微信停止重试。

幂等保证：`orderNo` 唯一 + 状态机 `pending → paid` 单向迁移，重复回调在步骤 4 被拦截。

## 七、前端设计

1. **入口**：`account.tsx` 余额卡片下方加「Top Up」按钮。
2. **充值弹框**（新建 `apps/web/src/features/billing/recharge-dialog.tsx`）：金额选择 → 二维码展示（`qrcode` 渲染 `codeUrl`）→ 3s 轮询 `getOrderStatus`，成功刷新余额。
3. **凭证兜底入口**：订单异常/超时时展示上传表单（凭证图片 + 实付金额 + 邮箱），提交转人工审核。

所有文案用 i18n（`@lingui`）包裹。

## 八、支付异常记录与日志

- 全链路（下单到入账）异常均写 `payment_exception_log` 一条明细，含 `stage/errorType/message/rawPayload/stack`。
- `rawPayload` 脱敏：仅保留 `out_trade_no`、`amount`、`transaction_id`，不落支付密码/openid 等敏感信息。
- 禁止静默吞错：所有 `catch` 必须记录日志后再决定应答/抛错，不允许空 `catch`。

## 九、Admin 查询

- 后端 `admin.payments.list` / `admin.payments.exceptions`（`adminProcedure`），支持按用户/订单号/状态/时间筛选 + 分页。
- 前端在 `admin/users.tsx` 的 Actions 下拉菜单新增「Payment Records」项，弹框展示该用户支付记录；异常记录单独入口。

## 十、安全性设计

1. 密钥通过 `packages/env` 管理，禁止硬编码。
2. 用户输入经 Zod 校验，金额限制合理区间。
3. 幂等入账：`orderNo` 唯一 + 状态机单向迁移。
4. 金额一致性：以微信回调金额为准入账，不信任前端。
5. 防伪造回调：强制验签，失败不入账。
6. 凭证兜底走人工审核，管理员确认后才入账。

## 十一、实施步骤

1. 新增 `payment.ts` schema + 迁移（`dotenvx run -f .env.local -- pnpm db:generate` / `db:migrate`）。
2. 新增 env 变量（`server.ts` + `turbo.json globalEnv`）。
3. 实现 `wechat-pay.ts` 客户端。
4. 实现 `payment` feature（router/service）与回调端点。
5. 前端充值弹框 + 轮询 + 凭证兜底。
6. Admin 查询入口。
7. 补充 i18n 文案与测试。

## 十二、测试要点

- 下单成功返回 `code_url`、订单落库 `pending`。
- 模拟微信回调：正常入账、重复回调幂等、验签失败、解密失败、金额不一致、订单不存在。
- 余额变动与 `user_transaction` 流水一致性。
- 异常场景 `payment_exception_log` 落库完整性。
