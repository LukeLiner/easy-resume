Agent 对话生成 / 修改简历逻辑梳理（源码实证）
所有结论均来自本次重新读取的源码，引用格式为 文件:行号。

一、两个「生成入口」：草稿线程 vs 就地线程
Agent 并不存在一个独立的「从零生成简历」端点。所谓"生成简历"实际是先创建一个被 Agent 编辑的 working resume，再让用户对话驱动它。分两种模式（service.ts:437-468）：

模式 A — 独立 Chat 线程（克隆草稿）

createWorkingResume 当 input.sourceResumeId 存在时：拉取源简历 → cloneResumeData(source.data) → 新建一份名为 <源名> - AI Draft 的副本（buildAgentDraftResumeName，resume.ts:6-11），slug 也带去重后缀（resume.ts:13-26）。
当无 sourceResumeId：基于 defaultResumeData 克隆创建名为 "AI Draft" 的空白简历（service.ts:456-467）。
所以"生成"= 复制一份空白/现有简历作为 playground，Agent 后续 patch 只改副本，用户自行决定是否采纳。
模式 B — In-Resume 助手（就地编辑）

getOrCreateForResume(resumeId)（threads.ts:37-53）：workingResumeId === sourceResumeId === resumeId，Agent 直接改当前简历，builder 通过 notifyResumePatched 实时刷新（service.ts:723-727）。
两种语义的差异仅是 thread.workingResumeId 是否等于 thread.sourceResumeId，代码路径统一（service.ts:1110 把 thread.workingResumeId 作为 patch 目标）。

二、对话 → 生成/修改 的核心循环：messages.send
入口 agentService.messages.send（service.ts:1014-1174），逐步逻辑如下（每行均有源码锚点）：

前置校验（service.ts:1018-1030）

线程 archived / 已有 activeRunId（CONFLICT）/ 缺 workingResumeId或aiProviderId（BAD_REQUEST "read-only"）一律拒绝。
乐观占坑运行锁（service.ts:1042-1051）

generateId() 生成 runId/streamId，AbortController 登记到 activeRunControllers，再 claimActiveAgentRun(...)；失败即抛 CONFLICT（防并发运行）。
消息持久化（service.ts:1066-1096）

用户消息：consumeThreadMessageQuota → getNextMessageSequence → withAttachmentUiParts → persistMessage 写 agent_message；首条消息用 buildThreadTitle 覆盖 thread.title（service.ts:630-634, 1090-1095）。
助手工具回传消息走 updateAssistantToolResultMessage（合并 ask_user_question 答案，见 service.ts:525-554）。
拼装模型输入（service.ts:1100-1128）

repairLegacyAskUserQuestionAnswers 兼容旧问答格式；
convertToModelMessages(messages.map(toModelInputMessage))：注意 toModelInputMessage 剥离 UI 元数据（前次对话已读，未在此段展开）；
buildAttachmentModelParts(readAttachmentModelInputs(...)) 按 MIME 路由附件（service.ts:401-413, 1106）；
attachModelPartsToLatestUserMessage 把附件 part 拼到最新 user 消息（service.ts:415-427）。
构建并运行 Agent（service.ts:1107-1128）

createAgent 用 ToolLoopAgent（stopWhen: stepCountIs(MAX_AGENT_STEPS=30)，service.ts:790-795），工具集来自 buildAgentTools，系统指令来自 buildAgentInstructions（service.ts:53-62）。
agent.stream({ messages, abortSignal }) 启动「思考→工具→观察」循环。
流式回传与落库（service.ts:1130-1163）

result.toUIMessageStream({ onFinish, onError }) 转成 UI 事件流；
onFinish：isAborted && canceledRunsWithPersistedPartial.has(runId) 时才跳过持久化（避免 stop 重复写入），否则 persistMessage(responseMessage, status: canceled/completed)，最后 cleanupActiveRun 释放锁（service.ts:1136-1159）。
三、LLM 实际改简历的唯一通道：apply_resume_patch 工具
工具定义（tools.ts:87-92）输入 schema：{ title, summary?, operations: JsonPatchOperation[] }，operations 用 jsonPatchOperationSchema 校验（tools.ts:16-20，来自 @reactive-resume/resume/patch）。

读 → 改 → 写 三步（createAgent 的 handlers，service.ts:751-788）：

read_resume（handler service.ts:754-775）：返回当前 resume.data 全量 + patch 路径示例（/basics/name、/sections/experience/items/0/description、/customSections/0/...），并强制规则：路径根在 data、不得写 /data 前缀、name 元数据只读（与 tools.ts:55 指令一致）。
apply_resume_patch（handler → applyResumePatch，service.ts:682-737）：
resumeService.getById 取改前数据，snapshotData = cloneResumeData(before.data)（回滚快照）；
normalizeAgentResumePatchOperations(before.data, operations) 路径规范化（resume.ts:41-54：把 /experience/items/0/... 这类简化写法补成 /sections/experience/items/0/...）；
单事务 db.transaction：先 resumeService.patchInTransaction（真正写库），再插入 agent_action（status:"applied"，带 operations、snapshotData、baseUpdatedAt、appliedUpdatedAt，service.ts:694-721）；
事务后 notifyResumePatched 推送给编辑器（service.ts:723-727）。
关键点：LLM 无法直接写库，只能通过这一个工具；每步修改都留下带快照的 action，天然可审计、可回滚。

四、回滚（修改的逆向）：actions.revert
逻辑（service.ts:1287-1385）：

取 action，要求 status==="applied"、kind==="resume_patch"、有 snapshotData（service.ts:1297-1307）。
取该线程最新 applied action 的 appliedUpdatedAt 作为乐观锁基线（service.ts:1309-1322）。
单事务（service.ts:1329-1361）：
patchInTransaction 用 op:"replace", path:"", value: cloneResumeData(snapshotData) 把整份简历恢复成快照值，expectedUpdatedAt = latestAction.appliedUpdatedAt；
把 appliedUpdatedAt >= 目标action.appliedUpdatedAt 的所有 applied action 标记 status:"rolled_back"。
幂等：回滚 = "恢复那一刻的整份快照"，而非反向计算 patch。
冲突处理（service.ts:1370-1384）：捕获 RESUME_VERSION_CONFLICT（乐观锁失败）→ 仅把该 action 标记 status:"conflicted"，不抛错给用户。
notifyResumePatched 推送恢复结果（service.ts:1363-1367）。
五、中断与恢复：stop / resume
stop（service.ts:1176-1217）：若带 partialMessage 先以 status:"canceled" 持久化，并 canceledRunsWithPersistedPartial.add(activeRunId) 防止 onFinish 重复写；随后 activeRunControllers.get(activeRunId)?.abort("USER_STOPPED") + clearActiveAgentRunIfCurrent 释放锁。
resume（service.ts:1218-1222）：agentStreamLifecycle.resume(thread.activeStreamId) —— 前端刷新/断线后用 activeStreamId 重连继续收流。
六、一句话结论（均经源码验证）
问题	实证答案
Agent 怎么"生成"简历？	不是生成，是 createWorkingResume 克隆空白/现有简历成副本（service.ts:437-468），对话只是往副本打 patch
Agent 怎么"修改"简历？	唯一通道 apply_resume_patch 工具 → applyResumePatch 单事务（快照+patch+action）→ notifyResumePatched（service.ts:682-727）
修改可追溯吗？	每次 patch 落 agent_action 带 snapshotData，revert 整份快照 replace 回滚（service.ts:1329-1361）
并发/中断安全吗？	运行锁 claimActiveAgentRun（service.ts:1047）+ 简历乐观锁 expectedUpdatedAt（service.ts:1334）双层保护
所有陈述均来自本次重新读取的 service.ts / tools.ts / threads.ts / resume.ts 实际内容，无凭记忆推断。需要我把这份梳理补进 docs/agent-chat.md 或生成一张流程图吗？