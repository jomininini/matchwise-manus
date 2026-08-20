# Company Match 官方数据源验证

用户指定的 DATA.GOV.HK 资源确认由 Hong Kong Science and Technology Parks Corporation 提供，数据格式为 JSON，标注为 API 可用且实时更新。官方公司目录端点为：

`https://opendata.hkstp.org/corporate/companydirectory/v1/`

接口返回对象中的 `value` 数组。每家公司记录包含英文、繁体与简体中文资料，例如 `name_EN`、`cluster`、`introduction_EN`、`product_EN`、`website`，以及对应的中文字段。该端点可作为 Company Match 的唯一权威公司资料来源；导入流程将保留原始 JSON、生成规范化 CSV，并以规范化文本构建后续向量索引。

浏览器验证已在 Company Match 页面输入代表性需求：“寻找提供人工智能、物联网和商业楼宇节能解决方案的香港科技公司”。页面正确呈现 Company Match、Company directory、Saved 与 Dataset administration 四个聚焦入口，下一步验证 LLM 优化与最终匹配结果。

LLM 优化步骤已在浏览器完成；系统将原始中文需求回填为可编辑的 refined statement。该 statement 随后可直接用于 OpenRouter embedding 与 TiDB 余弦向量检索。

最终匹配请求已在浏览器触发，界面进入“正在向量检索并逐家公司验证”的加载状态。该阶段使用 Top-K=10，并发调用分析层以保留合适结果、剔除不符合需求的公司。

浏览器端最终 Company Match 成功完成：系统保留 10 个结果并剔除 10 个不适合候选，结果包含公司、HKSTP cluster、匹配分数、语义相似度、证据、资料缺口和必要时的验证搜索建议；“导出 CSV”控件可用。前两名结果为 Carnot Innovations Limited 与 CyanSE Smart Energy Tech Limited，匹配分数均为 95%。

外部核验采用受控模式：LLM 仅在资料存在重要事实缺口时返回短验证查询，而非自行宣称未验证的网络事实。项目预置的数据 API 助手可在后续连接合适的公开搜索数据源后执行这些查询；目前结果明确展示建议查询和未确认项。

CSV 导出已在浏览器下载历史验证成功，文件名为 `company-match-results.csv`，由 Company Match 结果页面生成。

非默认 Top-K 验证已完成：将 Top-K 改为 3 后，系统最终保留 3 个公司结果并剔除 13 个候选，页面与服务端配置一致。保留结果为 Carnot Innovations Limited、IBUILDING LIMITED 与 Carbon Exchange (Hong Kong) Limited。

双语工作区验证完成：从中文切换到英文后，侧栏导航、数据管理入口、Company Match 四个执行步骤、深度需求优化说明、输入提示、召回数量和执行按钮均同步更新；语言开关状态持久化在浏览器本地设置中。

增强 refined statement 验证完成：一段包含 AI 能源优化、IoT、数字孪生、商业楼宇、服务模式、采购证据及排除条件的长篇英文需求，被 LLM 转换为可编辑的完整语义检索 statement，并显示目标信号、核心能力、应用场景、行业与地域、证据要求、检索术语和排除条件。

分阶段流程验证完成：系统先召回 10 家语义相似公司，未自动调用分析；用户点击 Start AI analysis 后，界面显示逐条处理进度。已完成的公司在卡片中呈现保留或剔除状态、匹配分数、资料证据与需核验点，尚未处理的公司保持候选状态。

完整流程验证完成：对 10 家候选逐条分析后，系统保留 IBUILDING LIMITED（85%），剔除 9 家不适合候选；导出按钮只在分析结束并存在保留结果后出现，点击后已触发 validated-results CSV 下载。

公开数据管理验证完成：移除登录阻断后，数据管理页直接加载 1,727 家官方公司、1,727 条向量、标准化 CSV 下载和公司资料表。选择 01River Limited 后，公开批量补全成功生成可审核草案，并记录“Data enrichment / Draft”治理事件；草案保留来源与后续人工审核入口，未自动覆写官方资料。

无登录端到端回归完成：对 01River Limited 执行未修改字段的保存操作，页面显示成功提示并写入“Profile edit / Applied”审计；随后执行单条向量更新，页面记录“Vector update / Completed”。官方公司目录 CSV 已在浏览器下载历史中确认生成。

真实编辑验证完成：在无登录数据管理页将 01River Limited 的 cluster 从“Green Technology”暂时更新为“Green Technology · management test”，列表和编辑面板均立即反映变化，并写入“Profile edit / Applied”治理事件；随后已恢复为原始“Green Technology”，正式目录不保留测试标记。
